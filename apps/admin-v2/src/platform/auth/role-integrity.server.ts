import 'server-only';
import type { PoolClient } from 'pg';
import { defaultRolePermissions } from '@yah/admin-core/permissions';

const builtInRoles = Object.keys(defaultRolePermissions);
const roleKeyIndex = 'organizationRole_organizationId_role_uidx';
const roleKeyConstraint = 'yah_organization_role_key';

function sqlLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

const builtInRoleArray = `ARRAY[${builtInRoles.map(sqlLiteral).join(', ')}]`;

async function count(client: PoolClient, statement: string, values: unknown[] = []): Promise<number> {
	const result = await client.query<{ count: number }>(statement, values);
	return result.rows[0]?.count ?? 0;
}

/**
 * Better Auth stores custom roles in organizationRole and multi-role
 * assignments as comma-separated text. This startup migration adds the
 * integrity Better Auth's schema cannot express itself:
 *
 * - custom keys are canonical and unique within an organization;
 * - new assignments must name an existing built-in or custom role; and
 * - custom roles are retired by removing grants, never physically deleted.
 *
 * The bounded lock timeout makes a busy deployment fail clearly instead of
 * leaving the server apparently hung while PostgreSQL waits for DDL locks.
 */
export async function ensureOrganizationRoleIntegrity(client: PoolClient): Promise<void> {
	await client.query("SET LOCAL lock_timeout = '5s'");
	// Freeze every table participating in the denormalized role invariant before
	// auditing it. Otherwise an older instance could write between the audit and
	// trigger installation, leaving a dangling assignment that startup missed.
	await client.query(
		'LOCK TABLE public."organizationRole", public.member, public.invitation IN SHARE ROW EXCLUSIVE MODE',
	);

	const invalidKeys = await count(
		client,
		`SELECT COUNT(*)::int AS count
		 FROM public."organizationRole"
		 WHERE role <> lower(btrim(role))
		    OR role = ''
		    OR position(',' in role) > 0
		    OR char_length(role) > 128`,
	);
	if (invalidKeys > 0) {
		throw new Error('Cannot enforce organization role integrity while non-canonical role keys exist.');
	}

	const duplicates = await count(
		client,
		`SELECT COUNT(*)::int AS count
		 FROM (
			SELECT 1
			FROM public."organizationRole"
			GROUP BY "organizationId", role
			HAVING COUNT(*) > 1
		 ) duplicate_role_keys`,
	);
	if (duplicates > 0) {
		throw new Error('Cannot enforce organization role integrity while duplicate role keys exist.');
	}

	const danglingAssignments = await count(
		client,
		`WITH assigned_roles AS (
			SELECT member."organizationId", btrim(token) AS role
			FROM public.member
			CROSS JOIN LATERAL unnest(string_to_array(COALESCE(member.role, ''), ',')) AS token
			WHERE btrim(token) <> ''
			UNION ALL
			SELECT invitation."organizationId", btrim(token) AS role
			FROM public.invitation
			CROSS JOIN LATERAL unnest(string_to_array(COALESCE(invitation.role, ''), ',')) AS token
			WHERE invitation.status = 'pending' AND btrim(token) <> ''
		 )
		 SELECT COUNT(*)::int AS count
		 FROM assigned_roles assigned
		 WHERE NOT (assigned.role = ANY($1::text[]))
		   AND NOT EXISTS (
			SELECT 1
			FROM public."organizationRole" custom_role
			WHERE custom_role."organizationId" = assigned."organizationId"
			  AND custom_role.role = assigned.role
		   )`,
		[builtInRoles],
	);
	if (danglingAssignments > 0) {
		throw new Error('Cannot enforce organization role integrity while unknown role assignments exist.');
	}

	await client.query(`
		CREATE OR REPLACE FUNCTION public.yah_valid_organization_role_key(candidate text)
		RETURNS boolean
		LANGUAGE sql
		IMMUTABLE
		PARALLEL SAFE
		SET search_path = pg_catalog, public
		AS $function$
			SELECT candidate = lower(btrim(candidate))
			   AND candidate <> ''
			   AND position(',' in candidate) = 0
			   AND char_length(candidate) <= 128
		$function$;

		DO $block$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_catalog.pg_constraint
				WHERE conrelid = 'public."organizationRole"'::regclass
				  AND conname = '${roleKeyConstraint}'
			) THEN
				ALTER TABLE public."organizationRole"
				ADD CONSTRAINT "${roleKeyConstraint}"
				CHECK (public.yah_valid_organization_role_key(role));
			END IF;
		END
		$block$;

		CREATE UNIQUE INDEX IF NOT EXISTS "${roleKeyIndex}"
		ON public."organizationRole" ("organizationId", role);
	`);

	const constraint = await client.query<{ type: string; validated: boolean; definition: string }>(
		`SELECT contype AS type, convalidated AS validated, pg_get_constraintdef(oid) AS definition
		 FROM pg_catalog.pg_constraint
		 WHERE conrelid = 'public."organizationRole"'::regclass AND conname = $1`,
		[roleKeyConstraint],
	);
	const storedConstraint = constraint.rows[0];
	if (
		!storedConstraint ||
		storedConstraint.type !== 'c' ||
		!storedConstraint.validated ||
		!storedConstraint.definition.includes('yah_valid_organization_role_key')
	) {
		throw new Error(`Database object ${roleKeyConstraint} does not match the required role-key constraint.`);
	}

	const index = await client.query<{ unique: boolean; valid: boolean; columns: string[] }>(
		`SELECT target.indisunique AS unique,
		        target.indisvalid AS valid,
		        array_agg(attribute.attname ORDER BY key.ordinality)::text[] AS columns
		 FROM pg_catalog.pg_class index_class
		 JOIN pg_catalog.pg_index target ON target.indexrelid = index_class.oid
		 CROSS JOIN LATERAL unnest(target.indkey) WITH ORDINALITY AS key(attnum, ordinality)
		 JOIN pg_catalog.pg_attribute attribute
		   ON attribute.attrelid = target.indrelid AND attribute.attnum = key.attnum
		 WHERE index_class.oid = to_regclass($1)
		 GROUP BY target.indisunique, target.indisvalid`,
		[`public."${roleKeyIndex}"`],
	);
	const storedIndex = index.rows[0];
	if (
		!storedIndex ||
		!storedIndex.unique ||
		!storedIndex.valid ||
		storedIndex.columns.join(',') !== 'organizationId,role'
	) {
		throw new Error(`Database object ${roleKeyIndex} does not match the required unique role-key index.`);
	}

	await client.query(`
		CREATE OR REPLACE FUNCTION public.yah_require_known_organization_roles(target_organization_id text, assigned_roles text)
		RETURNS void
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		DECLARE
			assigned_role text;
		BEGIN
			FOR assigned_role IN
				SELECT DISTINCT btrim(value)
				FROM unnest(string_to_array(COALESCE(assigned_roles, ''), ',')) AS value
				WHERE btrim(value) <> ''
				ORDER BY btrim(value)
			LOOP
				IF assigned_role = ANY(${builtInRoleArray}) THEN
					CONTINUE;
				END IF;

				PERFORM 1
				FROM public."organizationRole"
				WHERE "organizationId" = target_organization_id AND role = assigned_role;
				IF NOT FOUND THEN
					RAISE EXCEPTION USING
						ERRCODE = '23503',
						MESSAGE = 'Unknown organization role assignment.',
						CONSTRAINT = 'yah_known_organization_role';
				END IF;
			END LOOP;
		END;
		$function$;

		CREATE OR REPLACE FUNCTION public.yah_validate_member_roles()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		BEGIN
			PERFORM public.yah_require_known_organization_roles(NEW."organizationId", NEW.role);
			RETURN NEW;
		END;
		$function$;

		CREATE OR REPLACE FUNCTION public.yah_validate_pending_invitation_roles()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		BEGIN
			IF NEW.status = 'pending' THEN
				PERFORM public.yah_require_known_organization_roles(NEW."organizationId", NEW.role);
			END IF;
			RETURN NEW;
		END;
		$function$;

		CREATE OR REPLACE FUNCTION public.yah_prevent_organization_role_delete()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		BEGIN
			IF current_database() LIKE '%\\_test' ESCAPE '\\'
			   AND current_setting('yah.allow_test_role_delete', true) = 'on' THEN
				RETURN OLD;
			END IF;
			RAISE EXCEPTION USING
				ERRCODE = '55000',
				MESSAGE = 'Custom organization roles must be retired instead of deleted.',
				CONSTRAINT = 'yah_organization_role_delete_disabled';
		END;
		$function$;

		CREATE OR REPLACE FUNCTION public.yah_prevent_organization_role_identity_update()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		BEGIN
			IF NEW.role IS DISTINCT FROM OLD.role
			   OR NEW."organizationId" IS DISTINCT FROM OLD."organizationId" THEN
				RAISE EXCEPTION USING
					ERRCODE = '55000',
					MESSAGE = 'Custom organization role identities are immutable.',
					CONSTRAINT = 'yah_organization_role_identity_immutable';
			END IF;
			RETURN NEW;
		END;
		$function$;

		CREATE OR REPLACE FUNCTION public.yah_prevent_organization_role_truncate()
		RETURNS trigger
		LANGUAGE plpgsql
		SET search_path = pg_catalog, public
		AS $function$
		BEGIN
			IF current_database() LIKE '%\\_test' ESCAPE '\\'
			   AND current_setting('yah.allow_test_role_delete', true) = 'on' THEN
				RETURN NULL;
			END IF;
			RAISE EXCEPTION USING
				ERRCODE = '55000',
				MESSAGE = 'Custom organization roles must be retired instead of truncated.',
				CONSTRAINT = 'yah_organization_role_truncate_disabled';
		END;
		$function$;

		DROP TRIGGER IF EXISTS yah_lock_member_roles ON public.member;
		DROP TRIGGER IF EXISTS yah_validate_member_roles ON public.member;
		CREATE TRIGGER yah_validate_member_roles
		BEFORE INSERT OR UPDATE OF "organizationId", role ON public.member
		FOR EACH ROW EXECUTE FUNCTION public.yah_validate_member_roles();

		DROP TRIGGER IF EXISTS yah_lock_pending_invitation_roles ON public.invitation;
		DROP TRIGGER IF EXISTS yah_validate_pending_invitation_roles ON public.invitation;
		CREATE TRIGGER yah_validate_pending_invitation_roles
		BEFORE INSERT OR UPDATE OF "organizationId", role, status ON public.invitation
		FOR EACH ROW EXECUTE FUNCTION public.yah_validate_pending_invitation_roles();

		DROP TRIGGER IF EXISTS yah_prevent_organization_role_delete ON public."organizationRole";
		CREATE TRIGGER yah_prevent_organization_role_delete
		BEFORE DELETE ON public."organizationRole"
		FOR EACH ROW EXECUTE FUNCTION public.yah_prevent_organization_role_delete();

		DROP TRIGGER IF EXISTS yah_prevent_organization_role_truncate ON public."organizationRole";
		CREATE TRIGGER yah_prevent_organization_role_truncate
		BEFORE TRUNCATE ON public."organizationRole"
		FOR EACH STATEMENT EXECUTE FUNCTION public.yah_prevent_organization_role_truncate();

		DROP TRIGGER IF EXISTS yah_prevent_organization_role_identity_update ON public."organizationRole";
		CREATE TRIGGER yah_prevent_organization_role_identity_update
		BEFORE UPDATE OF "organizationId", role ON public."organizationRole"
		FOR EACH ROW EXECUTE FUNCTION public.yah_prevent_organization_role_identity_update();

		DROP FUNCTION IF EXISTS public.yah_lock_member_roles();
		DROP FUNCTION IF EXISTS public.yah_lock_pending_invitation_roles();
		DROP FUNCTION IF EXISTS public.yah_lock_known_organization_roles(text, text);
	`);
}

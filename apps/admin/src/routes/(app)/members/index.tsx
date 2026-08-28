import { createAsync, revalidate, type RouteDefinition } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";
import { createSolidTable, getCoreRowModel, createColumnHelper } from "@tanstack/solid-table";
import { toast, toastError } from "~/lib/toast";
import {
  Badge,
  Button,
  AlertDialog,
  DataTable,
  Dialog,
  PageHeader,
  FormField,
  Input,
  MultiSelect,
} from "~/components";
import { requireSession } from "~/routes/session";
import { can } from "~/lib/can";
import { canManageMemberTarget } from "@yah/admin-core/membership-policy";
import { parseMemberRoles } from "~/lib/role-permissions";
import {
  listMembers,
  listInvitations,
  inviteMember,
  updateMemberRole,
  removeMember,
  cancelInvitation,
} from "../members.server";
import { listRoles } from "../roles.server";
import "./index.css";

export const route: RouteDefinition = {
  preload: () => {
    void listMembers();
    void listInvitations();
  },
};

type Member = { id: string; role: string; user: { name: string | null; email: string } };
type Invitation = { id: string; email: string; role: string; status: string };

function roleBadgeVariant(role: string): "default" | "success" | "error" | "warning" | "info" {
  if (role === "owner") return "info";
  if (role === "admin") return "warning";
  return "default";
}

function RoleBadges(props: { role: string }) {
  return (
    <div class="role-badges">
      <For each={parseMemberRoles(props.role)}>
        {(role) => <Badge variant={roleBadgeVariant(role)}>{role}</Badge>}
      </For>
    </div>
  );
}

export default function MembersPage() {
  const session = createAsync(() => requireSession());
  const members = createAsync(() => listMembers());
  const invitations = createAsync(() => listInvitations());
  const assignableRoles = createAsync(async () => {
    if (!can(session(), "ac", "read")) return undefined;
    return listRoles();
  });

  const currentEmail = createMemo(() => session()?.user.email);
  const canReadAccessControl = createMemo(() => can(session(), "ac", "read"));
  const canUpdate = createMemo(() => can(session(), "member", "update"));
  const canDelete = createMemo(() => can(session(), "member", "delete"));
  const canInvite = createMemo(() => can(session(), "invitation", "create"));
  const canCancelInvite = createMemo(() => can(session(), "invitation", "cancel"));

  // ─── Invite dialog ───────────────────────────────────────────────────────────

  const [inviteOpen, setInviteOpen] = createSignal(false);
  const [inviteEmail, setInviteEmail] = createSignal("");
  const [inviteRoles, setInviteRoles] = createSignal<string[]>(["member"]);
  const [invitePending, setInvitePending] = createSignal(false);
  const [roleEditor, setRoleEditor] = createSignal({
    open: false,
    memberId: "",
    name: "",
    roles: [] as string[],
  });
  const [rolePending, setRolePending] = createSignal(false);

  // ─── Confirm dialogs ─────────────────────────────────────────────────────────

  const [confirmRemove, setConfirmRemove] = createSignal<{
    open: boolean;
    memberId: string;
    name: string;
  }>({
    open: false,
    memberId: "",
    name: "",
  });
  const [confirmCancel, setConfirmCancel] = createSignal<{
    open: boolean;
    id: string;
    email: string;
  }>({
    open: false,
    id: "",
    email: "",
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  async function handleInvite(e: SubmitEvent) {
    e.preventDefault();
    setInvitePending(true);
    try {
      await inviteMember({ email: inviteEmail(), roles: inviteRoles() });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRoles(["member"]);
      toast.success("Invitation sent.");
      await revalidate("listInvitations");
    } catch (err) {
      toastError(err, "Failed to send invitation.");
    } finally {
      setInvitePending(false);
    }
  }

  async function handleRoleChange() {
    setRolePending(true);
    try {
      await updateMemberRole({ memberId: roleEditor().memberId, roles: roleEditor().roles });
      setRoleEditor((state) => ({ ...state, open: false }));
      toast.success("Roles updated.");
      await revalidate("listMembers");
    } catch (err) {
      toastError(err, "Failed to update roles.");
    } finally {
      setRolePending(false);
    }
  }

  async function handleRemove() {
    try {
      await removeMember(confirmRemove().memberId);
      toast.success("Member removed.");
      setConfirmRemove((s) => ({ ...s, open: false }));
      await revalidate("listMembers");
    } catch (err) {
      toastError(err, "Failed to remove member.");
    }
  }

  async function handleCancelInvitation() {
    try {
      await cancelInvitation(confirmCancel().id);
      toast.success("Invitation cancelled.");
      setConfirmCancel((s) => ({ ...s, open: false }));
      await revalidate("listInvitations");
    } catch (err) {
      toastError(err, "Failed to cancel invitation.");
    }
  }

  // ─── Member table ─────────────────────────────────────────────────────────────

  const standardRoleOptions = [
    { value: "admin", label: "Admin" },
    { value: "member", label: "Member" },
  ];
  const customRoleOptions = createMemo(() =>
    (assignableRoles()?.roles ?? [])
      .filter((role) => !role.builtIn)
      .map((role) => ({ value: role.role, label: role.role }))
  );
  const roleOptions = createMemo(() => [
    ...(canReadAccessControl() ? [{ value: "owner", label: "Owner" }] : []),
    ...standardRoleOptions,
    ...(canReadAccessControl() ? customRoleOptions() : []),
  ]);
  const invitationRoleOptions = createMemo(() => [
    ...standardRoleOptions,
    ...(canReadAccessControl() ? customRoleOptions() : []),
  ]);
  const roleEditorOptions = createMemo(() => {
    const options = roleOptions();
    const known = new Set(options.map((option) => option.value));
    return [
      ...options,
      ...roleEditor()
        .roles.filter((role) => !known.has(role))
        .map((role) => ({ value: role, label: `${role} (missing)` })),
    ];
  });

  const memberColumnHelper = createColumnHelper<Member>();

  const memberColumns = [
    memberColumnHelper.accessor((r) => r.user.name, {
      id: "name",
      header: "Name",
      cell: (info) => info.getValue() ?? <span class="cell-muted">—</span>,
      enableSorting: false,
    }),
    memberColumnHelper.accessor((r) => r.user.email, {
      id: "email",
      header: "Email",
      cell: (info) => <span class="cell-muted">{info.getValue()}</span>,
      enableSorting: false,
    }),
    memberColumnHelper.accessor("role", {
      header: "Role",
      cell: (info) => <RoleBadges role={info.getValue()} />,
      enableSorting: false,
    }),
    memberColumnHelper.display({
      id: "actions",
      header: "Actions",
      cell: (info) => {
        const member = info.row.original;
        const memberRoles = parseMemberRoles(member.role);
        const isSelf = member.user.email === currentEmail();
        const showRoleEditor = canManageMemberTarget({
          isSelf,
          roles: memberRoles,
          canMutate: canUpdate(),
          canReadAccessControl: canReadAccessControl(),
        });
        const showRemove = canManageMemberTarget({
          isSelf,
          roles: memberRoles,
          canMutate: canDelete(),
          canReadAccessControl: canReadAccessControl(),
        });
        return (
          <Show when={!isSelf} fallback={<span class="you-label">You</span>}>
            <Show when={showRoleEditor || showRemove}>
              <div class="actions-cell">
                <Show when={showRoleEditor}>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setRoleEditor({
                        open: true,
                        memberId: member.id,
                        name: member.user.name ?? member.user.email,
                        roles: memberRoles,
                      })
                    }
                  >
                    Edit roles
                  </Button>
                </Show>
                <Show when={showRemove}>
                  <button
                    class="remove-btn"
                    onClick={() =>
                      setConfirmRemove({
                        open: true,
                        memberId: member.id,
                        name: member.user.name ?? member.user.email,
                      })
                    }
                  >
                    Remove
                  </button>
                </Show>
              </div>
            </Show>
          </Show>
        );
      },
      enableSorting: false,
    }),
  ];

  // ─── Invitation table ─────────────────────────────────────────────────────────

  const inviteColumnHelper = createColumnHelper<Invitation>();

  const inviteColumns = [
    inviteColumnHelper.accessor("email", {
      header: "Email",
      cell: (info) => <span class="cell-muted">{info.getValue()}</span>,
      enableSorting: false,
    }),
    inviteColumnHelper.accessor("role", {
      header: "Role",
      cell: (info) => <RoleBadges role={info.getValue()} />,
      enableSorting: false,
    }),
    inviteColumnHelper.accessor("status", {
      header: "Status",
      cell: (info) => <Badge>{info.getValue()}</Badge>,
      enableSorting: false,
    }),
    inviteColumnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => {
        const inv = info.row.original;
        return (
          <Show when={inv.status === "pending" && canCancelInvite()}>
            <button
              class="remove-btn"
              onClick={() => setConfirmCancel({ open: true, id: inv.id, email: inv.email })}
            >
              Cancel
            </button>
          </Show>
        );
      },
      enableSorting: false,
    }),
  ];

  const memberTable = createSolidTable({
    get data() {
      return members() ?? [];
    },
    columns: memberColumns,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const pendingInvites = createMemo(() =>
    (invitations() ?? []).filter((i) => i.status === "pending")
  );

  const inviteTable = createSolidTable({
    get data() {
      return pendingInvites();
    },
    columns: inviteColumns,
    enableColumnFilters: false,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <PageHeader title="Members">
        <Show when={canInvite()}>
          <Button onClick={() => setInviteOpen(true)}>+ Invite Member</Button>
        </Show>
      </PageHeader>

      <section class="members-section">
        <h2>Team Members</h2>
        <DataTable table={memberTable} emptyMessage="No members yet." />
      </section>

      <section class="members-section">
        <h2>Pending Invitations</h2>
        <DataTable table={inviteTable} emptyMessage="No pending invitations." />
      </section>

      <Dialog
        open={inviteOpen()}
        onOpenChange={(open) => {
          if (!open) {
            setInviteEmail("");
            setInviteRoles(["member"]);
          }
          setInviteOpen(open);
        }}
        title="Invite Member"
        maxWidth="440px"
        footer={
          <>
            <Button variant="ghost" type="button" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="invite-form"
              disabled={invitePending() || inviteRoles().length === 0}
            >
              {invitePending() ? "Sending…" : "Send Invitation"}
            </Button>
          </>
        }
      >
        <form id="invite-form" class="form-fields" onSubmit={handleInvite}>
          <FormField label="Email" required>
            <Input
              type="email"
              placeholder="user@example.com"
              value={inviteEmail()}
              onInput={(e) => setInviteEmail(e.currentTarget.value)}
              required
            />
          </FormField>
          <FormField label="Roles" hint="Permissions from all selected roles are combined.">
            <MultiSelect
              selected={inviteRoles()}
              onChange={setInviteRoles}
              options={invitationRoleOptions()}
            />
          </FormField>
        </form>
      </Dialog>

      <Dialog
        open={roleEditor().open}
        onOpenChange={(open) => setRoleEditor((state) => ({ ...state, open }))}
        title={`Roles for ${roleEditor().name}`}
        maxWidth="440px"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setRoleEditor((state) => ({ ...state, open: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={rolePending() || roleEditor().roles.length === 0}
            >
              {rolePending() ? "Saving…" : "Save Roles"}
            </Button>
          </>
        }
      >
        <FormField label="Roles" hint="Permissions from all selected roles are combined.">
          <MultiSelect
            selected={roleEditor().roles}
            onChange={(roles) => setRoleEditor((state) => ({ ...state, roles }))}
            options={roleEditorOptions()}
          />
        </FormField>
      </Dialog>

      <AlertDialog
        open={confirmRemove().open}
        onOpenChange={(open) => setConfirmRemove((s) => ({ ...s, open }))}
        title="Remove Member"
        description={`Remove ${confirmRemove().name} from the organization? Their account and any memberships in other organizations will be preserved.`}
        confirmLabel="Yes, remove"
        onconfirm={handleRemove}
      />
      <AlertDialog
        open={confirmCancel().open}
        onOpenChange={(open) => setConfirmCancel((s) => ({ ...s, open }))}
        title="Cancel Invitation"
        description={`Cancel the invitation for ${confirmCancel().email}?`}
        confirmLabel="Yes, cancel"
        onconfirm={handleCancelInvitation}
      />
    </>
  );
}

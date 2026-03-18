#!/bin/bash
set -e

psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    -- Shlink
    DO \$\$ BEGIN CREATE ROLE shlink WITH LOGIN PASSWORD '$SHLINK_DB_PASSWORD'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
    SELECT 'CREATE DATABASE shlink OWNER shlink' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'shlink')\gexec

    -- Umami
    DO \$\$ BEGIN CREATE ROLE umami WITH LOGIN PASSWORD '$UMAMI_DB_PASSWORD'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
    SELECT 'CREATE DATABASE umami OWNER umami' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec

    -- Listmonk
    DO \$\$ BEGIN CREATE ROLE listmonk WITH LOGIN PASSWORD '$LISTMONK_DB_PASSWORD'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
    SELECT 'CREATE DATABASE listmonk OWNER listmonk' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'listmonk')\gexec

    -- YAH (Better Auth, SvelteKit)
    DO \$\$ BEGIN CREATE ROLE yah WITH LOGIN PASSWORD '$YAH_DB_PASSWORD'; EXCEPTION WHEN duplicate_object THEN NULL; END \$\$;
    SELECT 'CREATE DATABASE yah OWNER yah' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'yah')\gexec
EOSQL

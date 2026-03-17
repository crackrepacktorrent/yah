#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    -- Shlink
    CREATE USER shlink WITH PASSWORD '$SHLINK_DB_PASSWORD';
    CREATE DATABASE shlink OWNER shlink;

    -- Umami
    CREATE USER umami WITH PASSWORD '$UMAMI_DB_PASSWORD';
    CREATE DATABASE umami OWNER umami;

    -- Listmonk
    CREATE USER listmonk WITH PASSWORD '$LISTMONK_DB_PASSWORD';
    CREATE DATABASE listmonk OWNER listmonk;

    -- YAH (Better Auth, SvelteKit)
    CREATE USER yah WITH PASSWORD '$YAH_DB_PASSWORD';
    CREATE DATABASE yah OWNER yah;
EOSQL

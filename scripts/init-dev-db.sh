#!/bin/bash
set -e

psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE umami' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec
    SELECT 'CREATE DATABASE listmonk' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'listmonk')\gexec
    SELECT 'CREATE DATABASE shlink' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'shlink')\gexec
EOSQL

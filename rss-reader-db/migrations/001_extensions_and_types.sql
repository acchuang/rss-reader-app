create extension if not exists pgcrypto;
create extension if not exists citext;

create type feed_status as enum ('active', 'degraded', 'failing', 'disabled');
create type fetch_outcome as enum ('success', 'not_modified', 'parse_error', 'network_error', 'invalid_feed');
create type import_status as enum ('pending', 'processing', 'completed', 'failed');

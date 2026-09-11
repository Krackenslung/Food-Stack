-- Dedicated database user for the TJ-Hotels app.
--
-- Until now the app connected as ADMIN, which owns the whole database and
-- can drop tables or create users. If the backend were ever compromised,
-- the blast radius was the entire database. This user can only read and
-- write rows in the three application tables — nothing else.
--
-- Run this as ADMIN in the OCI console: Database actions -> SQL.
-- Replace PUT_A_STRONG_PASSWORD_HERE first (12-30 chars, upper + lower +
-- digit, no double quotes, cannot contain the username).

CREATE USER TJHOTELS_APP IDENTIFIED BY "PUT_A_STRONG_PASSWORD_HERE";

-- Just enough to open a connection. No CREATE TABLE, no CREATE USER.
GRANT CREATE SESSION TO TJHOTELS_APP;

-- Row-level access to the three tables only.
-- UPDATE is deliberately absent: the app never updates a row. The MERGE in
-- Favorite.add only has WHEN NOT MATCHED, so INSERT + SELECT covers it.
GRANT SELECT, INSERT, DELETE ON ADMIN.Users     TO TJHOTELS_APP;
GRANT SELECT, INSERT, DELETE ON ADMIN.Locations TO TJHOTELS_APP;
GRANT SELECT, INSERT, DELETE ON ADMIN.Favorites TO TJHOTELS_APP;
-- Support form: the app only files tickets, it never reads or deletes them.
GRANT INSERT ON ADMIN.SupportTickets TO TJHOTELS_APP;

-- The tables live in the ADMIN schema, but the app queries them unqualified
-- ("FROM Users"). These synonyms make that resolve without touching a single
-- line of Python.
CREATE OR REPLACE SYNONYM TJHOTELS_APP.Users     FOR ADMIN.Users;
CREATE OR REPLACE SYNONYM TJHOTELS_APP.Locations FOR ADMIN.Locations;
CREATE OR REPLACE SYNONYM TJHOTELS_APP.Favorites FOR ADMIN.Favorites;
CREATE OR REPLACE SYNONYM TJHOTELS_APP.SupportTickets FOR ADMIN.SupportTickets;

-- Check what the new user ended up with
SELECT privilege, table_name FROM dba_tab_privs WHERE grantee = 'TJHOTELS_APP' ORDER BY table_name, privilege;

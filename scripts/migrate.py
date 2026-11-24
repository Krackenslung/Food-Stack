"""Apply docs/sql migrations to a SQL Server database.

    python scripts/migrate.py --baseline --seed   # fresh DB: schema.sql + migrations + seed.sql
    python scripts/migrate.py                     # apply pending migrations only
    python scripts/migrate.py --status            # show applied / pending
    python scripts/migrate.py --database FoodStack_scratch ...   # override DATABASE

Safety: the runner refuses to run against a server that is not local unless
--i-know-this-is-not-local is passed. Production migrations are run by hand (see CLAUDE.md).
Migrations are idempotent .sql files split on GO lines and tracked in Schema_Migrations.
"""

import argparse
import os
import re
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import pyodbc  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

SQL_DIR = Path(__file__).resolve().parent.parent / "docs" / "sql"
MIGRATIONS_DIR = SQL_DIR / "migrations"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "(local)", ".", "::1"}
GO = re.compile(r"^\s*GO\s*$", re.IGNORECASE | re.MULTILINE)


def split_batches(script: str) -> list[str]:
    """Split a script on GO lines and drop empty batches."""
    return [batch.strip() for batch in GO.split(script) if batch.strip()]


def connect(database: str, *, allow_remote: bool) -> pyodbc.Connection:
    load_dotenv()
    server = os.getenv("SQL_SERVER", "")
    host = server.split(",")[0].split("\\")[0].strip().lower()
    if host not in LOCAL_HOSTS and not allow_remote:
        raise SystemExit(
            f"Refusing to run against '{server}': not a local server. "
            "Production migrations are run by hand."
        )
    driver = os.getenv("SQL_DRIVER") or "ODBC Driver 18 for SQL Server"
    trust = (
        "yes" if os.getenv("SQL_TRUST_SERVER_CERT", "").lower() in ("1", "true", "yes") else "no"
    )
    return pyodbc.connect(
        f"DRIVER={{{driver}}};SERVER={server},1433;DATABASE={database};"
        f"UID={os.getenv('SQL_USER')};PWD={os.getenv('SQL_PASSWORD')};"
        f"TrustServerCertificate={trust};Encrypt=yes;Timeout=30;",
        autocommit=True,
    )


def run_script(conn: pyodbc.Connection, script: str) -> None:
    cursor = conn.cursor()
    for batch in split_batches(script):
        cursor.execute(batch)
        while cursor.nextset():
            pass


def ensure_database(database: str, *, allow_remote: bool) -> None:
    master = connect("master", allow_remote=allow_remote)
    master.cursor().execute(f"IF DB_ID(N'{database}') IS NULL CREATE DATABASE [{database}]")
    master.close()


def ensure_tracking(conn: pyodbc.Connection) -> None:
    conn.cursor().execute(
        "IF OBJECT_ID('dbo.Schema_Migrations') IS NULL "
        "CREATE TABLE dbo.Schema_Migrations (Version NVARCHAR(100) NOT NULL PRIMARY KEY, "
        "Applied_At DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())"
    )


def applied_versions(conn: pyodbc.Connection) -> set[str]:
    rows = conn.cursor().execute("SELECT Version FROM dbo.Schema_Migrations").fetchall()
    return {row[0] for row in rows}


def migration_files() -> list[Path]:
    return sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql"))


def baseline_script() -> str:
    # schema.sql starts with CREATE DATABASE / USE FoodStack: the target DB is already selected.
    text = (SQL_DIR / "schema.sql").read_text(encoding="utf-8")
    text = re.sub(r"IF DB_ID\('FoodStack'\).*?;\s*GO", "", text, flags=re.IGNORECASE | re.DOTALL)
    return re.sub(r"USE FoodStack;\s*GO", "", text, flags=re.IGNORECASE)


def seed_script() -> str:
    return (SQL_DIR / "seed.sql").read_text(encoding="utf-8").replace("USE FoodStack;", "")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "--baseline", action="store_true", help="create the database and base schema first"
    )
    parser.add_argument(
        "--seed", action="store_true", help="run seed.sql (only fills an empty catalog)"
    )
    parser.add_argument("--status", action="store_true", help="list applied and pending migrations")
    parser.add_argument("--database", help="override the DATABASE env var")
    parser.add_argument("--i-know-this-is-not-local", dest="remote", action="store_true")
    args = parser.parse_args(argv)

    load_dotenv()
    database = args.database or os.getenv("DATABASE") or "FoodStack"

    if args.baseline and not args.status:
        ensure_database(database, allow_remote=args.remote)
    conn = connect(database, allow_remote=args.remote)
    ensure_tracking(conn)

    if args.baseline and not args.status:
        run_script(conn, baseline_script())
        print(f"baseline schema applied to {database}")

    done = applied_versions(conn)
    files = migration_files()

    if args.status:
        for path in files:
            print(f"{'applied' if path.stem in done else 'pending':8} {path.name}")
        return 0

    for path in files:
        if path.stem in done:
            continue
        print(f"applying {path.name} ...")
        run_script(conn, path.read_text(encoding="utf-8"))
        conn.cursor().execute("INSERT INTO dbo.Schema_Migrations (Version) VALUES (?)", path.stem)
    print("migrations up to date")

    if args.seed:
        run_script(conn, seed_script())
        print("seed applied (skipped when Products already has rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

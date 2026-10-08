import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()


class SQLServerConnection:
    @staticmethod
    def get_connection():
        server = os.getenv("SQL_SERVER")
        database = os.getenv("DATABASE")
        username = os.getenv("SQL_USER")
        password = os.getenv("SQL_PASSWORD")
        # Set SQL_TRUST_SERVER_CERT=yes for a local SQL Server (self-signed cert).
        trust_cert = "yes" if os.getenv("SQL_TRUST_SERVER_CERT", "").lower() in ("1", "true", "yes") else "no"

        missing = []
        if not server:
            missing.append("SQL_SERVER")
        if not database:
            missing.append("DATABASE")
        if not username:
            missing.append("SQL_USER")
        if not password:
            missing.append("SQL_PASSWORD")

        if missing:
            raise RuntimeError(
                f"Missing SQL configuration variable(s): {', '.join(missing)}."
            )

        connectionString = (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={server},1433;"
            f"DATABASE={database};"
            f"UID={username};"
            f"PWD={password};"
            f"TrustServerCertificate={trust_cert};"
            "Encrypt=yes;"
            "Timeout=30;"
        )

        try:
            connection = pyodbc.connect(connectionString)
        except Exception as ex:
            raise ConnectionError(
                f"Could not connect to SQL server: {str(ex)}"
            ) from ex

        return connection

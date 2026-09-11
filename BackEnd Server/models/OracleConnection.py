import os
import oracledb
import config


# Clear error when the DB is unreachable or misconfigured
class DatabaseConnectionError(Exception):
    pass


class OracleConnection:
    """Connections to Oracle Autonomous Database.

    The instance requires mTLS: without the wallet it will not connect even
    with the right user and password. oracledb runs in thin mode, so no
    Instant Client is needed.
    """

    @staticmethod
    def get_connection():
        # Read configuration (config.py loads .env once)
        user = config.ORACLE_USER
        password = config.ORACLE_PASSWORD
        dsn = config.ORACLE_DSN
        wallet_dir = config.ORACLE_WALLET_DIR
        wallet_password = config.ORACLE_WALLET_PASSWORD

        # check parameters
        missing = [name for name, value in (
            ("ORACLE_USER", user),
            ("ORACLE_PASSWORD", password),
            ("ORACLE_DSN", dsn),
            ("ORACLE_WALLET_DIR", wallet_dir),
            ("ORACLE_WALLET_PASSWORD", wallet_password),
        ) if not value]
        if missing:
            raise DatabaseConnectionError(
                f"Configuration error: {', '.join(missing)} not found in .ENV File."
            )

        # Clear message instead of the driver's cryptic error
        if not os.path.isdir(wallet_dir):
            raise DatabaseConnectionError(
                f"Wallet directory not found: {wallet_dir}. "
                "Download it from the OCI console (Database connection -> "
                "Download wallet) and unzip it there."
            )

        try:
            connection = oracledb.connect(
                user=user,
                password=password,
                dsn=dsn,
                config_dir=wallet_dir,
                wallet_location=wallet_dir,
                wallet_password=wallet_password,
            )
        except Exception as ex:
            raise DatabaseConnectionError(
                "Could not connect to Oracle Autonomous Database: " + str(ex)
            )

        return connection

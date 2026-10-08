import os
import pyodbc
from dotenv import load_dotenv

#Read env data
load_dotenv()

class SQLServerConnection:
    @staticmethod
    def get_connection():
        # Read enviroment variables
        server = os.getenv("SQL_SERVER")
        database = os.getenv("SQL_DATABASE")
        user = os.getenv("SQL_USER")
        password = os.getenv("SQL_PASSWORD")
        #check parameters
        if not server:
            print("Configuration error: SQL_SERVER not found in .ENV File.")
        if not database:
            print("Configuration error: SQL_DATABASE not found in .ENV File.")
        if not user:
            print("Configuration error: SQL_USER not found in .ENV File.")
        if not password:
            print("Configuration error: SQL_PASSWORD not found in .ENV File.")
        # Connection string 
        connectionString = (
            "DRIVER={ODBC Driver 18 for SQL Server};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            "Encrypt=yes;"
            "TrustServerCertificate=yes;"
        )

        try: 
            # Try connection 
            connection = pyodbc.connect(connectionString)
            # set utf-8 encoding/decoding
            connection.setencoding(encoding='utf-8')
            connection.setdecoding(pyodbc.SQL_CHAR, encoding='utf-8')
            connection.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-8')
        except Exception as ex:
            print("Could not connect to SQL Server")
            print(str(ex))
            return None

        # return
        return connection
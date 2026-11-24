import os

from backend.app_factory import create_app
from backend.config import load_config
from backend.Services.container import build_sql_services

config = load_config()

# The SQL-backed checkout/payments/auth/admin API needs migrations 008+ applied to the database.
# It is opt-in (USE_SQL_SERVICES=1) so a deploy never switches it on before the migrations ran.
services = build_sql_services(config) if os.getenv("USE_SQL_SERVICES") == "1" else None
app = create_app(config, services=services)

if __name__ == "__main__":
    app.run(debug=True)

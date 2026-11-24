"""Environment-driven configuration, validated once at startup."""

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from dotenv import load_dotenv

load_dotenv()

REQUIRED_IN_PRODUCTION = (
    "SQL_SERVER",
    "DATABASE",
    "SQL_USER",
    "SQL_PASSWORD",
    "JWT_SECRET_KEY",
    "FLASK_SECRET_KEY",
)


class ConfigError(RuntimeError):
    """Raised at startup when the environment is incomplete or malformed."""


def _decimal(env, name, default):
    raw = env.get(name)
    if raw is None or str(raw).strip() == "":
        return Decimal(default)
    try:
        value = Decimal(str(raw).strip())
    except InvalidOperation as exc:
        raise ConfigError(f"{name} must be a number, got {raw!r}.") from exc
    if value < 0:
        raise ConfigError(f"{name} must not be negative, got {raw!r}.")
    return value


def _text(env, name, default=""):
    return (env.get(name) or default).strip()


@dataclass(frozen=True)
class Config:
    app_env: str
    flask_secret_key: str
    frontend_origin: str
    # Business rules (see CLAUDE.md "Business rules"); override through env.
    tax_rate: Decimal
    service_fee: Decimal
    delivery_fee: Decimal
    currency: str
    store_name: str
    store_address: str
    store_timezone: str
    store_hours: str

    @property
    def is_production(self):
        return self.app_env == "production"


def load_config(env=None):
    """Build a Config from ``env`` (defaults to os.environ), failing fast on problems."""
    env = os.environ if env is None else env

    app_env = _text(env, "APP_ENV", "development").lower()
    if app_env not in ("development", "production"):
        raise ConfigError(f"APP_ENV must be development or production, got {app_env!r}.")

    if app_env == "production":
        missing = [name for name in REQUIRED_IN_PRODUCTION if not _text(env, name)]
        if missing:
            raise ConfigError(
                "Missing required environment variable(s) for production: " + ", ".join(missing)
            )

    tax_rate = _decimal(env, "TAX_RATE", "0.08")
    if tax_rate > 1:
        raise ConfigError("TAX_RATE is a fraction (0.08 = 8%), got a value above 1.")

    return Config(
        app_env=app_env,
        flask_secret_key=_text(env, "FLASK_SECRET_KEY", "dev-secret-key"),
        frontend_origin=_text(env, "FRONTEND_ORIGIN").rstrip("/"),
        tax_rate=tax_rate,
        service_fee=_decimal(env, "SERVICE_FEE", "1.50"),
        delivery_fee=_decimal(env, "DELIVERY_FEE", "2.99"),
        currency=_text(env, "CURRENCY", _text(env, "STRIPE_CURRENCY", "usd")).upper(),
        store_name=_text(env, "STORE_NAME", "FoodStack"),
        store_address=_text(env, "STORE_ADDRESS"),
        store_timezone=_text(env, "STORE_TIMEZONE", "America/Tijuana"),
        store_hours=_text(env, "STORE_HOURS", "mon-sun 11:00-23:00"),
    )

from decimal import Decimal

import pytest

from backend.config import ConfigError, load_config

PRODUCTION_ENV = {
    "APP_ENV": "production",
    "SQL_SERVER": "s",
    "DATABASE": "d",
    "SQL_USER": "u",
    "SQL_PASSWORD": "p",
    "JWT_SECRET_KEY": "j",
    "FLASK_SECRET_KEY": "f",
}


def test_defaults_match_the_design_numbers():
    config = load_config({})
    assert config.app_env == "development"
    assert config.tax_rate == Decimal("0.08")
    assert config.service_fee == Decimal("1.50")
    assert config.delivery_fee == Decimal("2.99")
    assert not config.is_production


def test_env_overrides_business_values():
    config = load_config({"TAX_RATE": "0.10", "SERVICE_FEE": "2", "STRIPE_CURRENCY": "mxn"})
    assert config.tax_rate == Decimal("0.10")
    assert config.service_fee == Decimal("2")
    assert config.currency == "MXN"


def test_production_requires_secrets_and_database():
    with pytest.raises(ConfigError) as excinfo:
        load_config({"APP_ENV": "production"})
    message = str(excinfo.value)
    assert "JWT_SECRET_KEY" in message
    assert "SQL_SERVER" in message


def test_production_with_everything_set_is_valid():
    assert load_config(PRODUCTION_ENV).is_production


@pytest.mark.parametrize(
    "env",
    [
        {"APP_ENV": "staging"},
        {"TAX_RATE": "abc"},
        {"TAX_RATE": "8"},
        {"SERVICE_FEE": "-1"},
    ],
)
def test_malformed_values_fail_fast(env):
    with pytest.raises(ConfigError):
        load_config(env)

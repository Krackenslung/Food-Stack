from datetime import UTC, datetime

import pytest

from backend.config import ConfigError, load_config
from backend.store_hours import HoursError, parse_hours

# Tijuana is UTC-7 in June (PDT) and UTC-8 in January (PST).
SUMMER = lambda hour, minute=0, day=1: datetime(2026, 6, day, hour, minute, tzinfo=UTC)  # noqa: E731


def test_default_hours_open_at_11_and_close_at_23_local_time():
    hours = parse_hours("mon-sun 11:00-23:00", "America/Tijuana")
    assert not hours.is_open(SUMMER(17, 59))  # 10:59 local
    assert hours.is_open(SUMMER(18, 0))  # 11:00 local
    assert hours.is_open(SUMMER(5, 59, day=2))  # 22:59 local
    assert not hours.is_open(SUMMER(6, 0, day=2))  # 23:00 local: closed


def test_days_can_be_ranges_or_lists():
    weekdays = parse_hours("mon-fri 09:00-17:00", "UTC")
    assert weekdays.is_open(datetime(2026, 6, 1, 10, tzinfo=UTC))  # Monday
    assert not weekdays.is_open(datetime(2026, 6, 6, 10, tzinfo=UTC))  # Saturday
    weekend = parse_hours("sat,sun 10:00-14:00", "UTC")
    assert weekend.is_open(datetime(2026, 6, 6, 10, tzinfo=UTC))
    wrapped = parse_hours("fri-mon 10:00-14:00", "UTC")
    assert wrapped.is_open(datetime(2026, 6, 6, 10, tzinfo=UTC))  # Saturday is in fri-mon
    assert not wrapped.is_open(datetime(2026, 6, 3, 10, tzinfo=UTC))  # Wednesday is not


def test_the_next_opening_skips_closed_days():
    hours = parse_hours("mon-fri 09:00-17:00", "UTC")
    saturday = datetime(2026, 6, 6, 12, tzinfo=UTC)
    assert hours.opens_at(saturday) == datetime(2026, 6, 8, 9, tzinfo=UTC)


@pytest.mark.parametrize(
    ("spec", "zone"),
    [
        ("11:00-23:00", "UTC"),  # no days
        ("mon-sun 25:00-26:00", "UTC"),
        ("mon-sun 23:00-11:00", "UTC"),  # overnight windows are unsupported
        ("funday 11:00-12:00", "UTC"),
        ("mon-sun 11:00-23:00", "Mars/Olympus"),
    ],
)
def test_malformed_hours_are_rejected(spec, zone):
    with pytest.raises(HoursError):
        parse_hours(spec, zone)


def test_bad_hours_fail_at_startup_and_stripe_needs_both_keys():
    with pytest.raises(ConfigError):
        load_config({"STORE_HOURS": "whenever"})
    with pytest.raises(ConfigError):
        load_config({"STRIPE_SECRET_KEY": "sk_test_x"})
    assert not load_config({}).payments_enabled
    assert load_config(
        {"STRIPE_SECRET_KEY": "sk_test_x", "STRIPE_WEBHOOK_SECRET": "whsec_x"}
    ).payments_enabled

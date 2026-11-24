"""Opening-hours rules driven by STORE_HOURS / STORE_TIMEZONE (e.g. "mon-sun 11:00-23:00")."""

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


class HoursError(ValueError):
    """STORE_HOURS / STORE_TIMEZONE is malformed."""


@dataclass(frozen=True)
class StoreHours:
    days: frozenset[int]  # 0 = Monday
    opens: time
    closes: time
    tz: ZoneInfo

    def is_open(self, moment: datetime) -> bool:
        local = moment.astimezone(self.tz)
        return local.weekday() in self.days and self.opens <= local.time() < self.closes

    def opens_at(self, moment: datetime) -> datetime:
        """Next opening time at or after ``moment`` (local to the store)."""
        local = moment.astimezone(self.tz)
        for offset in range(0, 8):
            day = (local + timedelta(days=offset)).date()
            candidate = datetime.combine(day, self.opens, tzinfo=self.tz)
            if day.weekday() in self.days and candidate >= local:
                return candidate
        return local


def _day_index(token: str) -> int:
    try:
        return DAYS.index(token.strip().lower()[:3])
    except ValueError as exc:
        raise HoursError(f"Unknown day {token!r} in STORE_HOURS.") from exc


def _parse_days(spec: str) -> frozenset[int]:
    if "-" in spec:
        start, end = (_day_index(part) for part in spec.split("-", 1))
        span = range(start, end + 1) if start <= end else [*range(start, 7), *range(0, end + 1)]
        return frozenset(span)
    return frozenset(_day_index(part) for part in spec.split(","))


def _parse_time(text: str) -> time:
    try:
        hours, minutes = text.strip().split(":")
        return time(int(hours), int(minutes))
    except ValueError as exc:
        raise HoursError(f"Invalid time {text!r} in STORE_HOURS.") from exc


def parse_hours(spec: str, timezone: str) -> StoreHours:
    """Parse ``"mon-sun 11:00-23:00"`` (days, then one open-close window)."""
    try:
        days_part, window = spec.strip().split(None, 1)
        opens, closes = window.split("-", 1)
    except ValueError as exc:
        raise HoursError(
            f"STORE_HOURS must look like 'mon-sun 11:00-23:00', got {spec!r}."
        ) from exc
    try:
        tz = ZoneInfo(timezone)
    except Exception as exc:  # ZoneInfoNotFoundError, ValueError
        raise HoursError(f"Unknown STORE_TIMEZONE {timezone!r}.") from exc

    hours = StoreHours(_parse_days(days_part), _parse_time(opens), _parse_time(closes), tz)
    if hours.opens >= hours.closes:
        raise HoursError(
            "STORE_HOURS must open before it closes (overnight windows are unsupported)."
        )
    return hours

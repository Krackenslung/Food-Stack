"""Password sign-up / sign-in and the signed-in user's own profile.

Roles never come from the request: sign-up always creates a ``customer``. Google-only accounts
have no password hash and can never sign in with a password.
"""

import re
from collections.abc import Callable

import bcrypt

from backend.errors import AppError, ConflictError, RecordNotFoundException, ValidationError
from backend.Security.Auth import generate_token

EMAIL = re.compile(r"^\S+@\S+\.\S+$")
MIN_PASSWORD = 8
LANGS = ("en", "es")
THEMES = ("light", "dark", "system")
# A real hash to compare against when the email is unknown, so timing doesn't reveal accounts.
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt())


class AccountService:
    def __init__(self, users, issue_token: Callable[[int, str], str] = generate_token):
        self._users = users
        self._issue_token = issue_token

    def login(self, email, password) -> dict:
        email = str(email or "").strip().lower()
        password = str(password or "")
        record = self._users.find_credentials(email) if email else None
        stored = (record or {}).get("password_hash")
        valid = bcrypt.checkpw(
            password.encode("utf-8"), (stored or _DUMMY_HASH.decode()).encode("utf-8")
        )
        if record is None or not stored or not valid:
            raise AppError(
                "Incorrect email or password.", error_code="INVALID_CREDENTIALS", http_status=401
            )
        if record["status"] != 1:
            raise AppError(
                "This account is disabled.", error_code="ACCOUNT_DISABLED", http_status=403
            )
        self._users.touch_login(record["id"])
        return self._session(record)

    def signup(self, body: dict) -> dict:
        name = str(body.get("name") or "").strip()
        lastname = str(body.get("lastname") or "").strip()
        phone = str(body.get("phoneNumber") or "").strip()
        email = str(body.get("email") or "").strip().lower()
        password = str(body.get("password") or "")
        if not name or not lastname or not EMAIL.match(email):
            raise ValidationError(
                "Name and a valid email are required.", error_code="SIGNUP_INVALID"
            )
        if len(password) < MIN_PASSWORD:
            raise ValidationError("The password is too short.", error_code="PASSWORD_TOO_SHORT")
        if self._users.find_by_email(email) is not None:
            raise ConflictError("That email is already registered.", error_code="EMAIL_TAKEN")
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        user_id = self._users.create_password_user(
            name=name, lastname=lastname, phone=phone or None, email=email, password_hash=hashed
        )
        return self._session(self._users.get_profile(user_id))

    def me(self, user_id: int) -> dict:
        profile = self._users.get_profile(user_id)
        if profile is None or profile["status"] != 1:
            raise AppError("Please log in.", error_code="UNAUTHENTICATED", http_status=401)
        return {"user": self.public(profile)}

    def update_me(self, user_id: int, body: dict) -> dict:
        changes = {}
        for key, column in (("name", "name"), ("phone", "phone_number")):
            if key in body:
                changes[column] = str(body[key] or "").strip()
        if "name" in changes and not changes["name"]:
            raise ValidationError("Name is required.", error_code="SIGNUP_INVALID")
        if "preferredLanguage" in body:
            if body["preferredLanguage"] not in LANGS:
                raise ValidationError("Unknown language.", error_code="VALIDATION_ERROR")
            changes["preferred_language"] = body["preferredLanguage"]
        if "preferredTheme" in body:
            if body["preferredTheme"] not in THEMES:
                raise ValidationError("Unknown theme.", error_code="VALIDATION_ERROR")
            changes["preferred_theme"] = body["preferredTheme"]
        if changes:
            self._users.update_profile(user_id, changes)
        profile = self._users.get_profile(user_id)
        if profile is None:
            raise RecordNotFoundException("User not found.")
        return {"user": self.public(profile)}

    def _session(self, profile: dict) -> dict:
        return {
            "user": self.public(profile),
            "token": self._issue_token(profile["id"], profile["role"]),
        }

    @staticmethod
    def public(profile: dict) -> dict:
        return {
            "id": profile["id"],
            "name": profile["name"],
            "lastname": profile["lastname"],
            "email": profile["email"],
            "role": profile["role"],
            "preferredLanguage": profile.get("preferred_language", "en"),
            "preferredTheme": profile.get("preferred_theme", "system"),
        }

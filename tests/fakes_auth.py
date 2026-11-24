"""Fakes for Google sign-in: a verifier that maps fake tokens to claims, and in-memory users."""

from backend.errors import AppError
from backend.Services.ports import UserRecord


class FakeGoogle:
    """Unknown tokens are rejected like a bad signature."""

    def __init__(self, tokens=None):
        self.tokens = tokens or {}

    def verify(self, id_token):
        if id_token not in self.tokens:
            raise AppError(
                "Invalid Google token.", error_code="INVALID_GOOGLE_TOKEN", http_status=401
            )
        return self.tokens[id_token]


def claims(sub="g-1", email="ana@example.com", verified=True, **extra):
    return {"sub": sub, "email": email, "email_verified": verified, **extra}


class MemoryUsers:
    """Implements UserRepository."""

    def __init__(self):
        self.users: dict[int, UserRecord] = {}
        self.logins: list[int] = []

    def add(self, **fields):
        user = UserRecord(id=len(self.users) + 1, **fields)
        self.users[user.id] = user
        return user

    def find_by_google_sub(self, google_sub):
        return next((u for u in self.users.values() if u.google_sub == google_sub), None)

    def find_by_email(self, email):
        return next((u for u in self.users.values() if u.email == email), None)

    def create_google_user(self, *, email, name, lastname, google_sub, avatar_url):
        return self.add(
            name=name,
            lastname=lastname,
            email=email,
            role="customer",
            google_sub=google_sub,
            auth_provider="google",
        )

    def link_google(self, user_id, *, google_sub, avatar_url):
        user = self.users[user_id]
        user.google_sub = google_sub
        return user

    def touch_login(self, user_id):
        self.logins.append(user_id)

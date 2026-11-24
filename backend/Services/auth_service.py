"""Google login. Roles come only from our database: a Google account can never be granted
staff or admin, and nothing in the token (or the request) can change a user's role."""

from collections.abc import Callable

from backend.errors import AppError, ConflictError
from backend.Security.Auth import generate_token
from backend.Services.ports import GoogleVerifier, UserRecord, UserRepository


def _split_name(claims: dict, email: str) -> tuple[str, str]:
    first = str(claims.get("given_name") or "").strip()
    last = str(claims.get("family_name") or "").strip()
    if not first:
        parts = str(claims.get("name") or "").split()
        first = parts[0] if parts else email.split("@")[0]
        last = last or " ".join(parts[1:])
    return first, last


class AuthService:
    def __init__(
        self,
        verifier: GoogleVerifier,
        users: UserRepository,
        issue_token: Callable[[int, str], str] = generate_token,
    ):
        self._verifier = verifier
        self._users = users
        self._issue_token = issue_token

    def login_with_google(self, id_token: str) -> dict:
        claims = self._verifier.verify(id_token)

        # Google marks unverified addresses; linking or creating on one would allow takeover.
        if str(claims.get("email_verified")).lower() != "true":
            raise AppError(
                "Your Google email is not verified.",
                error_code="EMAIL_NOT_VERIFIED",
                http_status=401,
            )

        google_sub = str(claims["sub"])
        email = str(claims["email"]).strip().lower()
        avatar = claims.get("picture")

        user = self._users.find_by_google_sub(google_sub)
        if user is None:
            existing = self._users.find_by_email(email)
            if existing is not None:
                if existing.google_sub and existing.google_sub != google_sub:
                    raise ConflictError(
                        "That email is already linked to another Google account.",
                        error_code="ACCOUNT_LINKED_ELSEWHERE",
                    )
                # Same verified email: link the Google identity to the existing account.
                user = self._users.link_google(
                    existing.id, google_sub=google_sub, avatar_url=avatar
                )
            else:
                first, last = _split_name(claims, email)
                user = self._users.create_google_user(
                    email=email,
                    name=first,
                    lastname=last,
                    google_sub=google_sub,
                    avatar_url=avatar,
                )

        if user.status != 1:
            raise AppError(
                "This account is disabled.", error_code="ACCOUNT_DISABLED", http_status=403
            )

        self._users.touch_login(user.id)
        return {"user": _public(user), "token": self._issue_token(user.id, user.role)}


def _public(user: UserRecord) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "lastname": user.lastname,
        "email": user.email,
        "role": user.role,
    }

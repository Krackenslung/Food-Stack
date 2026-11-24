"""Google Sign-In: verifies the ID token that Google Identity Services hands the browser."""

from backend.errors import AppError


class GoogleTokenVerifier:
    """Implements GoogleVerifier with google-auth. ``verify_fn`` is injectable for tests."""

    def __init__(self, client_id: str, verify_fn=None, request=None):
        self._client_id = client_id
        self._verify_fn = verify_fn
        self._request = request

    def verify(self, id_token: str) -> dict:
        from google.auth.exceptions import GoogleAuthError

        verify_fn, request = self._verify_fn, self._request
        if verify_fn is None:
            from google.auth.transport import requests
            from google.oauth2 import id_token as google_id_token

            verify_fn = google_id_token.verify_oauth2_token
            request = request or requests.Request()

        try:
            # Checks signature, expiry, issuer (accounts.google.com) and audience (our client id).
            claims = verify_fn(id_token, request, self._client_id)
        except ValueError as exc:
            raise AppError(
                "Invalid Google token.", error_code="INVALID_GOOGLE_TOKEN", http_status=401
            ) from exc
        except GoogleAuthError as exc:
            raise AppError(
                "Google could not be reached.", error_code="GOOGLE_UNAVAILABLE", http_status=502
            ) from exc

        if not claims.get("sub") or not claims.get("email"):
            raise AppError(
                "Invalid Google token.", error_code="INVALID_GOOGLE_TOKEN", http_status=401
            )
        return claims

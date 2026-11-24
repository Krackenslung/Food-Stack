"""Shared exceptions. Global handlers in app_factory map them to HTTP responses."""


class RecordNotFoundException(Exception):
    """A requested row does not exist (or is soft-deleted). Maps to 404."""


class AppError(Exception):
    """Base for expected, client-facing errors."""

    http_status = 400
    error_code = "BAD_REQUEST"

    def __init__(self, message=None, *, error_code=None, http_status=None):
        super().__init__(message or self.error_code)
        if error_code:
            self.error_code = error_code
        if http_status:
            self.http_status = http_status


class ValidationError(AppError):
    http_status = 422
    error_code = "VALIDATION_ERROR"


class ConflictError(AppError):
    http_status = 409
    error_code = "CONFLICT"

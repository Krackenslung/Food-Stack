# JSON envelope helpers + shared route error handling.
# Every endpoint keeps the { status, data | message | errorMessage } shape.
from functools import wraps
from flask import jsonify

from models.User import RecordNotFoundError
from models.Location import RecordNotFoundException
from models.Favorite import RecordNotFoundException as FavoriteNotFoundException
from models.SupportTicket import RecordNotFoundException as TicketNotFoundException


# Success envelope
def ok(payload=None, message=None):
    body = {"status": 0}
    if payload is not None:
        body["data"] = payload
    if message is not None:
        body["message"] = message
    return jsonify(body)


# Error envelope
def fail(error_message, http_code=None, status=1):
    response = jsonify({
        "status": status,
        "errorMessage": error_message
    })
    return (response, http_code) if http_code else response


# Wraps a route so controllers don't repeat try/except blocks:
# record-not-found -> 404, anything else -> 500, always the envelope.
def handle_errors(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except (RecordNotFoundError, RecordNotFoundException,
                FavoriteNotFoundException, TicketNotFoundException) as e:
            return fail(str(e), 404)
        except Exception as e:
            return fail(str(e), 500)
    return wrapper

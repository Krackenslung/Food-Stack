from flask import Blueprint, request
import re
from models.SupportTicket import SupportTicket
from security.auth import decode_token
from utils import ok, fail, handle_errors

# Exported to server.py
support_bp = Blueprint('support_bp', __name__)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# Same limits the form enforces client-side. Repeated here because browser
# validation is a convenience, not a control: anyone can POST directly.
MIN_NAME = 2
MIN_MESSAGE = 10
MAX_MESSAGE = 2000
TOPICS = ("General", "Bookings", "Account", "Other")


# The form is public on purpose: someone who cannot sign in still needs a way
# to ask for help. If a valid cookie happens to be present we attach the user
# id, so a ticket from a signed-in user can be traced back to the account.
def _optional_user_id():
    token = request.cookies.get("auth_token")
    if not token:
        return None
    try:
        return decode_token(token).get("user_id")
    except Exception:
        return None


# ===== POST /support =====
@support_bp.route('/support', methods=['POST'])
@handle_errors
def create_ticket():
    data = request.get_json(silent=True) or {}

    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    topic = (data.get('topic') or 'General').strip()
    message = (data.get('message') or '').strip()

    if len(name) < MIN_NAME:
        return fail(f"Name must be at least {MIN_NAME} characters", 400)
    if not EMAIL_RE.match(email):
        return fail("A valid email is required", 400)
    if len(message) < MIN_MESSAGE:
        return fail(f"Message must be at least {MIN_MESSAGE} characters", 400)
    if len(message) > MAX_MESSAGE:
        return fail(f"Message must be at most {MAX_MESSAGE} characters", 400)
    if topic not in TOPICS:
        topic = "Other"

    t = SupportTicket([])
    t.name = name
    t.email = email
    t.topic = topic
    t.message = message
    t.userId = _optional_user_id()
    t.add()

    return ok(message="Support ticket received.")

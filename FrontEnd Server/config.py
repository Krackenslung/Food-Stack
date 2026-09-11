import os
from dotenv import load_dotenv

# Read env data once for the whole frontend (server.py imports from here)
load_dotenv()

# ===== Google Maps =====
# Browser key for the Maps JS API, injected into app.html by server.py.
# A Maps JS key is always visible client-side; the real protection is an
# HTTP referrer restriction in Google Cloud Console.
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# ===== Backend =====
# Locally the backend lives on another port; behind a proxy it is served
# under /api on the same domain, so the SameSite=Strict cookie still works.
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:5010")

// ========================================
// Shared frontend configuration
// ========================================

// Backend URL, injected in <meta name="api-base">.
// :5010 locally, /api in production (same domain).
function readApiBase() {
  const meta = document.querySelector('meta[name="api-base"]');
  return (meta?.content || "").trim() || "http://127.0.0.1:5010";
}

export const API_BASE = readApiBase();

// Google Maps JS API key.
// Injected by the server from .env, so it never lives in the repo.
// NOTE: always visible in the browser; restrict it by referrer
// in Google Cloud Console.
function readMapsApiKey() {
  const meta = document.querySelector('meta[name="google-maps-api-key"]');
  const key = (meta?.content || "").trim();

  if (!key) {
    console.warn(
      "[config] Falta la Google Maps API key: define GOOGLE_MAPS_API_KEY en FrontEnd Server/.env"
    );
  }

  return key;
}

export const API_KEY = readMapsApiKey();

// Default center (Tijuana)
export const DEFAULT_CENTER = { lat: 32.5149, lng: -117.0382 };

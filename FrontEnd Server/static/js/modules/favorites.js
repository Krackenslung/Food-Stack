// ================= FAVORITOS =================
// Per-account favorites, stored in the backend (Favorites table).
// Kept in an in-memory cache so getFavs() stays synchronous.

import { API_BASE } from "./config.js";

let favs = new Set();

// Old browser storage key (see migrateLegacyFavorites)
const LEGACY_KEY = "tj_favs";

// ========================================
// Current favorites (in-memory cache)
// ========================================
// Synchronous on purpose: renders call it. Returns a copy.
export function getFavs() {
  return new Set(favs);
}

// ========================================
// One-time migration from the old storage
// ========================================
// Uploads whatever is left in localStorage and drops the key.
// On failure it keeps the key: it retries on the next load.
async function migrateLegacyFavorites() {
  let legacy = [];

  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
  } catch {
    legacy = [];
  }

  if (!Array.isArray(legacy) || legacy.length === 0) {
    localStorage.removeItem(LEGACY_KEY);
    return false;
  }

  for (const placeId of legacy) {
    try {
      const res = await fetch(`${API_BASE}/favorites`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });

      if (!res.ok) return false;
    } catch (err) {
      console.warn("Could not migrate favorite", placeId, err);
      return false;
    }
  }

  localStorage.removeItem(LEGACY_KEY);
  console.log(`Favorites migrated to your account: ${legacy.length}`);
  return true;
}

// ========================================
// Fetch the account favorites from the backend
// ========================================
// Without a session (401) the cache stays empty
export async function syncFavorites() {
  try {
    let res = await fetch(`${API_BASE}/favorites`, {
      credentials: "include",
    });

    if (!res.ok) {
      favs = new Set();
      return getFavs();
    }

    // With a valid session: upload whatever the browser still has
    if (await migrateLegacyFavorites()) {
      res = await fetch(`${API_BASE}/favorites`, { credentials: "include" });
    }

    const data = await res.json();
    favs = new Set((data.data || []).map((f) => f.placeId));
  } catch (err) {
    console.warn("Could not load favorites:", err);
    favs = new Set();
  }

  return getFavs();
}

// ========================================
// Empty the local cache (on sign out)
// ========================================
export function clearFavorites() {
  favs = new Set();
}

// ========================================
// Toggle a place's favorite state (Places API - string place_id)
// ========================================
// Optimistic: updates the cache first and reverts if the backend fails
export async function toggleFavorite(placeId) {
  const wasFav = favs.has(placeId);

  if (wasFav) {
    favs.delete(placeId);
  } else {
    favs.add(placeId);
  }

  try {
    const res = wasFav
      ? await fetch(`${API_BASE}/favorites/${encodeURIComponent(placeId)}`, {
          method: "DELETE",
          credentials: "include",
        })
      : await fetch(`${API_BASE}/favorites`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId }),
        });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(
        res.status === 401
          ? "Sign in to save favorites"
          : data.errorMessage || "Could not save the favorite"
      );
    }
  } catch (err) {
    // Revert the optimistic change
    if (wasFav) {
      favs.add(placeId);
    } else {
      favs.delete(placeId);
    }
    throw err;
  }

  return favs.has(placeId);
}

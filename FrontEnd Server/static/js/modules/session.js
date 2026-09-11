// ================= AUTH / SESSION =================
// Source of truth is the httpOnly "auth_token" cookie (backend).
// sessionStorage("tj_user") is just a cache to paint the UI fast;
// it is validated against GET /me on every load.

import { API_BASE } from "./config.js";
import { clearFavorites } from "./favorites.js";

// ========================================
// Current user session (cache)
// ========================================
export function getSession() {
  const userStr = sessionStorage.getItem("tj_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// ========================================
// Store the user session (cache)
// ========================================
export function setSession(user) {
  sessionStorage.setItem("tj_user", JSON.stringify(user));
}

// ========================================
// Clear the user session
// ========================================
export function clearSession() {
  sessionStorage.removeItem("tj_user");
}

// ========================================
// Hydrate the session from the backend (GET /me).
// Valid cookie refreshes the cache; otherwise it clears it.
// ========================================
export async function hydrateSession() {
  try {
    const res = await fetch(`${API_BASE}/me`, { credentials: "include" });
    const data = await res.json();
    if (res.ok && data.status === 0) {
      setSession(data.data);
      return data.data;
    }
    clearSession();
    return null;
  } catch (err) {
    // Backend down: keep the local cache as best effort
    console.warn("Could not hydrate the session:", err);
    return getSession();
  }
}

// ========================================
// Update the UI based on auth state
// ========================================
export function updateUserInterface() {
  const userbox = document.querySelector(".userbox");
  if (!userbox) return;

  const user = getSession();

  if (user) {
    const username = user.name || user.username || "User";
    userbox.innerHTML = `
      <span class="user-name me-2"><i class="bi bi-person-circle"></i> ${username}</span>
      <button id="btnLogout" class="btn btn-light btn-sm">Sign out</button>
    `;
  } else {
    userbox.innerHTML = `
      <button id="btnRegister" class="btn btn-light btn-sm">Register</button>
      <button id="btnLogin" class="btn btn-light btn-sm">Sign in</button>
    `;
  }
}

// ========================================
// Sign out the current user
// ========================================
export function logout(onDone) {
  fetch(`${API_BASE}/logout`, {
    method: "POST",
    credentials: "include",
  })
    .then(() => {
      clearSession();
      clearFavorites();  // favorites belong to the account, not the browser
      updateUserInterface();

      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: "success",
          title: "Signed out",
          timer: 1200,
          showConfirmButton: false,
        });
      }

      onDone?.();
    })
    .catch((err) => {
      console.error("Sign out failed:", err);
      clearSession();
      clearFavorites();
      updateUserInterface();
    });
}

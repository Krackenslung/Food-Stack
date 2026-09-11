// ================= APP ENTRY (/app) =================
// SPA entry point: imports the modules and wires the global
// events. The logic lives in static/js/modules/.

import { API_KEY } from "./modules/config.js";
import { toggleFavorite, syncFavorites } from "./modules/favorites.js";
import { hydrateSession, updateUserInterface, logout } from "./modules/session.js";
import { setActiveView, getCurrentView, applyFilters } from "./modules/views.js";
import { HotelsMap } from "./modules/hotelsMap.js";
import { FavoritesMap } from "./modules/favoritesMap.js";

console.log("app.js loaded");

// ========================================
// Refresh the active view after toggling a favorite
// ========================================
function notifyFavoriteError(err) {
  console.error("Favorite:", err);

  if (typeof Swal !== "undefined") {
    Swal.fire("Favorites", err.message, "warning");
  }
}

function afterFavoriteToggle() {
  if (getCurrentView() === "favoritos") {
    FavoritesMap.loadFavorites(API_KEY);
  } else if (getCurrentView() === "hoteles") {
    HotelsMap.applyClientFilters?.();
  }
}

// ================= Events =================

document.addEventListener("input", (e) => {
  if (["q", "zone", "rating", "price", "service"].includes(e.target?.id)) applyFilters();
});

// Enter in the search box: same as typing, handy when pasting
document.addEventListener("keydown", (e) => {
  if (e.target?.id === "q" && e.key === "Enter") {
    e.preventDefault();
    applyFilters();
  }
});

document.addEventListener("click", (e) => {

  // -- Auth ------------------------------------------------------
  if (e.target?.id === "btnLogin") {
    window.location.href = "/login";
    return;
  }

  if (e.target?.id === "btnRegister") {
    window.location.href = "/register";
    return;
  }

  if (e.target?.id === "btnLogout") {
    logout(() => setActiveView("inicio"));
    return;
  }

  // -- Navigation CTAs -------------------------------------------
  if (e.target?.id === "btnGoHotels") {
    setActiveView("hoteles");
    return;
  }

  if (e.target?.id === "btnGoFavs") {
    setActiveView("favoritos");
    return;
  }

  // -- Nav switch ------------------------------------------------
  const navBtn = e.target?.closest?.(".nav-item");
  if (navBtn) {
    const view = navBtn.getAttribute("data-view");
    setActiveView(view);
    return;
  }

  // -- Toggle favorite - Places API (string place_id) ------------
  // closest() and not getAttribute(): the click lands on the <i>
  const favPlaceId = e.target
    ?.closest?.("[data-fav-place]")
    ?.getAttribute("data-fav-place");
  if (favPlaceId) {
    // Hits the backend now: on failure (e.g. no session) we skip the refresh
    toggleFavorite(favPlaceId)
      .then(afterFavoriteToggle)
      .catch(notifyFavoriteError);
    return;
  }

  // -- Toggle favorite - icon inside the HotelsMap InfoWindow ----
  if (e.target?.classList?.contains("fav-icon") || e.target?.closest(".fav-icon")) {
    const icon = e.target.classList.contains("fav-icon")
      ? e.target
      : e.target.closest(".fav-icon");
    const placeId = icon.getAttribute("data-pid");
    if (placeId) {
      toggleFavorite(placeId)
        .then((isFav) => {
          const heartIcon = icon.querySelector("i");
          if (heartIcon) {
            heartIcon.className = isFav
              ? "bi bi-heart-fill text-danger"
              : "bi bi-heart text-secondary";
          }
          afterFavoriteToggle();
        })
        .catch(notifyFavoriteError);
    }
    return;
  }
});

// ================= Boot =================

document.addEventListener("DOMContentLoaded", async () => {
  updateUserInterface();   // paint fast from the local cache
  setActiveView("inicio");

  await hydrateSession();  // validate the real session against GET /me
  updateUserInterface();

  // Favorites belong to the account: loaded once the session is valid
  await syncFavorites();
});

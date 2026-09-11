// ================= Views =================
// SPA view switching (/app) + lazy loading per view.

import { $ } from "./dom.js";
import { API_KEY } from "./config.js";
import { HotelsMap } from "./hotelsMap.js";
import { FavoritesMap } from "./favoritesMap.js";
import { bindSupportEventsIfPossible } from "./support.js";

let currentView = "inicio";
let hotelsMapLoaded = false;
let featuredLoaded = false;
let reviewsLoaded = false;

export function getCurrentView() {
  return currentView;
}

// ================= Featured (Inicio) =================

// ========================================
// Init the featured hotels if the DOM is ready
// ========================================
async function initFeaturedIfPossible() {
  if (featuredLoaded) return;

  const hasDOM =
    $("featuredGroup") && $("featuredGroupClone") && $("featuredTrack");
  if (!hasDOM) return;

  if (!window.FeaturedPlaces?.loadAndRender) {
    console.warn("FeaturedPlaces unavailable");
    return;
  }

  featuredLoaded = true;
  try {
    const result = await window.FeaturedPlaces.loadAndRender(API_KEY);

    if (result?.ok) {
      console.log(`FeaturedPlaces loaded (${result.count})`);
    } else {
      // Places failed inside the module: release the flag to retry
      console.warn("FeaturedPlaces returned no featured hotels");
      featuredLoaded = false;
    }

    await initReviewsIfPossible();
  } catch (err) {
    console.error("FeaturedPlaces failed:", err);
    featuredLoaded = false;
  }
}

// ========================================
// Init the reviews if the DOM is ready
// ========================================
async function initReviewsIfPossible() {
  if (reviewsLoaded) return;

  const hasDOM =
    $("reviewsGroup") &&
    $("reviewsGroupClone") &&
    $("reviewsTrack") &&
    $("reviewsNote");
  if (!hasDOM) return;

  if (!window.FeaturedPlaces?.loadAndRenderReviewsFromFeatured) {
    console.warn("Reviews unavailable");
    return;
  }

  reviewsLoaded = true;
  try {
    const result = await window.FeaturedPlaces.loadAndRenderReviewsFromFeatured(
      API_KEY,
      {
        maxHotels: 6,
        maxCards: 10,
      }
    );

    if (result?.ok) {
      console.log(`Real reviews loaded (${result.count})`);
    } else {
      // No reviews (or Place Details failed): allow a retry
      console.warn("No reviews loaded");
      reviewsLoaded = false;
    }
  } catch (err) {
    console.error("Reviews failed:", err);
    reviewsLoaded = false;
  }
}

// ========================================
// Hide every app view
// ========================================
function hideAllViews() {
  ["view-inicio", "view-grid", "view-soporte"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.remove("active");
  });
}

// ========================================
// Apply UI filters to the active view (Places API)
// ========================================
export function applyFilters() {
  // The search bar is global, but results only live in the list views.
  // Typing from Inicio or Soporte sends you to Hoteles: setActiveView
  // triggers the load and that load already applies the current filters.
  if (currentView !== "hoteles" && currentView !== "favoritos") {
    setActiveView("hoteles");
    return;
  }

  if (currentView === "hoteles") {
    HotelsMap.applyClientFilters?.();
    return;
  }

  if (currentView === "favoritos") {
    FavoritesMap.applyClientFilters?.();
  }
}

// ========================================
// Set and show the active view
// ========================================
export function setActiveView(view) {
  currentView = view;

  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(`.nav-item[data-view="${view}"]`).forEach((b) => b.classList.add("active"));

  const filtersBar = $("filtersBar");
  const actions = $("hotelsActions");

  const showFilters = ["hoteles", "favoritos"].includes(view);
  if (filtersBar) filtersBar.style.display = showFilters ? "" : "none";
  if (actions) actions.style.display = view === "hoteles" ? "" : "none";

  hideAllViews();

  if (view === "inicio") {
    $("view-inicio")?.classList.add("active");
    initFeaturedIfPossible();
    return;
  }

  if (["hoteles", "favoritos"].includes(view)) {
    $("view-grid")?.classList.add("active");

    const listTitle = $("listTitle");
    if (listTitle) listTitle.textContent = view === "favoritos" ? "Favorites" : "Hotels";

    if (view === "hoteles") {
      if (!hotelsMapLoaded) {
        hotelsMapLoaded = true;
        HotelsMap.loadAndRender(API_KEY).catch((err) => {
          console.error(err);
          hotelsMapLoaded = false;
          if (actions) actions.style.display = "none";
        });
      } else {
        HotelsMap.applyClientFilters?.();
      }
      return;
    }

    if (view === "favoritos") {
      FavoritesMap.loadFavorites(API_KEY).catch((err) => {
        console.error("Error loading favorites:", err);
      });
      return;
    }
  }

  if (view === "soporte") {
    $("view-soporte")?.classList.add("active");
    bindSupportEventsIfPossible();
  }
}

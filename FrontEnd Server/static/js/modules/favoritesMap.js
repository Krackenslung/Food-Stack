// ================= FAVORITOS MAP MODULE =================

// ========================================
// Favorites map (real Places API)
// ========================================

import { $ } from "./dom.js";
import { getFavs, syncFavorites } from "./favorites.js";
import { filterPlaces } from "./placeFilters.js";
import { DEFAULT_CENTER } from "./config.js";

let map = null;
let service = null;
let placesData = [];
let markers = [];

// ----------------------------------------
// Load and render the favorites on the map
// ----------------------------------------
async function loadFavorites(apiKey) {
  // Reuse the shared loader (Maps script injected only once)
  await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });

  const mapDiv = $("favoritesMap") || $("map");
  if (!mapDiv) return;

  if (!map) {
    map = new google.maps.Map(mapDiv, {
      center: DEFAULT_CENTER,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
  }

  service = new google.maps.places.PlacesService(map);

  // Re-read from the DB on open, in case they changed elsewhere
  await syncFavorites();

  const favIds = getFavs();
  if (favIds.size === 0) {
    placesData = [];
    renderFavoritesCards([]);
    renderMarkers([]);
    return;
  }

  const promises = Array.from(favIds).map((placeId) => {
    return new Promise((resolve) => {
      service.getDetails(
        {
          placeId: placeId,
          fields: [
            "name", "rating", "user_ratings_total", "formatted_address",
            "geometry", "price_level", "photos", "website", "place_id",
          ],
        },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(place);
          } else {
            console.warn(`Error loading place_id ${placeId}:`, status);
            resolve(null);
          }
        }
      );
    });
  });

  const results = await Promise.all(promises);
  placesData = results.filter((p) => p !== null);

  applyClientFilters();
}

// ----------------------------------------
// Apply the UI filters to the loaded favorites
// ----------------------------------------
function applyClientFilters() {
  const list = filterPlaces(placesData);
  renderFavoritesCards(list);
  renderMarkers(list);
}

// ----------------------------------------
// Render the markers on the favorites map
// ----------------------------------------
function renderMarkers(places) {
  markers.forEach((m) => m.setMap(null));
  markers = [];

  if (places.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  const infoWindow = new google.maps.InfoWindow();

  places.forEach((place) => {
    const position = place.geometry.location;

    const marker = new google.maps.Marker({
      position,
      map,
      title: place.name,
    });

    markers.push(marker);
    bounds.extend(position);

    marker.addListener("click", () => {
      const photoUrl =
        place.photos?.[0]?.getUrl({ maxWidth: 400 }) ||
        "/static/images/Grand%20Hotel.jpg";
      const rating = place.rating || "N/A";
      const total = place.user_ratings_total || 0;
      const vicinity = place.vicinity || place.formatted_address || "";
      const website = place.website || null;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.place_id)}`;

      infoWindow.setContent(`
        <div class="hotel-info">
          <img class="hotel-info__img" src="${photoUrl}" alt="${place.name}">
          <div class="hotel-info__body">
            <h6 class="hotel-info__title">${place.name}</h6>
            <p class="hotel-info__addr">${vicinity}</p>
            <p class="hotel-info__meta">
              <i class="bi bi-star-fill text-warning"></i> ${rating}
              <small class="text-muted">(${total})</small>
            </p>
            <div class="hotel-info__actions">
              ${
                website
                  ? `<a href="${website}" target="_blank" rel="noopener" class="btn btn-primary btn-sm flex-fill">Website</a>`
                  : `<button class="btn btn-secondary btn-sm flex-fill" disabled>Sin sitio</button>`
              }
              <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn btn-outline-secondary btn-sm flex-fill">Maps</a>
            </div>
          </div>
        </div>
      `);
      infoWindow.open(map, marker);
    });
  });

  if (places.length > 1) {
    map.fitBounds(bounds);
  } else {
    map.setCenter(places[0].geometry.location);
    map.setZoom(15);
  }
}

// ----------------------------------------
// Render the favorite cards in the side panel
// ----------------------------------------
function renderFavoritesCards(places) {
  const cards = $("cards");
  const count = $("count");

  if (!cards || !count) return;

  count.textContent = `${places.length} favorites`;

  if (places.length === 0) {
    const term = document.getElementById("q")?.value.trim() || "";

    // placesData is ALL favorites; places is already filtered
    if (term && placesData.length) {
      const msg = document.createElement("div");
      msg.className = "text-muted small p-3";
      msg.textContent = `None of your favorites match "${term}".`;
      cards.replaceChildren(msg);
      return;
    }

    cards.innerHTML = `
      <div class="text-muted small p-3">
        No favorites saved yet. Explore hotels and add them with <i class="bi bi-heart"></i>
      </div>
    `;
    return;
  }

  const favs = getFavs();

  cards.innerHTML = places
    .map((place) => {
      const photoUrl =
        place.photos?.[0]?.getUrl({ maxWidth: 400 }) ||
        "/static/images/Grand%20Hotel.jpg";
      const rating = place.rating || "N/A";
      const reviews = place.user_ratings_total || 0;
      const address = place.formatted_address || "";
      const isFav = favs.has(place.place_id);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.place_id)}`;

      return `
      <div class="card-hotel">
        <div class="card-hotel__side">
          <div class="card-hotel__thumb">
            <img class="card-hotel__img" src="${photoUrl}" alt="${place.name}">
          </div>
          ${
            place.website
              ? `<a class="btn btn-outline-primary btn-sm card-hotel__btn" href="${place.website}" target="_blank" rel="noopener">Website</a>`
              : `<button class="btn btn-outline-secondary btn-sm card-hotel__btn" disabled>Sin sitio</button>`
          }
          <a class="btn btn-outline-secondary btn-sm card-hotel__btn" href="${mapsUrl}" target="_blank" rel="noopener">Maps</a>
        </div>
        <div class="card-hotel__body">
          <div class="card-hotel__head">
            <h5 class="card-hotel__title">${place.name}</h5>
            <button class="card-hotel__fav${isFav ? " is-active" : ""}"
                    data-fav-place="${place.place_id}" type="button"
                    aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">
              <i class="bi ${isFav ? "bi-heart-fill" : "bi-heart"}"></i>
            </button>
          </div>
          <div class="card-hotel__meta">
            <i class="bi bi-star-fill text-warning"></i> ${rating} • (${Number(reviews).toLocaleString()})
          </div>
          <div class="card-hotel__addr">
            <i class="bi bi-geo-alt"></i> ${address}
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

// -- Public API ---------------------------------------------────────────────
export const FavoritesMap = {
  loadFavorites,
  applyClientFilters,
  getPlaceByPlaceId: (placeId) => placesData.find((p) => p.place_id === placeId),
};

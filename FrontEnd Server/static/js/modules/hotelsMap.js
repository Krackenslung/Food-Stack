// ================= HOTELES MAP MODULE =================

// ========================================
// Nearby hotels map (Places API)
// ========================================

import { getFavs } from "./favorites.js";
import { filterPlaces, normalize } from "./placeFilters.js";
import { DEFAULT_CENTER } from "./config.js";

let map = null;
let infoWindow = null;
let userMarker = null;
let userCircle = null;
let placeMarkers = [];

let lastCenter = null;
let lastPlacesRaw = [];

// ===== Busqueda por texto (toda la ciudad) =====
// null = no active search (nearby hotels are shown)
let searchResults = null;
let searchTerm = "";
let searchTimer = null;
let searchSeq = 0;   // descarta respuestas que llegan tarde

const SEARCH_MIN_CHARS = 3;
const SEARCH_DEBOUNCE_MS = 450;
const CITY_SEARCH_RADIUS = 20000;
let radiusMeters = 5000;

// ----------------------------------------
// Clear every place marker from the map
// ----------------------------------------
function clearPlaceMarkers() {
  placeMarkers.forEach((m) => m.setMap(null));
  placeMarkers = [];
}

// ----------------------------------------
// Set the map placeholder text
// ----------------------------------------
function setPlaceholder(text) {
  const ph = document.querySelector("#map .map-placeholder");
  if (ph) ph.textContent = text;
}

// ----------------------------------------
// Make sure the map is initialized
// ----------------------------------------
function ensureMap(center) {
  if (!map) {
    map = new google.maps.Map(document.getElementById("map"), {
      zoom: 14,
      center,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    infoWindow = new google.maps.InfoWindow();
  } else {
    map.setCenter(center);
  }
}

// ----------------------------------------
// Place the user location marker
// ----------------------------------------
function setUserMarker(center) {
  lastCenter = center;

  const icon = {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: "#2f6bff",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };

  if (!userMarker) {
    userMarker = new google.maps.Marker({
      position: center,
      map,
      title: "Your location",
      icon,
      zIndex: 9999,
    });
  } else {
    userMarker.setPosition(center);
    userMarker.setMap(map);
  }

  if (!userCircle) {
    userCircle = new google.maps.Circle({
      map,
      center,
      radius: radiusMeters,
      fillColor: "#2f6bff",
      fillOpacity: 0.08,
      strokeColor: "#2f6bff",
      strokeOpacity: 0.25,
      strokeWeight: 2,
    });
  } else {
    userCircle.setCenter(center);
    userCircle.setRadius(radiusMeters);
    userCircle.setMap(map);
  }
}

// ----------------------------------------
// Render the hotel list in the side panel
// ----------------------------------------
function renderListFromPlaces(places) {
  const cards = document.getElementById("cards");
  const count = document.getElementById("count");
  if (count) count.textContent = `${places.length} results`;

  if (!cards) return;

  if (!places.length) {
    const term = document.getElementById("q")?.value.trim() || "";

    const msg = document.createElement("div");
    msg.className = "text-muted small p-3";
    // textContent, not innerHTML: the user writes this text
    msg.textContent = term
      ? `No hotel in Tijuana matches "${term}".`
      : "No hotels found nearby.";

    cards.replaceChildren(msg);
    return;
  }

  const service = new google.maps.places.PlacesService(map);
  const favs = getFavs();

  cards.innerHTML = places
    .map((p, idx) => {
      const rating = p.rating ?? "—";
      const reviews = p.user_ratings_total ?? 0;
      const addr = p.vicinity ?? p.formatted_address ?? "No address";
      const name = p.name ?? "Hotel";
      const placeId = p.place_id;
      const isFav = favs.has(placeId);
      const photoUrl = "/static/images/Grand%20Hotel.jpg";

      const gmapsUrl = placeId
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + addr)}`;

      return `
      <div class="card-hotel" data-place="${placeId || ""}" data-idx="${idx}">
        <div class="card-hotel__side">
          <div class="card-hotel__thumb">
            <img class="card-hotel__img" src="${photoUrl}" alt="${name}" data-place-id="${placeId}">
          </div>
          <a class="btn btn-outline-primary btn-sm card-hotel__btn website-btn"
             href="#" target="_blank" rel="noopener" data-place-id="${placeId}">Website</a>
          <a class="btn btn-outline-secondary btn-sm card-hotel__btn"
             href="${gmapsUrl}" target="_blank" rel="noopener">Maps</a>
        </div>
        <div class="card-hotel__body">
          <div class="card-hotel__head">
            <h5 class="card-hotel__title">${name}</h5>
            <button class="card-hotel__fav${isFav ? " is-active" : ""}"
                    data-fav-place="${placeId}" type="button"
                    aria-label="${isFav ? "Remove from favorites" : "Add to favorites"}">
              <i class="bi ${isFav ? "bi-heart-fill" : "bi-heart"}"></i>
            </button>
          </div>
          <div class="card-hotel__meta">
            <i class="bi bi-star-fill text-warning"></i> ${rating} • (${Number(reviews).toLocaleString()})
          </div>
          <div class="card-hotel__addr">
            <i class="bi bi-geo-alt"></i> ${addr}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // Load full details (photo + website) asynchronously
  places.forEach((p) => {
    if (!p.place_id) return;

    service.getDetails(
      { placeId: p.place_id, fields: ["photos", "website"] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          const imgEl = cards.querySelector(`img[data-place-id="${p.place_id}"]`);
          if (imgEl && place.photos?.length) {
            imgEl.src = place.photos[0].getUrl({ maxWidth: 90 });
          }

          const webBtn = cards.querySelector(`.website-btn[data-place-id="${p.place_id}"]`);
          if (webBtn) {
            if (place.website) {
              webBtn.href = place.website;
            } else {
              webBtn.href = "#";
              webBtn.onclick = () => false;
              webBtn.classList.add("is-disabled");
            }
          }
        }
      }
    );
  });

  // Card click -> pan + zoom to the marker
  cards.querySelectorAll(".card-hotel").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (e.target.hasAttribute("data-fav-place") || e.target.closest("[data-fav-place]")) return;
      if (e.target.classList.contains("btn") || e.target.closest(".btn")) return;

      const idx = Number(el.getAttribute("data-idx"));
      const p = places[idx];
      if (!p?.geometry?.location) return;

      const pos = p.geometry.location;
      map.panTo(pos);
      map.setZoom(15);

      infoWindow.setContent(`
        <div class="hotel-info__body">
          <div class="hotel-info__title">${p.name ?? "Hotel"}</div>
          <div class="hotel-info__addr">${p.vicinity ?? ""}</div>
          <div class="hotel-info__meta"><i class="bi bi-star-fill text-warning"></i> ${p.rating ?? "—"} (${p.user_ratings_total ?? 0})</div>
        </div>
      `);
      infoWindow.setPosition(pos);
      infoWindow.open(map);
    });
  });
}

// ----------------------------------------
// Render the hotel markers on the map
// ----------------------------------------
function renderMarkers(places) {
  clearPlaceMarkers();

  places.forEach((p) => {
    if (!p.geometry?.location) return;

    const m = new google.maps.Marker({
      position: p.geometry.location,
      map,
      title: p.name || "Hotel",
    });

    m.addListener("click", () => {
      const service = new google.maps.places.PlacesService(map);

      service.getDetails(
        {
          placeId: p.place_id,
          fields: ["name", "rating", "user_ratings_total", "website", "photos", "vicinity"],
        },
        (place, status) => {
          const name = place?.name || "Hotel";
          const rating = place?.rating ?? "—";
          const total = place?.user_ratings_total ?? 0;
          const vicinity = place?.vicinity ?? "";
          const website = place?.website || null;

          const photoUrl = place?.photos?.length
            ? place.photos[0].getUrl({ maxWidth: 400 })
            : "/static/images/Grand%20Hotel.jpg";

          const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(p.place_id)}`;

          const favs = getFavs();
          const isFav = favs.has(p.place_id);

          infoWindow.setContent(`
            <div class="hotel-info">
              <img class="hotel-info__img" src="${photoUrl}" alt="${name}">
              <div class="hotel-info__body">
                <span class="fav-icon hotel-info__fav" data-pid="${p.place_id}">
                  <i class="${isFav ? "bi bi-heart-fill text-danger" : "bi bi-heart text-secondary"}"></i>
                </span>
                <h6 class="hotel-info__title">${name}</h6>
                <p class="hotel-info__addr">${vicinity}</p>
                <p class="hotel-info__meta">
                  <i class="bi bi-star-fill text-warning"></i> ${rating}
                  <small class="text-muted">(${total})</small>
                </p>
                <div class="hotel-info__actions">
                  ${
                    website
                      ? `<a href="${website}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm flex-fill">Website</a>`
                      : `<button class="btn btn-secondary btn-sm flex-fill" disabled>Sin sitio</button>`
                  }
                  <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-secondary btn-sm flex-fill">Maps</a>
                </div>
              </div>
            </div>
          `);

          infoWindow.open(map, m);
        }
      );
    });

    placeMarkers.push(m);
  });
}

// ----------------------------------------
// Drop places without reviews
// ----------------------------------------
// Google tags houses and gated communities as "lodging"
function hasReviews(place) {
  return Number(place?.user_ratings_total ?? 0) > 0;
}

// ----------------------------------------
// Lodging only
// ----------------------------------------
// textSearch("hotel") also returns restaurants and agencies
function isLodging(place) {
  return (place?.types || []).includes("lodging");
}

// ----------------------------------------
// Mexican side only
// ----------------------------------------
// NOTE: location + radius is a bias, not a limit: San Diego hotels
// slip through. We filter by address.
function isInMexico(place) {
  const addr = String(place?.formatted_address || place?.vicinity || "");

  if (/(EE\.\s?UU\.|U\.?S\.?A\.?|United States|Estados Unidos)/i.test(addr)) {
    return false;
  }

  return /m[eé]xico/i.test(addr);
}

// ----------------------------------------
// Distance in meters between two points (haversine)
// ----------------------------------------
// By hand to avoid loading the "geometry" library just for this
function distanceMeters(center, latLng) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const lat = typeof latLng.lat === "function" ? latLng.lat() : latLng.lat;
  const lng = typeof latLng.lng === "function" ? latLng.lng() : latLng.lng;

  const dLat = toRad(lat - center.lat);
  const dLng = toRad(lng - center.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(center.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

// ----------------------------------------
// Probe points
// ----------------------------------------
// IMPORTANT: textSearch returns 20 per query (no 2nd page here) and
// "radius" biases instead of filtering, so widening it makes Google
// return a different set. We probe fixed centers/radii and merge by
// place_id: widening the range only adds, never removes.
const PROBE_RADII = [2000, 5000, 10000, 20000];
const GRID_STEP_METERS = 7000;
const GRID_QUERY_RADIUS = 7000;
const MAX_CONCURRENT_PROBES = 5;

function probeRadiiFor(radius) {
  const rings = PROBE_RADII.filter((r) => r < radius);
  rings.push(radius);
  return rings;
}

// Offset a point N meters north and M meters east
function offsetLatLng(center, north, east) {
  const M_PER_DEG_LAT = 111320;
  const latRad = (center.lat * Math.PI) / 180;

  return {
    lat: center.lat + north / M_PER_DEG_LAT,
    lng: center.lng + east / (M_PER_DEG_LAT * Math.cos(latRad)),
  };
}

function buildProbes(center) {
  const probes = probeRadiiFor(radiusMeters).map((radius) => ({ center, radius }));

  const steps = Math.ceil(radiusMeters / GRID_STEP_METERS);
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      if (i === 0 && j === 0) continue;

      const point = offsetLatLng(center, i * GRID_STEP_METERS, j * GRID_STEP_METERS);
      if (distanceMeters(center, point) > radiusMeters) continue;

      probes.push({ center: point, radius: GRID_QUERY_RADIUS });
    }
  }

  return probes;
}

// ----------------------------------------
// One textSearch probe (with its pages, if any)
// ----------------------------------------
function textSearchPaged(service, center, radius, query, onPage) {
  return new Promise((resolve, reject) => {
    let pagesOk = 0;

    service.textSearch(
      { location: center, radius, query },
      (results, status, pagination) => {
        if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          return resolve();
        }

        if (status !== google.maps.places.PlacesServiceStatus.OK) {
          // If we already got pages, keep them
          if (pagesOk) return resolve();
          return reject(new Error("Places error: " + status));
        }

        onPage(results);
        pagesOk += 1;

        if (pagination?.hasNextPage) {
          // The next_page_token takes a moment to become valid
          setTimeout(() => pagination.nextPage(), 2000);
          return;
        }

        resolve();
      }
    );
  });
}

// ----------------------------------------
// Run tasks with limited concurrency
// ----------------------------------------
// Serial is too slow; all at once triggers OVER_QUERY_LIMIT
async function runPool(items, limit, worker) {
  let index = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (index < items.length) {
        await worker(items[index++]);
      }
    }
  );

  await Promise.all(runners);
}

// ----------------------------------------
// Search hotels near a location
// ----------------------------------------
// textSearch and not nearbySearch: the latter caps at 60 and in dense
// areas those are all private homes, hiding real hotels
async function searchNearbyHotels(center) {
  const service = new google.maps.places.PlacesService(map);

  const all = [];
  const seen = new Set();

  const collect = (results) => {
    (results || []).forEach((p) => {
      const id = p.place_id;
      if (id && seen.has(id)) return;

      const loc = p.geometry?.location;
      if (!loc) return;

      if (distanceMeters(center, loc) > radiusMeters) return;
      if (!isLodging(p)) return;
      if (!hasReviews(p)) return;
      if (!isInMexico(p)) return;

      if (id) seen.add(id);
      all.push(p);
    });
  };

  const probes = buildProbes(center);
  let lastError = null;
  let anyOk = false;
  let done = 0;

  await runPool(probes, MAX_CONCURRENT_PROBES, async (probe) => {
    try {
      await textSearchPaged(service, probe.center, probe.radius, "hotel", collect);
      anyOk = true;
    } catch (err) {
      // A failing probe must not sink the whole search
      lastError = err;
    }

    done += 1;
    setPlaceholder(`Searching hotels... ${done}/${probes.length} (${all.length})`);
  });

  if (!anyOk && lastError) throw lastError;

  // textSearch does not sort by distance, so we sort at the end
  return all.sort(
    (a, b) =>
      distanceMeters(center, a.geometry.location) -
      distanceMeters(center, b.geometry.location)
  );
}

// ----------------------------------------
// Get the user's GPS location
// ----------------------------------------
async function getUserLocation() {
  return await new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(DEFAULT_CENTER);

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(DEFAULT_CENTER),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

// ----------------------------------------
// Termino escrito en la barra de busqueda
// ----------------------------------------
function readSearchTerm() {
  return (document.getElementById("q")?.value || "").trim();
}

// ----------------------------------------
// Paint the current list (search or nearby) with the UI filters
// ----------------------------------------
function renderCurrent() {
  const searching = searchResults !== null;
  const list = filterPlaces(searching ? searchResults : lastPlacesRaw, {
    skipQuery: searching,
  });

  // The radius circle lies during a city-wide search
  if (userCircle) userCircle.setMap(searching ? null : map);

  renderMarkers(list);
  renderListFromPlaces(list);

  return list;
}

// ----------------------------------------
// Search all of Tijuana with Places (not just what is loaded)
// ----------------------------------------
async function runTextSearch(term) {
  const seq = ++searchSeq;
  const center = lastCenter || DEFAULT_CENTER;

  setPlaceholder(`Searching "${term}" in Tijuana...`);

  const service = new google.maps.places.PlacesService(map);
  const found = [];
  const seen = new Set();

  try {
    // The "hotel" prefix is required: without it Places returns the
    // neighborhood or the city instead of hotels
    await textSearchPaged(
      service,
      center,
      CITY_SEARCH_RADIUS,
      `hotel ${term} Tijuana`,
      (page) => {
        (page || []).forEach((p) => {
          const id = p.place_id;
          if (id && seen.has(id)) return;
          if (!p.geometry?.location) return;
          if (!isLodging(p)) return;
          if (!hasReviews(p)) return;
          if (!isInMexico(p)) return;

          if (id) seen.add(id);
          found.push(p);
        });
      }
    );
  } catch (err) {
    console.error("Tijuana search:", err);
  }

  // Another search started while this one was in flight: discard it
  if (seq !== searchSeq) return;

  // Places is fuzzy: if it does not understand the term it ignores it
  // and returns generic hotels. We require at least one to mention it.
  const algunoCoincide = found.some(
    (p) =>
      normalize(p.name).includes(normalize(term)) ||
      normalize(p.formatted_address || p.vicinity).includes(normalize(term))
  );

  // Keep the Places order: when searching "rosarito", nearby is not
  // what is relevant
  searchResults = algunoCoincide ? found : [];

  setPlaceholder("");
  const list = renderCurrent();

  // Results can be far from the user: fit the map to them
  if (list.length) {
    const bounds = new google.maps.LatLngBounds();
    list.forEach((p) => bounds.extend(p.geometry.location));
    map.fitBounds(bounds);
  }
}

// ----------------------------------------
// Apply the UI filters to the Places list
// ----------------------------------------
function applyClientFiltersFromUI() {
  const term = readSearchTerm();

  // Text changed: go to Places, not just re-filter in memory
  if (term !== searchTerm) {
    searchTerm = term;
    clearTimeout(searchTimer);

    if (term.length < SEARCH_MIN_CHARS) {
      // Back to the nearby hotels
      searchResults = null;
      searchSeq += 1;   // invalidate any in-flight response
      setPlaceholder("");
      renderCurrent();
      return;
    }

    // Without debounce we would call Places on every keystroke
    searchTimer = setTimeout(() => runTextSearch(term), SEARCH_DEBOUNCE_MS);
    return;
  }

  // Only rating / price / zone changed
  renderCurrent();
}

// ----------------------------------------
// Run a nearby hotel search
// ----------------------------------------
async function runSearch({ freshLocation = false } = {}) {
  setPlaceholder("Searching nearby hotels...");

  const center = freshLocation
    ? await getUserLocation()
    : lastCenter || (await getUserLocation());

  ensureMap(center);
  setUserMarker(center);

  const places = await searchNearbyHotels(center);
  lastPlacesRaw = places;

  setPlaceholder(places.length ? "" : "No results");

  applyClientFiltersFromUI();
}

// ----------------------------------------
// Wire the UI controls
// ----------------------------------------
function wireUIControls() {
  const actions = document.getElementById("hotelsActions");
  const btnRefresh = document.getElementById("btnRefreshHotels");
  const btnRecenter = document.getElementById("btnRecenter");
  const radiusSel = document.getElementById("radiusSel");

  if (actions) actions.style.display = "";

  if (radiusSel) {
    radiusSel.value = String(radiusMeters);
    radiusSel.addEventListener("change", async () => {
      radiusMeters = Number(radiusSel.value) || 5000;
      if (userCircle) userCircle.setRadius(radiusMeters);
      await runSearch({ freshLocation: false });
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener("click", async () => {
      await runSearch({ freshLocation: true });
    });
  }

  if (btnRecenter) {
    btnRecenter.addEventListener("click", () => {
      if (!map || !lastCenter) return;
      map.panTo(lastCenter);
      map.setZoom(14);
    });
  }

  ["q", "price", "rating", "zone"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", applyClientFiltersFromUI);
    el.addEventListener("change", applyClientFiltersFromUI);
  });
}

// ----------------------------------------
// Full init flow for the hotels map
// ----------------------------------------
async function initHotelsFlow() {
  setPlaceholder("Loading map...");

  const center = await getUserLocation();
  ensureMap(center);
  setUserMarker(center);

  wireUIControls();

  await runSearch({ freshLocation: false });
}

// -- Public API ---------------------------------------------────────────────
export const HotelsMap = {
  async loadAndRender(apiKey) {
    await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });
    await initHotelsFlow();
  },

  applyClientFilters: applyClientFiltersFromUI,

  refresh: () => runSearch({ freshLocation: true }),

  recenter: () => {
    if (!map || !lastCenter) return;
    map.panTo(lastCenter);
    map.setZoom(14);
  },

  setRadius: (m) => {
    radiusMeters = Number(m) || 5000;
    if (userCircle) userCircle.setRadius(radiusMeters);
    return runSearch({ freshLocation: false });
  },
};

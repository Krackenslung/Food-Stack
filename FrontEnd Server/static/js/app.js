console.log("app.js cargó ✅");

const API_KEY = "AIzaSyD6qRAcdy-4LRhsUwXp2ADVs_f9wnqHhCk";

let currentView = "inicio";
let hotelsMapLoaded = false;
let favoritesMapLoaded = false;
let featuredLoaded = false;
let reviewsLoaded = false;

// ========================================
// UTILIDAD: Selector de elementos DOM
// ========================================
const $ = (id) => document.getElementById(id);

// ========================================
// DATOS DE REFERENCIA: Hoteles destacados (fallback / modal)
// ========================================
const dummyHotels = [
  {
    id: 1,
    name: "Hotel Lucerna Tijuana",
    zone: "Zona Río",
    price: 120,
    rating: 4.7,
    reviews: 1289,
    services: ["wifi", "parking", "gym"],
    address: "Paseo de los Héroes 10902",
    emoji: "🏨",
    image: "/static/images/hotel-lucerna.png",
    website: "https://www.hotellucerna.com/tijuana/",
  },
  {
    id: 2,
    name: "Quartz Hotel & Spa",
    zone: "Zona Río",
    price: 150,
    rating: 4.6,
    reviews: 1299,
    services: ["wifi", "pool", "parking"],
    address: "Blvd. Agua Caliente 10515",
    emoji: "🛁",
    image: "/static/images/quartz-hotel-spa.png",
    website: "https://www.quartzhotel.mx/",
  },
  {
    id: 3,
    name: "Grand Hotel Tijuana",
    zone: "Zona Río",
    price: 110,
    rating: 4.5,
    reviews: 1180,
    services: ["wifi", "pool", "gym", "parking"],
    address: "Blvd. Agua Caliente 4558",
    emoji: "⭐",
    image: "/static/images/grand-one-plaza.png",
    website: "https://www.grandhoteltj.com/",
  },
  {
    id: 4,
    name: "Hotel Ticuán",
    zone: "Centro",
    price: 80,
    rating: 4.2,
    reviews: 1289,
    services: ["wifi", "parking"],
    address: "Av. Revolución 10410",
    emoji: "🏙️",
    image: "/static/images/sleep-in.png",
    website: "https://www.hotelticuan.com/",
  },
  {
    id: 5,
    name: "Hotel Real del Río",
    zone: "Zona Río",
    price: 95,
    rating: 4.1,
    reviews: 640,
    services: ["wifi", "gym"],
    address: "Blvd. Sánchez Taboada",
    emoji: "🌊",
    image: "/static/images/alberca-indoor.png",
    website: "https://www.hotelrealdelrio.com/",
  },
];

// ================= FAVORITOS STORAGE =================

// ========================================
// Obtiene los favoritos del localStorage
// ========================================
function getFavs() {
  return new Set(JSON.parse(localStorage.getItem("tj_favs") || "[]"));
}

// ========================================
// Guarda los favoritos en localStorage
// ========================================
function setFavs(set) {
  localStorage.setItem("tj_favs", JSON.stringify([...set]));
}

// ========================================
// Alterna el estado de favorito de un lugar (Places API – string place_id)
// ========================================
function toggleFavorite(placeId) {
  const favs = getFavs();
  if (favs.has(placeId)) {
    favs.delete(placeId);
  } else {
    favs.add(placeId);
  }
  setFavs(favs);

  if (currentView === "favoritos") {
    FavoritesMap.loadFavorites(API_KEY);
  }

  return favs.has(placeId);
}

// ================= AUTENTICACIÓN =================

// ========================================
// Obtiene la sesión del usuario actual
// ========================================
function getSession() {
  const userStr = sessionStorage.getItem("tj_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// ========================================
// Limpia la sesión del usuario
// ========================================
function clearSession() {
  sessionStorage.removeItem("tj_user");
}

// ========================================
// Actualiza la interfaz según el estado de autenticación
// ========================================
function updateUserInterface() {
  const userbox = document.querySelector(".userbox");
  if (!userbox) return;

  const user = getSession();

  if (user) {
    const username = user.name || user.username || "Usuario";
    userbox.innerHTML = `
      <span class="user-name me-2 text-light">👤 ${username}</span>
      <button id="btnLogout" class="btn btn-light btn-sm">Cerrar sesión</button>
    `;
  } else {
    userbox.innerHTML = `
      <button id="btnRegister" class="btn btn-light btn-sm">Register</button>
      <button id="btnLogin" class="btn btn-light btn-sm">Iniciar sesión</button>
    `;
  }
}

// ========================================
// Cierra la sesión del usuario actual
// ========================================
function logout() {
  fetch("http://127.0.0.1:5010/logout", {
    method: "POST",
    credentials: "include",
  })
    .then(() => {
      clearSession();
      updateUserInterface();

      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: "success",
          title: "Sesión cerrada",
          timer: 1200,
          showConfirmButton: false,
        });
      }

      setActiveView("inicio");
    })
    .catch((err) => {
      console.error("Error al cerrar sesión:", err);
      clearSession();
      updateUserInterface();
    });
}

// ================= FAVORITOS MAP MODULE =================

// ========================================
// Módulo para gestionar el mapa de favoritos (Places API real)
// ========================================
const FavoritesMap = (() => {
  let map, service, placesData = [], markers = [];

  // ----------------------------------------
  // Inicializa Google Maps API si no está cargada
  // ----------------------------------------
  async function init(apiKey) {
    return new Promise((resolve, reject) => {
      if (!window.google?.maps) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=es`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Google Maps falló"));
        document.head.appendChild(script);
      } else {
        resolve();
      }
    });
  }

  // ----------------------------------------
  // Carga y muestra los favoritos en el mapa
  // ----------------------------------------
  async function loadFavorites(apiKey) {
    await init(apiKey);

    const mapDiv = $("favoritesMap");
    if (!mapDiv) return;

    const center = { lat: 32.5149, lng: -117.0382 };

    if (!map) {
      map = new google.maps.Map(mapDiv, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    service = new google.maps.places.PlacesService(map);

    const favIds = getFavs();
    if (favIds.size === 0) {
      renderFavoritesCards([]);
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
              console.warn(`Error cargando place_id ${placeId}:`, status);
              resolve(null);
            }
          }
        );
      });
    });

    const results = await Promise.all(promises);
    placesData = results.filter((p) => p !== null);

    renderFavoritesCards(placesData);
    renderMarkers(placesData);
  }

  // ----------------------------------------
  // Renderiza los marcadores en el mapa de favoritos
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
          "https://via.placeholder.com/400x300?text=Hotel";
        const rating = place.rating || "N/A";
        const total = place.user_ratings_total || 0;
        const vicinity = place.vicinity || place.formatted_address || "";
        const website = place.website || null;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.place_id)}`;

        infoWindow.setContent(`
          <div class="card" style="width:18rem;max-width:300px;border-radius:12px;overflow:hidden;">
            <img src="${photoUrl}" alt="${place.name}" style="width:100%;height:160px;object-fit:cover;display:block;">
            <div class="card-body p-3">
              <h6 class="card-title mb-1" style="font-weight:700;font-size:1rem;">${place.name}</h6>
              <p class="mb-2" style="font-size:12px;color:#6c757d;line-height:1.3;">${vicinity}</p>
              <p class="mb-3" style="font-size:13px;">⭐ ${rating} <small class="text-muted">(${total})</small></p>
              <div class="d-flex gap-2">
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
  // Renderiza las tarjetas de favoritos en el panel lateral
  // ----------------------------------------
  function renderFavoritesCards(places) {
    const cards = $("cards");
    const count = $("count");

    if (!cards || !count) return;

    count.textContent = `${places.length} favoritos`;

    if (places.length === 0) {
      cards.innerHTML = `
        <div class="text-muted small p-3">
          No tienes favoritos guardados aún. Explora hoteles y agrégalos con ❤️
        </div>
      `;
      return;
    }

    const favs = getFavs();

    cards.innerHTML = places
      .map((place) => {
        const photoUrl =
          place.photos?.[0]?.getUrl({ maxWidth: 400 }) ||
          "https://via.placeholder.com/90x90?text=Hotel";
        const rating = place.rating || "N/A";
        const reviews = place.user_ratings_total || 0;
        const address = place.formatted_address || "";
        const isFav = favs.has(place.place_id);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.place_id)}`;

        return `
        <div class="card-hotel" style="border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:10px;display:flex;gap:15px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100px;flex-shrink:0;">
            <div class="thumb" style="width:90px;height:90px;overflow:hidden;border-radius:8px;background:#f0f0f0;">
              <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${place.name}">
            </div>
            ${
              place.website
                ? `<a class="btn btn-outline-primary btn-sm" style="width:90px;font-size:11px;" href="${place.website}" target="_blank" rel="noopener">Website</a>`
                : `<button class="btn btn-outline-secondary btn-sm" style="width:90px;font-size:11px;" disabled>Sin sitio</button>`
            }
            <a class="btn btn-outline-secondary btn-sm" style="width:90px;font-size:11px;" href="${mapsUrl}" target="_blank" rel="noopener">Maps</a>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
              <h5 style="font-size:18px;font-weight:600;margin:0;padding-right:10px;">${place.name}</h5>
              <button class="btn btn-link p-0" style="font-size:20px;color:${isFav ? "#dc3545" : "#6c757d"};"
                      data-fav-place="${place.place_id}" type="button">
                ${isFav ? "❤️" : "🤍"}
              </button>
            </div>
            <div style="font-size:14px;color:#666;margin-bottom:5px;">
              ⭐ ${rating} • (${Number(reviews).toLocaleString()})
            </div>
            <div style="font-size:13px;color:#999;">
              📍 ${address}
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  }

  return {
    loadFavorites,
    getPlaceByPlaceId: (placeId) => placesData.find((p) => p.place_id === placeId),
  };
})();

// ================= Featured (Inicio) =================

// ========================================
// Inicializa los hoteles destacados si el DOM está listo
// ========================================
async function initFeaturedIfPossible() {
  if (featuredLoaded) return;

  const hasDOM =
    $("featuredGroup") && $("featuredGroupClone") && $("featuredTrack");
  if (!hasDOM) return;

  if (!window.FeaturedPlaces?.loadAndRender) {
    console.warn("FeaturedPlaces no disponible");
    return;
  }

  featuredLoaded = true;
  try {
    await window.FeaturedPlaces.loadAndRender(API_KEY);
    console.log("FeaturedPlaces cargó ✅");
    await initReviewsIfPossible();
  } catch (err) {
    console.error("FeaturedPlaces falló:", err);
    featuredLoaded = false;
  }
}

// ========================================
// Inicializa las reseñas si el DOM está listo
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
    console.warn("Reviews no disponibles");
    return;
  }

  reviewsLoaded = true;
  try {
    await window.FeaturedPlaces.loadAndRenderReviewsFromFeatured(API_KEY, {
      maxHotels: 6,
      maxCards: 10,
    });
    console.log("Reviews reales cargadas ✅");
  } catch (err) {
    console.error("Reviews fallaron:", err);
    reviewsLoaded = false;
  }
}

// ================= Views =================

// ========================================
// Oculta todas las vistas de la aplicación
// ========================================
function hideAllViews() {
  ["view-inicio", "view-grid", "view-zonas", "view-ofertas", "view-soporte"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.remove("active");
  });
}

// ========================================
// Establece y muestra la vista activa
// ========================================
function setActiveView(view) {
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
    if (listTitle) listTitle.textContent = view === "favoritos" ? "Favoritos" : "Hoteles";

    if (view === "hoteles") {
      if (!hotelsMapLoaded) {
        hotelsMapLoaded = true;
        HotelsMap.loadAndRender(API_KEY).catch((err) => {
          console.error(err);
          hotelsMapLoaded = false;
          if (actions) actions.style.display = "none";
          applyFilters();
        });
      } else {
        HotelsMap.applyClientFilters?.();
      }
      return;
    }

    if (view === "favoritos") {
      FavoritesMap.loadFavorites(API_KEY).catch((err) => {
        console.error("Error cargando favoritos:", err);
      });
      return;
    }
  }

  if (view === "zonas") $("view-zonas")?.classList.add("active");
  if (view === "ofertas") $("view-ofertas")?.classList.add("active");
  if (view === "soporte") $("view-soporte")?.classList.add("active");
}

// ================= Render cards (dummyHotels – modal / fallback) =================

// ========================================
// Renderiza tarjetas de hoteles dummy en el panel
// ========================================
function render(list) {
  const favs = getFavs();

  const count = $("count");
  if (count) count.textContent = `${list.length} resultados`;

  const cards = $("cards");
  if (!cards) return;

  if (list.length === 0) {
    cards.innerHTML = `
      <div class="text-muted small p-3">
        No hay resultados para estos filtros.
      </div>
    `;
    return;
  }

  cards.innerHTML = list
    .map(
      (h) => `
    <div class="card-hotel">
      <div class="thumb">${h.emoji}</div>
      <div class="meta">
        <div class="title">${h.name}</div>
        <div class="sub">⭐ ${h.rating} • (${h.reviews.toLocaleString()}) • ${h.address}, ${h.zone}</div>
        <div class="price">$${h.price}/noche</div>
      </div>
      <div class="d-flex flex-column gap-2 align-items-end">
        <button class="btn btn-primary btn-sm" data-open="${h.id}">Ver hotel</button>
        <button class="btn btn-light btn-sm" data-fav="${h.id}">
          ${favs.has(h.id) ? "★ Favorito" : "☆ Favorito"}
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

// ========================================
// Devuelve la lista base filtrada según la vista actual
// ========================================
function getFilteredListBase() {
  if (currentView === "favoritos") {
    const favs = getFavs();
    return dummyHotels.filter((h) => favs.has(h.id));
  }
  return [...dummyHotels];
}

// ========================================
// Aplica filtros de la UI a la lista de hoteles activa
// ========================================
function applyFilters() {
  if (!["hoteles", "favoritos"].includes(currentView)) return;

  // Hoteles → delegar a HotelsMap (Places API)
  if (currentView === "hoteles") {
    HotelsMap.applyClientFilters?.();
    return;
  }

  // Favoritos → filtrar sobre dummyHotels
  const q = (($("q")?.value) || "").toLowerCase();
  const zone = $("zone")?.value || "all";
  const rating = $("rating")?.value || "all";
  const price = $("price")?.value || "all";
  const service = $("service") ? $("service").value : "all";

  let list = getFilteredListBase().filter((h) => {
    const matchQ = !q || h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q);
    const matchZone = zone === "all" || h.zone === zone;
    const matchRating = rating === "all" || h.rating >= parseFloat(rating);
    const matchService = service === "all" || h.services.includes(service);

    let matchPrice = true;
    if (price !== "all") {
      const [a, b] = price.split("-").map(Number);
      matchPrice = h.price >= a && h.price <= b;
    }

    return matchQ && matchZone && matchRating && matchPrice && matchService;
  });

  render(list);
}

// ================= Events =================

document.addEventListener("input", (e) => {
  if (["q", "zone", "rating", "price", "service"].includes(e.target?.id)) applyFilters();
});

document.addEventListener("click", (e) => {

  // ── Autenticación ──────────────────────────────────────────
  if (e.target?.id === "btnLogin") {
    window.location.href = "/login";
    return;
  }

  if (e.target?.id === "btnRegister") {
    window.location.href = "/register";
    return;
  }

  if (e.target?.id === "btnLogout") {
    logout();
    return;
  }

  // ── CTAs de navegación ────────────────────────────────────
  if (e.target?.id === "btnGoHotels") {
    setActiveView("hoteles");
    return;
  }

  if (e.target?.id === "btnGoFavs") {
    setActiveView("favoritos");
    return;
  }

  // ── Nav switch ────────────────────────────────────────────
  const navBtn = e.target?.closest?.(".nav-item");
  if (navBtn) {
    const view = navBtn.getAttribute("data-view");
    setActiveView(view);
    return;
  }

  // ── Quick zones ───────────────────────────────────────────
  const zoneQuick = e.target?.getAttribute?.("data-zonequick");
  if (zoneQuick) {
    const zoneSel = $("zone");
    if (zoneSel) zoneSel.value = zoneQuick;
    setActiveView("hoteles");
    applyFilters();
    return;
  }

  // ── Toggle favorito – Places API (string place_id) ────────
  const favPlaceId = e.target?.getAttribute?.("data-fav-place");
  if (favPlaceId) {
    toggleFavorite(favPlaceId);
    return;
  }

  // ── Toggle favorito – ícono dentro del InfoWindow de HotelsMap ──
  if (e.target?.classList?.contains("fav-icon") || e.target?.closest(".fav-icon")) {
    const icon = e.target.classList.contains("fav-icon")
      ? e.target
      : e.target.closest(".fav-icon");
    const placeId = icon.getAttribute("data-pid");
    if (placeId) {
      const isFav = toggleFavorite(placeId);
      const heartIcon = icon.querySelector("i");
      if (heartIcon) {
        heartIcon.className = isFav
          ? "bi bi-heart-fill text-danger"
          : "bi bi-heart text-secondary";
      }
    }
    return;
  }

  // ── Abrir modal – dummyHotels ─────────────────────────────
  const openId = e.target?.getAttribute?.("data-open");
  if (openId) {
    const h = dummyHotels.find((x) => x.id === Number(openId));
    if (!h) return;

    const modalEl = document.getElementById("hotelModal");
    const mTitle = $("mTitle");
    const mBody = $("mBody");

    if (!modalEl || !mTitle || !mBody || typeof bootstrap === "undefined") {
      window.open(h.website, "_blank", "noopener");
      return;
    }

    const modal = new bootstrap.Modal(modalEl);

    mTitle.textContent = h.name;
    mBody.innerHTML = `
      <div class="row g-3">
        <div class="col-md-5">
          <div class="rounded-3 overflow-hidden border">
            <img src="${h.image}" alt="${h.name}" style="width:100%;height:220px;object-fit:cover;">
          </div>
        </div>
        <div class="col-md-7">
          <div class="mb-2">⭐ <b>${h.rating}</b> (${h.reviews.toLocaleString()} reseñas)</div>
          <div class="mb-2"><b>Zona:</b> ${h.zone}</div>
          <div class="mb-2"><b>Dirección:</b> ${h.address}</div>
          <div class="mb-3"><b>Precio:</b> $${h.price}/noche</div>
          <div class="small text-muted mb-3">Servicios: ${h.services.join(", ")}</div>
          <a class="btn btn-outline-primary btn-sm" href="${h.website}" target="_blank" rel="noopener">
            Abrir sitio oficial (reservas)
          </a>
        </div>
      </div>
    `;
    modal.show();
    return;
  }

  // ── Toggle favorito – dummyHotels (numeric id) ────────────
  const favId = e.target?.getAttribute?.("data-fav");
  if (favId) {
    const id = Number(favId);
    const favs = getFavs();
    favs.has(id) ? favs.delete(id) : favs.add(id);
    setFavs(favs);
    applyFilters();
    return;
  }
});

// ================= Boot =================

document.addEventListener("DOMContentLoaded", () => {
  updateUserInterface();
  setActiveView("inicio");
});

// ================= HOTELES MAP MODULE =================

// ========================================
// Módulo para gestionar el mapa de hoteles cercanos (Places API)
// ========================================
window.HotelsMap = (function () {
  let map = null;
  let infoWindow = null;
  let userMarker = null;
  let userCircle = null;
  let placeMarkers = [];

  let lastCenter = null;
  let lastPlacesRaw = [];
  let radiusMeters = 5000;

  const DEFAULT_CENTER = { lat: 32.5149, lng: -117.0382 };

  // ----------------------------------------
  // Limpia todos los marcadores de lugares del mapa
  // ----------------------------------------
  function clearPlaceMarkers() {
    placeMarkers.forEach((m) => m.setMap(null));
    placeMarkers = [];
  }

  // ----------------------------------------
  // Establece el texto del placeholder del mapa
  // ----------------------------------------
  function setPlaceholder(text) {
    const ph = document.querySelector("#map .map-placeholder");
    if (ph) ph.textContent = text;
  }

  // ----------------------------------------
  // Asegura que el mapa esté inicializado
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
  // Coloca el marcador de ubicación del usuario
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
        title: "Tu ubicación",
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
  // Renderiza la lista de hoteles en el panel lateral
  // ----------------------------------------
  function renderListFromPlaces(places) {
    const cards = document.getElementById("cards");
    const count = document.getElementById("count");
    if (count) count.textContent = `${places.length} resultados`;

    if (!cards) return;

    if (!places.length) {
      cards.innerHTML = `<div class="text-muted small p-3">No se encontraron hoteles cercanos.</div>`;
      return;
    }

    const service = new google.maps.places.PlacesService(map);
    const favs = getFavs();

    cards.innerHTML = places
      .map((p, idx) => {
        const rating = p.rating ?? "—";
        const reviews = p.user_ratings_total ?? 0;
        const addr = p.vicinity ?? p.formatted_address ?? "Sin dirección";
        const name = p.name ?? "Hotel";
        const placeId = p.place_id;
        const isFav = favs.has(placeId);
        const photoUrl = "https://via.placeholder.com/90x90?text=Hotel";

        const gmapsUrl = placeId
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + addr)}`;

        return `
        <div class="card-hotel" data-place="${placeId || ""}" data-idx="${idx}"
             style="border:1px solid #ddd;border-radius:8px;padding:15px;margin-bottom:10px;display:flex;gap:15px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100px;flex-shrink:0;">
            <div class="thumb" style="width:90px;height:90px;overflow:hidden;border-radius:8px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">
              <img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${name}" data-place-id="${placeId}">
            </div>
            <a class="btn btn-outline-primary btn-sm website-btn" style="width:90px;font-size:11px;"
               href="#" target="_blank" rel="noopener" data-place-id="${placeId}">Website</a>
            <a class="btn btn-outline-secondary btn-sm" style="width:90px;font-size:11px;"
               href="${gmapsUrl}" target="_blank" rel="noopener">Maps</a>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
              <h5 style="font-size:18px;font-weight:600;margin:0;padding-right:10px;">${name}</h5>
              <button class="btn btn-link p-0" style="font-size:20px;color:${isFav ? "#dc3545" : "#6c757d"};"
                      data-fav-place="${placeId}" type="button">
                ${isFav ? "❤️" : "🤍"}
              </button>
            </div>
            <div style="font-size:14px;color:#666;margin-bottom:5px;">
              ⭐ ${rating} • (${Number(reviews).toLocaleString()})
            </div>
            <div style="font-size:13px;color:#999;">📍 ${addr}</div>
          </div>
        </div>
      `;
      })
      .join("");

    // Carga detalles completos (foto + website) de forma asíncrona
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
                webBtn.style.opacity = "0.5";
              }
            }
          }
        }
      );
    });

    // Click en tarjeta → pan + zoom al marcador
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
          <div style="max-width:240px">
            <div style="font-weight:700">${p.name ?? "Hotel"}</div>
            <div style="font-size:12px;opacity:.75">${p.vicinity ?? ""}</div>
            <div style="margin-top:6px;font-size:12px">⭐ ${p.rating ?? "—"} (${p.user_ratings_total ?? 0})</div>
          </div>
        `);
        infoWindow.setPosition(pos);
        infoWindow.open(map);
      });
    });
  }

  // ----------------------------------------
  // Renderiza los marcadores de hoteles en el mapa
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
              : "https://via.placeholder.com/400x300?text=Hotel";

            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(p.place_id)}`;

            const favs = getFavs();
            const isFav = favs.has(p.place_id);

            infoWindow.setContent(`
              <div class="card" style="width:18rem;max-width:300px;border-radius:12px;overflow:hidden;">
                <img src="${photoUrl}" alt="${name}" style="width:100%;height:160px;object-fit:cover;display:block;">
                <div class="card-body p-3">
                  <span class="fav-icon" data-pid="${p.place_id}"
                        style="cursor:pointer;user-select:none;position:absolute;top:10px;right:10px;font-size:1.5rem;">
                    <i class="${isFav ? "bi bi-heart-fill text-danger" : "bi bi-heart text-secondary"}"></i>
                  </span>
                  <h6 class="card-title mb-1" style="font-weight:700;font-size:1rem;">${name}</h6>
                  <p class="mb-2" style="font-size:12px;color:#6c757d;line-height:1.3;">${vicinity}</p>
                  <p class="mb-3" style="font-size:13px;">⭐ ${rating} <small class="text-muted">(${total})</small></p>
                  <div class="d-flex gap-2">
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
  // Busca hoteles cercanos a una ubicación
  // ----------------------------------------
  function searchNearbyHotels(center) {
    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(map);

      service.nearbySearch(
        { location: center, radius: radiusMeters, type: "lodging" },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            resolve(results || []);
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            resolve([]);
          } else {
            reject(new Error("Places error: " + status));
          }
        }
      );
    });
  }

  // ----------------------------------------
  // Obtiene la ubicación GPS del usuario
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

  function normalize(s) {
    return String(s || "").toLowerCase().trim();
  }

  function matchPriceRange(place, priceRange) {
    if (!priceRange || priceRange === "all") return true;
    const level = place.price_level;
    if (level == null) return true;
    if (priceRange === "0-100") return level <= 1;
    if (priceRange === "100-200") return level === 2;
    if (priceRange === "200-999") return level >= 3;
    return true;
  }

  function matchZone(place, zone) {
    if (!zone || zone === "all") return true;
    const v = normalize(place.vicinity || place.formatted_address || "");
    const z = normalize(zone);

    if (z.includes("zona río") || z.includes("zona rio")) {
      return (
        v.includes("zona rio") ||
        v.includes("zona río") ||
        v.includes("rio tijuana") ||
        v.includes("paseo de los héroes") ||
        v.includes("agua caliente")
      );
    }
    if (z.includes("centro")) {
      return (
        v.includes("zona centro") ||
        v.includes("centro") ||
        v.includes("revolución") ||
        v.includes("av. revolucion") ||
        v.includes("revolucion")
      );
    }
    if (z.includes("otay")) return v.includes("otay");
    if (z.includes("playas")) return v.includes("playas");
    return v.includes(z);
  }

  // ----------------------------------------
  // Aplica filtros de la UI a la lista de Places
  // ----------------------------------------
  function applyClientFiltersFromUI() {
    const q = normalize(document.getElementById("q")?.value);
    const ratingSel = document.getElementById("rating")?.value || "all";
    const priceSel = document.getElementById("price")?.value || "all";
    const zoneSel = document.getElementById("zone")?.value || "all";

    let list = [...lastPlacesRaw];

    if (q) {
      list = list.filter((p) => {
        const name = normalize(p.name);
        const addr = normalize(p.vicinity || p.formatted_address);
        return name.includes(q) || addr.includes(q);
      });
    }

    if (ratingSel !== "all") {
      const minR = Number(ratingSel);
      list = list.filter((p) => (p.rating ?? 0) >= minR);
    }

    if (zoneSel !== "all") {
      list = list.filter((p) => matchZone(p, zoneSel));
    }

    if (priceSel !== "all") {
      list = list.filter((p) => matchPriceRange(p, priceSel));
    }

    renderMarkers(list);
    renderListFromPlaces(list);
  }

  // ----------------------------------------
  // Ejecuta una búsqueda de hoteles cercanos
  // ----------------------------------------
  async function runSearch({ freshLocation = false } = {}) {
    setPlaceholder("Buscando hoteles cercanos...");

    const center = freshLocation
      ? await getUserLocation()
      : lastCenter || (await getUserLocation());

    ensureMap(center);
    setUserMarker(center);

    const places = await searchNearbyHotels(center);
    lastPlacesRaw = places;

    setPlaceholder(places.length ? "" : "Sin resultados");

    applyClientFiltersFromUI();
  }

  // ----------------------------------------
  // Conecta los controles de la UI
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
  // Flujo completo de inicialización del mapa de hoteles
  // ----------------------------------------
  async function initHotelsFlow() {
    setPlaceholder("Cargando mapa...");

    const center = await getUserLocation();
    ensureMap(center);
    setUserMarker(center);

    wireUIControls();

    await runSearch({ freshLocation: false });
  }

  // ── API pública ───────────────────────────────────────────
  return {
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
})();

// ================= Soporte (Frontend only) =================

let supportBound = false;

function showSupportToast(message) {
  const toastEl = document.getElementById("supportToast");
  const bodyEl = document.getElementById("supportToastBody");
  if (bodyEl) bodyEl.textContent = message;

  if (!toastEl || typeof bootstrap === "undefined") {
    alert(message);
    return;
  }

  const t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2200 });
  t.show();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function bindSupportEventsIfPossible() {
  if (supportBound) return;

  const form = document.getElementById("supportForm");
  const btnClear = document.getElementById("btnSupportClear");
  const btnEmail = document.getElementById("btnSupportEmail");

  if (!form || !btnClear || !btnEmail) return;

  supportBound = true;

  const $name = document.getElementById("supportName");
  const $email = document.getElementById("supportEmail");
  const $topic = document.getElementById("supportTopic");
  const $msg = document.getElementById("supportMsg");
  const $hint = document.getElementById("supportHint");

  const SUPPORT_EMAIL = "soporte@tjhotels.com";

  function setHint(txt) {
    if ($hint) $hint.textContent = txt || "";
  }

  btnEmail.addEventListener("click", () => {
    const subject = encodeURIComponent("Soporte TJ Hotels");
    const body = encodeURIComponent("Hola, necesito ayuda con...");
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  });

  btnClear.addEventListener("click", () => {
    if ($name) $name.value = "";
    if ($email) $email.value = "";
    if ($topic) $topic.value = "General";
    if ($msg) $msg.value = "";
    setHint("");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = ($name?.value || "").trim();
    const email = ($email?.value || "").trim();
    const topic = ($topic?.value || "General").trim();
    const msg = ($msg?.value || "").trim();

    if (name.length < 2) {
      setHint("Escribe tu nombre (mínimo 2 caracteres).");
      return;
    }
    if (!isValidEmail(email)) {
      setHint("Escribe un email válido.");
      return;
    }
    if (msg.length < 10) {
      setHint("Describe tu mensaje (mínimo 10 caracteres).");
      return;
    }

    setHint("");

    const item = {
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      createdAt: new Date().toISOString(),
      name,
      email,
      topic,
      msg,
      view: currentView,
    };

    const key = "tj_support_tickets";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.unshift(item);
    localStorage.setItem(key, JSON.stringify(prev));

    showSupportToast("✅ Mensaje enviado. Gracias, te contactaremos pronto.");

    if ($msg) $msg.value = "";
  });
}

// ── Re-bind automático al cambiar a la vista de soporte ──────
const _oldSetActiveView = setActiveView;
setActiveView = function (view) {
  _oldSetActiveView(view);
  if (view === "soporte") bindSupportEventsIfPossible();
};
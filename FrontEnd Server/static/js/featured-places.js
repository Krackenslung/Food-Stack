// Hoteles destacados (Inicio) usando Places Nearby Search
window.FeaturedPlaces = (function () {
  const DEFAULT_CENTER = { lat: 32.5149, lng: -117.0382 }; // Tijuana fallback
  const RADIUS_METERS = 4500; // destacado "cerca" del centro
  const MAX_ITEMS = 10;

  // Reviews (Place Details)
  const DEFAULT_MAX_REVIEW_CARDS = 10;     // cuántas tarjetas salen en el carrusel
  const DEFAULT_MAX_HOTELS_FOR_REVIEWS = 6; // de cuántos hoteles destacados jalamos reviews
  const FALLBACK_AVATAR_WOMAN = "/static/images/woman-user-circle-icon.webp";
  const FALLBACK_AVATAR_MAN = "/static/images/man-user-circle-icon.webp";

  let hiddenMap = null;
  let lastFeaturedPlaces = []; // <- memoria de destacados (para reviews)

  function $(id) { return document.getElementById(id); }

  function setNote(msg) {
    const note = $("featuredNote");
    if (note) note.textContent = msg;
  }

  function setReviewsNote(msg) {
    const note = $("reviewsNote");
    if (note) note.textContent = msg;
  }

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

  function ensureHiddenMap(center) {
    if (hiddenMap) return hiddenMap;

    // PlacesService necesita un Map o un DIV.
    const div = document.createElement("div");
    div.style.width = "1px";
    div.style.height = "1px";
    div.style.position = "absolute";
    div.style.left = "-9999px";
    div.style.top = "-9999px";
    document.body.appendChild(div);

    hiddenMap = new google.maps.Map(div, {
      center,
      zoom: 14,
      disableDefaultUI: true,
    });

    return hiddenMap;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildCard(place) {
    const name = place.name || "Hotel";
    const rating = place.rating ?? "—";
    const reviews = place.user_ratings_total ?? 0;
    const addr = place.vicinity || place.formatted_address || "Tijuana";
    const placeId = place.place_id;

    const gmapsUrl = placeId
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + addr)}`;

    let photoUrl = "";
    try {
      if (place.photos && place.photos.length) {
        photoUrl = place.photos[0].getUrl({ maxWidth: 520, maxHeight: 320 });
      }
    } catch (_) {}

    const cover = photoUrl
      ? `<img class="featured-img" src="${photoUrl}" alt="${escapeHtml(name)}" loading="lazy">`
      : `<div class="featured-img placeholder">🏨</div>`;

    return `
      <a class="featured-card" href="${gmapsUrl}" target="_blank" rel="noopener">
        <div class="featured-cover">${cover}</div>
        <div class="featured-body">
          <div class="featured-name">${escapeHtml(name)}</div>
          <div class="featured-meta">⭐ ${escapeHtml(rating)} • (${Number(reviews).toLocaleString()})</div>
          <div class="featured-addr">${escapeHtml(addr)}</div>
        </div>
      </a>
    `;
  }

  function render(places) {
    const group = $("featuredGroup");
    const clone = $("featuredGroupClone");
    if (!group || !clone) return;

    if (!places.length) {
      group.innerHTML = `<div class="text-muted small p-3">No hay destacados por ahora.</div>`;
      clone.innerHTML = "";
      return;
    }

    const html = places.map(buildCard).join("");
    group.innerHTML = html;
    clone.innerHTML = html; // loop perfecto
  }

  function nearbyHotels(center) {
    return new Promise((resolve, reject) => {
      const map = ensureHiddenMap(center);
      const service = new google.maps.places.PlacesService(map);

      service.nearbySearch(
        { location: center, radius: RADIUS_METERS, type: "lodging" },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) return resolve(results || []);
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) return resolve([]);
          reject(new Error("Places error: " + status));
        }
      );
    });
  }

  async function init() {
    setNote("Cargando hoteles destacados desde Places...");

    try {
      const center = await getUserLocation();
      const results = await nearbyHotels(center);

      // Orden simple: mejor rating primero (si existe)
      const sorted = (results || [])
        .slice()
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, MAX_ITEMS);

      lastFeaturedPlaces = sorted; // <- guardamos para reviews

      render(sorted);
setNote("");    } catch (err) {
      console.error("[FeaturedPlaces] error:", err);
      setNote("No se pudieron cargar los destacados (Places). Revisa la consola.");
      lastFeaturedPlaces = [];
      render([]);
    }
  }

  function getDetails(placeId, fields) {
    return new Promise((resolve, reject) => {
      const map = ensureHiddenMap(DEFAULT_CENTER);
      const service = new google.maps.places.PlacesService(map);

      service.getDetails(
        { placeId, fields },
        (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) return resolve(place);
          reject(new Error("Place Details error: " + status));
        }
      );
    });
  }

  function pickFallbackAvatar(authorName) {
    // Simple alternancia por hash (estable) para variar íconos
    const s = String(authorName || "");
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return (hash % 2 === 0) ? FALLBACK_AVATAR_WOMAN : FALLBACK_AVATAR_MAN;
  }

  function buildReviewCard({ author, text, avatarUrl, hotelName }) {
    const safeAuthor = escapeHtml(author || "Usuario");
    const safeText = escapeHtml(text || "");
    const safeHotel = escapeHtml(hotelName || "Hotel");

    const avatar = avatarUrl || pickFallbackAvatar(author);
    // Mantengo exactamente tu estructura/clases para no tocar CSS
    return `
      <div class="review-card">
        <img class="review-avatar" src="${avatar}" alt="User" loading="lazy" />
        <div class="review-meta">
          <div class="review-name">${safeAuthor} — ${safeHotel}</div>
          <div class="review-text">“${safeText}”</div>
        </div>
      </div>
    `;
  }

  function renderReviews(reviewCardsHtml) {
    const group = $("reviewsGroup");
    const clone = $("reviewsGroupClone");
    if (!group || !clone) return;

    if (!reviewCardsHtml || !reviewCardsHtml.length) {
      group.innerHTML = `<div class="text-muted small p-3">No hay reseñas disponibles por ahora.</div>`;
      clone.innerHTML = "";
      return;
    }

    const html = reviewCardsHtml.join("");
    group.innerHTML = html;
    clone.innerHTML = html; // loop perfecto
  }

  async function loadAndRenderReviewsFromFeatured(apiKey, opts = {}) {
    const maxCards = Number(opts.maxCards ?? DEFAULT_MAX_REVIEW_CARDS);
    const maxHotels = Number(opts.maxHotels ?? DEFAULT_MAX_HOTELS_FOR_REVIEWS);

    // DOM check
    const hasDOM =
      document.getElementById("reviewsGroup") &&
      document.getElementById("reviewsGroupClone") &&
      document.getElementById("reviewsTrack") &&
      document.getElementById("reviewsNote");

    if (!hasDOM) return;

setReviewsNote("");
    try {
      await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });

      // Asegura que Featured ya tenga data
      if (!lastFeaturedPlaces || lastFeaturedPlaces.length === 0) {
        // Si alguien llamó esto antes que init(), intentamos cargar destacados rápido
        await init();
      }

      const baseHotels = (lastFeaturedPlaces || []).slice(0, Math.max(1, maxHotels));

      // Pedimos Place Details para reviews
      const detailsList = await Promise.allSettled(
        baseHotels
          .filter(p => !!p.place_id)
          .map(p => getDetails(p.place_id, ["name", "reviews", "place_id"]))
      );

      const allReviews = [];
      for (const r of detailsList) {
        if (r.status !== "fulfilled") continue;
        const place = r.value;
        const hotelName = place?.name || "Hotel";
        const reviews = Array.isArray(place?.reviews) ? place.reviews : [];
        for (const rev of reviews) {
          // rev: author_name, profile_photo_url, text, time, rating, etc.
         allReviews.push({
  hotelName,
  author: rev.author_name || "Usuario",
  avatarUrl: rev.profile_photo_url || "",
  text: rev.text || "",
  time: Number(rev.time || 0),
  rating: Number(rev.rating || 0)
});
        }
      }

      // Ordena por más reciente (si time existe)
      allReviews.sort((a, b) => (b.time || 0) - (a.time || 0));

      // Filtra vacías y recorta
     const MIN_LEN = 60;     // “mediana” mínimo (ajusta)
const MAX_LEN = 220;    // “mediana” máximo (ajusta)
const MIN_RATING = 4;   // solo positivas (4-5). Si quieres “puras 5”, pon 5.

const picked = allReviews
  .filter(x => {
    const t = (x.text || "").trim();
    const lenOk = t.length >= MIN_LEN && t.length <= MAX_LEN;

    // rating puede venir undefined si algo raro, lo descartamos
    const r = Number(x.rating ?? 0);
    const ratingOk = r >= MIN_RATING;

    return lenOk && ratingOk;
  })
  .slice(0, Math.max(1, maxCards));

      if (!picked.length) {
        renderReviews([]);
        setReviewsNote("No se encontraron reseñas públicas para los destacados.");
        return;
      }

      const cards = picked.map(buildReviewCard);
      renderReviews(cards);
setReviewsNote("");    } catch (err) {
      console.error("[Reviews] error:", err);
      renderReviews([]);
      setReviewsNote("No se pudieron cargar reseñas (Place Details). Revisa consola/API Key.");
    }
  }

  return {
    async loadAndRender(apiKey) {
      // Reusa tu loader existente
      await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });
      await init();
    },

    // ✅ NUEVO: para que app.js pueda reusar destacados
    getFeaturedPlaces() {
      return (lastFeaturedPlaces || []).slice();
    },

    // ✅ NUEVO: carga y renderiza reviews reales a partir de los destacados
    async loadAndRenderReviewsFromFeatured(apiKey, opts = {}) {
      await loadAndRenderReviewsFromFeatured(apiKey, opts);
    }
  };
})();
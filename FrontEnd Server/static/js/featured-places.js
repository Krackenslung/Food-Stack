// Featured hotels (Inicio) using Places
window.FeaturedPlaces = (function () {
  const DEFAULT_CENTER = { lat: 32.5149, lng: -117.0382 }; // Tijuana fallback
  const MAX_ITEMS = 10;

  // Search in stages and stop at MAX_ITEMS distinct hotels: a fixed
  // radius only returned 1 or 2 real hotels
  const SEARCH_RADII = [5000, 10000, 20000];
  const MAX_RADIUS = SEARCH_RADII[SEARCH_RADII.length - 1];
  const GRID_STEP_METERS = 7000;

  // Reviews (Place Details)
  const DEFAULT_MAX_REVIEW_CARDS = 10;     // how many cards the carousel shows
  const DEFAULT_MAX_HOTELS_FOR_REVIEWS = 6; // how many featured hotels we pull reviews from
  const FALLBACK_AVATAR_WOMAN = "/static/images/woman-user-circle-icon.webp";
  const FALLBACK_AVATAR_MAN = "/static/images/man-user-circle-icon.webp";

  let hiddenMap = null;
  let lastFeaturedPlaces = []; // <- featured memory (for reviews)

  function $(id) { return document.getElementById(id); }

  // Quality score: rating weighted by how many people voted.
  // Raw rating alone put a 5-star hotel with 3 reviews above the Grand
  // Hotel with 6,315. log10 dampens the vote count so a huge hotel does
  // not bury a good small one either.
  function qualityScore(place) {
    const rating = Number(place?.rating ?? 0);
    const votes = Number(place?.user_ratings_total ?? 0);
    return rating * Math.log10(votes + 1);
  }

  // Drop houses and gated communities without reviews
  function hasReviews(place) {
    return Number(place?.user_ratings_total ?? 0) > 0;
  }

  // textSearch("hotel") also returns restaurants, spas and agencies.
  function isLodging(place) {
    return (place?.types || []).includes("lodging");
  }

  // NOTE: San Diego hotels slip in, so we filter by address
  function isInMexico(place) {
    const addr = String(place?.formatted_address || place?.vicinity || "");

    if (/(EE\.\s?UU\.|U\.?S\.?A\.?|United States|Estados Unidos)/i.test(addr)) {
      return false;
    }

    return /m[eé]xico/i.test(addr);
  }

  // Haversine: the loader only requests "places", no "geometry"
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

    // PlacesService needs a Map or a DIV.
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
          <div class="featured-meta"><i class="bi bi-star-fill text-warning"></i> ${escapeHtml(rating)} • (${Number(reviews).toLocaleString()})</div>
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
      group.innerHTML = `<div class="text-muted small p-3">No featured hotels right now.</div>`;
      clone.innerHTML = "";
      return;
    }

    const html = places.map(buildCard).join("");
    group.innerHTML = html;
    clone.innerHTML = html; // perfect loop
  }

  // textSearch and not nearbySearch: the latter caps at 60 and in dense
  // areas those are private homes, hiding the real hotels
  // Desplaza un punto N metros al norte y M al este
  function offsetLatLng(center, north, east) {
    const M_PER_DEG_LAT = 111320;
    const latRad = (center.lat * Math.PI) / 180;

    return {
      lat: center.lat + north / M_PER_DEG_LAT,
      lng: center.lng + east / (M_PER_DEG_LAT * Math.cos(latRad)),
    };
  }

  // Una consulta de textSearch (primera pagina)
  function textSearchOnce(service, center, radius) {
    return new Promise((resolve, reject) => {
      service.textSearch(
        { location: center, radius, query: "hotel" },
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            return resolve(results || []);
          }
          if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            return resolve([]);
          }
          reject(new Error("Places error: " + status));
        }
      );
    });
  }

  // Busca hoteles hasta juntar MAX_ITEMS distintos.
  // Primero amplia el radio por etapas (lo cercano tiene prioridad) y, si
  // aun faltan, reparte consultas en una rejilla: textSearch devuelve 20
  // por consulta, asi que la unica forma de encontrar mas es preguntar en
  // varios puntos.
  async function nearbyHotels(center) {
    const map = ensureHiddenMap(center);
    const service = new google.maps.places.PlacesService(map);

    const all = [];
    const seen = new Set();
    let lastError = null;

    const collect = (results, limit) => {
      (results || []).forEach((p) => {
        const id = p.place_id;
        if (id && seen.has(id)) return;

        const loc = p.geometry?.location;
        if (!loc) return;

        if (distanceMeters(center, loc) > limit) return;
        if (!isLodging(p)) return;
        if (!hasReviews(p)) return;
        if (!isInMexico(p)) return;

        if (id) seen.add(id);
        all.push(p);
      });
    };

    const probe = async (point, radius, limit) => {
      try {
        collect(await textSearchOnce(service, point, radius), limit);
      } catch (err) {
        // Un sondeo que falla no debe tirar toda la busqueda
        lastError = err;
      }
    };

    // Etapa 1: ampliar el radio desde el centro
    for (const radius of SEARCH_RADII) {
      await probe(center, radius, radius);
      if (all.length >= MAX_ITEMS) return all;
    }

    // Etapa 2: rejilla, solo si aun faltan hoteles
    const steps = Math.ceil(MAX_RADIUS / GRID_STEP_METERS);
    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        if (i === 0 && j === 0) continue;

        const point = offsetLatLng(center, i * GRID_STEP_METERS, j * GRID_STEP_METERS);
        if (distanceMeters(center, point) > MAX_RADIUS) continue;

        await probe(point, GRID_STEP_METERS, MAX_RADIUS);
        if (all.length >= MAX_ITEMS) return all;
      }
    }

    if (!all.length && lastError) throw lastError;

    return all;
  }

  async function init() {
    setNote("Loading featured hotels from Places...");

    try {
      const center = await getUserLocation();
      const results = await nearbyHotels(center);

      // Simple order: best rating first (when present)
      const sorted = (results || [])
        .sort((a, b) => qualityScore(b) - qualityScore(a))
        .slice(0, MAX_ITEMS);

      lastFeaturedPlaces = sorted; // <- kept for reviews

      render(sorted);
      setNote("");

      // Report the outcome: the caller cannot tell success from failure
      // if we swallow the error here and return undefined.
      return { ok: true, count: sorted.length };
    } catch (err) {
      console.error("[FeaturedPlaces] error:", err);
      setNote("Could not load featured hotels (Places). Check the console.");
      lastFeaturedPlaces = [];
      render([]);
      return { ok: false, count: 0 };
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
    // Stable hash alternation to vary the icons
    const s = String(authorName || "");
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
    return (hash % 2 === 0) ? FALLBACK_AVATAR_WOMAN : FALLBACK_AVATAR_MAN;
  }

  function buildReviewCard({ author, text, avatarUrl, hotelName }) {
    const safeAuthor = escapeHtml(author || "User");
    const safeText = escapeHtml(text || "");
    const safeHotel = escapeHtml(hotelName || "Hotel");

    const avatar = avatarUrl || pickFallbackAvatar(author);
    // Same structure/classes to avoid touching the CSS
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
      group.innerHTML = `<div class="text-muted small p-3">No reviews available right now.</div>`;
      clone.innerHTML = "";
      return;
    }

    const html = reviewCardsHtml.join("");
    group.innerHTML = html;
    clone.innerHTML = html; // perfect loop
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

    if (!hasDOM) return { ok: false, count: 0 };

    setReviewsNote("");
    try {
      await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });

      // Make sure Featured already has data
      if (!lastFeaturedPlaces || lastFeaturedPlaces.length === 0) {
        // If called before init(), try loading featured quickly
        await init();
      }

      const baseHotels = (lastFeaturedPlaces || []).slice(0, Math.max(1, maxHotels));

      // Ask Place Details for reviews
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
  author: rev.author_name || "User",
  avatarUrl: rev.profile_photo_url || "",
  text: rev.text || "",
  time: Number(rev.time || 0),
  rating: Number(rev.rating || 0)
});
        }
      }

      // Sort by most recent (when time exists)
      allReviews.sort((a, b) => (b.time || 0) - (a.time || 0));

      // Drop empty ones and trim
     const MIN_LEN = 60;     // minimum “medium” length (tune it)
const MAX_LEN = 220;    // maximum “medium” length (tune it)
const MIN_RATING = 4;   // positive only (4-5). Use 5 for “only 5 stars”.

const picked = allReviews
  .filter(x => {
    const t = (x.text || "").trim();
    const lenOk = t.length >= MIN_LEN && t.length <= MAX_LEN;

    // rating can be undefined in odd cases, drop it
    const r = Number(x.rating ?? 0);
    const ratingOk = r >= MIN_RATING;

    return lenOk && ratingOk;
  })
  .slice(0, Math.max(1, maxCards));

      if (!picked.length) {
        renderReviews([]);
        setReviewsNote("No public reviews found for the featured hotels.");
        return { ok: false, count: 0 };
      }

      const cards = picked.map(buildReviewCard);
      renderReviews(cards);
      setReviewsNote("");

      return { ok: true, count: cards.length };
    } catch (err) {
      console.error("[Reviews] error:", err);
      renderReviews([]);
      setReviewsNote("Could not load reviews (Place Details). Check console/API key.");
      return { ok: false, count: 0 };
    }
  }

  return {
    async loadAndRender(apiKey) {
      // Reuse the existing loader
      await window.loadGoogleMapsOnce({ apiKey, libraries: "places" });
      return await init();
    },

    // NEW: lets app.js reuse the featured list
    getFeaturedPlaces() {
      return (lastFeaturedPlaces || []).slice();
    },

    // NEW: loads and renders real reviews from the featured hotels
    async loadAndRenderReviewsFromFeatured(apiKey, opts = {}) {
      return await loadAndRenderReviewsFromFeatured(apiKey, opts);
    }
  };
})();
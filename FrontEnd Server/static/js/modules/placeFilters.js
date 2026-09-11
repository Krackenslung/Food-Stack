// ================= FILTROS CLIENT-SIDE =================
// Filters shared by the Hoteles and Favoritos views.
// They run over Places API results (nearbySearch / getDetails).

// Accent-insensitive: "jardin" must match "Jardin"
export function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function matchPriceRange(place, priceRange) {
  if (!priceRange || priceRange === "all") return true;
  const level = place.price_level;
  if (level == null) return true;
  if (priceRange === "0-100") return level <= 1;
  if (priceRange === "100-200") return level === 2;
  if (priceRange === "200-999") return level >= 3;
  return true;
}

// Tijuana zones with their colonias. It used to be a loose substring
// match and "playas" let Playas de Rosarito through, another city.
const ZONAS = {
  "zona rio": ["zona urbana rio", "zona rio", "rio tijuana", "paseo de los heroes",
               "agua caliente", "hipodromo", "aviacion"],
  centro: ["zona centro", "revolucion", "primera 1era", "col. centro"],
  otay: ["otay"],
  playas: ["playas de tijuana", "playas tijuana"],
};

// Neighboring cities that fall inside the radius
const CIUDADES_FUERA = ["rosarito", "ensenada", "tecate", "mexicali"];

export function matchZone(place, zone) {
  if (!zone || zone === "all") return true;

  const v = normalize(place.vicinity || place.formatted_address || "");
  const z = normalize(zone);

  // NOTE: some Rosarito addresses carry "tijuana" in the highway name,
  // so we must exclude rather than require.
  if (CIUDADES_FUERA.some((c) => v.includes(c))) return false;

  const claves = ZONAS[z] || Object.entries(ZONAS).find(([k]) => z.includes(k))?.[1];

  if (!claves) return v.includes(z);

  return claves.some((clave) => v.includes(clave));
}

// ----------------------------------------
// Read the current values from the filter bar
// ----------------------------------------
export function readFiltersFromUI() {
  return {
    q: normalize(document.getElementById("q")?.value),
    rating: document.getElementById("rating")?.value || "all",
    price: document.getElementById("price")?.value || "all",
    zone: document.getElementById("zone")?.value || "all",
  };
}

// ----------------------------------------
// Apply the UI filters to a list of Places
// ----------------------------------------
// skipQuery: if the list came from Places, Google already applied the term
export function filterPlaces(places, options = {}) {
  const { q, rating, price, zone } = readFiltersFromUI();

  let list = [...places];

  if (q && !options.skipQuery) {
    list = list.filter((p) => {
      const name = normalize(p.name);
      const addr = normalize(p.vicinity || p.formatted_address);
      return name.includes(q) || addr.includes(q);
    });
  }

  if (rating !== "all") {
    const minR = Number(rating);
    list = list.filter((p) => (p.rating ?? 0) >= minR);
  }

  if (zone !== "all") {
    list = list.filter((p) => matchZone(p, zone));
  }

  if (price !== "all") {
    list = list.filter((p) => matchPriceRange(p, price));
  }

  return list;
}

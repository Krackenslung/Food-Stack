// Carga Google Maps JS API solo 1 vez (cuando lo necesites)
window.__gmapsPromise = null;

window.loadGoogleMapsOnce = function ({ apiKey, libraries = "places" } = {}) {
  if (window.google?.maps) return Promise.resolve();

  if (window.__gmapsPromise) return window.__gmapsPromise;

  window.__gmapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.defer = true;

    // IMPORTANTE: sin callback, resolvemos en onload
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&libraries=${encodeURIComponent(libraries)}`;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps JS API"));

    document.head.appendChild(script);
  });

  return window.__gmapsPromise;
};
// weather.js
// Frontend script (ES module)
const input = document.getElementById("city-input");
const suggestionsEl = document.getElementById("suggestions");
const weatherCard = document.getElementById("weather-card");
const locationEl = weatherCard.querySelector(".location");
const tempEl = weatherCard.querySelector(".temp");
const descEl = weatherCard.querySelector(".desc");
const detailsEl = weatherCard.querySelector(".details");
const updatedEl = weatherCard.querySelector(".updated");
const geoStatus = document.getElementById("geo-status");
const useLocationBtn = document.getElementById("use-location");

let debounceTimer = null;
let activeWatchId = null;
let lastFetchedAt = null;

// Utility: debounce
function debounce(fn, ms) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), ms);
  };
}

// Render suggestions list
function showSuggestions(list) {
  suggestionsEl.innerHTML = "";
  if (!list || list.length === 0) {
    suggestionsEl.classList.add("hidden");
    return;
  }
  for (const item of list) {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.tabIndex = 0;
    li.dataset.lat = item.lat;
    li.dataset.lon = item.lon;
    li.className = "suggestion-item";
    li.textContent = formatPlace(item);
    li.addEventListener("click", () => {
      selectSuggestion(item);
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter") selectSuggestion(item);
    });
    suggestionsEl.appendChild(li);
  }
  suggestionsEl.classList.remove("hidden");
}

// Format place display
function formatPlace(p) {
  return `${p.name}${p.state ? ", " + p.state : ""}${p.country ? " — " + p.country : ""}`;
}

// When user selects a suggestion
async function selectSuggestion(item) {
  suggestionsEl.classList.add("hidden");
  input.value = formatPlace(item);
  await fetchAndShowWeather(item.lat, item.lon, formatPlace(item));
}

// Fetch autocomplete suggestions (debounced)
const fetchSuggestions = debounce(async (q) => {
  if (!q || q.trim().length < 1) {
    showSuggestions([]);
    return;
  }
  try {
    const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error("Failed to get suggestions");
    const data = await res.json();
    showSuggestions(data);
  } catch (err) {
    console.error(err);
    showSuggestions([]);
  }
}, 300);

// Fetch weather from server API and display
async function fetchAndShowWeather(lat, lon, nameHint = "") {
  try {
    geoStatus.textContent = "Loading weather...";
    const res = await fetch(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    if (!res.ok) {
      const text = await res.text();
      geoStatus.textContent = `Error fetching weather: ${text}`;
      return;
    }
    const w = await res.json();
    renderWeather(w, nameHint);
    lastFetchedAt = new Date();
    geoStatus.textContent = "";
  } catch (err) {
    console.error(err);
    geoStatus.textContent = "Network error fetching weather";
  }
}

// Render weather data to card
function renderWeather(w, nameHint) {
  weatherCard.classList.remove("hidden");
  const city = nameHint || (w.name ? `${w.name}${w.sys && w.sys.country ? ", " + w.sys.country : ""}` : "");
  locationEl.textContent = city || "Unknown location";
  tempEl.textContent = (w.main && typeof w.main.temp !== "undefined") ? `${Math.round(w.main.temp)}°C` : "N/A";
  descEl.textContent = (w.weather && w.weather[0] && w.weather[0].description) ? capitalize(w.weather[0].description) : "";
  const feels = w.main && typeof w.main.feels_like !== "undefined" ? `${Math.round(w.main.feels_like)}°C` : "N/A";
  const humidity = w.main && typeof w.main.humidity !== "undefined" ? `${w.main.humidity}%` : "N/A";
  const wind = w.wind && typeof w.wind.speed !== "undefined" ? `${w.wind.speed} m/s` : "N/A";
  detailsEl.innerHTML = `<div>Feels: ${feels}</div><div>Humidity: ${humidity}</div><div>Wind: ${wind}</div>`;
  updatedEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
}

// Small helper
function capitalize(s) {
  if (!s) return s;
  return s.split(" ").map(p => p[0].toUpperCase() + p.slice(1)).join(" ");
}

// Geolocation: watchPosition to constantly update weather for the device location
function startLocationWatch() {
  if (!navigator.geolocation) {
    geoStatus.textContent = "Geolocation not supported";
    return;
  }
  // If already watching, don't double-watch
  if (activeWatchId !== null) {
    geoStatus.textContent = "Already tracking your location";
    return;
  }

  activeWatchId = navigator.geolocation.watchPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    geoStatus.textContent = `Tracking location: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    // Only fetch if last fetch >30s old to avoid too many requests
    const now = Date.now();
    if (!lastFetchedAt || (now - lastFetchedAt.getTime()) > 30000) {
      await fetchAndShowWeather(lat, lon, "Your location");
    }
  }, (err) => {
    console.warn("Geolocation error", err);
    geoStatus.textContent = `Geolocation error: ${err.message || err.code}`;
  }, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 10000
  });
}

// Stop location watch (not exposed in UI now but available)
function stopLocationWatch() {
  if (activeWatchId !== null) {
    navigator.geolocation.clearWatch(activeWatchId);
    activeWatchId = null;
    geoStatus.textContent = "Stopped tracking location";
  }
}

// Event listeners
input.addEventListener("input", (e) => {
  fetchSuggestions(e.target.value);
});

input.addEventListener("focus", () => {
  if (suggestionsEl.childElementCount > 0) suggestionsEl.classList.remove("hidden");
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search")) {
    suggestionsEl.classList.add("hidden");
  }
});

useLocationBtn.addEventListener("click", () => {
  startLocationWatch();
});

// try to start tracking automatically (graceful)
if ("geolocation" in navigator) {
  // request a one-shot position to prime permission prompt then start watching
  navigator.geolocation.getCurrentPosition((pos) => {
    // fetch initial weather immediately
    fetchAndShowWeather(pos.coords.latitude, pos.coords.longitude, "Your location");
    // then start watch for constant updates
    startLocationWatch();
  }, (err) => {
    // user may deny — just show status
    geoStatus.textContent = `Location permission: ${err.message || err.code}`;
  }, { enableHighAccuracy: true, timeout: 7000 });
}

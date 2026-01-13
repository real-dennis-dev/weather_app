// server.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import fetch from "node-fetch"; // If Node >=18 you can use global fetch; leave as node-fetch for compatibility.

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENWEATHER_API_KEY;

if (!API_KEY) {
  console.error("ERROR: Set OPENWEATHER_API_KEY in .env (get one from https://openweathermap.org).");
  process.exit(1);
}

app.use(express.static(path.join(process.cwd(), "/"))); // serve files in project root

// Serve the main page (inline HTML so you only need the three files)
app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Local Weather</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="app">
    <header>
      <h1>Weather (Local + search)</h1>
    </header>

    <main>
      <section class="search">
        <label for="city-input">Search city or town</label>
        <input id="city-input" type="search" placeholder="Type city name..." autocomplete="off"/>
        <ul id="suggestions" class="suggestions hidden" role="listbox"></ul>
      </section>

      <section class="controls">
        <button id="use-location">Use my location</button>
      </section>

      <section id="weather-card" class="weather-card hidden" aria-live="polite">
        <div class="location"></div>
        <div class="temp"></div>
        <div class="desc"></div>
        <div class="details"></div>
        <small class="updated"></small>
      </section>

      <section class="status">
        <div id="geo-status"></div>
      </section>
    </main>

    <footer>
      <small>Powered by OpenWeatherMap. Your IP & location are only used locally to fetch weather.</small>
    </footer>
  </div>

  <script src="/weather.js" type="module"></script>
</body>
</html>`);
});

// Proxy to OpenWeatherMap: get weather by lat/lon or by city (lat/lon from geocoding)
app.get("/api/weather", async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: "Provide lat and lon query parameters" });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=metric&appid=${API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Autocomplete / geocoding: query param q (city name)
app.get("/api/autocomplete", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Provide q query parameter" });

    // OpenWeatherMap Direct Geocoding
    const limit = 6; // number of suggestions
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=${limit}&appid=${API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const places = await r.json();
    // Normalize to only needed fields
    const suggestions = places.map(p => ({
      name: p.name,
      state: p.state || "",
      country: p.country || "",
      lat: p.lat,
      lon: p.lon
    }));
    res.json(suggestions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

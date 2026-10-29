// Glass Weather – powered by Open-Meteo (https://open-meteo.com), no API key required.

const DEFAULT_LOCATION = {
  name: "Boca Raton",
  region: "Florida, United States",
  latitude: 26.3587,
  longitude: -80.0831,
};

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

// WMO weather interpretation codes -> [description, day icon, night icon, theme]
const WEATHER_CODES = {
  0: ["Clear sky", "☀️", "🌙", "clear"],
  1: ["Mainly clear", "🌤️", "🌙", "clear"],
  2: ["Partly cloudy", "⛅", "☁️", "cloudy"],
  3: ["Overcast", "☁️", "☁️", "cloudy"],
  45: ["Fog", "🌫️", "🌫️", "fog"],
  48: ["Rime fog", "🌫️", "🌫️", "fog"],
  51: ["Light drizzle", "🌦️", "🌧️", "rain"],
  53: ["Drizzle", "🌦️", "🌧️", "rain"],
  55: ["Heavy drizzle", "🌧️", "🌧️", "rain"],
  56: ["Freezing drizzle", "🌧️", "🌧️", "rain"],
  57: ["Freezing drizzle", "🌧️", "🌧️", "rain"],
  61: ["Light rain", "🌦️", "🌧️", "rain"],
  63: ["Rain", "🌧️", "🌧️", "rain"],
  65: ["Heavy rain", "🌧️", "🌧️", "rain"],
  66: ["Freezing rain", "🌧️", "🌧️", "rain"],
  67: ["Freezing rain", "🌧️", "🌧️", "rain"],
  71: ["Light snow", "🌨️", "🌨️", "snow"],
  73: ["Snow", "🌨️", "🌨️", "snow"],
  75: ["Heavy snow", "❄️", "❄️", "snow"],
  77: ["Snow grains", "🌨️", "🌨️", "snow"],
  80: ["Rain showers", "🌦️", "🌧️", "rain"],
  81: ["Rain showers", "🌧️", "🌧️", "rain"],
  82: ["Violent showers", "⛈️", "⛈️", "storm"],
  85: ["Snow showers", "🌨️", "🌨️", "snow"],
  86: ["Snow showers", "❄️", "❄️", "snow"],
  95: ["Thunderstorm", "⛈️", "⛈️", "storm"],
  96: ["Thunderstorm, hail", "⛈️", "⛈️", "storm"],
  99: ["Thunderstorm, hail", "⛈️", "⛈️", "storm"],
};

const $ = (id) => document.getElementById(id);

const state = {
  unit: load("unit") || "fahrenheit",
  location: load("location") || DEFAULT_LOCATION,
};

// ---------- storage helpers (safe in private mode) ----------
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(`glass-weather:${key}`));
  } catch {
    return null;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(`glass-weather:${key}`, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// ---------- formatting ----------
function describe(code, isDay = 1) {
  const [desc, dayIcon, nightIcon, theme] = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️", "cloudy"];
  return { desc, icon: isDay ? dayIcon : nightIcon, theme };
}

const round = (n) => Math.round(n);

// "2026-10-29T07:22" -> "7:22 AM" (keeps the location's local time, not the browser's)
function formatClock(iso) {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function formatHour(iso) {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
}

function parseLocalDate(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function compassDirection(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function setStatus(message, isError = false) {
  const el = $("status");
  el.textContent = message;
  el.classList.toggle("error", isError);
}

// ---------- API ----------
async function fetchWeather({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "pressure_msl",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability", "is_day"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "precipitation_probability_max",
      "uv_index_max",
    ].join(","),
    temperature_unit: state.unit,
    wind_speed_unit: state.unit === "fahrenheit" ? "mph" : "kmh",
    timezone: "auto",
    forecast_days: 7,
  });

  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  return res.json();
}

async function searchCities(query) {
  const params = new URLSearchParams({ name: query, count: 6, language: "en", format: "json" });
  const res = await fetch(`${GEOCODE_URL}?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.results || [];
}

// ---------- rendering ----------
function renderCurrent(data) {
  const { current, daily } = data;
  const { desc, icon, theme } = describe(current.weather_code, current.is_day);
  const loc = state.location;

  document.body.dataset.theme = current.is_day ? (theme === "clear" || theme === "cloudy" ? `${theme}-day` : theme) : "night";

  $("location").textContent = loc.name;
  $("region").textContent = loc.region || "";
  $("date").textContent = `${parseLocalDate(current.time).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })} · ${formatClock(current.time)} local time`;

  $("current-icon").textContent = icon;
  $("current-temp").textContent = `${round(current.temperature_2m)}°`;
  $("current-desc").textContent = desc;
  $("hi-lo").textContent = `H: ${round(daily.temperature_2m_max[0])}°  L: ${round(daily.temperature_2m_min[0])}°`;

  $("feels").textContent = `${round(current.apparent_temperature)}°`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${round(current.wind_speed_10m)} ${state.unit === "fahrenheit" ? "mph" : "km/h"} ${compassDirection(current.wind_direction_10m)}`;
  const uv = daily.uv_index_max[0] ?? 0;
  $("uv").textContent = `${round(uv)} · ${uvLabel(uv)}`;
  $("pressure").textContent = `${round(current.pressure_msl)} hPa`;
  $("rain").textContent = `${daily.precipitation_probability_max[0] ?? 0}%`;
  $("sunrise").textContent = formatClock(daily.sunrise[0]);
  $("sunset").textContent = formatClock(daily.sunset[0]);

  document.title = `${round(current.temperature_2m)}° ${loc.name} · Glass Weather`;
}

function renderHourly(data) {
  const { hourly, current } = data;
  const currentHour = current.time.slice(0, 13);
  let start = hourly.time.findIndex((t) => t.slice(0, 13) === currentHour);
  if (start < 0) start = 0;

  const container = $("hourly");
  container.replaceChildren();

  for (let i = start; i < Math.min(start + 24, hourly.time.length); i++) {
    const { icon } = describe(hourly.weather_code[i], hourly.is_day[i]);
    const rain = hourly.precipitation_probability[i];
    const el = document.createElement("div");
    el.className = `hour glass-inner${i === start ? " now" : ""}`;
    el.innerHTML = `
      <span class="time">${i === start ? "Now" : formatHour(hourly.time[i])}</span>
      <span class="icon">${icon}</span>
      <span class="t">${round(hourly.temperature_2m[i])}°</span>
      <span class="p">${rain >= 10 ? `💧${rain}%` : ""}</span>`;
    container.appendChild(el);
  }
}

function renderDaily(data) {
  const { daily } = data;
  const weekMin = Math.min(...daily.temperature_2m_min);
  const weekMax = Math.max(...daily.temperature_2m_max);
  const span = weekMax - weekMin || 1;

  const container = $("daily");
  container.replaceChildren();

  daily.time.forEach((day, i) => {
    const { icon, desc } = describe(daily.weather_code[i], 1);
    const lo = daily.temperature_2m_min[i];
    const hi = daily.temperature_2m_max[i];
    const rain = daily.precipitation_probability_max[i] ?? 0;
    const name = i === 0 ? "Today" : parseLocalDate(day).toLocaleDateString(undefined, { weekday: "short" });
    const left = ((lo - weekMin) / span) * 100;
    const width = ((hi - lo) / span) * 100;

    const el = document.createElement("div");
    el.className = "day glass-inner";
    el.innerHTML = `
      <span class="name">${name}</span>
      <span class="icon" title="${desc}">${icon}</span>
      <span class="p">💧${rain}%</span>
      <div class="range">
        <span class="lo">${round(lo)}°</span>
        <div class="bar"><span style="left:${left}%;width:${Math.max(width, 4)}%"></span></div>
        <span class="hi">${round(hi)}°</span>
      </div>`;
    container.appendChild(el);
  });
}

async function refresh() {
  setStatus("Loading weather…");
  try {
    const data = await fetchWeather(state.location);
    renderCurrent(data);
    renderHourly(data);
    renderDaily(data);
    setStatus("");
  } catch (err) {
    console.error(err);
    setStatus("Couldn't load the weather. Please check your connection and try again.", true);
  }
}

function setLocation(location) {
  state.location = location;
  save("location", location);
  refresh();
}

// ---------- search ----------
const input = $("search-input");
const list = $("suggestions");
let results = [];
let activeIndex = -1;
let searchTimer;

function closeSuggestions() {
  list.hidden = true;
  list.replaceChildren();
  activeIndex = -1;
}

function showSuggestions(items) {
  results = items;
  list.replaceChildren();
  activeIndex = -1;

  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No matching cities";
    li.setAttribute("aria-disabled", "true");
    list.appendChild(li);
    list.hidden = false;
    return;
  }

  items.forEach((city, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.textContent = city.name;
    const small = document.createElement("small");
    small.textContent = [city.admin1, city.country].filter(Boolean).join(", ");
    li.appendChild(small);
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      pickCity(i);
    });
    list.appendChild(li);
  });
  list.hidden = false;
}

function pickCity(i) {
  const city = results[i];
  if (!city) return;
  input.value = "";
  input.blur();
  closeSuggestions();
  setLocation({
    name: city.name,
    region: [city.admin1, city.country].filter(Boolean).join(", "),
    latitude: city.latitude,
    longitude: city.longitude,
  });
}

function highlight(index) {
  const items = [...list.querySelectorAll("li[role=option]")];
  if (!items.length) return;
  activeIndex = (index + items.length) % items.length;
  items.forEach((li, i) => li.classList.toggle("active", i === activeIndex));
}

input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = input.value.trim();
  if (query.length < 2) return closeSuggestions();
  searchTimer = setTimeout(async () => {
    try {
      const items = await searchCities(query);
      if (input.value.trim() === query) showSuggestions(items);
    } catch (err) {
      console.error(err);
    }
  }, 300);
});

input.addEventListener("keydown", (e) => {
  if (list.hidden) return;
  if (e.key === "ArrowDown") { e.preventDefault(); highlight(activeIndex + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); highlight(activeIndex - 1); }
  else if (e.key === "Escape") closeSuggestions();
});

input.addEventListener("blur", () => setTimeout(closeSuggestions, 150));

$("search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (activeIndex >= 0) return pickCity(activeIndex);
  const query = input.value.trim();
  if (!query) return;
  try {
    results = await searchCities(query);
    if (results.length) pickCity(0);
    else setStatus(`No results for "${query}".`, true);
  } catch (err) {
    console.error(err);
    setStatus("Search failed. Please try again.", true);
  }
});

// ---------- geolocation ----------
$("locate-btn").addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Geolocation isn't supported by your browser.", true);
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    ({ coords }) =>
      setLocation({
        name: "My Location",
        region: `${coords.latitude.toFixed(2)}°, ${coords.longitude.toFixed(2)}°`,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
    () => setStatus("Location access was denied.", true),
    { timeout: 10000 }
  );
});

// ---------- units ----------
const unitBtn = $("unit-btn");
function updateUnitButton() {
  unitBtn.textContent = state.unit === "fahrenheit" ? "°F" : "°C";
  unitBtn.title = `Switch to ${state.unit === "fahrenheit" ? "Celsius" : "Fahrenheit"}`;
}
unitBtn.addEventListener("click", () => {
  state.unit = state.unit === "fahrenheit" ? "celsius" : "fahrenheit";
  save("unit", state.unit);
  updateUnitButton();
  refresh();
});

// ---------- init ----------
updateUnitButton();
refresh();
setInterval(refresh, 10 * 60 * 1000); // keep data fresh every 10 minutes

# ISM6427 – Glass Weather

A glassmorphic weather app powered by the free [Open-Meteo API](https://open-meteo.com/) (no API key needed).
Default location: **Boca Raton, FL**.

## Features
- Current conditions: temperature, feels like, humidity, wind, UV, pressure, rain chance, sunrise/sunset
- 24-hour hourly forecast and 7-day forecast
- City search (Open-Meteo Geocoding API) and "use my location"
- °F / °C toggle; last city and unit are remembered
- Light, Dark and System color themes (System follows your device setting)
- Personalized greeting ("Good morning, Maria 👋") – defaults to Maria, editable in the app
- Background colors change with the weather and time of day

## Files
- `index.html` – markup
- `style.css` – glassmorphism styles
- `app.js` – API calls and rendering
- `netlify.toml` – Netlify config (static site, no build step)

## Run locally
Open `index.html` in a browser, or serve the folder:
```
python3 -m http.server 8000
```

## Deploy to Netlify
Plain static site, no build command. Publish directory: `.` (repo root).
Either connect this repo in Netlify, or drag the project folder into Netlify Drop.

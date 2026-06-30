/**
 * weather-api.js
 *
 * All network access and raw data shaping lives here, separate from
 * app.js (which owns the DOM). Every exported function returns plain
 * data or throws — nothing in this file touches document/window UI,
 * which makes the async logic easy to read (and would make it easy
 * to unit-test in isolation, which is exactly how this was checked
 * before being wired into the page).
 *
 * Both API calls go through a shared `fetchJson` helper that
 * centralizes the three things that actually go wrong with a real
 * network request:
 *   1. The network itself fails (offline, DNS, CORS) — fetch()
 *      rejects its promise, caught here.
 *   2. The request reaches the server but gets an error status
 *      (404, 400, 500) — fetch() does NOT reject for this; it
 *      resolves with response.ok === false, so that has to be
 *      checked explicitly or failures pass through silently.
 *   3. The response body isn't valid JSON — .json() can itself
 *      throw, separate from the network/HTTP-status failure modes
 *      above.
 */

const WeatherAPI = (function () {
  "use strict";

  const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  /**
   * WMO weather interpretation codes -> human-readable condition
   * + a representative emoji icon. Source: Open-Meteo's documented
   * WMO code table (https://open-meteo.com/en/docs — "WMO Weather
   * interpretation codes"). Codes not in this table fall back to a
   * generic label rather than rendering "undefined".
   */
  const WMO_CODES = {
    0: { label: "Clear sky", icon: "☀️" },
    1: { label: "Mainly clear", icon: "🌤️" },
    2: { label: "Partly cloudy", icon: "⛅" },
    3: { label: "Overcast", icon: "☁️" },
    45: { label: "Fog", icon: "🌫️" },
    48: { label: "Freezing fog", icon: "🌫️" },
    51: { label: "Light drizzle", icon: "🌦️" },
    53: { label: "Drizzle", icon: "🌦️" },
    55: { label: "Heavy drizzle", icon: "🌧️" },
    56: { label: "Light freezing drizzle", icon: "🌧️" },
    57: { label: "Freezing drizzle", icon: "🌧️" },
    61: { label: "Light rain", icon: "🌧️" },
    63: { label: "Rain", icon: "🌧️" },
    65: { label: "Heavy rain", icon: "🌧️" },
    66: { label: "Light freezing rain", icon: "🌧️" },
    67: { label: "Freezing rain", icon: "🌧️" },
    71: { label: "Light snow", icon: "🌨️" },
    73: { label: "Snow", icon: "🌨️" },
    75: { label: "Heavy snow", icon: "❄️" },
    77: { label: "Snow grains", icon: "🌨️" },
    80: { label: "Light rain showers", icon: "🌦️" },
    81: { label: "Rain showers", icon: "🌧️" },
    82: { label: "Heavy rain showers", icon: "⛈️" },
    85: { label: "Snow showers", icon: "🌨️" },
    86: { label: "Heavy snow showers", icon: "❄️" },
    95: { label: "Thunderstorm", icon: "⛈️" },
    96: { label: "Thunderstorm with hail", icon: "⛈️" },
    99: { label: "Severe thunderstorm with hail", icon: "⛈️" },
  };

  function describeWeatherCode(code) {
    return WMO_CODES[code] || { label: "Unknown conditions", icon: "❔" };
  }

  /** 16-point compass conversion for a wind bearing in degrees. */
  function degreesToCompass(degrees) {
    const points = [
      "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
      "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ];
    const index = Math.round(degrees / 22.5) % 16;
    return points[(index + 16) % 16];
  }

  /**
   * A custom error class for HTTP-level failures (request reached
   * the server, server said no). Kept distinct from generic
   * network/parse errors so app.js can show a more specific
   * message for "city not found" (404-shaped) versus "the network
   * is down" versus "the server sent back garbage."
   */
  class WeatherAPIError extends Error {
    constructor(message, kind) {
      super(message);
      this.name = "WeatherAPIError";
      // kind is one of: "network" | "http" | "parse" | "not-found"
      this.kind = kind;
    }
  }

  /**
   * Shared fetch wrapper. Every network call in this file goes
   * through here so the three failure modes described in the file
   * header are handled in exactly one place.
   */
  async function fetchJson(url) {
    let response;
    try {
      response = await fetch(url);
    } catch (networkError) {
      // fetch() rejects for DNS failures, no connectivity, CORS
      // preflight rejection, etc. The browser gives very little
      // detail here by design (for security reasons), so the
      // message is intentionally generic.
      throw new WeatherAPIError(
        "Could not reach the weather service. Check your internet connection and try again.",
        "network"
      );
    }

    if (!response.ok) {
      // fetch() only rejects on true network failure — a 404 or
      // 500 still resolves successfully with response.ok === false,
      // so this has to be checked explicitly or HTTP errors would
      // silently fall through as if they were valid responses.
      throw new WeatherAPIError(
        "The weather service returned an error (status " + response.status + ").",
        "http"
      );
    }

    try {
      return await response.json();
    } catch (parseError) {
      throw new WeatherAPIError(
        "The weather service sent back a response that couldn't be read.",
        "parse"
      );
    }
  }

  /**
   * Resolves a free-text city search to a single best-match
   * location via Open-Meteo's geocoding endpoint. Throws a
   * WeatherAPIError with kind "not-found" if the search returns
   * no results at all — a legitimate, expected outcome (a typo or
   * an obscure place name), not a network failure, so it's
   * surfaced as its own error kind rather than reusing "http".
   */
  async function geocodeCity(cityName) {
    const url =
      GEOCODING_URL +
      "?name=" +
      encodeURIComponent(cityName) +
      "&count=1&language=en&format=json";

    const data = await fetchJson(url);

    // Defensive parsing: the geocoding API's documented shape is
    // { results: [...] }, but on a true no-match it omits the
    // `results` key entirely rather than returning an empty array
    // — so both "missing" and "empty" have to be treated as the
    // same "not found" outcome.
    if (!data.results || data.results.length === 0) {
      throw new WeatherAPIError(
        'No location found for "' + cityName + '". Try a different spelling, or add a country (e.g. "Paris, France").',
        "not-found"
      );
    }

    const place = data.results[0];
    return {
      name: place.name,
      // admin1 (state/region) and country are both optional in the
      // API response — omitted entirely when not applicable — so
      // both default to empty string rather than the literal
      // string "undefined" leaking into the rendered UI.
      admin1: place.admin1 || "",
      country: place.country || "",
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
    };
  }

  /**
   * Fetches current conditions + a short daily forecast for a
   * given coordinate pair. `unit` is "celsius" or "fahrenheit" —
   * Open-Meteo performs the conversion server-side based on the
   * temperature_unit query parameter, so the client never needs
   * to do unit math by hand (and can't introduce a rounding bug
   * by doing so).
   */
  async function fetchWeather(latitude, longitude, unit) {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: "auto",
      temperature_unit: unit === "fahrenheit" ? "fahrenheit" : "celsius",
      wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
      ].join(","),
      forecast_days: "6", // today + 5 upcoming days
    });

    const url = FORECAST_URL + "?" + params.toString();
    const data = await fetchJson(url);

    // The forecast response nests current conditions under
    // `current` with matching units under `current_units` (a
    // separate sibling object, not inline per field) — both are
    // read here so the rendered UI can show the unit symbol the
    // API actually used, rather than assuming it.
    if (!data.current || !data.daily) {
      throw new WeatherAPIError(
        "The weather service response was missing expected data.",
        "parse"
      );
    }

    const current = data.current;
    const currentUnits = data.current_units || {};
    const weatherInfo = describeWeatherCode(current.weather_code);

    // The `daily` block is a set of parallel arrays all indexed by
    // the same position (daily.time[0] pairs with
    // daily.temperature_2m_max[0], etc.) rather than an array of
    // per-day objects — a real REST API shape worth handling
    // explicitly instead of assuming a friendlier structure.
    const days = data.daily.time.map((isoDate, index) => {
      const code = data.daily.weather_code[index];
      const info = describeWeatherCode(code);
      return {
        date: isoDate,
        label: formatDayLabel(isoDate, index),
        condition: info.label,
        icon: info.icon,
        high: Math.round(data.daily.temperature_2m_max[index]),
        low: Math.round(data.daily.temperature_2m_min[index]),
      };
    });

    return {
      temperature: Math.round(current.temperature_2m),
      temperatureUnit: currentUnits.temperature_2m || (unit === "fahrenheit" ? "°F" : "°C"),
      feelsLike: Math.round(current.apparent_temperature),
      condition: weatherInfo.label,
      icon: weatherInfo.icon,
      isDay: current.is_day === 1,
      humidity: Math.round(current.relative_humidity_2m),
      humidityUnit: currentUnits.relative_humidity_2m || "%",
      windSpeed: Math.round(current.wind_speed_10m),
      windUnit: currentUnits.wind_speed_10m || (unit === "fahrenheit" ? "mph" : "km/h"),
      windDirection: degreesToCompass(current.wind_direction_10m),
      windGusts: Math.round(current.wind_gusts_10m),
      precipitation: current.precipitation,
      precipitationUnit: currentUnits.precipitation || "mm",
      observedAt: current.time,
      // Skip today (index 0) for the forecast strip — "today" is
      // already shown in full in the current-conditions panel
      // above it, so repeating it in the strip would be redundant.
      forecast: days.slice(1),
    };
  }

  function formatDayLabel(isoDate, index) {
    if (index === 0) return "Today";
    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }

  // Public surface: only what app.js actually needs to call.
  return {
    geocodeCity,
    fetchWeather,
    WeatherAPIError,
  };
})();

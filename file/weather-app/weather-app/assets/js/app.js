/**
 * app.js
 *
 * Owns the DOM. Talks to the network only through the WeatherAPI
 * module (weather-api.js) — this file never calls fetch() directly,
 * which keeps the "what can fail over the network" logic in one
 * place and this file focused on "given data (or an error), what
 * does the page look like."
 */
(function () {
  "use strict";

  // ---------------------------------------------------------
  // DOM REFERENCES
  // ---------------------------------------------------------

  const form = document.getElementById("search-form");
  const cityInput = document.getElementById("city-input");
  const searchButton = form.querySelector("button[type='submit']");
  const statusMessage = document.getElementById("status-message");
  const resultsSection = document.getElementById("results");

  const resultCity = document.getElementById("result-city");
  const resultMeta = document.getElementById("result-meta");
  const resultTemp = document.getElementById("result-temp");
  const resultCondition = document.getElementById("result-condition");
  const resultMetrics = document.getElementById("result-metrics");
  const resultForecast = document.getElementById("result-forecast");

  const metricTemplate = document.getElementById("metric-template");
  const dayTemplate = document.getElementById("forecast-day-template");

  const unitRadios = document.querySelectorAll('input[name="unit"]');

  // ---------------------------------------------------------
  // STATE
  // Tracking the last successfully-searched location lets the
  // unit toggle re-fetch with the new unit for the same place,
  // rather than requiring the person to re-type the city every
  // time they switch between °C and °F.
  // ---------------------------------------------------------

  /** @type {{ name: string, admin1: string, country: string, latitude: number, longitude: number, timezone: string } | null} */
  let lastLocation = null;

  function getSelectedUnit() {
    const checked = document.querySelector('input[name="unit"]:checked');
    return checked ? checked.value : "celsius";
  }

  // ---------------------------------------------------------
  // STATUS / ERROR DISPLAY
  // One shared region handles loading, error, and "no results"
  // states, rather than three separate DOM elements that all
  // have to be hidden/shown in sync with each other.
  // ---------------------------------------------------------

  function showStatus(message, state) {
    statusMessage.textContent = message;
    statusMessage.dataset.state = state; // "loading" | "error" | "empty"
  }

  function clearStatus() {
    statusMessage.textContent = "";
    statusMessage.removeAttribute("data-state");
  }

  // ---------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------

  function renderResults(location, weather) {
    resultCity.textContent =
      location.name + (location.admin1 ? ", " + location.admin1 : "");
    resultMeta.textContent =
      [location.country, "Updated " + formatTime(weather.observedAt)]
        .filter(Boolean)
        .join(" · ");

    resultTemp.textContent = weather.temperature + weather.temperatureUnit;
    resultCondition.textContent =
      weather.icon + " " + weather.condition + " · Feels like " + weather.feelsLike + weather.temperatureUnit;

    renderMetrics(weather);
    renderForecast(weather.forecast);

    resultsSection.hidden = false;
  }

  function renderMetrics(weather) {
    resultMetrics.innerHTML = "";

    const rows = [
      { label: "Humidity", value: weather.humidity + weather.humidityUnit },
      { label: "Wind", value: weather.windSpeed + " " + weather.windUnit + " " + weather.windDirection },
      { label: "Gusts", value: weather.windGusts + " " + weather.windUnit },
      { label: "Precipitation", value: weather.precipitation + " " + weather.precipitationUnit },
    ];

    rows.forEach((row) => {
      const fragment = metricTemplate.content.cloneNode(true);
      fragment.querySelector(".metric__label").textContent = row.label;
      fragment.querySelector(".metric__value").textContent = row.value;
      resultMetrics.appendChild(fragment);
    });
  }

  function renderForecast(days) {
    resultForecast.innerHTML = "";

    days.forEach((day) => {
      const fragment = dayTemplate.content.cloneNode(true);
      fragment.querySelector(".forecast__day-name").textContent = day.label;
      fragment.querySelector(".forecast__day-icon").textContent = day.icon;
      fragment.querySelector(".forecast__day-condition").textContent = day.condition;
      fragment.querySelector(".forecast__day-high").textContent = day.high + "°";
      fragment.querySelector(".forecast__day-low").textContent = day.low + "°";
      resultForecast.appendChild(fragment);
    });
  }

  function formatTime(isoString) {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    } catch {
      return isoString;
    }
  }

  // ---------------------------------------------------------
  // SEARCH ORCHESTRATION
  // A search is two sequential network calls — geocode the city
  // name to coordinates, then fetch weather for those coordinates
  // — awaited in order since the second call needs the first
  // call's result. Both are wrapped in one try/catch so any
  // failure from either step is handled identically.
  // ---------------------------------------------------------

  async function runSearch(cityName) {
    const trimmed = cityName.trim();
    if (trimmed === "") return;

    setLoading(true);
    showStatus("Searching for \u201C" + trimmed + "\u201D\u2026", "loading");
    resultsSection.hidden = true;

    try {
      const location = await WeatherAPI.geocodeCity(trimmed);
      const weather = await WeatherAPI.fetchWeather(
        location.latitude,
        location.longitude,
        getSelectedUnit()
      );

      lastLocation = location;
      clearStatus();
      renderResults(location, weather);
    } catch (error) {
      // WeatherAPIError carries a `kind` for more specific
      // messaging; anything else (a genuine bug, an unexpected
      // exception) still gets caught here rather than crashing
      // the page silently, but is shown with a generic message
      // since its cause isn't something the user can act on.
      if (error instanceof WeatherAPI.WeatherAPIError) {
        showStatus(error.message, error.kind === "not-found" ? "empty" : "error");
      } else {
        console.error("Unexpected error during search:", error);
        showStatus(
          "Something went wrong while fetching the weather. Please try again.",
          "error"
        );
      }
      resultsSection.hidden = true;
    } finally {
      setLoading(false);
    }
  }

  function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    cityInput.disabled = isLoading;
  }

  // ---------------------------------------------------------
  // EVENT HANDLING
  // ---------------------------------------------------------

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(cityInput.value);
  });

  // Switching units re-fetches weather for the last-searched
  // location rather than requiring a fresh city search, since
  // Open-Meteo converts units server-side and needs a new request
  // to do so (there's no client-side conversion to "just redraw
  // with"— the source numbers themselves are unit-specific).
  unitRadios.forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (!lastLocation) return; // no search yet — nothing to refresh

      setLoading(true);
      showStatus("Updating units\u2026", "loading");

      try {
        const weather = await WeatherAPI.fetchWeather(
          lastLocation.latitude,
          lastLocation.longitude,
          getSelectedUnit()
        );
        clearStatus();
        renderResults(lastLocation, weather);
      } catch (error) {
        if (error instanceof WeatherAPI.WeatherAPIError) {
          showStatus(error.message, "error");
        } else {
          console.error("Unexpected error while updating units:", error);
          showStatus("Could not update units. Please try searching again.", "error");
        }
      } finally {
        setLoading(false);
      }
    });
  });
})();

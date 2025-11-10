const WEATHER_API_URL = 'https://api.weatherapi.com/v1/forecast.json'
const WEATHER_API_SEARCH_URL = 'https://api.weatherapi.com/v1/search.json'

type WeatherApiResponse = {
  location: {
    name: string
    localtime_epoch: number
  }
  current: {
    last_updated_epoch: number
    temp_c: number
    pressure_mb: number
    wind_kph: number
    wind_dir: string
    cloud: number
    uv: number
    precip_mm: number
  }
  forecast: {
    forecastday: Array<{
      date_epoch: number
      day: {
        daily_chance_of_rain: number
        daily_chance_of_snow: number
      }
      hour: Array<{
        time_epoch: number
        pressure_mb: number
      }>
      astro: {
        sunrise: string
        sunset: string
        moon_phase: string
      }
    }>
  }
}

export type WeatherData = {
  locationName: string
  pressureHpa: number
  pressureTrend: 'emelkedő' | 'csökkenő' | 'stabil'
  airTemperatureC: number
  waterTemperatureC: number | null
  windDirection: string
  windSpeedKph: number
  cloudCoverPercent: number
  uvIndex: number
  precipitationChancePercent: number
  precipitationIntensityMmPerHour: number
  sunrise: string
  sunset: string
  moonPhase: string
}

export type LocationSearchResult = {
  id: number
  name: string
  region: string
  country: string
  lat: number
  lon: number
  url: string
}

function determinePressureTrend(currentPressure: number, historyPressure?: number) {
  if (historyPressure === undefined) {
    return 'stabil' as const
  }

  const delta = currentPressure - historyPressure

  if (Math.abs(delta) < 0.5) {
    return 'stabil' as const
  }

  return delta > 0 ? ('emelkedő' as const) : ('csökkenő' as const)
}

function extractPreviousHourPressure(data: WeatherApiResponse) {
  const currentEpoch = data.current.last_updated_epoch
  const allHours = data.forecast.forecastday.flatMap((day) => day.hour)
  const candidates = allHours
    .filter((hour) => hour.time_epoch < currentEpoch)
    .sort((a, b) => b.time_epoch - a.time_epoch)

  return candidates.length > 0 ? candidates[0].pressure_mb : undefined
}

export async function fetchWeather(locationQuery: string): Promise<WeatherData> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY
  if (!apiKey) {
    throw new Error('A WeatherAPI kulcs hiányzik. Add hozzá a VITE_WEATHER_API_KEY változót a .env.local fájlhoz.')
  }

  const url = new URL(WEATHER_API_URL)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', locationQuery)
  url.searchParams.set('days', '1')
  url.searchParams.set('aqi', 'no')
  url.searchParams.set('alerts', 'no')

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`WeatherAPI hiba (${response.status}): ${errorBody}`)
  }

  const data = (await response.json()) as WeatherApiResponse

  const forecastDay = data.forecast.forecastday[0]
  const previousHourPressure = extractPreviousHourPressure(data)
  const pressureTrend = determinePressureTrend(data.current.pressure_mb, previousHourPressure)

  const precipitationChance =
    Math.max(forecastDay.day.daily_chance_of_rain, forecastDay.day.daily_chance_of_snow) ?? 0

  return {
    locationName: data.location.name,
    pressureHpa: data.current.pressure_mb,
    pressureTrend,
    airTemperatureC: data.current.temp_c,
    waterTemperatureC: null, // WeatherAPI "forecast.json" nem tartalmaz vízhőmérséklet adatot.
    windDirection: data.current.wind_dir,
    windSpeedKph: data.current.wind_kph,
    cloudCoverPercent: data.current.cloud,
    uvIndex: data.current.uv,
    precipitationChancePercent: precipitationChance,
    precipitationIntensityMmPerHour: data.current.precip_mm,
    sunrise: forecastDay?.astro.sunrise ?? '-',
    sunset: forecastDay?.astro.sunset ?? '-',
    moonPhase: forecastDay?.astro.moon_phase ?? '-',
  }
}

export async function searchNearestLocation(
  lat: number,
  lon: number,
  countryFilter = 'Hungary',
): Promise<LocationSearchResult | null> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY
  if (!apiKey) {
    throw new Error('A WeatherAPI kulcs hiányzik. Add hozzá a VITE_WEATHER_API_KEY változót a .env.local fájlhoz.')
  }

  const url = new URL(WEATHER_API_SEARCH_URL)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', `${lat},${lon}`)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`WeatherAPI keresési hiba (${response.status}): ${errorBody}`)
  }

  const data = (await response.json()) as LocationSearchResult[]

  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const filtered = countryFilter ? data.filter((item) => item.country.toLowerCase() === countryFilter.toLowerCase()) : data

  return filtered[0] ?? data[0]
}

export async function searchLocations(query: string, countryFilter = 'Hungary'): Promise<LocationSearchResult[]> {
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY
  if (!apiKey) {
    throw new Error('A WeatherAPI kulcs hiányzik. Add hozzá a VITE_WEATHER_API_KEY változót a .env.local fájlhoz.')
  }

  const trimmed = query.trim()

  if (!trimmed) {
    return []
  }

  const url = new URL(WEATHER_API_SEARCH_URL)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('q', trimmed)

  const response = await fetch(url.toString())

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`WeatherAPI keresési hiba (${response.status}): ${errorBody}`)
  }

  const data = (await response.json()) as LocationSearchResult[]

  if (!Array.isArray(data)) {
    return []
  }

  if (!countryFilter) {
    return data
  }

  const filtered = data.filter((item) => item.country.toLowerCase() === countryFilter.toLowerCase())

  return filtered.length > 0 ? filtered : data
}



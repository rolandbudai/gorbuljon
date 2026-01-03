import type { LocationRecord } from '../services/records'

export type DataType = 
  | 'waterLevel'
  | 'waterTemperature'
  | 'airTemperature'
  | 'pressure'
  | 'windSpeed'
  | 'cloudCover'
  | 'precipitationChance'
  | 'uvIndex'
  | 'moonPhase'
  | 'lightChange'

export type DataValue = {
  type: DataType
  value: number
  recordId: string
  fishCount: number
}

export type NormalizedDataValue = {
  type: DataType
  normalizedValue: number // 0-100
  originalValue: number
  recordId: string
  fishCount: number
  min: number
  max: number
}

export type DataTypeConfig = {
  label: string
  unit: string
  min: number
  max: number
}

const DATA_TYPE_CONFIGS: Record<DataType, DataTypeConfig> = {
  waterLevel: { label: 'Vízállás', unit: 'cm', min: 0, max: 500 },
  waterTemperature: { label: 'Vízhőmérséklet', unit: '°C', min: 0, max: 30 },
  airTemperature: { label: 'Levegő hőmérséklet', unit: '°C', min: -20, max: 40 },
  pressure: { label: 'Légnyomás', unit: 'hPa', min: 980, max: 1040 },
  windSpeed: { label: 'Szélsebesség', unit: 'km/h', min: 0, max: 50 },
  cloudCover: { label: 'Felhőzet', unit: '%', min: 0, max: 100 },
  precipitationChance: { label: 'Csapadék esély', unit: '%', min: 0, max: 100 },
  uvIndex: { label: 'UV index', unit: '', min: 0, max: 12 },
  moonPhase: { label: 'Holdfázis', unit: 'nap', min: 0, max: 6 },
  lightChange: { label: 'Fényváltás', unit: '', min: 0, max: 1 },
}

/**
 * Kiszámolja a halak darabszámát egy rekordból
 */
export function calculateFishCount(record: LocationRecord): number {
  if (!record.caughtFish) return 0
  
  if (Array.isArray(record.caughtFish)) {
    return record.caughtFish.length
  }
  
  if (typeof record.caughtFish === 'object') {
    return Object.values(record.caughtFish).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0)
  }
  
  return 0
}

/**
 * Kinyeri az összes adattípus értékeit a rekordokból
 */
export function extractDataValues(records: LocationRecord[]): DataValue[] {
  const values: DataValue[] = []
  
  records.forEach(record => {
    const fishCount = calculateFishCount(record)
    
    // Vízállás
    if (record.waterDataSnapshot?.measurements && record.waterDataSnapshot.measurements.length > 0) {
      const lastMeasurement = record.waterDataSnapshot.measurements[record.waterDataSnapshot.measurements.length - 1]
      const value = typeof lastMeasurement.value === 'string' ? parseFloat(lastMeasurement.value) : lastMeasurement.value
      if (!isNaN(value)) {
        values.push({ type: 'waterLevel', value, recordId: record.id, fishCount })
      }
    }
    
    // Vízhőmérséklet
    if (record.waterTemperatureSnapshot?.measurements && record.waterTemperatureSnapshot.measurements.length > 0) {
      const lastMeasurement = record.waterTemperatureSnapshot.measurements[record.waterTemperatureSnapshot.measurements.length - 1]
      const value = typeof lastMeasurement.value === 'string' ? parseFloat(lastMeasurement.value) : lastMeasurement.value
      if (!isNaN(value)) {
        values.push({ type: 'waterTemperature', value, recordId: record.id, fishCount })
      }
    }
    
    // Levegő hőmérséklet
    if (record.weatherSnapshot?.airTemperatureC !== undefined) {
      values.push({ type: 'airTemperature', value: record.weatherSnapshot.airTemperatureC, recordId: record.id, fishCount })
    }
    
    // Légnyomás
    if (record.weatherSnapshot?.pressureHpa !== undefined) {
      values.push({ type: 'pressure', value: record.weatherSnapshot.pressureHpa, recordId: record.id, fishCount })
    }
    
    // Szélsebesség
    if (record.weatherSnapshot?.windSpeedKph !== undefined) {
      values.push({ type: 'windSpeed', value: record.weatherSnapshot.windSpeedKph, recordId: record.id, fishCount })
    }
    
    // Felhőzet
    if (record.weatherSnapshot?.cloudCoverPercent !== undefined) {
      values.push({ type: 'cloudCover', value: record.weatherSnapshot.cloudCoverPercent, recordId: record.id, fishCount })
    }
    
    // Csapadék esély
    if (record.weatherSnapshot?.precipitationChancePercent !== undefined) {
      values.push({ type: 'precipitationChance', value: record.weatherSnapshot.precipitationChancePercent, recordId: record.id, fishCount })
    }
    
    // UV index
    if (record.weatherSnapshot?.uvIndex !== undefined) {
      values.push({ type: 'uvIndex', value: record.weatherSnapshot.uvIndex, recordId: record.id, fishCount })
    }
    
    // Holdfázis
    if (record.weatherSnapshot?.moonPhase !== undefined && record.weatherSnapshot.moonPhase !== '-') {
      // A holdfázis string-ként van tárolva (pl. "New Moon", "Full Moon")
      // Át kell alakítanunk számértékké a skálán való megjelenítéshez
      // Használjuk a getMoonLevel függvényt, hogy meghatározzuk a szintet, majd számoljuk a napokat
      const moonPhaseStr = typeof record.weatherSnapshot.moonPhase === 'string' 
        ? record.weatherSnapshot.moonPhase 
        : String(record.weatherSnapshot.moonPhase)
      
      // Számoljuk a napokat a teliholdig
      const LUNAR_CYCLE_DAYS = 29.5
      const phaseToDays: Record<string, number> = {
        'New Moon': Math.round((180 / 360) * LUNAR_CYCLE_DAYS),
        'Waxing Crescent': Math.round((135 / 360) * LUNAR_CYCLE_DAYS),
        'First Quarter': Math.round((90 / 360) * LUNAR_CYCLE_DAYS),
        'Waxing Gibbous': Math.round((45 / 360) * LUNAR_CYCLE_DAYS),
        'Full Moon': 0,
        'Waning Gibbous': Math.round((315 / 360) * LUNAR_CYCLE_DAYS),
        'Last Quarter': Math.round((270 / 360) * LUNAR_CYCLE_DAYS),
        'Waning Crescent': Math.round((225 / 360) * LUNAR_CYCLE_DAYS),
      }
      
      // Magyar fordítást is kezeljük
      const hungarianToEnglish: Record<string, string> = {
        'Újhold': 'New Moon',
        'Növekvő hold': 'Waxing Crescent',
        'Első negyed': 'First Quarter',
        'Telihold': 'Full Moon',
        'Fogyó hold': 'Waning Gibbous',
        'Utolsó negyed': 'Last Quarter',
      }
      
      let englishPhase = moonPhaseStr
      if (hungarianToEnglish[moonPhaseStr]) {
        englishPhase = hungarianToEnglish[moonPhaseStr]
      }
      
      const daysUntilFull = phaseToDays[englishPhase] ?? 0
      
      // Tároljuk a napokat számként (0-29.5)
      values.push({ type: 'moonPhase', value: daysUntilFull, recordId: record.id, fishCount })
    }
    
    // Fényváltás
    if (record.weatherSnapshot?.sunrise && record.weatherSnapshot?.sunset) {
      // Használjuk a rekord mentésének időpontját, ha van date és time
      let referenceDate: Date | undefined = undefined
      if (record.date && record.time) {
        try {
          const dateTimeStr = `${record.date} ${record.time}`
          referenceDate = new Date(dateTimeStr)
          if (isNaN(referenceDate.getTime())) {
            referenceDate = new Date(record.createdAt)
          }
        } catch {
          referenceDate = new Date(record.createdAt)
        }
      } else {
        referenceDate = new Date(record.createdAt)
      }
      
      const lightChangeValue = isLightChangeTime(record.weatherSnapshot.sunrise, record.weatherSnapshot.sunset, referenceDate) ? 1 : 0
      values.push({ type: 'lightChange', value: lightChangeValue, recordId: record.id, fishCount })
    }
  })
  
  return values
}

/**
 * Ellenőrzi, hogy az adott időpont a fényváltás időpontjához képest +/- 30 perc intervallumba esik-e
 */
function isLightChangeTime(sunrise: string, sunset: string, referenceDate?: Date): boolean {
  if (!referenceDate) return false
  
  const now = referenceDate
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  
  // Parse sunrise and sunset times
  const [sunriseHours, sunriseMinutes] = sunrise.split(':').map(Number)
  const [sunsetHours, sunsetMinutes] = sunset.split(':').map(Number)
  
  const sunriseTime = new Date(today)
  sunriseTime.setHours(sunriseHours, sunriseMinutes, 0, 0)
  
  const sunsetTime = new Date(today)
  sunsetTime.setHours(sunsetHours, sunsetMinutes, 0, 0)
  
  // +/- 30 perc intervallum
  const sunriseStart = new Date(sunriseTime.getTime() - 30 * 60 * 1000)
  const sunriseEnd = new Date(sunriseTime.getTime() + 30 * 60 * 1000)
  const sunsetStart = new Date(sunsetTime.getTime() - 30 * 60 * 1000)
  const sunsetEnd = new Date(sunsetTime.getTime() + 30 * 60 * 1000)
  
  return (now >= sunriseStart && now <= sunriseEnd) || (now >= sunsetStart && now <= sunsetEnd)
}

/**
 * Normalizálja az értékeket 0-100 skálára minden típushoz
 */
export function normalizeValue(value: number, type: DataType, allValues?: number[]): NormalizedDataValue {
  const config = DATA_TYPE_CONFIGS[type]
  
  // Ha vannak értékek, dinamikusan számoljuk a min-max-ot
  let min = config.min
  let max = config.max
  
  if (allValues && allValues.length > 0) {
    const actualMin = Math.min(...allValues)
    const actualMax = Math.max(...allValues)
    
    // Használjuk a dinamikus értékeket, de ne menjünk túl a konfigurált határokon
    min = Math.min(min, actualMin)
    max = Math.max(max, actualMax)
    
    // Ha minden érték ugyanaz, adjunk egy kis tartományt
    if (min === max) {
      min = Math.max(0, min - 1)
      max = max + 1
    }
  }
  
  const range = max - min
  const normalizedValue = range > 0 ? ((value - min) / range) * 100 : 50
  
  return {
    type,
    normalizedValue: Math.max(0, Math.min(100, normalizedValue)),
    originalValue: value,
    recordId: '',
    fishCount: 0,
    min,
    max,
  }
}

/**
 * Összesíti az adatértékeket típusonként és normalizálja őket
 */
export function aggregateAndNormalizeData(records: LocationRecord[]): Map<DataType, NormalizedDataValue[]> {
  const values = extractDataValues(records)
  const aggregated = new Map<DataType, NormalizedDataValue[]>()
  
  // Csoportosítás típus szerint
  const groupedByType = new Map<DataType, DataValue[]>()
  values.forEach(value => {
    if (!groupedByType.has(value.type)) {
      groupedByType.set(value.type, [])
    }
    groupedByType.get(value.type)!.push(value)
  })
  
  // Normalizálás minden típushoz
  groupedByType.forEach((typeValues, type) => {
    const allValues = typeValues.map(v => v.value)
    const normalized = typeValues.map(value => {
      const normalized = normalizeValue(value.value, type, allValues)
      return {
        ...normalized,
        recordId: value.recordId,
        fishCount: value.fishCount,
      }
    })
    aggregated.set(type, normalized)
  })
  
  return aggregated
}

/**
 * Összesíti a halak darabszámát adattípus szerint
 */
export function aggregateFishCountsByDataType(records: LocationRecord[]): Map<DataType, number> {
  const values = extractDataValues(records)
  const fishCounts = new Map<DataType, number>()
  
  values.forEach(value => {
    const current = fishCounts.get(value.type) || 0
    fishCounts.set(value.type, current + value.fishCount)
  })
  
  return fishCounts
}

/**
 * Visszaadja az adattípus konfigurációját
 */
export function getDataTypeConfig(type: DataType): DataTypeConfig {
  return DATA_TYPE_CONFIGS[type]
}

/**
 * Visszaadja az összes adattípust sorrendben
 */
export function getAllDataTypes(): DataType[] {
  return Object.keys(DATA_TYPE_CONFIGS) as DataType[]
}

/**
 * Színkódolás helper függvények
 */
export function getWaterLevelLevel(value: number | string): number {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return 0
  if (numValue < 20) return -3
  if (numValue < 70) return -2
  if (numValue < 120) return -1
  if (numValue < 200) return 0
  if (numValue < 400) return 1
  if (numValue < 700) return 2
  return 3
}

export function getWaterTempLevel(value: number | string): number {
  const numValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(numValue)) return 0
  if (numValue <= 2) return -3
  if (numValue <= 6) return -2
  if (numValue <= 10) return -1
  if (numValue <= 16) return 0
  if (numValue <= 20) return 1
  if (numValue <= 24) return 2
  return 3
}

export function getAirTempLevel(value: number): number {
  if (isNaN(value)) return 0
  if (value <= -10) return -3
  if (value <= -2) return -2
  if (value <= 6) return -1
  if (value <= 16) return 0
  if (value <= 24) return 1
  if (value <= 32) return 2
  return 3
}

export function getPressureLevel(value: number): number {
  if (isNaN(value)) return 0
  if (value <= 985) return -3
  if (value <= 995) return -2
  if (value <= 1005) return -1
  if (value <= 1018) return 0
  if (value <= 1025) return 1
  if (value <= 1035) return 2
  return 3
}

export function getCloudCoverLevel(percent: number): number {
  if (isNaN(percent)) return 0
  if (percent <= 10) return -3
  if (percent <= 30) return -2
  if (percent <= 50) return -1
  if (percent <= 70) return 0
  if (percent <= 85) return 1
  if (percent <= 95) return 2
  return 3
}

export function getRainLevel(chance: number): number {
  if (isNaN(chance)) return 0
  if (chance <= 5) return -3
  if (chance <= 20) return -2
  if (chance <= 40) return -1
  if (chance <= 60) return 0
  if (chance <= 75) return 1
  if (chance <= 90) return 2
  return 3
}

export function getWindLevel(speedKph: number): number {
  if (isNaN(speedKph)) return 0
  if (speedKph <= 2) return -3
  if (speedKph <= 9) return -2
  if (speedKph <= 18) return -1
  if (speedKph <= 29) return 0
  if (speedKph <= 40) return 1
  if (speedKph <= 61) return 2
  return 3
}

export function getUVLevel(uvIndex: number): number {
  if (isNaN(uvIndex)) return 0
  if (uvIndex <= 1) return -3
  if (uvIndex <= 2) return -2
  if (uvIndex <= 4) return -1
  if (uvIndex <= 6) return 0
  if (uvIndex <= 7) return 1
  if (uvIndex <= 10) return 2
  return 3
}

export function getMoonLevel(moonPhase: string): number {
  try {
    if (!moonPhase || moonPhase === '-') {
      return 0
    }

    const LUNAR_CYCLE_DAYS = 29.5
    
    const phaseToDays: Record<string, number> = {
      'New Moon': Math.round((180 / 360) * LUNAR_CYCLE_DAYS),
      'Waxing Crescent': Math.round((135 / 360) * LUNAR_CYCLE_DAYS),
      'First Quarter': Math.round((90 / 360) * LUNAR_CYCLE_DAYS),
      'Waxing Gibbous': Math.round((45 / 360) * LUNAR_CYCLE_DAYS),
      'Full Moon': 0,
      'Waning Gibbous': Math.round((315 / 360) * LUNAR_CYCLE_DAYS),
      'Last Quarter': Math.round((270 / 360) * LUNAR_CYCLE_DAYS),
      'Waning Crescent': Math.round((225 / 360) * LUNAR_CYCLE_DAYS),
    }

    const daysUntilFull = phaseToDays[moonPhase] ?? 0
    
    if (daysUntilFull === 0) return 0
    if (daysUntilFull <= 1) return -1
    if (daysUntilFull <= 2) return -2
    if (daysUntilFull <= 3) return -3
    if (daysUntilFull <= 4) return 1
    if (daysUntilFull <= 5) return 2
    return 3
  } catch {
    return 0
  }
}

export function getLightChangeLevel(sunrise: string, sunset: string, referenceDate?: Date): number {
  try {
    const now = referenceDate || new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    const parseTime = (timeStr: string): number => {
      if (!timeStr || timeStr === '-') return -1
      
      const cleaned = timeStr.trim().toUpperCase()
      
      const amPmMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
      if (amPmMatch) {
        let hours = parseInt(amPmMatch[1], 10)
        const minutes = parseInt(amPmMatch[2], 10)
        const amPm = amPmMatch[3]
        
        if (amPm === 'PM' && hours !== 12) hours += 12
        if (amPm === 'AM' && hours === 12) hours = 0
        
        return hours * 60 + minutes
      }
      
      const timeMatch = cleaned.match(/(\d{1,2}):(\d{2})/)
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10)
        const minutes = parseInt(timeMatch[2], 10)
        return hours * 60 + minutes
      }
      
      return -1
    }

    const sunriseTime = parseTime(sunrise)
    const sunsetTime = parseTime(sunset)

    if (sunriseTime === -1 || sunsetTime === -1) {
      return 0
    }

    const sunriseStart = sunriseTime - 30
    const sunriseEnd = sunriseTime + 30
    const sunsetStart = sunsetTime - 30
    const sunsetEnd = sunsetTime + 30

    const isInSunriseRange = 
      (sunriseStart >= 0 && currentTime >= sunriseStart && currentTime <= sunriseEnd) ||
      (sunriseStart < 0 && (currentTime >= (1440 + sunriseStart) || currentTime <= sunriseEnd))
    
    const isInSunsetRange = 
      (sunsetStart >= 0 && currentTime >= sunsetStart && currentTime <= sunsetEnd) ||
      (sunsetEnd >= 1440 && (currentTime >= sunsetStart || currentTime <= (sunsetEnd - 1440)))

    return (isInSunriseRange || isInSunsetRange) ? 1 : 0
  } catch {
    return 0
  }
}

/**
 * Visszaadja a színt egy adattípus és szint alapján
 */
export function getVariantColor(type: DataType, level: number): { bg: string, border: string } {
  // Formázzuk a szintet stringként, hogy egyezzen a colorMap kulcsaival
  const levelStr = level < 0 ? `-${Math.abs(level)}` : `${level}`
  const baseName = type === 'waterLevel' ? 'water' :
                   type === 'waterTemperature' ? 'temp' :
                   type === 'airTemperature' ? 'weather' :
                   type === 'pressure' ? 'pressure' :
                   type === 'cloudCover' ? 'cloud' :
                   type === 'precipitationChance' ? 'rain' :
                   type === 'windSpeed' ? 'wind' :
                   type === 'uvIndex' ? 'uv' :
                   type === 'moonPhase' ? 'moon' :
                   type === 'lightChange' ? 'sun' : 'water'
  
  // CSS változók közvetlen HEX értékei - pontosan egyeznek a CSS változókkal (index.css)
  const colorMap: Record<string, Record<string, { bg: string, border: string }>> = {
    // Vízállás (water) - --color-bg-variant-water-{level}
    water: {
      '-3': { bg: '#020617', border: '#020617' }, // --color-bg-variant-water--3, --color-border-variant-water--3
      '-2': { bg: '#0F172A', border: '#020617' }, // --color-bg-variant-water--2, --color-border-variant-water--2
      '-1': { bg: '#1E3A8A', border: '#1E293B' }, // --color-bg-variant-water--1, --color-border-variant-water--1
      '0': { bg: '#2563EB', border: '#1E40AF' }, // --color-bg-variant-water-0, --color-border-variant-water-0
      '1': { bg: '#60A5FA', border: '#3B82F6' }, // --color-bg-variant-water-1, --color-border-variant-water-1
      '2': { bg: '#38BDF8', border: '#0284C7' }, // --color-bg-variant-water-2, --color-border-variant-water-2
      '3': { bg: '#0284C7', border: '#0369A1' }, // --color-bg-variant-water-3, --color-border-variant-water-3
    },
    // Vízhőmérséklet (temp) - --color-bg-variant-temp-{level}
    temp: {
      '-3': { bg: '#020617', border: '#020617' }, // --color-bg-variant-temp--3, --color-border-variant-temp--3
      '-2': { bg: '#1E3A8A', border: '#1E293B' }, // --color-bg-variant-temp--2, --color-border-variant-temp--2
      '-1': { bg: '#60A5FA', border: '#3B82F6' }, // --color-bg-variant-temp--1, --color-border-variant-temp--1
      '0': { bg: '#FACC15', border: '#F59E0B' }, // --color-bg-variant-temp-0, --color-border-variant-temp-0
      '1': { bg: '#FDBA74', border: '#FB923C' }, // --color-bg-variant-temp-1, --color-border-variant-temp-1
      '2': { bg: '#F97316', border: '#EA580C' }, // --color-bg-variant-temp-2, --color-border-variant-temp-2
      '3': { bg: '#DC2626', border: '#B91C1C' }, // --color-bg-variant-temp-3, --color-border-variant-temp-3
    },
    // Levegő hőmérséklet (weather) - --color-bg-weather-{level}
    weather: {
      '-3': { bg: '#020617', border: '#020617' }, // --color-bg-weather--3, --color-border-weather--3
      '-2': { bg: '#0F172A', border: '#020617' }, // --color-bg-weather--2, --color-border-weather--2
      '-1': { bg: '#1E40AF', border: '#1E293B' }, // --color-bg-weather--1, --color-border-weather--1
      '0': { bg: '#3B82F6', border: '#2563EB' }, // --color-bg-weather-0, --color-border-weather-0
      '1': { bg: '#60A5FA', border: '#3B82F6' }, // --color-bg-weather-1, --color-border-weather-1
      '2': { bg: '#FB923C', border: '#F97316' }, // --color-bg-weather-2, --color-border-weather-2
      '3': { bg: '#DC2626', border: '#B91C1C' }, // --color-bg-weather-3, --color-border-weather-3
    },
    // Légnyomás (pressure) - --color-bg-pressure-{level}
    pressure: {
      '-3': { bg: '#7F1D1D', border: '#450A0A' }, // --color-bg-pressure--3, --color-border-pressure--3
      '-2': { bg: '#DC2626', border: '#991B1B' }, // --color-bg-pressure--2, --color-border-pressure--2
      '-1': { bg: '#F97316', border: '#EA580C' }, // --color-bg-pressure--1, --color-border-pressure--1
      '0': { bg: '#9CA3AF', border: '#6B7280' }, // --color-bg-pressure-0, --color-border-pressure-0
      '1': { bg: '#E5E7EB', border: '#D1D5DB' }, // --color-bg-pressure-1, --color-border-pressure-1
      '2': { bg: '#CBD5E1', border: '#94A3B8' }, // --color-bg-pressure-2, --color-border-pressure-2
      '3': { bg: '#F8FAFC', border: '#E5E7EB' }, // --color-bg-pressure-3, --color-border-pressure-3
    },
    // Felhőzet (cloud) - --color-bg-cloud-{level}
    cloud: {
      '-3': { bg: '#FFFFFF', border: '#E5E7EB' }, // --color-bg-cloud--3, --color-border-cloud--3
      '-2': { bg: '#F1F5F9', border: '#CBD5E1' }, // --color-bg-cloud--2, --color-border-cloud--2
      '-1': { bg: '#E5E7EB', border: '#CBD5E1' }, // --color-bg-cloud--1, --color-border-cloud--1
      '0': { bg: '#9CA3AF', border: '#6B7280' }, // --color-bg-cloud-0, --color-border-cloud-0
      '1': { bg: '#94A3B8', border: '#64748B' }, // --color-bg-cloud-1, --color-border-cloud-1
      '2': { bg: '#64748B', border: '#475569' }, // --color-bg-cloud-2, --color-border-cloud-2
      '3': { bg: '#334155', border: '#1E293B' }, // --color-bg-cloud-3, --color-border-cloud-3
    },
    // Csapadék esély (rain) - --color-bg-rain-{level}
    rain: {
      '-3': { bg: '#FFFFFF', border: '#E5E7EB' }, // --color-bg-rain--3, --color-border-rain--3
      '-2': { bg: '#EFF6FF', border: '#DBEAFE' }, // --color-bg-rain--2, --color-border-rain--2
      '-1': { bg: '#DBEAFE', border: '#BFDBFE' }, // --color-bg-rain--1, --color-border-rain--1
      '0': { bg: '#93C5FD', border: '#60A5FA' }, // --color-bg-rain-0, --color-border-rain-0
      '1': { bg: '#60A5FA', border: '#3B82F6' }, // --color-bg-rain-1, --color-border-rain-1
      '2': { bg: '#2563EB', border: '#1E40AF' }, // --color-bg-rain-2, --color-border-rain-2
      '3': { bg: '#1E3A8A', border: '#020617' }, // --color-bg-rain-3, --color-border-rain-3
    },
    // Szélsebesség (wind) - --color-bg-wind-{level}
    wind: {
      '-3': { bg: '#EFF6FF', border: '#DBEAFE' }, // --color-bg-wind--3, --color-border-wind--3
      '-2': { bg: '#DBEAFE', border: '#BFDBFE' }, // --color-bg-wind--2, --color-border-wind--2
      '-1': { bg: '#93C5FD', border: '#60A5FA' }, // --color-bg-wind--1, --color-border-wind--1
      '0': { bg: '#60A5FA', border: '#3B82F6' }, // --color-bg-wind-0, --color-border-wind-0
      '1': { bg: '#2563EB', border: '#1E40AF' }, // --color-bg-wind-1, --color-border-wind-1
      '2': { bg: '#1E3A8A', border: '#020617' }, // --color-bg-wind-2, --color-border-wind-2
      '3': { bg: '#020617', border: '#020617' }, // --color-bg-wind-3, --color-border-wind-3
    },
    // Holdfázis (moon) - --color-bg-moon-{level}
    moon: {
      '-3': { bg: '#FEFCE8', border: '#FDE047' }, // --color-bg-moon--3, --color-border-moon--3
      '-2': { bg: '#FEF08A', border: '#FACC15' }, // --color-bg-moon--2, --color-border-moon--2
      '-1': { bg: '#FDE047', border: '#FBBF24' }, // --color-bg-moon--1, --color-border-moon--1
      '0': { bg: '#FACC15', border: '#F59E0B' }, // --color-bg-moon-0, --color-border-moon-0
      '1': { bg: '#FDE68A', border: '#FACC15' }, // --color-bg-moon-1, --color-border-moon-1
      '2': { bg: '#FEF3C7', border: '#FDE047' }, // --color-bg-moon-2, --color-border-moon-2
      '3': { bg: '#FFFBEB', border: '#FEF08A' }, // --color-bg-moon-3, --color-border-moon-3
    },
    // UV index (uv) - --color-bg-uv-{level}
    uv: {
      '-3': { bg: '#FFFBEB', border: '#FEF3C7' }, // --color-bg-uv--3, --color-border-uv--3
      '-2': { bg: '#FEF3C7', border: '#FDE68A' }, // --color-bg-uv--2, --color-border-uv--2
      '-1': { bg: '#FDE047', border: '#FACC15' }, // --color-bg-uv--1, --color-border-uv--1
      '0': { bg: '#FACC15', border: '#F59E0B' }, // --color-bg-uv-0, --color-border-uv-0
      '1': { bg: '#FB923C', border: '#F97316' }, // --color-bg-uv-1, --color-border-uv-1
      '2': { bg: '#F97316', border: '#EA580C' }, // --color-bg-uv-2, --color-border-uv-2
      '3': { bg: '#DC2626', border: '#B91C1C' }, // --color-bg-uv-3, --color-border-uv-3
    },
    // Fényváltás (sun) - --color-bg-sun-{level}
    sun: {
      '0': { bg: '#9CA3AF', border: '#6B7280' }, // --color-bg-sun-0, --color-border-sun-0
      '1': { bg: '#FACC15', border: '#F59E0B' }, // --color-bg-sun-1, --color-border-sun-1
    },
  }
  
  return colorMap[baseName]?.[levelStr] || { bg: '#9CA3AF', border: '#6B7280' }
}

/**
 * Visszaadja a szint leírását az adattípus és szint alapján
 */
export function getLevelDescription(level: number, type: DataType): string {
  // DataType → belső kulcs leképezés
  const typeKey = type === 'waterLevel' ? 'water' :
                  type === 'waterTemperature' ? 'temp' :
                  type === 'airTemperature' ? 'weather' :
                  type === 'pressure' ? 'pressure' :
                  type === 'cloudCover' ? 'cloud' :
                  type === 'precipitationChance' ? 'rain' :
                  type === 'windSpeed' ? 'wind' :
                  type === 'uvIndex' ? 'uv' :
                  type === 'moonPhase' ? 'moon' :
                  type === 'lightChange' ? 'sun' : 'water'
  
  const descriptions: Record<string, Record<number, string>> = {
    water: {
      [-3]: 'Extrém alacsony',
      [-2]: 'Alacsony',
      [-1]: 'Kissé alacsony',
      [0]: 'Normál',
      [1]: 'Kissé magas',
      [2]: 'Magas',
      [3]: 'Extrém magas'
    },
    temp: {
      [-3]: 'Extrém hideg',
      [-2]: 'Hideg',
      [-1]: 'Hűvös',
      [0]: 'Mérsékelt',
      [1]: 'Meleg',
      [2]: 'Nagyon meleg',
      [3]: 'Extrém meleg'
    },
    weather: {
      [-3]: 'Extrém hideg',
      [-2]: 'Hideg',
      [-1]: 'Hűvös',
      [0]: 'Mérsékelt',
      [1]: 'Meleg',
      [2]: 'Forró',
      [3]: 'Extrém forró'
    },
    pressure: {
      [-3]: 'Extrém alacsony',
      [-2]: 'Alacsony',
      [-1]: 'Kissé alacsony',
      [0]: 'Normál',
      [1]: 'Kissé magas',
      [2]: 'Magas',
      [3]: 'Extrém magas'
    },
    cloud: {
      [-3]: 'Teljesen derült',
      [-2]: 'Gyengén felhős',
      [-1]: 'Közepesen felhős',
      [0]: 'Változóan felhős',
      [1]: 'Erősen felhős',
      [2]: 'Borult',
      [3]: 'Teljesen borult'
    },
    rain: {
      [-3]: 'Nincs csapadék',
      [-2]: 'Nagyon kicsi esély',
      [-1]: 'Kicsi esély',
      [0]: 'Közepes esély',
      [1]: 'Valószínű',
      [2]: 'Nagyon valószínű',
      [3]: 'Szinte biztos'
    },
    wind: {
      [-3]: 'Szélcsend',
      [-2]: 'Gyenge szél',
      [-1]: 'Mérsékelt szél',
      [0]: 'Élénk szél',
      [1]: 'Erős szél',
      [2]: 'Viharos szél',
      [3]: 'Erős vihar'
    },
    uv: {
      [-3]: 'Minimális',
      [-2]: 'Alacsony',
      [-1]: 'Mérsékelt',
      [0]: 'Közepes',
      [1]: 'Erős',
      [2]: 'Nagyon erős',
      [3]: 'Extrém'
    },
    moon: {
      [-3]: 'Újhold',
      [-2]: 'Növő sarló',
      [-1]: 'Első negyed',
      [0]: 'Telihold',
      [1]: 'Fogyó hold',
      [2]: 'Utolsó negyed',
      [3]: 'Fogyó sarló'
    },
    sun: {
      [0]: 'Nincs váltás',
      [1]: 'Fényváltás'
    }
  }
  
  return descriptions[typeKey]?.[level] || ''
}

/**
 * D3.js-kompatibilis adatstruktúra előkészítése (Stacked Bar Chart)
 */
export type D3DataPoint = {
  value: number
  recordId: string
  level: number // -3 to +3
  color: {
    bg: string // HEX szín
    border: string // HEX szín
  }
  fishCount: number // Fogások száma az adott rekordhoz
}

export type D3DataTypeData = {
  type: DataType
  label: string
  unit: string
  min: number
  max: number
  values: D3DataPoint[]
}

export function prepareD3Data(records: LocationRecord[]): D3DataTypeData[] {
  const values = extractDataValues(records)
  const result: D3DataTypeData[] = []
  
  // Csoportosítás típus szerint
  const groupedByType = new Map<DataType, D3DataPoint[]>()
  
  values.forEach(value => {
    if (!groupedByType.has(value.type)) {
      groupedByType.set(value.type, [])
    }
    
    // Szint számítása az adattípus alapján
    let level = 0
    if (value.type === 'waterLevel') {
      level = getWaterLevelLevel(value.value)
    } else if (value.type === 'waterTemperature') {
      level = getWaterTempLevel(value.value)
    } else if (value.type === 'airTemperature') {
      level = getAirTempLevel(value.value)
    } else if (value.type === 'pressure') {
      level = getPressureLevel(value.value)
    } else if (value.type === 'cloudCover') {
      level = getCloudCoverLevel(value.value)
    } else if (value.type === 'precipitationChance') {
      level = getRainLevel(value.value)
    } else if (value.type === 'windSpeed') {
      level = getWindLevel(value.value)
    } else if (value.type === 'uvIndex') {
      level = getUVLevel(value.value)
    } else if (value.type === 'moonPhase') {
      // Moon phase érték kezelése - az érték már napok száma (0-29.5)
      // Át kell alakítanunk szintre (-3-tól +3-ig)
      const daysUntilFull = value.value
      if (daysUntilFull === 0) {
        level = 0 // Telihold
      } else if (daysUntilFull <= 1) {
        level = -1
      } else if (daysUntilFull <= 2) {
        level = -2
      } else if (daysUntilFull <= 3) {
        level = -3
      } else if (daysUntilFull <= 4) {
        level = 1
      } else if (daysUntilFull <= 5) {
        level = 2
      } else {
        level = 3
      }
    } else if (value.type === 'lightChange') {
      // Light change érték kezelése - a rekordból kell kinyerni a sunrise/sunset-et
      const record = records.find(r => r.id === value.recordId)
      if (record?.weatherSnapshot?.sunrise && record?.weatherSnapshot?.sunset) {
        let referenceDate: Date | undefined = undefined
        if (record.date && record.time) {
          try {
            const dateTimeStr = `${record.date} ${record.time}`
            referenceDate = new Date(dateTimeStr)
            if (isNaN(referenceDate.getTime())) {
              referenceDate = new Date(record.createdAt)
            }
          } catch {
            referenceDate = new Date(record.createdAt)
          }
        } else {
          referenceDate = new Date(record.createdAt)
        }
        level = getLightChangeLevel(record.weatherSnapshot.sunrise, record.weatherSnapshot.sunset, referenceDate)
      }
    }
    
    // Szín meghatározása
    const color = getVariantColor(value.type, level)
    
    groupedByType.get(value.type)!.push({
      value: value.value,
      recordId: value.recordId,
      level,
      color,
      fishCount: value.fishCount,
    })
  })
  
  // Konfiguráció hozzáadása minden típushoz
  groupedByType.forEach((dataPoints, type) => {
    const config = getDataTypeConfig(type)
    
    // Dinamikus min-max számítás, ha vannak értékek
    let min = config.min
    let max = config.max
    
    if (dataPoints.length > 0) {
      const actualValues = dataPoints.map(p => p.value)
      const actualMin = Math.min(...actualValues)
      const actualMax = Math.max(...actualValues)
      
      min = Math.min(min, actualMin)
      max = Math.max(max, actualMax)
      
      // Ha minden érték ugyanaz, adjunk egy kis tartományt
      if (min === max) {
        min = Math.max(0, min - 1)
        max = max + 1
      }
    }
    
    // Értékek csoportosítása érték szerint (kerekített értékek alapján)
    // Ugyanaz az érték = ugyanaz a pozíció, kumulatív fogásszám
    const groupedByValue = new Map<number, {
      value: number
      level: number
      color: { bg: string, border: string }
      fishCount: number
      count: number
      recordIds: string[]
    }>()
    
    dataPoints.forEach(point => {
      // Kerekítés az adattípus alapján
      const decimals = type === 'pressure' ? 0 : 
                      type === 'airTemperature' || type === 'waterTemperature' ? 1 :
                      type === 'moonPhase' ? 0 : 0
      const roundedValue = Math.round(point.value * Math.pow(10, decimals)) / Math.pow(10, decimals)
      
      if (!groupedByValue.has(roundedValue)) {
        groupedByValue.set(roundedValue, {
          value: roundedValue,
          level: point.level,
          color: point.color,
          fishCount: 0,
          count: 0,
          recordIds: [],
        })
      }
      
      const group = groupedByValue.get(roundedValue)!
      group.fishCount += point.fishCount
      group.count += 1
      group.recordIds.push(point.recordId)
    })
    
    // Csoportosított értékek átalakítása D3DataPoint-okra
    // Rétegek magassága az értékek számától függ (több érték = magasabb réteg)
    const groupedPoints: D3DataPoint[] = Array.from(groupedByValue.values()).map(group => ({
      value: group.value,
      recordId: group.recordIds.join(','), // Több rekord ID összefűzve
      level: group.level,
      color: group.color,
      fishCount: group.fishCount, // Kumulatív fogásszám
    }))
    
    // Rekordok rendezése érték szerint (növekvő)
    const sortedPoints = [...groupedPoints].sort((a, b) => a.value - b.value)
    
    result.push({
      type,
      label: config.label,
      unit: config.unit,
      min,
      max,
      values: sortedPoints,
    })
  })
  
  return result
}



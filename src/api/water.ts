// Fejlesztésben proxy-t használunk a CORS probléma megkerüléséhez
const OVSZ_API_URL = import.meta.env.DEV
  ? '/api/ovszws/api.php'
  : 'https://hydroinfo.hu/WSCSS/ovszws/api.php'

// Típusok definiálása
export type Variable = {
  varid: number
  name: string
  desc: string
  unit: string
}

export type Station = {
  statid: number
  name: string
  eovx?: number
  eovy?: number
  water?: string
  lat: number
  lon: number
  fkm?: number
  nullpoint?: number
  lkv?: number
  lnv?: number
}

export type Water = {
  waterid: number
  name: string
}

export type SystemInfo = {
  organization: string
  version: string
  versionname: string
  documentation: string
  last_change: string
  url: string
  contact: string
  station_count: number
  variable_count: number
  water_count: number
}

export type Measurement = {
  date: string
  value: number
}

export type MeasurementEntry = {
  statid: number
  measurements: Measurement[]
  station?: string
  water?: string
  lat?: number
  lon?: number
  unit?: string
  variable?: string
  distance?: number
  distance_unit?: string
}

export type Forecast = {
  date: string
  value: number
  conf: number
}

export type ForecastEntry = {
  statid: number
  forecasts: Forecast[]
  station?: string
  water?: string
  lat?: number
  lon?: number
  unit?: string
  variable?: string
}

export type StationVariable = {
  statid: number
  forecasted: number
}

export type VariableStation = {
  varid: number
  forecasted: number
}

type ApiError = {
  error: number
  message: string
}

// Helper függvény az API hívásokhoz
async function callApi(params: Record<string, string | number | undefined>): Promise<any> {
  const token = import.meta.env.VITE_OVSZ_API_TOKEN

  if (!token) {
    throw new Error('Az OVSZ API token hiányzik. Add hozzá a VITE_OVSZ_API_TOKEN változót a .env.local fájlhoz.')
  }

  // Fejlesztésben relatív URL-t használunk (proxy), production-ben abszolút URL-t
  let url: URL
  if (import.meta.env.DEV) {
    // Relatív URL esetén hozzáadjuk az origin-t
    url = new URL(OVSZ_API_URL, window.location.origin)
  } else {
    url = new URL(OVSZ_API_URL)
  }

  url.searchParams.set('token', token)

  // Hozzáadjuk a többi paramétert
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  console.log('OVSZ API hívás:', url.toString())

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('OVSZ API hiba válasz:', response.status, errorBody)
    throw new Error(`OVSZ API hiba (${response.status}): ${errorBody}`)
  }

  const responseText = await response.text()
  console.log('OVSZ API válasz szöveg:', responseText)

  // Eltávolítjuk a HTML tag-eket (<pre>, </pre>, stb.), ha vannak
  let cleanedText = responseText.trim()
  
  // Ha HTML <pre> taggel van becsomagolva, kinyerjük a tartalmat
  if (cleanedText.startsWith('<pre>') && cleanedText.endsWith('</pre>')) {
    cleanedText = cleanedText.slice(5, -6).trim()
  }
  
  // Eltávolítjuk az esetleges további HTML tag-eket
  cleanedText = cleanedText.replace(/^<[^>]+>/, '').replace(/<[^>]+>$/, '').trim()

  let data: any
  try {
    data = JSON.parse(cleanedText)
    console.log('OVSZ API válasz JSON:', data)
  } catch (e) {
    console.error('OVSZ API válasz nem JSON:', e)
    console.error('Tisztított szöveg:', cleanedText.substring(0, 200))
    throw new Error(`OVSZ API válasz nem érvényes JSON: ${cleanedText.substring(0, 100)}`)
  }

  // Ellenőrizzük, hogy van-e hiba a válaszban
  if (data.error) {
    const errorMessages: Record<number, string> = {
      1: 'A megadott kérés (view) nem érvényes',
      2: 'A felhasználói egyedi azonosító (token) hibás',
      3: 'A megadott földrajzi szélességi koordináta (lat) érvénytelen vagy nincs megadva',
      4: 'A megadott földrajzi hosszúsági koordináta (lon) érvénytelen vagy nincs megadva',
      5: 'Nem érvényes a változó azonosító (varid) értéke, vagy 0',
      6: 'Nem érvényes az állomás azonosító (statid) értéke, vagy 0',
      7: 'Nem érvényes a megadott kezdő dátum (fromdate)',
      8: 'Nem érvényes a megadott befejező dátum (todate)',
      9: 'Nincs megadva a változó azonosító (varid)',
      10: 'Nem érvényes a megadott extended paraméter',
      11: 'A megadott statid-hez nem tartozik a rendszerben állomás',
      12: 'A megadott varid-hez nem tartozik a rendszerben változó',
      13: 'Nem érvényes a víztest azonosító (waterid) értéke, vagy 0',
      14: 'A megadott waterid-hez nem tartozik a rendszerben víztest',
      15: 'Adatbázis hiba',
      16: 'A megadott állomásra semmilyen paraméterre nem készül előrejelzés',
      17: 'A megadott paraméterre nem készül előrejelzés egyik állomásra se',
      18: 'A megadott állomáson a megadott paraméterre nem készül előrejelzés',
    }

    // Előrejelzés hiány esetén ne dobjunk hibát, hanem jelezzük, hogy nincs adat
    const errorCode = typeof data.error === 'number' ? data.error : null
    const errorMessage = errorCode ? errorMessages[errorCode] : null
    
    // Ha szöveges hibaüzenet van és tartalmazza az "forecast" szót, akkor nincs előrejelzés
    // Az error mező lehet szám vagy szöveg is
    const errorText = typeof data.error === 'string' ? data.error : ''
    const messageText = data.message || ''
    const combinedErrorText = (errorText + ' ' + messageText).toLowerCase()
    const isForecastError = 
      errorCode === 16 || errorCode === 17 || errorCode === 18 ||
      combinedErrorText.includes('forecast') ||
      combinedErrorText.includes('no forecast')

    if (isForecastError) {
      // Speciális kezelés: előrejelzés hiány esetén null-t dobunk, amit a hívó oldal kezel
      throw new Error('NO_FORECAST')
    }

    const finalErrorMessage = errorMessage || (typeof data.error === 'string' ? data.error : `Ismeretlen hiba (${data.error})`)
    throw new Error(`OVSZ API hiba: ${finalErrorMessage}`)
  }

  return data
}

/**
 * Lekéri a rendszer által kezelt paramétereket
 */
export async function getVariables(): Promise<Variable[]> {
  const data = await callApi({ view: 'getvariables' })
  console.log('getVariables válasz:', data)
  // Az API válasz lehet objektum, ami tartalmazza a változókat egy kulcs alatt
  if (Array.isArray(data)) {
    return data
  }
  // Ha objektum, próbáljuk meg megtalálni a változókat
  if (typeof data === 'object' && data !== null) {
    // Lehet, hogy 'entries', 'variables', vagy más kulcs alatt vannak
    const entries = (data as any).entries || (data as any).variables || Object.values(data)
    if (Array.isArray(entries)) {
      return entries
    }
  }
  return []
}

/**
 * Lekéri a rendszer által kezelt állomásokat
 */
export async function getStations(): Promise<Station[]> {
  const data = await callApi({ view: 'getstations' })
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    return data
  }
  
  // Ha objektum, próbáljuk meg kinyerni az entries tömböt
  if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    return data.entries
  }
  
  // Ha üres objektum vagy más formátum, üres tömböt adunk vissza
  return []
}

/**
 * Lekéri a rendszer által kezelt víztesteket
 */
export async function getWaters(): Promise<Water[]> {
  const data = await callApi({ view: 'getwaters' })
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    return data
  }
  
  // Ha objektum, próbáljuk meg kinyerni az entries tömböt
  if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    return data.entries
  }
  
  // Ha üres objektum vagy más formátum, üres tömböt adunk vissza
  return []
}

/**
 * Lekéri a rendszerinformációkat
 */
export async function getInfo(): Promise<SystemInfo> {
  return await callApi({ view: 'getinfo' })
}

/**
 * Lekéri a méréseket
 * @param varid - A paraméter azonosítója (kötelező)
 * @param statid - Az állomás azonosítója (opcionális)
 * @param waterid - A víztest azonosítója (opcionális)
 * @param fromdate - Kezdő dátum YYYY-mm-dd formátumban (opcionális)
 * @param todate - Befejező dátum YYYY-mm-dd formátumban (opcionális)
 * @param extended - Részletes válasz (opcionális)
 */
export async function getMeasurements(params: {
  varid: number
  statid?: number
  waterid?: number
  fromdate?: string
  todate?: string
  extended?: boolean
}): Promise<MeasurementEntry[]> {
  const apiParams: Record<string, string | number | undefined> = {
    view: 'getmeas',
    varid: params.varid,
    statid: params.statid,
    waterid: params.waterid,
    fromdate: params.fromdate,
    todate: params.todate,
  }

  if (params.extended) {
    apiParams.extended = '1'
  }

  const data = await callApi(apiParams)
  console.log('getMeasurements API válasz:', data)
  
  let entries: any[] = []
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    entries = data
  } else if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    entries = data.entries
  } else if (data && typeof data === 'object') {
    const values = Object.values(data)
    if (values.length > 0 && Array.isArray(values[0])) {
      entries = values[0]
    }
  }
  
  // Szűrjük ki a null értékeket, majd konvertáljuk a string értékeket számokká
  return entries
    .filter((entry) => entry !== null && entry !== undefined)
    .map((entry) => ({
      ...entry,
      statid: typeof entry.statid === 'string' ? parseInt(entry.statid, 10) : entry.statid,
      measurements: Array.isArray(entry.measurements)
        ? entry.measurements.map((m: any) => ({
            ...m,
            value: typeof m.value === 'string' ? parseFloat(m.value) : m.value,
          }))
        : [],
    })) as MeasurementEntry[]
}

/**
 * Lekéri a legközelebbi állomás méréseit egy megadott koordinátához
 * @param varid - A paraméter azonosítója (kötelező)
 * @param lat - Földrajzi szélesség (kötelező)
 * @param lon - Földrajzi hosszúság (kötelező)
 * @param waterid - A víztest azonosítója (opcionális)
 * @param fromdate - Kezdő dátum YYYY-mm-dd formátumban (opcionális)
 * @param todate - Befejező dátum YYYY-mm-dd formátumban (opcionális)
 * @param extended - Részletes válasz (opcionális)
 */
export async function getNearestMeasurements(params: {
  varid: number
  lat: number
  lon: number
  waterid?: number
  fromdate?: string
  todate?: string
  extended?: boolean
}): Promise<MeasurementEntry | null> {
  const apiParams: Record<string, string | number | undefined> = {
    view: 'getnearestmeas',
    varid: params.varid,
    lat: params.lat,
    lon: params.lon,
    waterid: params.waterid,
    fromdate: params.fromdate,
    todate: params.todate,
  }

  if (params.extended) {
    apiParams.extended = '1'
  }

  const data = await callApi(apiParams)
  
  // Az API válasz {entries: [...]} formátumú, kinyerjük az első bejegyzést
  if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries) && data.entries.length > 0) {
    const entry = data.entries[0]
    // Konvertáljuk a string értékeket számokká, ha szükséges
    return {
      ...entry,
      statid: typeof entry.statid === 'string' ? parseInt(entry.statid, 10) : entry.statid,
      lat: typeof entry.lat === 'string' ? parseFloat(entry.lat) : entry.lat,
      lon: typeof entry.lon === 'string' ? parseFloat(entry.lon) : entry.lon,
      distance: typeof entry.distance === 'string' ? parseFloat(entry.distance) : entry.distance,
      measurements: Array.isArray(entry.measurements)
        ? entry.measurements.map((m: any) => ({
            ...m,
            value: typeof m.value === 'string' ? parseFloat(m.value) : m.value,
          }))
        : [],
    } as MeasurementEntry
  }
  
  return null
}

/**
 * Lekéri, hogy egy paraméter adatai mely állomásokon érhetők el
 * @param varid - A paraméter azonosítója (kötelező)
 */
export async function getVariableStations(varid: number): Promise<StationVariable[]> {
  const data = await callApi({ view: 'getvarstat', varid })
  console.log('getVariableStations API válasz:', data)
  
  let entries: any[] = []
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    entries = data
  } else if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    entries = data.entries
  } else if (data && typeof data === 'object') {
    const values = Object.values(data)
    if (values.length > 0 && Array.isArray(values[0])) {
      entries = values[0]
    }
  }
  
  // Az API válaszban `stationid` van (nem `statid`) és `forecasted` stringként ("1" vagy "0")
  // Csak azokat az állomásokat adjuk vissza, ahol `forecasted === "1"`
  return entries
    .filter((entry) => entry.forecasted === '1' || entry.forecasted === 1)
    .map((entry) => ({
      statid: typeof entry.stationid === 'string' ? parseInt(entry.stationid, 10) : (entry.statid || entry.stationid),
      forecasted: typeof entry.forecasted === 'string' ? parseInt(entry.forecasted, 10) : entry.forecasted,
    }))
}

/**
 * Lekéri, hogy egy állomáson milyen paraméterek adatai érhetők el
 * @param statid - Az állomás azonosítója (kötelező)
 */
export async function getStationVariables(statid: number): Promise<VariableStation[]> {
  const data = await callApi({ view: 'getstatvar', statid })
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    return data
  }
  
  // Ha objektum, próbáljuk meg kinyerni az entries tömböt
  if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    return data.entries
  }
  
  // Ha üres objektum vagy más formátum, üres tömböt adunk vissza
  return []
}

/**
 * Lekéri az előrejelzéseket
 * @param varid - A paraméter azonosítója (kötelező)
 * @param statid - Az állomás azonosítója (kötelező)
 * @param extended - Részletes válasz (opcionális)
 */
export async function getForecast(params: {
  varid: number
  statid: number
  extended?: boolean
}): Promise<ForecastEntry[]> {
  const apiParams: Record<string, string | number | undefined> = {
    view: 'getfc',
    varid: params.varid,
    statid: params.statid,
  }

  if (params.extended) {
    apiParams.extended = '1'
  }

  const data = await callApi(apiParams)
  
  let entries: any[] = []
  
  // Az API válasz lehet {entries: [...]} formátumú vagy közvetlenül tömb
  if (Array.isArray(data)) {
    entries = data
  } else if (data && typeof data === 'object' && 'entries' in data && Array.isArray(data.entries)) {
    entries = data.entries
  }
  
  // Konvertáljuk az előrejelzési értékeket számokká
  return entries.map((entry) => ({
    ...entry,
    statid: typeof entry.statid === 'string' ? parseInt(entry.statid, 10) : entry.statid,
    forecasts: Array.isArray(entry.forecasts)
      ? entry.forecasts.map((f: any) => ({
          ...f,
          value: typeof f.value === 'string' ? parseFloat(f.value) : f.value,
          conf: typeof f.conf === 'string' ? parseFloat(f.conf) : (f.conf !== undefined ? f.conf : undefined),
        }))
      : [],
  }))
}


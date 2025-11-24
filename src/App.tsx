import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

import { useAuth } from './context/AuthContext.tsx'
import pikeSvg from './assets/pike.svg'
import bassSvg from './assets/bass.svg'
import logoImg from './assets/logo-cropped.svg'
import {
  fetchWeather,
  searchLocations,
  searchNearestLocation,
  type LocationSearchResult,
  type WeatherData,
} from './api/weather.ts'
import {
  getForecast,
  getMeasurements,
  getNearestMeasurements,
  getStations,
  getVariables,
  getVariableStations,
  getWaters,
  type ForecastEntry,
  type Measurement,
  type MeasurementEntry,
  type Station,
  type StationVariable,
  type Variable,
} from './api/water.ts'
import {
  addRecord,
  deleteRecord,
  listenToRecords,
  type Coordinates,
  type LocationRecord,
  type WeatherSnapshot,
} from './services/records.ts'

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOutUser, authActionRunning } = useAuth()
  const [message, setMessage] = useState<string>('Kapcsolódás ellenőrzése folyamatban…')
  const [records, setRecords] = useState<LocationRecord[]>([])
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedRecordId) ?? null,
    [records, selectedRecordId],
  )
  const [location, setLocation] = useState<string>('')
  const [locationQuery, setLocationQuery] = useState<string>('')
  const [coordinates, setCoordinates] = useState<Coordinates | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [geolocationLoading, setGeolocationLoading] = useState(false)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  const isFormDisabled = authLoading || !user
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [waterData, setWaterData] = useState<MeasurementEntry | null>(null)
  const [waterLoading, setWaterLoading] = useState(false)
  const [waterError, setWaterError] = useState<string | null>(null)
  const [waterLevelVarId, setWaterLevelVarId] = useState<number | null>(null)
  const [waterTemperatureData, setWaterTemperatureData] = useState<MeasurementEntry | null>(null)
  const [waterTemperatureLoading, setWaterTemperatureLoading] = useState(false)
  const [waterTemperatureError, setWaterTemperatureError] = useState<string | null>(null)
  const [waterTemperatureVarId, setWaterTemperatureVarId] = useState<number | null>(null)
  const [forecastData, setForecastData] = useState<ForecastEntry[] | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastStationId, setForecastStationId] = useState<number | null>(null) // Melyik állomásról származik az előrejelzés
  const [pastWaterLevelData, setPastWaterLevelData] = useState<Array<{ entry: MeasurementEntry; measurement: Measurement }> | null>(null)
  const [pastWaterLevelLoading, setPastWaterLevelLoading] = useState(false)
  const [pastWaterLevelError, setPastWaterLevelError] = useState<string | null>(null)
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null)
  const [stationDetails, setStationDetails] = useState<Station | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showBackCorner, setShowBackCorner] = useState(false)
  const [savedCardFlipped, setSavedCardFlipped] = useState(false)
  const [showSavedBackCorner, setShowSavedBackCorner] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSearchResult[]>([])
  const [locationSuggestionLoading, setLocationSuggestionLoading] = useState(false)
  const [locationSuggestionError, setLocationSuggestionError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [poppingBubbles, setPoppingBubbles] = useState<Set<number>>(new Set())
  // Véletlenszerű inicializálás az első halhoz
  const getRandomFish = () => Math.random() > 0.5 ? 'pike' : 'bass'
  const getRandomTopOffset = () => Math.random() * 60 + 10 // 10-70% között véletlenszerű

  const [pikeTopOffset, setPikeTopOffset] = useState<number>(getRandomTopOffset())
  const [bassTopOffset, setBassTopOffset] = useState<number>(getRandomTopOffset())
  const [activeFish, setActiveFish] = useState<'pike' | 'bass' | null>(null) // Kezdetben nincs hal
  const [fishDirection, setFishDirection] = useState<'left-to-right' | 'right-to-left'>('left-to-right') // Kezdjük balról
  const [animationKey, setAnimationKey] = useState<number>(0) // Kulcs az animáció újraindításához
  const [nextDirection, setNextDirection] = useState<'left-to-right' | 'right-to-left'>('right-to-left') // Következő irány

  // Az első hal 3 másodperc késleltetéssel úszik be
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveFish(getRandomFish())
      setPikeTopOffset(getRandomTopOffset())
      setBassTopOffset(getRandomTopOffset())
      setFishDirection('left-to-right') // Első hal balról jön
      setNextDirection('right-to-left') // Következő jobbról
    }, 3000) // 3 másodperc

    return () => clearTimeout(timer)
  }, [])

  // Új hal generálása amikor kiúszik
  const generateNewFish = () => {
    // Véletlenszerűen választunk egy halat
    setActiveFish(getRandomFish())
    // Véletlenszerű magasság
    setPikeTopOffset(getRandomTopOffset())
    setBassTopOffset(getRandomTopOffset())
    // Felváltva választunk irányt
    const currentDir = nextDirection
    setFishDirection(currentDir)
    // Következő irány fordítva lesz
    setNextDirection(currentDir === 'left-to-right' ? 'right-to-left' : 'left-to-right')
    // Animáció újraindítása
    setAnimationKey(prev => prev + 1)
  }

  // Új hal generálása amikor az animáció befejeződik (maximum 3 másodperc késleltetéssel)
  const handleAnimationEnd = () => {
    // Véletlenszerű késleltetés 0-3 másodperc között
    const delay = Math.random() * 3000 // 0-3000 ms között véletlenszerű
    setTimeout(() => {
      generateNewFish()
    }, delay)
  }

  useEffect(() => {
    if (authLoading) {
      setMessage('Bejelentkezés állapotának ellenőrzése…')
      return
    }

    if (!user) {
      setMessage('Lépj be Google fiókkal, hogy menteni tudd a helyszíneket.')
      setRecords([])
      setSelectedRecordId(null)
      setLocation('')
      setLocationQuery('')
      setCoordinates(undefined)
      return
    }

    setMessage('Rekordok betöltése…')

    const unsubscribe = listenToRecords(
      user.uid,
      (userRecords) => {
        setRecords(userRecords)
        if (userRecords.length === 0) {
          setMessage('Nincs mentett rekord. Adj meg egy helyszínt és mentsd el.')
        } else {
          setMessage('')
        }
      },
      () => {
        setMessage('Hoppá, valami hiba történt a rekordok betöltésekor.')
      },
    )

    return () => {
      unsubscribe()
    }
  }, [authLoading, user])

  useEffect(() => {
    if (!user) {
      setSelectedRecordId(null)
      return
    }

    if (records.length === 0) {
      setSelectedRecordId(null)
      setLocation('')
      setLocationQuery('')
      setCoordinates(undefined)
      setWeatherData(null)
      setWeatherError(null)
      return
    }

    if (selectedRecordId && records.some((record) => record.id === selectedRecordId)) {
      return
    }

    const [first] = records
    setSelectedRecordId(first.id)
  }, [records, selectedRecordId, user])


  useEffect(() => {
    if (!user) {
      setLocationSuggestions([])
      setLocationSuggestionLoading(false)
      return
    }

    const query = location.trim()
    const selectedLocationTrimmed = selectedRecord ? selectedRecord.locationName.trim() : ''

    if (query.length < 2 || (selectedLocationTrimmed && query === selectedLocationTrimmed)) {
      setLocationSuggestions([])
      setLocationSuggestionLoading(false)
      return
    }

    setLocationSuggestionError(null)
    setLocationSuggestionLoading(true)
    let cancelled = false
    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchLocations(query)
        if (!cancelled) {
          setLocationSuggestions(results)
          setShowSuggestions(results.length > 0)
        }
      } catch (error) {
        if (!cancelled) {
          setLocationSuggestionError('Nem sikerült helyszíneket találni.')
          setLocationSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setLocationSuggestionLoading(false)
        }
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [location, selectedRecord, user])

  const handleLocationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLocation(event.target.value)
    setLocationQuery(event.target.value)
    setCoordinates(undefined)
    setShowSuggestions(true)
    setLocationSuggestionError(null)
  }

  const saveLocation = async (overrides?: {
    locationName?: string
    locationQuery?: string
    coordinates?: Coordinates
  }) => {
    if (!user) {
      throw new Error('Bejelentkezés szükséges a mentéshez.')
    }

    const locationName = (overrides?.locationName ?? location).trim()
    const query = (overrides?.locationQuery ?? locationQuery ?? locationName).trim()

    if (!locationName || !query) {
      throw new Error('Üres helyszínt nem lehet menteni.')
    }

    const snapshot: WeatherSnapshot | undefined = weatherData
      ? {
          ...weatherData,
          capturedAt: Date.now(),
        }
      : undefined
    
    const waterDataSnapshot = waterData
      ? {
          ...waterData,
          capturedAt: Date.now(),
        }
      : undefined
    
    const waterTemperatureSnapshot = waterTemperatureData
      ? {
          ...waterTemperatureData,
          capturedAt: Date.now(),
        }
      : undefined
    
    const forecastSnapshot = forecastData && forecastData.length > 0
      ? {
          forecasts: forecastData,
          capturedAt: Date.now(),
        }
      : undefined
    
    const pastWaterLevelSnapshot = pastWaterLevelData && pastWaterLevelData.length > 0
      ? {
          data: pastWaterLevelData,
          capturedAt: Date.now(),
        }
      : undefined
    
    const nextCoordinates = overrides?.coordinates ?? coordinates

    const payload = {
      locationName,
      locationQuery: query,
      coordinates: nextCoordinates,
      weatherSnapshot: snapshot,
      waterDataSnapshot,
      waterTemperatureSnapshot,
      forecastSnapshot,
      pastWaterLevelSnapshot,
    }

    const ref = await addRecord(user.uid, payload)
    setSelectedRecordId(ref.id)
    setSaveMessage('Rekord mentve!')
    setMessage(`Rekord mentve: "${locationName}".`)

    setCoordinates(nextCoordinates)
    setLocation(locationName)
    setLocationQuery(query)
    setLocationSuggestions([])
    setShowSuggestions(false)
    setLocationSuggestionError(null)
  }

  const handleSave = async () => {
    if (!user) {
      setSaveMessage('Előbb jelentkezz be Google fiókkal!')
      return
    }

    const trimmed = location.trim()
    if (!trimmed) {
      setSaveMessage('Add meg a helyszínt a mentéshez!')
      return
    }

    setIsSaving(true)
    setSaveMessage('Mentés folyamatban…')

    try {
      await saveLocation()
    } catch (error) {
      setSaveMessage('Mentés sikertelen. Nézd meg a konzolt a részletekért!')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithGoogle()
    } catch (error) {
      setAuthError('A Google bejelentkezés sikertelen. Próbáld újra később.')
    }
  }

  // Koordináták beállítása a kiválasztott rekordból - csak akkor, ha nincs explicit koordináta beállítva
  // Ez megakadályozza, hogy rekord kiválasztásakor újratöltse az adatokat
  // useEffect(() => {
  //   if (selectedRecord?.coordinates) {
  //     setCoordinates(selectedRecord.coordinates)
  //   }
  // }, [selectedRecord])

  useEffect(() => {
    if (!user) {
      setWeatherData(null)
      return
    }

    const trimmedInput = location.trim()
    const trimmedQuery = locationQuery.trim()
    
    // Csak akkor használjuk a rekord adatokat, ha nincs explicit location vagy locationQuery
    const recordQuery = (!trimmedQuery && !trimmedInput && selectedRecord) ? selectedRecord.locationQuery?.trim() ?? '' : ''
    const recordName = (!trimmedQuery && !trimmedInput && selectedRecord) ? selectedRecord.locationName?.trim() ?? '' : ''

    const query = trimmedQuery || trimmedInput || recordQuery || recordName

    if (!query) {
      setWeatherData(null)
      return
    }

    let cancelled = false

    const loadWeather = async () => {
      setWeatherLoading(true)
      setWeatherError(null)
      try {
        const data = await fetchWeather(query)
        if (!cancelled) {
          setWeatherData(data)
        }
      } catch (error) {
        if (!cancelled) {
          setWeatherError('Nem sikerült lekérni az időjárás adatokat.')
        }
      } finally {
        if (!cancelled) {
          setWeatherLoading(false)
        }
      }
    }

    void loadWeather()

    return () => {
      cancelled = true
    }
  }, [location, locationQuery, user])

  // Vízszint és vízhőmérséklet paraméter azonosítók lekérése
  useEffect(() => {
    if (!user) {
      setWaterLevelVarId(null)
      return
    }

    let cancelled = false

    const loadVariableIds = async () => {
      try {
        const variables = await getVariables()
        if (!cancelled) {
          console.log('📋 Változók lekérve:', variables.map(v => ({ varid: v.varid, name: v.name })))
          
          // Keresünk vízszint paramétert (lehet "vízszint", "vízállás", stb.)
          const waterLevelVar = variables.find(
            (v) =>
              v.name.toLowerCase().includes('vízszint') ||
              v.name.toLowerCase().includes('vízállás') ||
              v.name.toLowerCase().includes('vízmérték'),
          )
          if (waterLevelVar) {
            console.log('✅ Vízállás változó találva:', { varid: waterLevelVar.varid, name: waterLevelVar.name })
            setWaterLevelVarId(waterLevelVar.varid)
          } else {
            console.log('❌ Vízállás változó nem található')
          }

          // Keresünk vízhőmérséklet paramétert (vízfelszín közelében)
          // Először próbáljuk meg a pontosabb keresést (vízhő + felszín)
          let waterTemperatureVar = variables.find(
            (v) =>
              (v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')) &&
              (v.name.toLowerCase().includes('felszín') || v.name.toLowerCase().includes('felszíni')),
          )
          
          // Ha nem találjuk, próbáljuk meg csak a "vízhő" szóval (de nem a mederfenék közelében lévőt)
          if (!waterTemperatureVar) {
            console.log('🔍 Vízhőmérséklet változó keresés (felszín): nem található, próbáljuk a második keresést...')
            waterTemperatureVar = variables.find(
              (v) =>
                (v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')) &&
                !v.name.toLowerCase().includes('fenék') &&
                !v.name.toLowerCase().includes('meder'),
            )
          }
          
          if (waterTemperatureVar) {
            console.log('✅ Vízhőmérséklet változó találva:', { varid: waterTemperatureVar.varid, name: waterTemperatureVar.name })
            setWaterTemperatureVarId(waterTemperatureVar.varid)
          } else {
            console.log('❌ Vízhőmérséklet változó nem található')
            console.log('🔍 Elérhető változók, amelyek tartalmaznak "vízhő" vagy "víz hő" szavakat:')
            const tempVars = variables.filter(v => 
              v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')
            )
            if (tempVars.length > 0) {
              tempVars.forEach(v => console.log(`  - ${v.name} (varid: ${v.varid})`))
            } else {
              console.log('  Nincs ilyen változó')
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          setWaterLevelVarId(null)
          setWaterTemperatureVarId(null)
        }
      }
    }

    void loadVariableIds()

    return () => {
      cancelled = true
    }
  }, [user])

  // Vízállás adatok lekérése koordináták alapján
  useEffect(() => {
    if (!user || !coordinates || !waterLevelVarId) {
      setWaterData(null)
      return
    }

    let cancelled = false

    const loadWaterData = async () => {
      setWaterLoading(true)
      setWaterError(null)
      try {
        const data = await getNearestMeasurements({
          varid: waterLevelVarId,
          lat: coordinates.lat,
          lon: coordinates.lon,
          extended: true,
        })
        if (!cancelled) {
          setWaterData(data)
        }
      } catch (error) {
        if (!cancelled) {
          setWaterError(`Nem sikerült lekérni a vízállás adatokat: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
        }
      } finally {
        if (!cancelled) {
          setWaterLoading(false)
        }
      }
    }

    void loadWaterData()

    return () => {
      cancelled = true
    }
  }, [coordinates, waterLevelVarId, user])

  // Vízhőmérséklet adatok lekérése ugyanazon víztesten
  useEffect(() => {
    console.log('🔍 Vízhőmérséklet useEffect feltétel ellenőrzés:')
    console.log('  - user:', user ? '✅' : '❌')
    console.log('  - coordinates:', coordinates ? `✅ (${coordinates.lat}, ${coordinates.lon})` : '❌')
    console.log('  - waterTemperatureVarId:', waterTemperatureVarId ? `✅ (${waterTemperatureVarId})` : '❌')
    console.log('  - waterData:', waterData ? '✅' : '❌')
    console.log('  - waterData.water:', waterData?.water ? `✅ (${waterData.water})` : '❌')
    
    if (!user || !coordinates || !waterTemperatureVarId || !waterData || !waterData.water) {
      console.log('❌ Vízhőmérséklet lekérés nem indítható: hiányzó feltétel(ek)')
      setWaterTemperatureData(null)
      return
    }
    
    console.log('✅ Minden feltétel teljesül, vízhőmérséklet lekérés indítása...')

    let cancelled = false

    const loadWaterTemperatureData = async () => {
      console.log('🌡️ Vízhőmérséklet adatok lekérése kezdődik...')
      setWaterTemperatureLoading(true)
      setWaterTemperatureError(null)
      try {
        // Lekérjük a víztesteket, hogy megtaláljuk a víztest ID-ját
        console.log('📥 Víztestek lekérése...')
        const waters = await getWaters()
        console.log(`✅ Víztestek lekérve: ${waters.length} db`)
        const waterInfo = waters.find((w) => w.name === waterData.water)
        
        if (!waterInfo) {
          console.error(`❌ Nem található víztest információ: ${waterData.water}`)
          if (!cancelled) {
            setWaterTemperatureError(`Nem található víztest információ: ${waterData.water}`)
            setWaterTemperatureData(null)
          }
          return
        }
        console.log(`✅ Víztest információ találva: ${waterInfo.name} (waterid: ${waterInfo.waterid})`)

        // Először lekérjük az összes vízhőmérséklet adatot a víztesthez
        console.log('📥 Összes vízhőmérséklet adat lekérése a víztesthez...')
        console.log(`  Paraméterek: varid=${waterTemperatureVarId}, waterid=${waterInfo.waterid}`)
        
        // Számoljuk ki az elmúlt 30 nap dátumát
        const today = new Date()
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(today.getDate() - 30)
        const fromdate = thirtyDaysAgo.toISOString().split('T')[0]
        const todate = today.toISOString().split('T')[0]
        
        const allMeasurements = await getMeasurements({
          varid: waterTemperatureVarId,
          waterid: waterInfo.waterid,
          fromdate: fromdate,
          todate: todate,
          extended: true,
        })
        console.log(`✅ Vízhőmérséklet adatok lekérve: ${allMeasurements.length} állomás`)

        // Szűrjük az érvényes adatokat (van mérés és nem null az érték)
        const validMeasurements = allMeasurements.filter((entry) => {
          if (!entry.measurements || entry.measurements.length === 0) {
            return false
          }
          const lastMeasurement = entry.measurements[entry.measurements.length - 1]
          return lastMeasurement && lastMeasurement.value !== null && lastMeasurement.value !== undefined
        })

        if (validMeasurements.length === 0) {
          console.log('⚠️ Nincs érvényes vízhőmérséklet adat a víztesten')
          if (!cancelled) {
            setWaterTemperatureError('Nincs vízhőmérséklet adat elérhető a víztesten')
            setWaterTemperatureData(null)
          }
          return
        }

        // Kiszámoljuk a távolságot minden állomáshoz és kiválasztjuk a legközelebbit
        let nearestEntry: MeasurementEntry | null = null
        let minDistance = Infinity

        for (const entry of validMeasurements) {
          const entryLat = typeof entry.lat === 'string' ? parseFloat(entry.lat) : (entry.lat || 0)
          const entryLon = typeof entry.lon === 'string' ? parseFloat(entry.lon) : (entry.lon || 0)
          
          if (entryLat === 0 && entryLon === 0) {
            continue // Nincs koordináta
          }

          const distance = calculateDistance(coordinates.lat, coordinates.lon, entryLat, entryLon)
          if (distance < minDistance) {
            minDistance = distance
            nearestEntry = entry
          }
        }

        if (!nearestEntry) {
          console.log('⚠️ Nem található állomás érvényes koordinátákkal')
          if (!cancelled) {
            setWaterTemperatureError('Nem található vízhőmérséklet adat érvényes koordinátákkal')
            setWaterTemperatureData(null)
          }
          return
        }

        console.log(`✅ Legközelebbi vízhőmérséklet adat: ${nearestEntry.station || nearestEntry.statid}, távolság: ${minDistance.toFixed(2)} km`)

        if (!cancelled) {
          setWaterTemperatureData(nearestEntry)
          setWaterTemperatureError(null)
          console.log('✅ Vízhőmérséklet adatok beállítva')
        }
      } catch (error) {
        console.error('❌ Vízhőmérséklet adatok lekérése sikertelen:', error)
        if (error instanceof Error) {
          console.error('  Hiba üzenet:', error.message)
          console.error('  Hiba stack:', error.stack)
        }
        if (!cancelled) {
          setWaterTemperatureError('Nem sikerült lekérni a vízhőmérséklet adatokat')
          setWaterTemperatureData(null)
        }
      } finally {
        if (!cancelled) {
          setWaterTemperatureLoading(false)
          console.log('🏁 Vízhőmérséklet lekérés befejezve')
        }
      }
    }

    void loadWaterTemperatureData()

    return () => {
      cancelled = true
    }
  }, [coordinates, waterTemperatureVarId, user, waterData])

  // Előrejelzés lekérése
  useEffect(() => {
    if (!user || !waterData || !waterLevelVarId) {
      setForecastData(null)
      return
    }

    let cancelled = false

    const loadForecast = async () => {
      setForecastLoading(true)
      setForecastError(null)
      try {
        // Először próbáljuk meg lekérni az adott állomás előrejelzését
        const data = await getForecast({
          statid: waterData.statid,
          varid: waterLevelVarId,
          extended: true,
        })
        if (!cancelled) {
          setForecastData(data)
          setForecastStationId(waterData.statid) // Az eredeti állomás
        }
      } catch (error) {
        if (!cancelled) {
          // Ha nincs előrejelzés az adott állomáson, keressük meg a legközelebbit
          if (error instanceof Error && error.message === 'NO_FORECAST') {
            try {
              // Lekérjük az összes állomás részletes adatait
              const allStations = await getStations()
              
              // Próbáljuk meg lekérni az előrejelzést minden állomásra, amíg nem találunk egyet, amelyen van
              // De először próbáljuk meg a getVariableStations-t
              let stationsWithForecast: Station[] = []
              
              try {
                const variableStations = await getVariableStations(waterLevelVarId)
                
                if (variableStations.length > 0) {
                  // Szűrjük azokat, amelyeken van előrejelzés
                  stationsWithForecast = allStations.filter((station) =>
                    variableStations.some((vs) => vs.statid === station.statid),
                  )
                }
              } catch (varStatError) {
                // Folytatjuk közvetlenül
              }
              
              // Ha nincs eredmény a getVariableStations-ból, próbáljuk meg közvetlenül az összes állomásból
              if (stationsWithForecast.length === 0) {
                // Próbáljuk meg az első 10 állomást (hatékonyság miatt)
                const stationsToTry = allStations.slice(0, 10)
                for (const station of stationsToTry) {
                  try {
                    const testForecast = await getForecast({
                      statid: station.statid,
                      varid: waterLevelVarId,
                      extended: true,
                    })
                    if (testForecast && testForecast.length > 0 && testForecast[0]?.forecasts && testForecast[0].forecasts.length > 0) {
                      stationsWithForecast.push(station)
                      break // Csak az elsőt keressük meg
                    }
                  } catch (testError) {
                    // Folytatjuk a következő állomással
                    continue
                  }
                }
              }

              if (stationsWithForecast.length === 0) {
                // Nincs egyetlen állomás sem előrejelzéssel
                setForecastData(null)
                setForecastError(null)
                setForecastStationId(null)
                return
              }

              // Számoljuk ki a távolságot minden állomástól
              const currentLat = waterData.lat || coordinates?.lat
              const currentLon = waterData.lon || coordinates?.lon

              if (!currentLat || !currentLon) {
                setForecastData(null)
                setForecastError(null)
                setForecastStationId(null)
                return
              }

              // Keressük meg a legközelebbi állomást
              let nearestStation = stationsWithForecast[0]
              let minDistance = calculateDistance(currentLat, currentLon, nearestStation.lat, nearestStation.lon)

              for (const station of stationsWithForecast) {
                const distance = calculateDistance(currentLat, currentLon, station.lat, station.lon)
                if (distance < minDistance) {
                  minDistance = distance
                  nearestStation = station
                }
              }

              // Lekérjük az előrejelzést a legközelebbi állomásra
              const nearestForecast = await getForecast({
                statid: nearestStation.statid,
                varid: waterLevelVarId,
                extended: true,
              })

              if (!cancelled) {
                setForecastData(nearestForecast)
                setForecastStationId(nearestStation.statid)
                setForecastError(null)
              }
            } catch (fallbackError) {
              if (!cancelled) {
                setForecastData(null)
                setForecastError(null)
                setForecastStationId(null)
              }
            }
          } else {
            setForecastError(`Nem sikerült lekérni az előrejelzést: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
            setForecastStationId(null)
          }
        }
      } finally {
        if (!cancelled) {
          setForecastLoading(false)
        }
      }
    }

    void loadForecast()

    return () => {
      cancelled = true
    }
  }, [waterData, waterLevelVarId, user])

  // Előző 3 nap vízállás adatainak lekérése
  useEffect(() => {
    if (!user || !waterData || !waterLevelVarId) {
      setPastWaterLevelData(null)
      return
    }

    let cancelled = false

    const loadPastWaterLevel = async () => {
      setPastWaterLevelLoading(true)
      setPastWaterLevelError(null)
      try {
        // Számoljuk ki az elmúlt 3 nap dátumát
        const today = new Date()
        const threeDaysAgo = new Date(today)
        threeDaysAgo.setDate(today.getDate() - 3)
        const fromdate = threeDaysAgo.toISOString().split('T')[0]
        const todate = today.toISOString().split('T')[0]

        const measurements = await getMeasurements({
          varid: waterLevelVarId,
          statid: waterData.statid,
          fromdate: fromdate,
          todate: todate,
          extended: true,
        })

        if (!cancelled) {
          // Szűrjük az érvényes méréseket és csoportosítjuk napok szerint
          const validMeasurements = measurements
            .filter((entry) => entry.measurements && entry.measurements.length > 0)
            .flatMap((entry) =>
              entry.measurements
                .filter((m) => m.value !== null && m.value !== undefined)
                .map((m) => ({
                  entry: entry,
                  measurement: m,
                })),
            )

          // Csoportosítjuk napok szerint és kiválasztjuk a napi egy értéket (12:00 vagy legközelebbi)
          const dailyMeasurements = validMeasurements.reduce((acc: typeof validMeasurements, item) => {
            const date = new Date(item.measurement.date)
            const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD

            const existing = acc.find((a) => {
              const aDate = new Date(a.measurement.date)
              return aDate.toISOString().split('T')[0] === dateKey
            })

            if (!existing) {
              acc.push(item)
            } else {
              const existingHour = new Date(existing.measurement.date).getHours()
              const currentHour = date.getHours()
              const existingDiff = Math.abs(existingHour - 12)
              const currentDiff = Math.abs(currentHour - 12)

              if (currentDiff < existingDiff) {
                const index = acc.indexOf(existing)
                acc[index] = item
              }
            }

            return acc
          }, [])

          // Rendezzük dátum szerint és csak az elmúlt 3 napot vesszük
          dailyMeasurements.sort((a, b) => {
            const dateA = new Date(a.measurement.date).getTime()
            const dateB = new Date(b.measurement.date).getTime()
            return dateA - dateB
          })

          // Kizárjuk a mai napot és csak az előző 3 napot vesszük
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const filtered = dailyMeasurements.filter((item) => {
            const itemDate = new Date(item.measurement.date)
            itemDate.setHours(0, 0, 0, 0)
            return itemDate < today
          })

          // Csak az utolsó 3 napot vesszük
          setPastWaterLevelData(filtered.slice(-3))
        }
      } catch (error) {
        if (!cancelled) {
          setPastWaterLevelError('Nem sikerült lekérni az előző napok vízállás adatait')
          setPastWaterLevelData(null)
        }
      } finally {
        if (!cancelled) {
          setPastWaterLevelLoading(false)
        }
      }
    }

    void loadPastWaterLevel()

    return () => {
      cancelled = true
    }
  }, [waterData, waterLevelVarId, user])

  // Állomás részletes adatainak lekérése
  useEffect(() => {
    if (!user || !waterData) {
      setStationDetails(null)
      return
    }

    let cancelled = false

    const loadStationDetails = async () => {
      try {
        const stations = await getStations()
        if (!cancelled) {
          const station = stations.find((s) => s.statid === waterData.statid)
          setStationDetails(station || null)
        }
      } catch (error) {
        if (!cancelled) {
          setStationDetails(null)
        }
      }
    }

    void loadStationDetails()

    return () => {
      cancelled = true
    }
  }, [waterData, user])

  const handleSignOut = async () => {
    setAuthError(null)
    try {
      await signOutUser()
      setLocation('')
      setSaveMessage(null)
      setRecords([])
      setSelectedRecordId(null)
      setLocationSuggestions([])
      setShowSuggestions(false)
      setWeatherData(null)
      setWeatherError(null)
      setWeatherLoading(false)
      setLocationSuggestionError(null)
      setLocationQuery('')
      setCoordinates(undefined)
      setWaterData(null)
      setWaterError(null)
      setWaterLoading(false)
      setWaterLevelVarId(null)
      setWaterTemperatureData(null)
      setWaterTemperatureError(null)
      setWaterTemperatureLoading(false)
      setWaterTemperatureVarId(null)
      setForecastData(null)
      setForecastError(null)
      setForecastLoading(false)
      setForecastStationId(null)
      setStationDetails(null)
    } catch (error) {
      setAuthError('A kijelentkezés nem sikerült. Próbáld újra.')
    }
  }

  // Távolság számítás két koordináta között (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371 // Föld sugara km-ben
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Tendencia számítás függvény - jelenlegi vízállástól az utolsó előrejelzési napig
  const calculateTrend = (forecasts: ForecastEntry['forecasts'], currentWaterLevel: number) => {
    if (!forecasts || forecasts.length < 2 || currentWaterLevel === undefined || currentWaterLevel === null) {
      return null
    }

    // Csak napi egy adatot használunk (12:00 vagy legközelebbi)
    const dailyForecasts = forecasts.reduce((acc: typeof forecasts, forecast) => {
      const date = new Date(forecast.date)
      const dateKey = date.toISOString().split('T')[0] // YYYY-MM-DD
      
      const existing = acc.find((f) => {
        const fDate = new Date(f.date)
        return fDate.toISOString().split('T')[0] === dateKey
      })
      
      if (!existing) {
        acc.push(forecast)
      } else {
        const existingHour = new Date(existing.date).getHours()
        const currentHour = date.getHours()
        const existingDiff = Math.abs(existingHour - 12)
        const currentDiff = Math.abs(currentHour - 12)
        
        if (currentDiff < existingDiff) {
          const index = acc.indexOf(existing)
          acc[index] = forecast
        }
      }
      
      return acc
    }, [])

    if (dailyForecasts.length < 2) {
      return null
    }

    // Rendezzük dátum szerint
    dailyForecasts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Megkeressük a mai dátumot
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Következő 5 nap értékei (a mai dátum utáni 5 nap)
    const futureDays = dailyForecasts.filter((f) => {
      const fDate = new Date(f.date)
      fDate.setHours(0, 0, 0, 0)
      return fDate > today
    }).slice(0, 5) // Első 5 nap

    // Ha nincs elég adat (kevesebb mint 2 nap), nem számolunk trendet
    if (futureDays.length < 2) {
      return null
    }

    // Az utolsó előrejelzési nap értéke
    const lastForecast = futureDays[futureDays.length - 1]
    const lastValue = typeof lastForecast.value === 'string' ? parseFloat(lastForecast.value) : lastForecast.value
    
    // A változás: utolsó előrejelzési nap - jelenlegi vízállás
    const change = lastValue - currentWaterLevel
    // Százalékos változás a jelenlegi vízálláshoz viszonyítva
    const percentChange = currentWaterLevel !== 0 ? (change / Math.abs(currentWaterLevel)) * 100 : 0
    
    // Az első előrejelzési nap dátumától az utolsóig számoljuk a napokat
    const firstForecastDate = new Date(futureDays[0].date)
    const lastForecastDate = new Date(lastForecast.date)
    firstForecastDate.setHours(0, 0, 0, 0)
    lastForecastDate.setHours(0, 0, 0, 0)
    const daysDiff = Math.round((lastForecastDate.getTime() - firstForecastDate.getTime()) / (1000 * 60 * 60 * 24))
    const days = daysDiff

    // 5% vagy 10 cm küszöbérték a jelenlegi vízállás alapján
    const threshold = Math.max(Math.abs(currentWaterLevel) * 0.05, 10)

    if (Math.abs(change) < threshold) {
      return {
        type: 'stable' as const,
        change: change,
        percentChange: percentChange,
        days: days,
      }
    } else if (change > 0) {
      return {
        type: 'increasing' as const,
        change: change,
        percentChange: percentChange,
        days: days,
      }
    } else {
      return {
        type: 'decreasing' as const,
        change: change,
        percentChange: percentChange,
        days: days,
      }
    }
  }

  const handleSelectSuggestion = async (suggestion: LocationSearchResult) => {
    const displayName = [suggestion.name, suggestion.region].filter(Boolean).join(', ')
    const queryValue = suggestion.name
    const coords: Coordinates = { lat: suggestion.lat, lon: suggestion.lon }

    setLocation(displayName)
    setLocationQuery(queryValue)
    setCoordinates(coords)
    setShowSuggestions(false)
    setLocationSuggestions([])
    setLocationSuggestionError(null)

    if (!user) {
      return
    }

    try {
      await saveLocation({
        locationName: displayName,
        locationQuery: queryValue,
        coordinates: coords,
      })
    } catch (error) {
      setSaveMessage('Nem sikerült menteni a kiválasztott helyszínt.')
    }
  }

  const handleUseCurrentLocation = () => {
    if (!user) {
      setGeolocationError('Előbb jelentkezz be, hogy használd a helymeghatározást.')
      return
    }

    if (!('geolocation' in navigator)) {
      setGeolocationError('A böngésző nem támogatja a helymeghatározást.')
      return
    }

    setGeolocationLoading(true)
    setGeolocationError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const nearest = await searchNearestLocation(latitude, longitude)

          if (!nearest) {
            setGeolocationError('Nem található közeli település.')
            return
          }

          const displayName = [nearest.name, nearest.region].filter(Boolean).join(', ')
          const queryValue = `${nearest.lat},${nearest.lon}`
          const coords: Coordinates = { lat: nearest.lat, lon: nearest.lon }

          setLocation(displayName)
          setLocationQuery(queryValue)
          setCoordinates(coords)
          setShowSuggestions(false)
          setLocationSuggestions([])
          setSaveMessage('Az aktuális helyzet alapján betöltöttük az adatokat. Mentsd el, ha szeretnéd naplózni.')
        } catch (error) {
          setGeolocationError('Nem sikerült feldolgozni a helyadatokat.')
        } finally {
          setGeolocationLoading(false)
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeolocationError('A helyhozzáférés engedélyezése szükséges.')
            break
          case error.POSITION_UNAVAILABLE:
            setGeolocationError('A helyzet nem állapítható meg.')
            break
          case error.TIMEOUT:
            setGeolocationError('A helyadat lekérése túl sok időt vett igénybe.')
            break
          default:
            setGeolocationError('Ismeretlen hiba történt a helymeghatározás során.')
        }
        setGeolocationLoading(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    )
  }

  const handleSelectRecord = (recordId: string) => {
    const record = records.find((item) => item.id === recordId)
    if (record) {
      setWeatherError(null)
      setMessage(`"${record.locationName}" megnyitva.`)
    }
    setSelectedRecordId(recordId)
    setSaveMessage(null)
    setShowSuggestions(false)
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!user) {
      setSaveMessage('Jelentkezz be a törléshez!')
      return
    }

    try {
      await deleteRecord(user.uid, recordId)
      setSaveMessage('Rekord törölve.')
      setMessage('Rekord törölve.')

      if (selectedRecordId === recordId) {
        setSelectedRecordId(null)
        setLocation('')
        setLocationQuery('')
        setCoordinates(undefined)
        setWeatherData(null)
        setWeatherError(null)
      }
    } catch (error) {
      setSaveMessage('Rekord törlése sikertelen. Nézd meg a konzolt!')
    }
  }

  const handleBubbleClick = (index: number) => {
    setPoppingBubbles((prev) => new Set(prev).add(index))
    setTimeout(() => {
      setPoppingBubbles((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }, 500)
  }

  const handleExportToExcel = async () => {
    if (!user || !waterTemperatureVarId) {
      alert('Be kell jelentkezned és meg kell várnod, amíg a vízhőmérséklet változó betöltődik.')
      return
    }

    try {
      console.log('📥 Excel export kezdődik...')
      
      // Lekérjük az összes víztestet
      const waters = await getWaters()
      console.log(`✅ Víztestek lekérve: ${waters.length} db`)

      // Számoljuk ki az elmúlt 30 nap dátumát
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      const fromdate = thirtyDaysAgo.toISOString().split('T')[0]
      const todate = today.toISOString().split('T')[0]

      // Összegyűjtjük az összes vízhőmérséklet adatot minden víztestről
      const allTemperatureData: Array<{
        statid: number
        station: string
        water: string
        lat: number
        lon: number
        date: string
        value: number
        unit: string
      }> = []

      // Minden víztestre lekérjük az adatokat
      for (const water of waters) {
        try {
          console.log(`📥 ${water.name} (waterid: ${water.waterid}) vízhőmérséklet adatok lekérése...`)
          const measurements = await getMeasurements({
            varid: waterTemperatureVarId,
            waterid: water.waterid,
            fromdate: fromdate,
            todate: todate,
            extended: true,
          })

          // Feldolgozzuk az eredményeket
          for (const measurementEntry of measurements) {
            if (measurementEntry.measurements && measurementEntry.measurements.length > 0) {
              // Minden mérést hozzáadunk
              for (const measurement of measurementEntry.measurements) {
                if (measurement.value !== null && measurement.value !== undefined) {
                  allTemperatureData.push({
                    statid: typeof measurementEntry.statid === 'string' ? parseInt(measurementEntry.statid) : measurementEntry.statid,
                    station: measurementEntry.station || 'Ismeretlen',
                    water: measurementEntry.water || water.name,
                    lat: typeof measurementEntry.lat === 'string' ? parseFloat(measurementEntry.lat) : (measurementEntry.lat || 0),
                    lon: typeof measurementEntry.lon === 'string' ? parseFloat(measurementEntry.lon) : (measurementEntry.lon || 0),
                    date: measurement.date,
                    value: typeof measurement.value === 'string' ? parseFloat(measurement.value) : measurement.value,
                    unit: measurementEntry.unit || 'C°',
                  })
                }
              }
            }
          }
          console.log(`✅ ${water.name}: ${measurements.length} állomás adata lekérve`)
        } catch (error) {
          console.error(`❌ Hiba ${water.name} lekérésekor:`, error)
        }
      }

      console.log(`📊 Összesen ${allTemperatureData.length} vízhőmérséklet mérés találva`)

      // Excel fájl létrehozása
      const workbook = XLSX.utils.book_new()

      // Munkalap 1: Víztestek
      const watersSheet = XLSX.utils.json_to_sheet(
        waters.map((w) => ({
          'Víztest ID': w.waterid,
          'Víztest neve': w.name,
        }))
      )
      XLSX.utils.book_append_sheet(workbook, watersSheet, 'Víztestek')

      // Munkalap 2: Vízhőmérséklet adatok
      const temperatureSheet = XLSX.utils.json_to_sheet(allTemperatureData)
      XLSX.utils.book_append_sheet(workbook, temperatureSheet, 'Vízhőmérséklet')

      // Fájl mentése
      const fileName = `vizhomerseklet_adatok_${today.toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)

      console.log(`✅ Excel fájl létrehozva: ${fileName}`)
      alert(`Excel fájl sikeresen létrehozva: ${fileName}`)
    } catch (error) {
      console.error('❌ Excel export hiba:', error)
      alert('Hiba történt az Excel fájl létrehozása során. Nézd meg a konzolt!')
    }
  }

  return (
    <>
      <div className="underwater-background">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className={`bubble ${poppingBubbles.has(index) ? 'popping' : ''}`}
            onClick={() => handleBubbleClick(index)}
          />
        ))}
        {activeFish === 'pike' && (
          <div 
            key={`pike-${animationKey}`}
            className={`pike-container ${fishDirection}`}
            style={{ '--pike-top': `${pikeTopOffset}%` } as React.CSSProperties}
            onAnimationEnd={handleAnimationEnd}
          >
            <img src={pikeSvg} alt="Pike" className="pike" />
      </div>
        )}
        {activeFish === 'bass' && (
          <div 
            key={`bass-${animationKey}`}
            className={`bass-container ${fishDirection}`}
            style={{ '--bass-top': `${bassTopOffset}%` } as React.CSSProperties}
            onAnimationEnd={handleAnimationEnd}
          >
            <img src={bassSvg} alt="Bass" className="bass" />
          </div>
        )}
      </div>
      <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', position: 'relative', zIndex: 10, width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
        <h1 style={{ position: 'relative' }}>
          <img src={logoImg} alt="Logo" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: -1, opacity: 0.3, maxWidth: '200px', height: 'auto', filter: 'brightness(0) invert(1)' }} />
          <span style={{ color: '#FFFFF7' }}>HALNAPLÓ</span>
        </h1>
        <h4>Best horgász app in the world...</h4>
      <section
        style={{
          margin: '0.5rem 0',
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: '1px solid rgba(255, 255, 247, 0.2)',
          backgroundColor: 'rgba(85, 161, 191, 0.15)',
          backdropFilter: 'blur(10px)',
          color: 'rgba(255, 255, 247, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {authLoading ? (
          <p style={{ color: 'rgba(255, 255, 247, 0.9)', fontSize: '0.75rem', margin: 0 }}>Bejelentkezés állapotának ellenőrzése…</p>
        ) : user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {user.photoURL ? (
                <div style={{
                  position: 'relative',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 247, 0.2)',
                  border: '1px solid rgba(255, 255, 247, 0.3)',
                  padding: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? user.email ?? 'Felhasználó'}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ) : null}
              <div>
                <p style={{ margin: 0, fontWeight: 500, color: 'rgba(255, 255, 247, 0.95)', fontSize: '0.8rem' }}>{user.displayName ?? 'Bejelentkezett felhasználó'}</p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255, 255, 247, 0.8)' }}>{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authActionRunning}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #ef4444',
                backgroundColor: authActionRunning ? '#fca5a5' : '#ef4444',
                color: '#FFFFF7',
                cursor: authActionRunning ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
                fontSize: '0.75rem',
                opacity: 0.8,
              }}
            >
              Kijelentkezés
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: 'rgba(255, 255, 247, 0.9)', fontSize: '0.75rem', margin: 0 }}>Belépés után tudod menteni a helyszíneket.</p>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={authActionRunning}
              style={{
                alignSelf: 'flex-start',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid #2563eb',
                backgroundColor: authActionRunning ? '#93c5fd' : '#2563eb',
                color: '#FFFFF7',
                cursor: authActionRunning ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
                fontSize: '0.75rem',
              }}
            >
              Belépés Google fiókkal
            </button>
          </>
        )}
        {authError && <p style={{ color: '#dc2626', fontSize: '0.75rem', margin: 0 }}>{authError}</p>}
      </section>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        {user ? (
          <span style={{ fontSize: '0.85rem', color: '#FFFFF7' }}>
            Adj meg egy helyszínt <span style={{ color: 'rgba(211, 43, 21, 0.95)', fontWeight: 'bold'}}> vagy </span> kattints az „Automatikus helymeghatározás” gombra.
          </span>
        ) : null}
        <input
          type="text"
          value={location}
          onChange={handleLocationChange}
          placeholder="Írd be a helyszínt"
          disabled={isFormDisabled}
          style={{
            color: '#111827',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid #ccc',
            backgroundColor: isFormDisabled ? '#e2e8f0' : '#FFFFF7',
            cursor: isFormDisabled ? 'not-allowed' : 'text',
          }}
          onFocus={() => {
            if (locationSuggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 200)
          }}
        />
        {locationSuggestionLoading && <span style={{ color: '#475569' }}>Települések keresése…</span>}
        {locationSuggestionError && <span style={{ color: '#dc2626' }}>{locationSuggestionError}</span>}
        {showSuggestions && locationSuggestions.length > 0 ? (
          <ul
            style={{
              margin: 0,
              marginTop: '0.5rem',
              padding: 0,
              listStyle: 'none',
              border: '1px solid #cbd5f5',
              borderRadius: '0.5rem',
              backgroundColor: '#FFFFF7',
              maxHeight: '12rem',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
              zIndex: 10,
            }}
          >
            {locationSuggestions.map((suggestion) => {
              const displayName = [suggestion.name, suggestion.region, suggestion.country]
                .filter((value, index, array) => value && array.indexOf(value) === index)
                .join(', ')

              return (
                <li key={`${suggestion.id}-${suggestion.lat}-${suggestion.lon}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      void handleSelectSuggestion(suggestion)
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = '#f1f5f9'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{displayName}</span>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                      Koordináták: {suggestion.lat.toFixed(2)}, {suggestion.lon.toFixed(2)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </label>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isFormDisabled || geolocationLoading}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.25rem',
            border: '1px solid #1f2937',
            backgroundColor: isFormDisabled || geolocationLoading ? '#9ca3af' : '#111827',
            color: '#FFFFF7',
            cursor: isFormDisabled || geolocationLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          {geolocationLoading ? 'Helyzet meghatározása…' : 'Automatikus helymeghatározás'}
        </button>
        {geolocationError && <span style={{ color: '#dc2626' }}>{geolocationError}</span>}
      </div>

      <section
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || isFormDisabled || location.trim().length === 0}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.25rem',
          border: '1px solid #0d9488',
          backgroundColor: isSaving || isFormDisabled ? '#9ca3af' : '#14b8a6',
          color: '#ffffff',
          cursor: isSaving || isFormDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s ease',
          marginBottom: '1rem',
        }}
      >
        {isSaving ? 'Mentés…' : 'Mentés'}
      </button>
        {!user ? (
          <p>Jelentkezz be és adj meg helyszínt, hogy lásd az adatokat.</p>
        ) : weatherLoading ? (
          <p>Időjárási adatok betöltése…</p>
        ) : weatherError ? (
          <p style={{ color: '#dc2626' }}>{weatherError}</p>
        ) : weatherData ? (
          <div
            className={`data-card folded-corner ${isFlipped ? 'flipped' : ''} ${showBackCorner ? 'show-back-corner' : ''}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const clickX = e.clientX - rect.right
              const clickY = e.clientY - rect.bottom
              
              // Mindkét oldalon a jobb alsó sarok környékén kattintunk (70px körzetben)
              if (clickX > -70 && clickY > -70) {
                if (isFlipped) {
                  setShowBackCorner(false)
                  setIsFlipped(false)
                } else {
                  setShowBackCorner(false)
                  setIsFlipped(true)
                  // 0.6s után (amikor az animáció véget ér) megjelenik a corner a back oldalon
                  setTimeout(() => {
                    setShowBackCorner(true)
                  }, 600)
                }
              }
            }}
            style={{
              position: 'relative',
              width: '100%',
              height: 'auto',
              minHeight: '400px',
              cursor: 'pointer',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.6s ease-in-out',
              borderRadius: '0.75rem',
              overflow: 'hidden',
            }}
          >
            {/* Front side - Időjárási adatok */}
            <div
              className="card-front"
              style={{
                display: 'flex',
                flexDirection: 'column',
              gap: '1rem',
              padding: '1.5rem',
              borderRadius: '0.75rem',
                border: '1px solid #e0e0e0',
                backgroundColor: '#FFFFF7',
              color: '#0f172a',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {weatherData.locationName}
                {coordinates && (
                  <span
        style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginLeft: '0.25rem',
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '1'
                        tooltip.style.visibility = 'visible'
                      }
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '0'
                        tooltip.style.visibility = 'hidden'
                      }
                    }}
                  >
                    i
                    <span
                      data-tooltip
            style={{
                        position: 'absolute',
                        top: '50%',
                        left: '100%',
                        transform: 'translateY(-50%)',
                        marginLeft: '5px',
                        padding: '6px 10px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        opacity: 0,
                        visibility: 'hidden',
                        transition: 'opacity 0.2s, visibility 0.2s',
                      }}
                    >
                      Koordináták: {coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}
                    </span>
                  </span>
                )}
              </h3>
              {waterData?.water && (
                <p style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <strong>{waterData.water}</strong>
                  {waterData.station && (
                    <span
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#94a3b8',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginLeft: '0.25rem',
                      }}
                      onMouseEnter={(e) => {
                        const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                        if (tooltip) {
                          tooltip.style.opacity = '1'
                          tooltip.style.visibility = 'visible'
                        }
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                        if (tooltip) {
                          tooltip.style.opacity = '0'
                          tooltip.style.visibility = 'hidden'
                        }
                      }}
                    >
                      i
                      <span
                        data-tooltip
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '100%',
                          transform: 'translateY(-50%)',
                          marginLeft: '5px',
                          padding: '6px 10px',
                          backgroundColor: '#1e293b',
                          color: '#ffffff',
                          borderRadius: '4px',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          zIndex: 1000,
                          pointerEvents: 'none',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                          opacity: 0,
                          visibility: 'hidden',
                          transition: 'opacity 0.2s, visibility 0.2s',
                        }}
                      >
                        Legközelebbi mérőállomás: {waterData.station}
                      </span>
                    </span>
                  )}
                </p>
              )}
              {waterLoading ? (
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Vízállás: adatok betöltése…
                </p>
              ) : waterData?.measurements && waterData.measurements.length > 0 ? (
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Vízállás: {waterData.measurements[waterData.measurements.length - 1].value.toFixed(1)}{' '}
                    {waterData.unit || 'cm'}
                  <span
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginLeft: '0.25rem',
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '1'
                        tooltip.style.visibility = 'visible'
                      }
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '0'
                        tooltip.style.visibility = 'hidden'
                      }
                    }}
                  >
                    i
                    <span
                      data-tooltip
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '100%',
                        transform: 'translateY(-50%)',
                        marginLeft: '5px',
                        padding: '6px 10px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        opacity: 0,
                        visibility: 'hidden',
                        transition: 'opacity 0.2s, visibility 0.2s',
                      }}
                    >
                      Mérés dátuma: {new Date(waterData.measurements[waterData.measurements.length - 1].date).toLocaleString('hu-HU')}
                    </span>
                  </span>
                </p>
              ) : null}
                {waterTemperatureLoading ? (
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Vízhőmérséklet: adatok betöltése…
                    </p>
                ) : waterTemperatureError ? (
                <p style={{ margin: '0 0 0.5rem', color: '#ef4444' }}>
                      ⚠️ {waterTemperatureError}
                    </p>
                ) : waterTemperatureData && waterTemperatureData.measurements && waterTemperatureData.measurements.length > 0 && waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value != null ? (
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Vízhőmérséklet: {typeof waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value === 'number' ? waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value.toFixed(1) : waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value}{' '}
                      {waterTemperatureData.unit || '°C'}
                  <span
                    style={{
                      position: 'relative',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginLeft: '0.25rem',
                    }}
                    onMouseEnter={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '1'
                        tooltip.style.visibility = 'visible'
                      }
                    }}
                    onMouseLeave={(e) => {
                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                      if (tooltip) {
                        tooltip.style.opacity = '0'
                        tooltip.style.visibility = 'hidden'
                      }
                    }}
                  >
                    i
                    <span
                      data-tooltip
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '100%',
                        transform: 'translateY(-50%)',
                        marginLeft: '5px',
                        padding: '6px 10px',
                        backgroundColor: '#1e293b',
                        color: '#ffffff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        zIndex: 1000,
                        pointerEvents: 'none',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                        opacity: 0,
                        visibility: 'hidden',
                        transition: 'opacity 0.2s, visibility 0.2s',
                      }}
                    >
                      Mérés dátuma: {new Date(waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].date).toLocaleString('hu-HU')}
                    </span>
                  </span>
                </p>
                ) : !waterTemperatureLoading && waterTemperatureVarId ? (
                <p style={{ margin: '0 0 0.5rem' }}>
                  adatok betöltése...
                    </p>
                ) : null}
              <p style={{ margin: '0 0 0.5rem' }}>
                Levegő hőmérséklet: {weatherData.airTemperatureC.toFixed(1)} °C
              </p>
              <p style={{ margin: '0 0 0.5rem' }}>
                Légnyomás: {weatherData.pressureHpa.toFixed(0)} hPa ({weatherData.pressureTrend})
              </p>
              <p style={{ margin: '0 0 0.5rem' }}>
                Szél: {weatherData.windDirection} {weatherData.windSpeedKph.toFixed(1)} km/h
              </p>
              <p style={{ margin: 0 }}>
                Felhőzet: {weatherData.cloudCoverPercent}% &nbsp;|&nbsp; UV-index: {weatherData.uvIndex.toFixed(1)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem' }}>
                Csapadék esély: {weatherData.precipitationChancePercent}% &nbsp;|&nbsp; Intenzitás:{' '}
                {weatherData.precipitationIntensityMmPerHour.toFixed(1)} mm/h
              </p>
              <p style={{ margin: 0 }}>
                Napkelte: {weatherData.sunrise} &nbsp;|&nbsp; Napnyugta: {weatherData.sunset}
              </p>
                  </div>
              <div>
              <p style={{ margin: 0 }}>Holdfázis: {weatherData.moonPhase}</p>
              </div>
          </div>
            {/* Back side - Vízállás előrejelzés */}
            <div
              className="card-back"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '1.5rem',
                borderRadius: '0.75rem',
                border: '1px solid #e0e0e0',
                backgroundColor: '#FFFFF7',
                color: '#0f172a',
              }}
            >
                  {user && waterData ? (
                <>
                  <h2 style={{ marginBottom: '1rem', marginTop: 0 }}>Vízállás előrejelzés</h2>
                  {forecastLoading ? (
                    <p>Előrejelzés betöltése…</p>
                  ) : forecastError ? (
                    <p style={{ color: '#dc2626' }}>{forecastError}</p>
                  ) : forecastData && forecastData.length > 0 && forecastData[0]?.forecasts && forecastData[0].forecasts.length > 0 ? (
                    <>
              {(() => {
                const firstForecast = forecastData[0]
                const isFromDifferentStation = forecastStationId !== null && forecastStationId !== waterData.statid
                const lastMeasurement = waterData.measurements && waterData.measurements.length > 0
                  ? waterData.measurements[waterData.measurements.length - 1]
                  : null
                const currentWaterLevel = lastMeasurement
                  ? (typeof lastMeasurement.value === 'string'
                      ? parseFloat(lastMeasurement.value)
                      : lastMeasurement.value)
                  : null
                        // Számoljuk a tendenciát a megjelenített adatokból (előző 3 nap + mai nap + következő 3 nap)
                        let trend = null
                        if (pastWaterLevelData && pastWaterLevelData.length >= 3 && firstForecast.forecasts && firstForecast.forecasts.length > 0) {
                          // Összegyűjtjük az adatokat
                          const chartData: Array<{ date: Date; value: number }> = []
                          
                          // Előző 3 nap
                          if (pastWaterLevelData && pastWaterLevelData.length > 0) {
                            pastWaterLevelData.forEach((item) => {
                              const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                              const date = new Date(item.measurement.date)
                              chartData.push({ date, value })
                            })
                          }
                          
                          // Mai nap
                          if (currentWaterLevel !== null) {
                            const today = new Date()
                            chartData.push({ date: today, value: currentWaterLevel })
                          }
                          
                          // Következő 3 nap (előrejelzés)
                          const dailyForecasts = firstForecast.forecasts.reduce((acc: typeof firstForecast.forecasts, forecast) => {
                            const date = new Date(forecast.date)
                            const dateKey = date.toISOString().split('T')[0]
                            const existing = acc.find((f) => {
                              const fDate = new Date(f.date)
                              return fDate.toISOString().split('T')[0] === dateKey
                            })
                            if (!existing) {
                              acc.push(forecast)
                            } else {
                              const existingHour = new Date(existing.date).getHours()
                              const currentHour = date.getHours()
                              const existingDiff = Math.abs(existingHour - 12)
                              const currentDiff = Math.abs(currentHour - 12)
                              if (currentDiff < existingDiff) {
                                const index = acc.indexOf(existing)
                                acc[index] = forecast
                              }
                            }
                            return acc
                          }, [])
                          
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          const filteredForecasts = dailyForecasts.filter((forecast) => {
                            const forecastDate = new Date(forecast.date)
                            forecastDate.setHours(0, 0, 0, 0)
                            return forecastDate.getTime() !== today.getTime()
                          })
                          
                          const futureForecasts = filteredForecasts.filter((forecast) => {
                            const forecastDate = new Date(forecast.date)
                            forecastDate.setHours(0, 0, 0, 0)
                            return forecastDate.getTime() > today.getTime()
                          }).slice(0, 3)
                          
                          futureForecasts.forEach((forecast) => {
                            const value = typeof forecast.value === 'string' ? parseFloat(forecast.value) : forecast.value
                            const date = new Date(forecast.date)
                            chartData.push({ date, value })
                          })
                          
                          // Rendezzük dátum szerint
                          chartData.sort((a, b) => a.date.getTime() - b.date.getTime())
                          
                          // Kiszámoljuk a megjelenített adatokból a legkisebb és legnagyobb értéket
                          const allValues = chartData.map(d => d.value)
                          
                          if (allValues.length > 0) {
                            const minValue = Math.min(...allValues)
                            const maxValue = Math.max(...allValues)
                            const change = maxValue - minValue
                            
                            const threshold = Math.max(Math.abs(minValue) * 0.05, 10)
                            
                            if (Math.abs(change) < threshold) {
                              trend = {
                                type: 'stable' as const,
                                change: change,
                                days: 6,
                              }
                            } else {
                              const lastValue = allValues[allValues.length - 1]
                              const firstValue = allValues[0]
                              
                              if (lastValue > firstValue) {
                                trend = {
                                  type: 'increasing' as const,
                                  change: change,
                                  days: 6,
                                }
                              } else {
                                trend = {
                                  type: 'decreasing' as const,
                                  change: change,
                                  days: 6,
                                }
                              }
                            }
                          }
                        } else if (currentWaterLevel !== null) {
                          trend = calculateTrend(firstForecast.forecasts, currentWaterLevel)
                        }
                        const firstForecastForTrend = forecastData[0]
                return (
                  <>
                            {trend && (
                              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                {trend.type === 'increasing' && '📈 '}
                                {trend.type === 'decreasing' && '📉 '}
                                {trend.type === 'stable' && '➡️ '}
                                {trend.type === 'increasing' && 'Növekvő tendencia'}
                                {trend.type === 'decreasing' && 'Csökkenő tendencia'}
                                {trend.type === 'stable' && 'Stabil vízállás'}
                                {' - '}
                                {Math.round(Math.abs(trend.change))} cm változás
                                {(isFromDifferentStation || firstForecastForTrend.station) && (
                                  <span
                        style={{
                                      position: 'relative',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '50%',
                                      backgroundColor: '#94a3b8',
                                      color: '#ffffff',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      marginLeft: '0.25rem',
                                    }}
                                    onMouseEnter={(e) => {
                                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                      if (tooltip) {
                                        tooltip.style.opacity = '1'
                                        tooltip.style.visibility = 'visible'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                      if (tooltip) {
                                        tooltip.style.opacity = '0'
                                        tooltip.style.visibility = 'hidden'
                                      }
                                    }}
                                  >
                                    i
                                    <span
                                      data-tooltip
                        style={{
                                        position: 'absolute',
                                        bottom: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        marginBottom: '5px',
                                        padding: '6px 10px',
                                        backgroundColor: '#1e293b',
                                        color: '#ffffff',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        whiteSpace: 'nowrap',
                                        zIndex: 1000,
                                        pointerEvents: 'none',
                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                        opacity: 0,
                                        visibility: 'hidden',
                                        transition: 'opacity 0.2s, visibility 0.2s',
                                      }}
                                    >
                                      Az előrejelzés a legközelebbi állomásról származik ({firstForecastForTrend.station || 'Ismeretlen állomás'})
                                      {firstForecastForTrend.water && ` - ${firstForecastForTrend.water}`}
                                    </span>
                                  </span>
                                )}
                              </p>
                            )}
                            {pastWaterLevelLoading ? (
                              <div style={{ marginBottom: '1rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Előző 3 nap vízállása:</p>
                                <p style={{ margin: '0.25rem 0' }}>Betöltés…</p>
                              </div>
                            ) : pastWaterLevelError ? (
                              <div style={{ marginBottom: '1rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Előző 3 nap vízállása:</p>
                                <p style={{ margin: '0.25rem 0', color: '#ef4444' }}>{pastWaterLevelError}</p>
                              </div>
                            ) : pastWaterLevelData && pastWaterLevelData.length > 0 ? (
                              <div style={{ marginBottom: '1rem' }}>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Előző 3 nap vízállása:</p>
                                {pastWaterLevelData.map((item, idx) => {
                                  const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                                  const date = new Date(item.measurement.date)
                                  return (
                                    <p key={idx} style={{ margin: '0.25rem 0' }}>
                                      {date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}:{' '}
                                      {Math.round(value)} {item.entry.unit || waterData.unit || 'cm'}
                                    </p>
                                  )
                                })}
                      </div>
                            ) : null}
                            <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>Előrejelzési értékek:</p>
                      {(() => {
                                const firstForecastForDisplay = forecastData[0]
                                const dailyForecasts = firstForecastForDisplay.forecasts.reduce((acc: typeof firstForecastForDisplay.forecasts, forecast) => {
                          const date = new Date(forecast.date)
                                  const dateKey = date.toISOString().split('T')[0]
                          const existing = acc.find((f) => {
                            const fDate = new Date(f.date)
                            return fDate.toISOString().split('T')[0] === dateKey
                          })
                          if (!existing) {
                            acc.push(forecast)
                          } else {
                            const existingHour = new Date(existing.date).getHours()
                            const currentHour = date.getHours()
                            const existingDiff = Math.abs(existingHour - 12)
                            const currentDiff = Math.abs(currentHour - 12)
                            if (currentDiff < existingDiff) {
                              const index = acc.indexOf(existing)
                              acc[index] = forecast
                            }
                          }
                          return acc
                        }, [])
                        
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const filteredForecasts = dailyForecasts.filter((forecast) => {
                          const forecastDate = new Date(forecast.date)
                          forecastDate.setHours(0, 0, 0, 0)
                          return forecastDate.getTime() !== today.getTime()
                        })
                        
                        return filteredForecasts.slice(0, 3).map((forecast, idx) => {
                          const value = typeof forecast.value === 'string' ? parseFloat(forecast.value) : forecast.value
                          const conf = typeof forecast.conf === 'string' ? parseFloat(forecast.conf) : forecast.conf
                          const date = new Date(forecast.date)
                          return (
                                    <p key={idx} style={{ margin: '0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}:{' '}
                                      {Math.round(value)} {firstForecastForDisplay.unit || 'cm'}
                                      {conf !== undefined && !isNaN(conf) && (
                                        <span
                                          style={{
                                            position: 'relative',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '14px',
                                            height: '14px',
                                            borderRadius: '50%',
                                            backgroundColor: '#94a3b8',
                                            color: '#ffffff',
                                            fontSize: '10px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            marginLeft: '0.25rem',
                                          }}
                                          onMouseEnter={(e) => {
                                            const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                            if (tooltip) {
                                              tooltip.style.opacity = '1'
                                              tooltip.style.visibility = 'visible'
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                            if (tooltip) {
                                              tooltip.style.opacity = '0'
                                              tooltip.style.visibility = 'hidden'
                                            }
                                          }}
                                        >
                                          i
                                          <span
                                            data-tooltip
                                            style={{
                                              position: 'absolute',
                                              bottom: '100%',
                                              left: '50%',
                                              transform: 'translateX(-50%)',
                                              marginBottom: '5px',
                                              padding: '6px 10px',
                                              backgroundColor: '#1e293b',
                                              color: '#ffffff',
                                              borderRadius: '4px',
                                              fontSize: '12px',
                                              whiteSpace: 'nowrap',
                                              zIndex: 1000,
                                              pointerEvents: 'none',
                                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                              opacity: 0,
                                              visibility: 'hidden',
                                              transition: 'opacity 0.2s, visibility 0.2s',
                                            }}
                                          >
                                            {conf.toFixed(0)}% hibahatár
                                          </span>
                                        </span>
                                      )}
                            </p>
                          )
                        })
                      })()}
                    </div>
                              {/* Grafikon: előző 3 nap, mai nap, következő 3 nap */}
                              {forecastData && forecastData.length > 0 && (() => {
                              const firstForecastForChart = forecastData[0]
                              const chartData: Array<{ date: Date; value: number; isPast: boolean; isToday: boolean; isFuture: boolean }> = []
                              
                              // Előző 3 nap
                              if (pastWaterLevelData && pastWaterLevelData.length > 0) {
                                pastWaterLevelData.forEach((item) => {
                                  const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                                  const date = new Date(item.measurement.date)
                                  chartData.push({ date, value, isPast: true, isToday: false, isFuture: false })
                                })
                              }
                              
                              // Mai nap
                              if (currentWaterLevel !== null) {
                                const today = new Date()
                                chartData.push({ date: today, value: currentWaterLevel, isPast: false, isToday: true, isFuture: false })
                              }
                              
                              // Következő 3 nap (előrejelzés)
                              const dailyForecasts = firstForecastForChart.forecasts.reduce((acc: typeof firstForecastForChart.forecasts, forecast) => {
                                const date = new Date(forecast.date)
                                const dateKey = date.toISOString().split('T')[0]
                                const existing = acc.find((f) => {
                                  const fDate = new Date(f.date)
                                  return fDate.toISOString().split('T')[0] === dateKey
                                })
                                if (!existing) {
                                  acc.push(forecast)
                                } else {
                                  const existingHour = new Date(existing.date).getHours()
                                  const currentHour = date.getHours()
                                  const existingDiff = Math.abs(existingHour - 12)
                                  const currentDiff = Math.abs(currentHour - 12)
                                  if (currentDiff < existingDiff) {
                                    const index = acc.indexOf(existing)
                                    acc[index] = forecast
                                  }
                                }
                                return acc
                              }, [])
                              
                              const today = new Date()
                              today.setHours(0, 0, 0, 0)
                              const futureForecasts = dailyForecasts.filter((forecast) => {
                                const forecastDate = new Date(forecast.date)
                                forecastDate.setHours(0, 0, 0, 0)
                                return forecastDate.getTime() > today.getTime()
                              }).slice(0, 3)
                              
                              futureForecasts.forEach((forecast) => {
                                const value = typeof forecast.value === 'string' ? parseFloat(forecast.value) : forecast.value
                                const date = new Date(forecast.date)
                                chartData.push({ date, value, isPast: false, isToday: false, isFuture: true })
                              })
                              
                              // Rendezzük dátum szerint
                              chartData.sort((a, b) => a.date.getTime() - b.date.getTime())
                              
                              if (chartData.length === 0) {
                                return null
                              }
                              
                              // Fix skála: -100 és 800 cm között
                              const minValue = -100
                              const maxValue = 800
                              const range = maxValue - minValue
                              
                              // Grafikon méretek
                              const width = 200
                              const height = 200
                              const padding = { top: 10, right: 10, bottom: 30, left: 30 }
                              const chartWidth = width - padding.left - padding.right
                              const chartHeight = height - padding.top - padding.bottom
                              
                              // Pontok koordinátái
                              const points = chartData.map((data, index) => {
                                const x = padding.left + (index / (chartData.length - 1 || 1)) * chartWidth
                                const y = padding.top + chartHeight - ((data.value - minValue) / range) * chartHeight
                                return { x, y, ...data }
                              })
                              
                              // Vonal path
                              const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                              
                              return (
                                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e2e8f0', flexShrink: 0, width: '200px', height: '200px' }}>
                                    <svg width={width} height={height} style={{ overflow: 'visible' }}>
                                      {/* Y tengely skála */}
                                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                        const value = minValue + range * ratio
                                        const y = padding.top + chartHeight - ratio * chartHeight
                                        return (
                                          <g key={ratio}>
                                            <line
                                              x1={padding.left - 5}
                                              y1={y}
                                              x2={padding.left}
                                              y2={y}
                                              stroke="#cbd5e1"
                                              strokeWidth="1"
                                            />
                                            <text
                                              x={padding.left - 8}
                                              y={y + 3}
                                              textAnchor="end"
                                              fontSize="9"
                                              fill="#64748b"
                                            >
                                              {value.toFixed(0)} cm
                                            </text>
                                          </g>
                                        )
                                      })}
                                      
                                      {/* Grid vonalak */}
                                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                        const y = padding.top + chartHeight - ratio * chartHeight
                                        return (
                                          <line
                                            key={`grid-${ratio}`}
                                            x1={padding.left}
                                            y1={y}
                                            x2={padding.left + chartWidth}
                                            y2={y}
                                            stroke="#e2e8f0"
                                            strokeWidth="1"
                                            strokeDasharray="2,2"
                                          />
                                        )
                                      })}
                                      
                                      {/* Vonal */}
                                      <path
                                        d={pathData}
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      
                                      {/* Pontok */}
                                      {points.map((point, index) => {
                                        const isPast = point.isPast
                                        const isToday = point.isToday
                                        const isFuture = point.isFuture
                                        let color = '#3b82f6'
                                        let radius = 6
                                        
                                        if (isPast) {
                                          color = '#64748b'
                                          radius = 6
                                        } else if (isToday) {
                                          color = '#10b981'
                                          radius = 7
                                        } else if (isFuture) {
                                          color = '#f59e0b'
                                          radius = 6
                                        }
                                        
                                        return (
                                          <g key={index}>
                                            <circle
                                              cx={point.x}
                                              cy={point.y}
                                              r={radius}
                                              fill={color}
                                              stroke="#ffffff"
                                              strokeWidth="1.5"
                                              style={{ cursor: 'pointer' }}
                                              onMouseEnter={() => setHoveredPointIndex(index)}
                                              onMouseLeave={() => setHoveredPointIndex(null)}
                                            />
                                            <text
                                              x={point.x}
                                              y={height - padding.bottom + 12}
                                              textAnchor="middle"
                                              fontSize="8"
                                              fill="#64748b"
                                            >
                                              {point.isToday ? 'Mai nap' : point.date.toLocaleDateString('hu-HU', { day: 'numeric', month: 'short' })}
                                            </text>
                                          </g>
                                        )
                                      })}
                                      
                                      {/* X tengely */}
                                      <line
                                        x1={padding.left}
                                        y1={padding.top + chartHeight}
                                        x2={padding.left + chartWidth}
                                        y2={padding.top + chartHeight}
                                        stroke="#cbd5e1"
                                        strokeWidth="1"
                                      />
                                      
                                      {/* Y tengely */}
                                      <line
                                        x1={padding.left}
                                        y1={padding.top}
                                        x2={padding.left}
                                        y2={padding.top + chartHeight}
                                        stroke="#cbd5e1"
                                        strokeWidth="1"
                                      />
                                    </svg>
                                    {/* Tooltip */}
                                    {hoveredPointIndex !== null && points[hoveredPointIndex] && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          left: `${points[hoveredPointIndex].x + 15}px`,
                                          top: `${points[hoveredPointIndex].y + 15 - 30}px`,
                                          transform: 'translateX(-50%)',
                                          backgroundColor: '#1e293b',
                                          color: '#ffffff',
                                          padding: '0.375rem 0.625rem',
                                          borderRadius: '0.375rem',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          whiteSpace: 'nowrap',
                                          pointerEvents: 'none',
                                          zIndex: 10,
                                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        }}
                                      >
                                        {points[hoveredPointIndex].value.toFixed(1)} {firstForecastForChart.unit || (waterData && waterData.unit) || 'cm'}
                                      </div>
                                    )}
                                  </div>
                )
              })()}
            </div>
                  </>
                )
              })()}
                    </>
          ) : (
            <p style={{ color: '#64748b', fontStyle: 'italic' }}>
              Nincs elérhető előrejelzés erre az állomásra és paraméterre.
            </p>
          )}
                </>
              ) : (
                <p style={{ color: '#64748b', fontStyle: 'italic' }}>
                  Jelentkezz be és adj meg helyszínt, hogy lásd a vízállás előrejelzést.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Mentett bejegyzések</h2>
        {!user ? (
          <p>Bejelentkezés után érheted el a mentett rekordokat.</p>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1rem',
              }}
            >
              {records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => handleSelectRecord(record.id)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.25rem',
                    border: record.id === selectedRecordId ? '1px solid #2563eb' : '1px solid #cbd5f5',
                    backgroundColor: record.id === selectedRecordId ? '#2563eb' : 'rgba(203, 213, 225, 0.4)',
                    color: record.id === selectedRecordId ? '#FFFFF7' : '#0f172a',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>{record.locationName}</span>
                  <span
                    onClick={(event) => {
                      event.stopPropagation()
                      void handleDeleteRecord(record.id)
                    }}
                    title="Rekord törlése"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '9999px',
                      backgroundColor: 'rgba(248, 113, 113, 0.9)',
                      color: '#FFFFF7',
                      fontWeight: 700,
                      lineHeight: 1,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.backgroundColor = '#ef4444'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.9)'
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
            </div>
            {records.length === 0 ? (
              <div
                className="saved-data-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5f5',
                backgroundColor: '#f8fafc',
                color: '#000000',
                minHeight: '500px',
                overflowY: 'auto',
              }}
            >
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                  Nincs mentett rekord. Adj meg egy helyszínt fent, majd kattints a „Mentés” gombra.
                </p>
              </div>
              ) : selectedRecord ? (
              <div
                className={`saved-data-card data-card folded-corner ${savedCardFlipped ? 'flipped' : ''} ${showSavedBackCorner ? 'show-back-corner' : ''}`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const clickX = e.clientX - rect.right
                  const clickY = e.clientY - rect.bottom
                  
                  // Mindkét oldalon a jobb alsó sarok környékén kattintunk (70px körzetben)
                  if (clickX > -70 && clickY > -70) {
                    if (savedCardFlipped) {
                      setShowSavedBackCorner(false)
                      setSavedCardFlipped(false)
                    } else {
                      setShowSavedBackCorner(false)
                      setSavedCardFlipped(true)
                      // 0.6s után (amikor az animáció véget ér) megjelenik a corner a back oldalon
                      setTimeout(() => {
                        setShowSavedBackCorner(true)
                      }, 600)
                    }
                  }
                }}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 'auto',
                  minHeight: '400px',
                  cursor: 'pointer',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.6s ease-in-out',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                }}
              >
                {/* Front side - Időjárási adatok */}
                <div
                  className="card-front"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#FFFFF7',
                    color: '#0f172a',
                  }}
                >
                  {selectedRecord.weatherSnapshot ? (
                    <>
                      <div>
                        <h3 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {selectedRecord.locationName}
                          {selectedRecord.coordinates && (
                            <span
                              style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: '#94a3b8',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginLeft: '0.25rem',
                              }}
                              onMouseEnter={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '1'
                                  tooltip.style.visibility = 'visible'
                                }
                              }}
                              onMouseLeave={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '0'
                                  tooltip.style.visibility = 'hidden'
                                }
                              }}
                            >
                              i
                              <span
                                data-tooltip
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '100%',
                                  transform: 'translateY(-50%)',
                                  marginLeft: '5px',
                                  padding: '6px 10px',
                                  backgroundColor: '#1e293b',
                                  color: '#ffffff',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap',
                                  zIndex: 1000,
                                  pointerEvents: 'none',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                  opacity: 0,
                                  visibility: 'hidden',
                                  transition: 'opacity 0.2s, visibility 0.2s',
                                }}
                              >
                                Koordináták: {selectedRecord.coordinates.lat.toFixed(4)}, {selectedRecord.coordinates.lon.toFixed(4)}
                  </span>
                    </span>
                          )}
                        </h3>
                        {selectedRecord.waterDataSnapshot?.water && (
                          <p style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <strong>{selectedRecord.waterDataSnapshot.water}</strong>
                            {selectedRecord.waterDataSnapshot.station && (
                              <span
                                style={{
                                  position: 'relative',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  backgroundColor: '#94a3b8',
                                  color: '#ffffff',
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  marginLeft: '0.25rem',
                                }}
                                onMouseEnter={(e) => {
                                  const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                  if (tooltip) {
                                    tooltip.style.opacity = '1'
                                    tooltip.style.visibility = 'visible'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                  if (tooltip) {
                                    tooltip.style.opacity = '0'
                                    tooltip.style.visibility = 'hidden'
                                  }
                                }}
                              >
                                i
                                <span
                                  data-tooltip
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '100%',
                                    transform: 'translateY(-50%)',
                                    marginLeft: '5px',
                                    padding: '6px 10px',
                                    backgroundColor: '#1e293b',
                                    color: '#ffffff',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    whiteSpace: 'nowrap',
                                    zIndex: 1000,
                                    pointerEvents: 'none',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                    opacity: 0,
                                    visibility: 'hidden',
                                    transition: 'opacity 0.2s, visibility 0.2s',
                                  }}
                                >
                                  Legközelebbi mérőállomás: {selectedRecord.waterDataSnapshot.station}
                  </span>
                              </span>
                            )}
                          </p>
                        )}
                        {selectedRecord.waterDataSnapshot?.measurements && selectedRecord.waterDataSnapshot.measurements.length > 0 ? (
                          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            Vízállás: {selectedRecord.waterDataSnapshot.measurements[selectedRecord.waterDataSnapshot.measurements.length - 1].value.toFixed(1)}{' '}
                            {selectedRecord.waterDataSnapshot.unit || 'cm'}
                            <span
                      style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: '#94a3b8',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginLeft: '0.25rem',
                              }}
                              onMouseEnter={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '1'
                                  tooltip.style.visibility = 'visible'
                                }
                              }}
                              onMouseLeave={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '0'
                                  tooltip.style.visibility = 'hidden'
                                }
                              }}
                            >
                              i
                              <span
                                data-tooltip
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '100%',
                                  transform: 'translateY(-50%)',
                                  marginLeft: '5px',
                                  padding: '6px 10px',
                                  backgroundColor: '#1e293b',
                                  color: '#ffffff',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap',
                                  zIndex: 1000,
                                  pointerEvents: 'none',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                  opacity: 0,
                                  visibility: 'hidden',
                                  transition: 'opacity 0.2s, visibility 0.2s',
                                }}
                              >
                                Mérés dátuma: {new Date(selectedRecord.waterDataSnapshot.measurements[selectedRecord.waterDataSnapshot.measurements.length - 1].date).toLocaleString('hu-HU')}
                              </span>
                            </span>
                          </p>
                        ) : null}
                        {selectedRecord.waterTemperatureSnapshot?.measurements && selectedRecord.waterTemperatureSnapshot.measurements.length > 0 && selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value != null ? (
                          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            Vízhőmérséklet: {typeof selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value === 'number' ? selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value.toFixed(1) : selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value}{' '}
                            {selectedRecord.waterTemperatureSnapshot.unit || '°C'}
                            <span
                              style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: '#94a3b8',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginLeft: '0.25rem',
                              }}
                              onMouseEnter={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '1'
                                  tooltip.style.visibility = 'visible'
                                }
                              }}
                              onMouseLeave={(e) => {
                                const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                if (tooltip) {
                                  tooltip.style.opacity = '0'
                                  tooltip.style.visibility = 'hidden'
                                }
                              }}
                            >
                              i
                              <span
                                data-tooltip
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '100%',
                                  transform: 'translateY(-50%)',
                                  marginLeft: '5px',
                                  padding: '6px 10px',
                                  backgroundColor: '#1e293b',
                                  color: '#ffffff',
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  whiteSpace: 'nowrap',
                                  zIndex: 1000,
                                  pointerEvents: 'none',
                                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                  opacity: 0,
                                  visibility: 'hidden',
                                  transition: 'opacity 0.2s, visibility 0.2s',
                                }}
                              >
                                Mérés dátuma: {new Date(selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].date).toLocaleString('hu-HU')}
                              </span>
                            </span>
                          </p>
                        ) : null}
                        <p style={{ margin: '0 0 0.5rem' }}>
                          Levegő hőmérséklet: {selectedRecord.weatherSnapshot.airTemperatureC.toFixed(1)} °C
                        </p>
                        <p style={{ margin: '0 0 0.5rem' }}>
                          Légnyomás: {selectedRecord.weatherSnapshot.pressureHpa.toFixed(0)} hPa ({selectedRecord.weatherSnapshot.pressureTrend})
                        </p>
                        <p style={{ margin: '0 0 0.5rem' }}>
                          Szél: {selectedRecord.weatherSnapshot.windDirection} {selectedRecord.weatherSnapshot.windSpeedKph.toFixed(1)} km/h
                        </p>
                        <p style={{ margin: 0 }}>
                          Felhőzet: {selectedRecord.weatherSnapshot.cloudCoverPercent}% &nbsp;|&nbsp; UV-index: {selectedRecord.weatherSnapshot.uvIndex.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 0.25rem' }}>
                          Csapadék esély: {selectedRecord.weatherSnapshot.precipitationChancePercent}% &nbsp;|&nbsp; Intenzitás:{' '}
                          {selectedRecord.weatherSnapshot.precipitationIntensityMmPerHour.toFixed(1)} mm/h
                        </p>
                        <p style={{ margin: 0 }}>
                          Napkelte: {selectedRecord.weatherSnapshot.sunrise} &nbsp;|&nbsp; Napnyugta: {selectedRecord.weatherSnapshot.sunset}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0 }}>Holdfázis: {selectedRecord.weatherSnapshot.moonPhase}</p>
                      </div>
                    </>
                  ) : (
                    <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                      Ehhez a rekordhoz még nem tartozik mentett időjárási pillanat. Mentéskor automatikusan rögzül.
                    </p>
                  )}
                </div>
                {/* Back side - Vízállás előrejelzés */}
                <div
                  className="card-back"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #e0e0e0',
                    backgroundColor: '#FFFFF7',
                    color: '#0f172a',
                  }}
                >
                  {selectedRecord.forecastSnapshot && selectedRecord.forecastSnapshot.forecasts && selectedRecord.forecastSnapshot.forecasts.length > 0 ? (
                    <>
                      <h2 className="data-card-title">Vízállás előrejelzés</h2>
                      <div className="data-card-grid">
                        {(() => {
                          const firstForecast = selectedRecord.forecastSnapshot.forecasts[0]
                          const waterData = selectedRecord.waterDataSnapshot
                          const pastData = selectedRecord.pastWaterLevelSnapshot?.data || []
                          
                          // Számoljuk a tendenciát
                          let trend = null
                          if (pastData.length >= 3 && firstForecast.forecasts && firstForecast.forecasts.length > 0) {
                            const chartData: Array<{ date: Date; value: number }> = []
                            
                            // Előző 3 nap
                            pastData.forEach((item) => {
                              const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                              const date = new Date(item.measurement.date)
                              chartData.push({ date, value })
                            })
                            
                            // Mai nap
                            if (waterData?.measurements && waterData.measurements.length > 0) {
                              const lastMeasurement = waterData.measurements[waterData.measurements.length - 1]
                              const currentWaterLevel = typeof lastMeasurement.value === 'string' ? parseFloat(lastMeasurement.value) : lastMeasurement.value
                              const today = new Date()
                              chartData.push({ date: today, value: currentWaterLevel })
                            }
                            
                            // Következő 3 nap
                            const dailyForecasts = firstForecast.forecasts.reduce((acc: typeof firstForecast.forecasts, forecast) => {
                              const date = new Date(forecast.date)
                              const dateKey = date.toISOString().split('T')[0]
                              const existing = acc.find((f) => {
                                const fDate = new Date(f.date)
                                return fDate.toISOString().split('T')[0] === dateKey
                              })
                              if (!existing) {
                                acc.push(forecast)
                              } else {
                                const existingHour = new Date(existing.date).getHours()
                                const currentHour = date.getHours()
                                const existingDiff = Math.abs(existingHour - 12)
                                const currentDiff = Math.abs(currentHour - 12)
                                if (currentDiff < existingDiff) {
                                  const index = acc.indexOf(existing)
                                  acc[index] = forecast
                                }
                              }
                              return acc
                            }, [])
                            
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const futureForecasts = dailyForecasts.filter((forecast) => {
                              const forecastDate = new Date(forecast.date)
                              forecastDate.setHours(0, 0, 0, 0)
                              return forecastDate.getTime() > today.getTime()
                            }).slice(0, 3)
                            
                            futureForecasts.forEach((forecast) => {
                              const value = typeof forecast.value === 'string' ? parseFloat(forecast.value) : forecast.value
                              const date = new Date(forecast.date)
                              chartData.push({ date, value })
                            })
                            
                            chartData.sort((a, b) => a.date.getTime() - b.date.getTime())
                            
                            const allValues = chartData.map(d => d.value)
                            if (allValues.length > 0) {
                              const minValue = Math.min(...allValues)
                              const maxValue = Math.max(...allValues)
                              const change = maxValue - minValue
                              const threshold = Math.max(Math.abs(minValue) * 0.05, 10)
                              
                              if (Math.abs(change) < threshold) {
                                trend = { type: 'stable' as const, change: change }
                              } else {
                                const lastValue = allValues[allValues.length - 1]
                                const firstValue = allValues[0]
                                trend = {
                                  type: (lastValue > firstValue ? 'increasing' : 'decreasing') as 'increasing' | 'decreasing',
                                  change: change,
                                }
                              }
                            }
                          }
                          
                          return (
                            <>
                              {trend && (
                                  <p className="data-card-text" style={{ margin: '0 0 1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    {trend.type === 'increasing' && '📈 '}
                                    {trend.type === 'decreasing' && '📉 '}
                                    {trend.type === 'stable' && '➡️ '}
                                    {trend.type === 'increasing' && 'Növekvő tendencia'}
                                    {trend.type === 'decreasing' && 'Csökkenő tendencia'}
                                    {trend.type === 'stable' && 'Stabil vízállás'}
                                    {' - '}
                                    {Math.round(Math.abs(trend.change))} cm változás
                                    {firstForecast.station && (
                                      <span
                                        style={{
                                          position: 'relative',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: '14px',
                                          height: '14px',
                                          borderRadius: '50%',
                                          backgroundColor: '#94a3b8',
                                          color: '#ffffff',
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          marginLeft: '0.25rem',
                                        }}
                                        onMouseEnter={(e) => {
                                          const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                          if (tooltip) {
                                            tooltip.style.opacity = '1'
                                            tooltip.style.visibility = 'visible'
                                          }
                                        }}
                                        onMouseLeave={(e) => {
                                          const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                          if (tooltip) {
                                            tooltip.style.opacity = '0'
                                            tooltip.style.visibility = 'hidden'
                                          }
                                        }}
                                      >
                                        i
                                        <span
                                          data-tooltip
                                          style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            marginBottom: '5px',
                                            padding: '6px 10px',
                                            backgroundColor: '#1e293b',
                                            color: '#ffffff',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            whiteSpace: 'nowrap',
                                            zIndex: 1000,
                                            pointerEvents: 'none',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                            opacity: 0,
                                            visibility: 'hidden',
                                            transition: 'opacity 0.2s, visibility 0.2s',
                                          }}
                                        >
                                          Az előrejelzés a legközelebbi állomásról származik ({firstForecast.station || 'Ismeretlen állomás'})
                                          {firstForecast.water && ` - ${firstForecast.water}`}
                                        </span>
                                      </span>
                                    )}
                                  </p>
                              )}
                              {pastData.length > 0 && (
                                <div>
                                  <h3 className="data-card-title">Előző 3 nap vízállása:</h3>
                                  {pastData.map((item, idx) => {
                                    const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                                    const date = new Date(item.measurement.date)
                                    return (
                                      <p key={idx} className="data-card-text">
                                        {date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}:{' '}
                                        {Math.round(value)} {item.entry.unit || waterData?.unit || 'cm'}
                                      </p>
                                    )
                                  })}
                      </div>
                              )}
                      <div>
                                <h3 className="data-card-title">Előrejelzési értékek:</h3>
                                {(() => {
                                  const dailyForecasts = firstForecast.forecasts.reduce((acc: typeof firstForecast.forecasts, forecast) => {
                                    const date = new Date(forecast.date)
                                    const dateKey = date.toISOString().split('T')[0]
                                    const existing = acc.find((f) => {
                                      const fDate = new Date(f.date)
                                      return fDate.toISOString().split('T')[0] === dateKey
                                    })
                                    if (!existing) {
                                      acc.push(forecast)
                                    } else {
                                      const existingHour = new Date(existing.date).getHours()
                                      const currentHour = date.getHours()
                                      const existingDiff = Math.abs(existingHour - 12)
                                      const currentDiff = Math.abs(currentHour - 12)
                                      if (currentDiff < existingDiff) {
                                        const index = acc.indexOf(existing)
                                        acc[index] = forecast
                                      }
                                    }
                                    return acc
                                  }, [])
                                  
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  const filteredForecasts = dailyForecasts.filter((forecast) => {
                                    const forecastDate = new Date(forecast.date)
                                    forecastDate.setHours(0, 0, 0, 0)
                                    return forecastDate.getTime() !== today.getTime()
                                  })
                                  
                                  return filteredForecasts.slice(0, 3).map((forecast, idx) => {
                                    const value = typeof forecast.value === 'string' ? parseFloat(forecast.value) : forecast.value
                                    const conf = typeof forecast.conf === 'string' ? parseFloat(forecast.conf) : forecast.conf
                                    const date = new Date(forecast.date)
                                    return (
                                      <p key={idx} className="data-card-text" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' })}:{' '}
                                        {Math.round(value)} {firstForecast.unit || 'cm'}
                                        {conf !== undefined && !isNaN(conf) && (
                                          <span
                                            style={{
                                              position: 'relative',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              width: '14px',
                                              height: '14px',
                                              borderRadius: '50%',
                                              backgroundColor: '#94a3b8',
                                              color: '#ffffff',
                                              fontSize: '10px',
                                              fontWeight: 600,
                                              cursor: 'pointer',
                                              marginLeft: '0.25rem',
                                            }}
                                            onMouseEnter={(e) => {
                                              const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                              if (tooltip) {
                                                tooltip.style.opacity = '1'
                                                tooltip.style.visibility = 'visible'
                                              }
                                            }}
                                            onMouseLeave={(e) => {
                                              const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                              if (tooltip) {
                                                tooltip.style.opacity = '0'
                                                tooltip.style.visibility = 'hidden'
                                              }
                                            }}
                                          >
                                            i
                                            <span
                                              data-tooltip
                                              style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '100%',
                                                transform: 'translateY(-50%)',
                                                marginLeft: '5px',
                                                padding: '6px 10px',
                                                backgroundColor: '#1e293b',
                                                color: '#ffffff',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                whiteSpace: 'nowrap',
                                                zIndex: 1000,
                                                pointerEvents: 'none',
                                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                                                opacity: 0,
                                                visibility: 'hidden',
                                                transition: 'opacity 0.2s, visibility 0.2s',
                                              }}
                                            >
                                              {conf.toFixed(0)}% hibahatár
                                            </span>
                                          </span>
                                        )}
                                      </p>
                                    )
                                  })
                                })()}
                      </div>
                            </>
                          )
                        })()}
                    </div>
                    </>
                  ) : (
                    <p className="data-card-italic" style={{ textAlign: 'center', marginTop: '2rem' }}>
                      Ehhez a rekordhoz még nem tartozik mentett előrejelzés. Mentéskor automatikusan rögzül.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="saved-data-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5f5',
                  backgroundColor: '#f8fafc',
                  color: '#000000',
                  minHeight: '500px',
                  overflowY: 'auto',
                }}
              >
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                  Válassz egy rekordot a listából, vagy adj meg egy új helyszínt és mentsd el.
                </p>
            </div>
            )}
          </>
        )}
      </section>
      </main>
    </>
  )
}

export default App

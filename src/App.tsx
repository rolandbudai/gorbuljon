import React, { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'

import { useAuth } from './context/AuthContext.tsx'
import logoImg from './assets/logo-cropped.svg'
import geolocIcon from './assets/geoloc.svg'
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
} from './api/water.ts'
import {
  addRecord,
  deleteRecord,
  listenToRecords,
  type Coordinates,
  type LocationRecord,
  type WeatherSnapshot,
} from './services/records.ts'
import { StatisticsSection } from './components/StatisticsSection.tsx'
import { LogbookSection } from './components/logbook/LogbookSection.tsx'
import { ForecastSection } from './components/forecast/ForecastSection.tsx'
import { getLevelDescription as getLevelDescriptionFromStats } from './utils/statistics'

// Fish system types and config
type FishConfig = {
  src: string
  name: string
  width: number
  duration: string // CSS duration string (e.g., '48s')
}

// Configuration for specific species (default values)
const SPECIES_CONFIG: Record<string, { width: number; duration: string }> = {
  pike: { width: 600, duration: '48s' },
  bass: { width: 200, duration: '36s' },
  catfish: { width: 300, duration: '55s' },
  // Default fallback for new files
  default: { width: 200, duration: '40s' }
}

function App() {
  const { user, loading: authLoading, signInWithGoogle, signOutUser, authActionRunning } = useAuth()
  const [_message, setMessage] = useState<string>('KapcsolĂłdás ellenőrzése folyamatbanâ€¦')
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
  const [_saveMessage, setSaveMessage] = useState<string | null>(null)
  const [showFishPopup, setShowFishPopup] = useState(false)
  const [selectedFish, setSelectedFish] = useState<Record<string, number>>({})
  const fishOptions = ['balin', 'csuka', 'harcsa', 'süllő', 'sügér', 'egyéb', 'betli']
  const [authError, setAuthError] = useState<string | null>(null)
  const [geolocationLoading, setGeolocationLoading] = useState(false)
  const [geolocationError, setGeolocationError] = useState<string | null>(null)
  const [geolocationNameLoading, setGeolocationNameLoading] = useState(false)
  const isFormDisabled = authLoading || !user
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [waterData, setWaterData] = useState<MeasurementEntry | null>(null)
  const [waterLoading, setWaterLoading] = useState(false)
  const [_waterError, setWaterError] = useState<string | null>(null)
  const [waterLevelVarId, setWaterLevelVarId] = useState<number | null>(null)
  const [waterTemperatureData, setWaterTemperatureData] = useState<MeasurementEntry | null>(null)
  const [waterTemperatureLoading, setWaterTemperatureLoading] = useState(false)
  const [waterTemperatureError, setWaterTemperatureError] = useState<string | null>(null)
  const [waterTemperatureVarId, setWaterTemperatureVarId] = useState<number | null>(null)
  const [forecastData, setForecastData] = useState<ForecastEntry[] | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [pastWaterLevelData, setPastWaterLevelData] = useState<Array<{ entry: MeasurementEntry; measurement: Measurement }> | null>(null)
  const [_pastWaterLevelLoading, setPastWaterLevelLoading] = useState(false)
  const [_pastWaterLevelError, setPastWaterLevelError] = useState<string | null>(null)
  const cardFrontRef = useRef<HTMLDivElement>(null)
  const dataCardRef = useRef<HTMLDivElement>(null)
  const savedDataCardRef = useRef<HTMLDivElement>(null)
  const savedChartRef = useRef<HTMLDivElement>(null)
  const [savedCardFlipped, setSavedCardFlipped] = useState(false)
  const [showSavedBackCorner, setShowSavedBackCorner] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSearchResult[]>([])
  const [locationSuggestionLoading, setLocationSuggestionLoading] = useState(false)
  const [locationSuggestionError, setLocationSuggestionError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [poppingBubbles, setPoppingBubbles] = useState<Set<number>>(new Set())
  // Dynamic Fish Loading
  const fishAssets = useMemo(() => {
    const glob = import.meta.glob('./assets/fish/*.{png,svg,webp}', { eager: true, query: '?url', import: 'default' })
    return Object.entries(glob).map(([path, url]) => {
      // Extract filename without extension as species name
      const filename = path.split('/').pop()?.split('.')[0].toLowerCase() || 'unknown'
      const config = SPECIES_CONFIG[filename] || SPECIES_CONFIG['default']
      return {
        src: url,
        name: filename,
        width: config.width,
        duration: config.duration
      } as FishConfig
    })
  }, []) // Load once

  const [activeFish, setActiveFish] = useState<FishConfig | null>(null)
  const [fishTopOffset, setFishTopOffset] = useState<number>(30)
  const [fishDirection, setFishDirection] = useState<'left-to-right' | 'right-to-left'>('left-to-right')
  const [nextDirection, setNextDirection] = useState<'left-to-right' | 'right-to-left'>('right-to-left')
  const [animationKey, setAnimationKey] = useState<number>(0)
  const [isLightMode, setIsLightMode] = useState(false)

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light-mode')
    } else {
      document.body.classList.remove('light-mode')
    }
  }, [isLightMode])

  // Filter states
  // State-ek
  const [showStatistics, setShowStatistics] = useState<boolean>(false)
  const [showLogbook, setShowLogbook] = useState<boolean>(false)
  const [showForecast, setShowForecast] = useState<boolean>(false)
  const [deleteConfirmRecordId, setDeleteConfirmRecordId] = useState<string | null>(null)


  // Az első hal 3 másodperc késleltetéssel úszik be
  useEffect(() => {
    const timer = setTimeout(() => {
      // Pick random fish from available assets
      if (fishAssets.length > 0) {
        const randomFish = fishAssets[Math.floor(Math.random() * fishAssets.length)]
        setActiveFish(randomFish)
        setFishTopOffset(Math.random() * 60 + 10)
        setFishDirection('left-to-right')
        setNextDirection('right-to-left')
      }
    }, 3000)

    return () => clearTimeout(timer)
  }, [fishAssets])

  // Új hal generálása amikor kiúszik
  const generateNewFish = () => {
    if (fishAssets.length === 0) return

    // Pick random fish
    const randomFish = fishAssets[Math.floor(Math.random() * fishAssets.length)]
    setActiveFish(randomFish)

    // Random height
    setFishTopOffset(Math.random() * 60 + 10)

    // Direction swap
    const currentDir = nextDirection
    setFishDirection(currentDir)
    setNextDirection(currentDir === 'left-to-right' ? 'right-to-left' : 'left-to-right')

    // Restart animation
    setAnimationKey(prev => prev + 1)
  }

  // Új hal generálása amikor az animáciĂł befejeződik
  const handleAnimationEnd = () => {
    const delay = Math.random() * 3000
    setTimeout(() => {
      generateNewFish()
    }, delay)
  }

  useEffect(() => {
    if (authLoading) {
      setMessage('Bejelentkezés állapotának ellenőrzéseâ€¦')
      return
    }

    if (!user) {
      setMessage('Lépj be Google fiĂłkkal, hogy menteni tudd a helyszíneket.')
      setRecords([])
      setSelectedRecordId(null)
      setLocation('')
      setLocationQuery('')
      setCoordinates(undefined)
      return
    }

    setMessage('Rekordok betöltéseâ€¦')

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
      (error) => {
        console.error('Hiba a rekordok betöltésekor:', error)
        setMessage(`Hoppá, valami hiba történt a rekordok betöltésekor: ${error.message || 'Ismeretlen hiba'}`)
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
      // Ne töröljük a weatherData-t, weatherError-t, location-t és locationQuery-t,
      // hogy a felső data-card megmaradjon az aktuálisan lekért adatokkal
      // setLocation('')
      // setLocationQuery('')
      // setCoordinates(undefined)
      return
    }

    // Ha van kiválasztott rekord ID, de az már nem létezik a rekordok között, null-ra állítjuk
    if (selectedRecordId && !records.some((record) => record.id === selectedRecordId)) {
      setSelectedRecordId(null)
      // Ne töröljük a weatherData-t, hogy a data-card megmaradjon
    }

    // Nem választunk ki automatikusan rekordot - csak manuális kattintásra
  }, [records, selectedRecordId, user])

  // Dinamikusan beállítjuk a data-card magasságát a grafikon mérete alapján és az ikonok méretét
  useEffect(() => {
    if (dataCardRef.current) {
      const viewportHeight = window.innerHeight

      // Az ikonok méretét a viewport height alapján számoljuk (vh egységben)
      // Min: 0.8rem, Max: 2rem, alapértelmezett: 1.25rem
      const iconSizeMultiplier = Math.max(0.64, Math.min(1.6, viewportHeight / 800)) // 0.8-2rem között skálázĂłdik
      const root = document.documentElement
      root.style.setProperty('--icon-size-base', `${iconSizeMultiplier}rem`)

      // Data field méretek reszponzív beállítása
      const fieldLabelSize = Math.max(0.6, Math.min(0.75, viewportHeight / 1200))
      const fieldValueSize = Math.max(0.8, Math.min(1.25, viewportHeight / 800))
      const fieldIconSize = Math.max(0.7, Math.min(1, viewportHeight / 1000))
      root.style.setProperty('--data-field-label-size', `${fieldLabelSize}rem`)
      root.style.setProperty('--data-field-value-size', `${fieldValueSize}rem`)
      root.style.setProperty('--data-field-icon-size', `${fieldIconSize}rem`)
    }
  }, [weatherData, waterData, selectedRecord])

  // Data-card magasság dinamikus beállítása a grafikon mérete alapján
  useEffect(() => {
    if (dataCardRef.current && (weatherData || waterData)) {
      // Várunk egy kicsit, hogy a DOM frissüljön
      const timeoutId = setTimeout(() => {
        if (dataCardRef.current) {
          const cardFront = dataCardRef.current.querySelector('.card-front') as HTMLElement

          if (cardFront) {
            const frontHeight = cardFront.scrollHeight
            // Hozzáadunk egy kis padding-ot
            const cardHeight = frontHeight + 20 // 20px padding

            dataCardRef.current.style.height = `${cardHeight}px`
            dataCardRef.current.style.maxHeight = `${cardHeight}px`
          }
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [weatherData, waterData, forecastData])

  // Saved-data-card magasság dinamikus beállítása a grafikon mérete alapján
  useEffect(() => {
    if (savedDataCardRef.current && selectedRecord) {
      // Várunk egy kicsit, hogy a DOM frissüljön
      const timeoutId = setTimeout(() => {
        if (savedDataCardRef.current) {
          const cardFront = savedDataCardRef.current.querySelector('.card-front') as HTMLElement
          const cardBack = savedDataCardRef.current.querySelector('.card-back') as HTMLElement

          if (cardFront && cardBack) {
            const frontHeight = cardFront.scrollHeight
            const backHeight = cardBack.scrollHeight

            // A magasság a nagyobbik oldal alapján legyen (front vagy back)
            const maxContentHeight = Math.max(frontHeight, backHeight)

            // Hozzáadunk egy kis padding-ot
            const cardHeight = maxContentHeight + 20 // 20px padding

            savedDataCardRef.current.style.height = `${cardHeight}px`
            savedDataCardRef.current.style.maxHeight = `${cardHeight}px`
          }
        }
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [selectedRecord, savedCardFlipped, selectedRecord?.forecastSnapshot])

  // Window resize esemény kezelése az ikonok méretének frissítéséhez
  useEffect(() => {
    const handleResize = () => {
      if (dataCardRef.current) {
        const viewportHeight = window.innerHeight

        const iconSizeMultiplier = Math.max(0.64, Math.min(1.6, viewportHeight / 800))
        const root = document.documentElement
        root.style.setProperty('--icon-size-base', `${iconSizeMultiplier}rem`)

        // Data field méretek reszponzív beállítása
        const fieldLabelSize = Math.max(0.6, Math.min(0.75, viewportHeight / 1200))
        const fieldValueSize = Math.max(0.8, Math.min(1.25, viewportHeight / 800))
        const fieldIconSize = Math.max(0.7, Math.min(1, viewportHeight / 1000))
        root.style.setProperty('--data-field-label-size', `${fieldLabelSize}rem`)
        root.style.setProperty('--data-field-value-size', `${fieldValueSize}rem`)
        root.style.setProperty('--data-field-icon-size', `${fieldIconSize}rem`)
      }

      // Data-card magasság frissítése resize esetén
      if (dataCardRef.current && (weatherData || waterData)) {
        const cardFront = dataCardRef.current.querySelector('.card-front') as HTMLElement
        const cardBack = dataCardRef.current.querySelector('.card-back') as HTMLElement

        if (cardFront && cardBack) {
          const frontHeight = cardFront.scrollHeight
          const backHeight = cardBack.scrollHeight
          const maxContentHeight = Math.max(frontHeight, backHeight)
          const cardHeight = maxContentHeight + 20

          dataCardRef.current.style.height = `${cardHeight}px`
          dataCardRef.current.style.maxHeight = `${cardHeight}px`
        }
      }

      // Saved-data-card magasság frissítése resize esetén
      if (savedDataCardRef.current && selectedRecord) {
        const cardFront = savedDataCardRef.current.querySelector('.card-front') as HTMLElement
        const cardBack = savedDataCardRef.current.querySelector('.card-back') as HTMLElement

        if (cardFront && cardBack) {
          const frontHeight = cardFront.scrollHeight
          const backHeight = cardBack.scrollHeight
          const maxContentHeight = Math.max(frontHeight, backHeight)
          const cardHeight = maxContentHeight + 20

          savedDataCardRef.current.style.height = `${cardHeight}px`
          savedDataCardRef.current.style.maxHeight = `${cardHeight}px`
        }
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [selectedRecord, weatherData, waterData])


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
  }, caughtFish?: string[] | Record<string, number>) => {
    if (!user) {
      throw new Error('Bejelentkezés szükséges a mentéshez.')
    }

    const locationName = (overrides?.locationName ?? location).trim()
    const query = (overrides?.locationQuery ?? locationQuery ?? locationName).trim()

    if (!locationName || !query) {
      throw new Error('Ăśres helyszínt nem lehet menteni.')
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

    // Dátum és idő formázása
    const now = new Date()
    const date = now.toISOString().split('T')[0].replace(/-/g, '.') // yyyy.mm.dd
    const time = now.toTimeString().split(' ')[0].slice(0, 5) // HH:MM

    const payload = {
      locationName,
      locationQuery: query,
      coordinates: nextCoordinates,
      date,
      time,
      weatherSnapshot: snapshot,
      waterDataSnapshot,
      waterTemperatureSnapshot,
      forecastSnapshot,
      pastWaterLevelSnapshot,
      caughtFish: caughtFish
        ? (Array.isArray(caughtFish) ? caughtFish : caughtFish)
        : undefined, // Mentés Record<string, number> vagy string[] formátumban
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
      setSaveMessage('Előbb jelentkezz be Google fiĂłkkal!')
      return
    }

    const trimmed = location.trim()
    if (!trimmed) {
      setSaveMessage('Add meg a helyszínt a mentéshez!')
      return
    }

    // Popup megjelenítése a halak kiválasztásához
    setShowFishPopup(true)
  }

  const handleFishPopupConfirm = async () => {
    setIsSaving(true)
    setSaveMessage('Mentés folyamatbanâ€¦')

    try {
      await saveLocation(undefined, Object.keys(selectedFish).length > 0 ? selectedFish : undefined)
      setSelectedFish({}) // Reset a következő mentéshez
      setShowFishPopup(false) // Csak sikeres mentés után zárjuk be a popup-ot
    } catch (error) {
      console.error('Hiba a rekord mentésekor:', error)
      setSaveMessage(`Mentés sikertelen: ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`)
      // Ne zárjuk be a popup-ot hiba esetén, hogy a felhasználĂł újra prĂłbálkozhat
    } finally {
      setIsSaving(false)
    }
  }

  const handleFishPopupCancel = () => {
    setShowFishPopup(false)
    setSelectedFish({})
  }

  const toggleFish = (fish: string) => {
    setSelectedFish(prev => {
      if (prev[fish]) {
        const newState = { ...prev }
        delete newState[fish]
        return newState
      } else {
        return { ...prev, [fish]: 1 }
      }
    })
  }

  const increaseFishCount = (fish: string) => {
    setSelectedFish(prev => ({
      ...prev,
      [fish]: (prev[fish] || 0) + 1
    }))
  }

  const decreaseFishCount = (fish: string) => {
    setSelectedFish(prev => {
      const currentCount = prev[fish] || 0
      if (currentCount <= 1) {
        const newState = { ...prev }
        delete newState[fish]
        return newState
      }
      return {
        ...prev,
        [fish]: currentCount - 1
      }
    })
  }

  const handleSignIn = async () => {
    setAuthError(null)
    try {
      await signInWithGoogle()
    } catch (error) {
      setAuthError('A Google bejelentkezés sikertelen. Próbáld újra később.')
    }
  }

  // Koordináták beállítása a kiválasztott rekordbĂłl - csak akkor, ha nincs explicit koordináta beállítva
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

    // Ne használjuk a rekord adatokat a weatherData betöltéséhez
    // A felső data-card mindig az aktuális adatokat mutatja (explicit location vagy locationQuery alapján)
    const query = trimmedQuery || trimmedInput

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

  // Vízszint és vízhőmérséklet paraméter azonosítĂłk lekérése
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
          console.log('📋 VáltozĂłk lekérve:', variables.map(v => ({ varid: v.varid, name: v.name })))

          // Keresünk vízszint paramétert (lehet "vízszint", "vízállás", stb.)
          const waterLevelVar = variables.find(
            (v) =>
              v.name.toLowerCase().includes('vízszint') ||
              v.name.toLowerCase().includes('vízállás') ||
              v.name.toLowerCase().includes('vízmérték'),
          )
          if (waterLevelVar) {
            console.log('✅ Vízállás változĂł találva:', { varid: waterLevelVar.varid, name: waterLevelVar.name })
            setWaterLevelVarId(waterLevelVar.varid)
          } else {
            console.log('❌ Vízállás változĂł nem találhatĂł')
          }

          // Keresünk vízhőmérséklet paramétert (vízfelszín közelében)
          // Először prĂłbáljuk meg a pontosabb keresést (vízhő + felszín)
          let waterTemperatureVar = variables.find(
            (v) =>
              (v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')) &&
              (v.name.toLowerCase().includes('felszín') || v.name.toLowerCase().includes('felszíni')),
          )

          // Ha nem találjuk, prĂłbáljuk meg csak a "vízhő" szĂłval (de nem a mederfenék közelében lévőt)
          if (!waterTemperatureVar) {
            console.log('🔍 Vízhőmérséklet változĂł keresés (felszín): nem találhatĂł, prĂłbáljuk a második keresést...')
            waterTemperatureVar = variables.find(
              (v) =>
                (v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')) &&
                !v.name.toLowerCase().includes('fenék') &&
                !v.name.toLowerCase().includes('meder'),
            )
          }

          if (waterTemperatureVar) {
            console.log('✅ Vízhőmérséklet változĂł találva:', { varid: waterTemperatureVar.varid, name: waterTemperatureVar.name })
            setWaterTemperatureVarId(waterTemperatureVar.varid)
          } else {
            console.log('❌ Vízhőmérséklet változĂł nem találhatĂł')
            console.log('🔍 Elérhető változĂłk, amelyek tartalmaznak "vízhő" vagy "víz hő" szavakat:')
            const tempVars = variables.filter(v =>
              v.name.toLowerCase().includes('vízhő') || v.name.toLowerCase().includes('víz hő')
            )
            if (tempVars.length > 0) {
              tempVars.forEach(v => console.log(`  - ${v.name} (varid: ${v.varid})`))
            } else {
              console.log('  Nincs ilyen változĂł')
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
      console.log('❌ Vízhőmérséklet lekérés nem indíthatĂł: hiányzĂł feltétel(ek)')
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
        console.log('📡 Víztestek lekérése...')
        const waters = await getWaters()
        console.log(`✅ Víztestek lekérve: ${waters.length} db`)
        const waterInfo = waters.find((w) => w.name === waterData.water)

        if (!waterInfo) {
          console.error(`❌ Nem találhatĂł víztest informáciĂł: ${waterData.water}`)
          if (!cancelled) {
            setWaterTemperatureError(`Nem találhatĂł víztest informáciĂł: ${waterData.water}`)
            setWaterTemperatureData(null)
          }
          return
        }
        console.log(`✅ Víztest informáciĂł találva: ${waterInfo.name} (waterid: ${waterInfo.waterid})`)

        // Először lekérjük az összes vízhőmérséklet adatot a víztesthez
        console.log('📡 Ă–sszes vízhőmérséklet adat lekérése a víztesthez...')
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
          console.log('⚠️ď¸Ź Nincs érvényes vízhőmérséklet adat a víztesten')
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
          console.log('⚠️ď¸Ź Nem találhatĂł állomás érvényes koordinátákkal')
          if (!cancelled) {
            setWaterTemperatureError('Nem találhatĂł vízhőmérséklet adat érvényes koordinátákkal')
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
          console.log('đźŹ Vízhőmérséklet lekérés befejezve')
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
        // Először prĂłbáljuk meg lekérni az adott állomás előrejelzését
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

              // PrĂłbáljuk meg lekérni az előrejelzést minden állomásra, amíg nem találunk egyet, amelyen van
              // De először prĂłbáljuk meg a getVariableStations-t
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

              // Ha nincs eredmény a getVariableStations-bĂłl, prĂłbáljuk meg közvetlenül az összes állomásbĂłl
              if (stationsWithForecast.length === 0) {
                // PrĂłbáljuk meg az első 10 állomást (hatékonyság miatt)
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

              // Számoljuk ki a távolságot minden állomástĂłl
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

          // Csak az utolsĂł 3 napot vesszük
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
      console.error('Logout error:', error)
      // setAuthError('A kijelentkezés nem sikerült. Próbáld újra.') // User requested to remove this "false" message
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

  // Helper függvények a dinamikus variant class számításához
  // Helper függvények a 7 fokozatú színezési rendszerhez
  const getWaterLevelLevel = (value: number | string): number => {
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

  // Wrapper függvény a kompatibilitáshoz: string típus → DataType
  const getLevelDescription = (level: number, type: string): string => {
    // String típus leképezése DataType-ra
    const dataTypeMap: Record<string, 'waterLevel' | 'waterTemperature' | 'airTemperature' | 'pressure' | 'cloudCover' | 'precipitationChance' | 'windSpeed' | 'uvIndex' | 'moonPhase' | 'lightChange'> = {
      'water': 'waterLevel',
      'temp': 'waterTemperature',
      'weather': 'airTemperature',
      'pressure': 'pressure',
      'cloud': 'cloudCover',
      'rain': 'precipitationChance',
      'wind': 'windSpeed',
      'uv': 'uvIndex',
      'moon': 'moonPhase',
      'sun': 'lightChange'
    }

    const dataType = dataTypeMap[type]
    if (!dataType) return ''

    return getLevelDescriptionFromStats(level, dataType)
  }

  const getVariantClass = (level: number, baseName: string): string => {
    // Negatív számok esetén külön kezelés (pl. variant-water--3)
    if (level < 0) {
      return `variant-${baseName}--${Math.abs(level)}`
    }
    return `variant-${baseName}-${level}`
  }

  const getWaterTempLevel = (value: number | string): number => {
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

  const getAirTempLevel = (value: number): number => {
    if (isNaN(value)) return 0
    if (value <= -10) return -3
    if (value <= -2) return -2
    if (value <= 6) return -1
    if (value <= 16) return 0
    if (value <= 24) return 1
    if (value <= 32) return 2
    return 3
  }

  const getPressureLevel = (value: number): number => {
    if (isNaN(value)) return 0
    if (value <= 985) return -3
    if (value <= 995) return -2
    if (value <= 1005) return -1
    if (value <= 1018) return 0
    if (value <= 1025) return 1
    if (value <= 1035) return 2
    return 3
  }

  const getCloudCoverLevel = (percent: number): number => {
    if (isNaN(percent)) return 0
    if (percent <= 10) return -3
    if (percent <= 30) return -2
    if (percent <= 50) return -1
    if (percent <= 70) return 0
    if (percent <= 85) return 1
    if (percent <= 95) return 2
    return 3
  }

  const getRainLevel = (chance: number): number => {
    if (isNaN(chance)) return 0
    if (chance <= 5) return -3
    if (chance <= 20) return -2
    if (chance <= 40) return -1
    if (chance <= 60) return 0
    if (chance <= 75) return 1
    if (chance <= 90) return 2
    return 3
  }

  const getWindLevel = (speedKph: number): number => {
    if (isNaN(speedKph)) return 0
    if (speedKph <= 2) return -3
    if (speedKph <= 9) return -2
    if (speedKph <= 18) return -1
    if (speedKph <= 29) return 0
    if (speedKph <= 40) return 1
    if (speedKph <= 61) return 2
    return 3
  }

  const getUVLevel = (uvIndex: number): number => {
    if (isNaN(uvIndex)) return 0
    if (uvIndex <= 1) return -3
    if (uvIndex <= 2) return -2
    if (uvIndex <= 4) return -1
    if (uvIndex <= 6) return 0
    if (uvIndex <= 7) return 1
    if (uvIndex <= 10) return 2
    return 3
  }

  const isLightChangeTime = (sunrise: string, sunset: string, referenceDate?: Date): string => {
    try {
      const now = referenceDate || new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes() // percben

      // Parse sunrise time (pl. "06:30 AM" vagy "06:30")
      const parseTime = (timeStr: string): number => {
        if (!timeStr || timeStr === '-') return -1

        // Távolítsuk el a szĂłközöket és alakítsuk nagybetűssé
        const cleaned = timeStr.trim().toUpperCase()

        // PrĂłbáljuk meg a "HH:MM AM/PM" formátumot
        const amPmMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
        if (amPmMatch) {
          let hours = parseInt(amPmMatch[1], 10)
          const minutes = parseInt(amPmMatch[2], 10)
          const amPm = amPmMatch[3]

          if (amPm === 'PM' && hours !== 12) hours += 12
          if (amPm === 'AM' && hours === 12) hours = 0

          return hours * 60 + minutes
        }

        // PrĂłbáljuk meg a "HH:MM" formátumot
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
        return 'NEM'
      }

      // Ellenőrizzük, hogy az aktuális idő +/- 30 perc intervallumban van-e
      const sunriseStart = sunriseTime - 30
      const sunriseEnd = sunriseTime + 30
      const sunsetStart = sunsetTime - 30
      const sunsetEnd = sunsetTime + 30

      // Kezeljük az éjfélt átnyúlĂł eseteket
      const isInSunriseRange =
        (sunriseStart >= 0 && currentTime >= sunriseStart && currentTime <= sunriseEnd) ||
        (sunriseStart < 0 && (currentTime >= (1440 + sunriseStart) || currentTime <= sunriseEnd))

      const isInSunsetRange =
        (sunsetStart >= 0 && currentTime >= sunsetStart && currentTime <= sunsetEnd) ||
        (sunsetEnd >= 1440 && (currentTime >= sunsetStart || currentTime <= (sunsetEnd - 1440)))

      return (isInSunriseRange || isInSunsetRange) ? 'IGEN' : 'NEM'
    } catch (error) {
      console.error('Error checking light change time:', error)
      return 'NEM'
    }
  }

  const getLightChangeLevel = (sunrise: string, sunset: string, referenceDate?: Date): number => {
    try {
      const now = referenceDate || new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes() // percben

      // Parse sunrise time (pl. "06:30 AM" vagy "06:30")
      const parseTime = (timeStr: string): number => {
        if (!timeStr || timeStr === '-') return -1

        // Távolítsuk el a szĂłközöket és alakítsuk nagybetűssé
        const cleaned = timeStr.trim().toUpperCase()

        // PrĂłbáljuk meg a "HH:MM AM/PM" formátumot
        const amPmMatch = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/)
        if (amPmMatch) {
          let hours = parseInt(amPmMatch[1], 10)
          const minutes = parseInt(amPmMatch[2], 10)
          const amPm = amPmMatch[3]

          if (amPm === 'PM' && hours !== 12) hours += 12
          if (amPm === 'AM' && hours === 12) hours = 0

          return hours * 60 + minutes
        }

        // PrĂłbáljuk meg a "HH:MM" formátumot
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

      // Ellenőrizzük, hogy az aktuális idő +/- 30 perc intervallumban van-e
      const sunriseStart = sunriseTime - 30
      const sunriseEnd = sunriseTime + 30
      const sunsetStart = sunsetTime - 30
      const sunsetEnd = sunsetTime + 30

      // Kezeljük az éjfélt átnyúlĂł eseteket
      const isInSunriseRange =
        (sunriseStart >= 0 && currentTime >= sunriseStart && currentTime <= sunriseEnd) ||
        (sunriseStart < 0 && (currentTime >= (1440 + sunriseStart) || currentTime <= sunriseEnd))

      const isInSunsetRange =
        (sunsetStart >= 0 && currentTime >= sunsetStart && currentTime <= sunsetEnd) ||
        (sunsetEnd >= 1440 && (currentTime >= sunsetStart || currentTime <= (sunsetEnd - 1440)))

      return (isInSunriseRange || isInSunsetRange) ? 1 : 0
    } catch (error) {
      console.error('Error checking light change level:', error)
      return 0
    }
  }

  const getDaysUntilFullMoon = (moonPhase: string): string => {
    try {
      if (!moonPhase || moonPhase === '-') {
        return 'Ismeretlen'
      }

      // A holdfázis ciklusa kb. 29.5 nap
      const LUNAR_CYCLE_DAYS = 29.5

      // Angol holdfázis nevek -> napok száma a következő teliholdig
      const phaseToDays: Record<string, number> = {
        'New Moon': Math.round((180 / 360) * LUNAR_CYCLE_DAYS), // ~15 nap
        'Waxing Crescent': Math.round((135 / 360) * LUNAR_CYCLE_DAYS), // ~11 nap
        'First Quarter': Math.round((90 / 360) * LUNAR_CYCLE_DAYS), // ~7 nap
        'Waxing Gibbous': Math.round((45 / 360) * LUNAR_CYCLE_DAYS), // ~4 nap
        'Full Moon': 0, // Most van telihold
        'Waning Gibbous': Math.round((315 / 360) * LUNAR_CYCLE_DAYS), // ~26 nap (következő telihold)
        'Last Quarter': Math.round((270 / 360) * LUNAR_CYCLE_DAYS), // ~22 nap (következő telihold)
        'Waning Crescent': Math.round((225 / 360) * LUNAR_CYCLE_DAYS), // ~19 nap (következő telihold)
      }

      // Magyar fordítást is kezeljük
      const hungarianToEnglish: Record<string, string> = {
        'Újhold': 'New Moon',
        'Növekvő hold': 'Waxing Crescent',
        'Első negyed': 'First Quarter',
        'Telihold': 'Full Moon',
        'FogyĂł hold': 'Waning Gibbous',
        'UtolsĂł negyed': 'Last Quarter',
      }

      // PrĂłbáljuk meg az angol nevet
      let days = phaseToDays[moonPhase]

      // Ha nem találjuk, prĂłbáljuk meg a magyar fordítást
      if (days === undefined) {
        const englishPhase = hungarianToEnglish[moonPhase]
        if (englishPhase) {
          days = phaseToDays[englishPhase]
        }
      }

      if (days === undefined) {
        return 'Ismeretlen'
      }

      if (days === 0) {
        return 'Most van telihold'
      }

      return `${days} nap múlva telihold`
    } catch (error) {
      console.error('Error calculating days until full moon:', error)
      return 'Ismeretlen'
    }
  }

  const getMoonLevel = (moonPhase: string): number => {
    try {
      if (!moonPhase || moonPhase === '-') {
        return 0
      }

      // A holdfázis ciklusa kb. 29.5 nap
      const LUNAR_CYCLE_DAYS = 29.5

      // Angol holdfázis nevek -> napok száma a következő teliholdig
      const phaseToDays: Record<string, number> = {
        'New Moon': Math.round((180 / 360) * LUNAR_CYCLE_DAYS), // ~15 nap
        'Waxing Crescent': Math.round((135 / 360) * LUNAR_CYCLE_DAYS), // ~11 nap
        'First Quarter': Math.round((90 / 360) * LUNAR_CYCLE_DAYS), // ~7 nap
        'Waxing Gibbous': Math.round((45 / 360) * LUNAR_CYCLE_DAYS), // ~4 nap
        'Full Moon': 0, // Most van telihold
        'Waning Gibbous': Math.round((315 / 360) * LUNAR_CYCLE_DAYS), // ~26 nap (következő telihold)
        'Last Quarter': Math.round((270 / 360) * LUNAR_CYCLE_DAYS), // ~22 nap (következő telihold)
        'Waning Crescent': Math.round((225 / 360) * LUNAR_CYCLE_DAYS), // ~19 nap (következő telihold)
      }

      // Magyar fordítást is kezeljük
      const hungarianToEnglish: Record<string, string> = {
        'Újhold': 'New Moon',
        'Növekvő hold': 'Waxing Crescent',
        'Első negyed': 'First Quarter',
        'Telihold': 'Full Moon',
        'FogyĂł hold': 'Waning Gibbous',
        'UtolsĂł negyed': 'Last Quarter',
      }

      // PrĂłbáljuk meg az angol nevet
      let days = phaseToDays[moonPhase]

      // Ha nem találjuk, prĂłbáljuk meg a magyar fordítást
      if (days === undefined) {
        const englishPhase = hungarianToEnglish[moonPhase]
        if (englishPhase) {
          days = phaseToDays[englishPhase]
        }
      }

      if (days === undefined) {
        return 0
      }

      // A napok száma alapján visszaadjuk a szintet (-3-tĂłl +3-ig)
      // A skála: 0 nap (telihold) = 0, 1-4 nap = -1, 5-8 nap = -2, 9-14 nap = -3, 15-19 nap = +1, 20-25 nap = +2, 26-29 nap = +3
      if (days === 0) return 0 // Telihold
      if (days <= 4) return -1 // Közel telihold (Waxing Gibbous)
      if (days <= 8) return -2 // Első negyed körül
      if (days <= 14) return -3 // Újhold körül
      if (days <= 19) return 1 // UtolsĂł negyed körül
      if (days <= 25) return 2 // FogyĂł hold
      return 3 // Mély éjszaka (következő újhold előtt)
    } catch (error) {
      console.error('Error calculating moon level:', error)
      return 0
    }
  }






  // Tendencia számítás függvény - jelenlegi vízállástĂłl az utolsĂł előrejelzési napig
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

    // Az utolsĂł előrejelzési nap értéke
    const lastForecast = futureDays[futureDays.length - 1]
    const lastValue = typeof lastForecast.value === 'string' ? parseFloat(lastForecast.value) : lastForecast.value

    // A változás: utolsĂł előrejelzési nap - jelenlegi vízállás
    const change = lastValue - currentWaterLevel
    // Százalékos változás a jelenlegi vízálláshoz viszonyítva
    const percentChange = currentWaterLevel !== 0 ? (change / Math.abs(currentWaterLevel)) * 100 : 0

    // Az első előrejelzési nap dátumátĂłl az utolsĂłig számoljuk a napokat
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
      }, undefined) // Automatikus mentésnél nincs hal kiválasztás
    } catch (error) {
      setSaveMessage('Nem sikerült menteni a kiválasztott helyszínt.')
    }
  }

  const handleUseCurrentLocation = () => {
    console.log('đź”µ handleUseCurrentLocation called')

    if (!user) {
      console.log('❌ No user logged in')
      setGeolocationError('Előbb jelentkezz be, hogy használd a helymeghatározást.')
      return
    }

    if (!('geolocation' in navigator)) {
      console.log('❌ Geolocation not supported')
      setGeolocationError('A böngésző nem támogatja a helymeghatározást.')
      return
    }

    // Guard: don't start if a request is already running
    if (geolocationLoading || geolocationNameLoading) {
      console.log('⚠️ď¸Ź Geolocation already running')
      return
    }

    // Check permission status first (if available)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          console.log('đź” Geolocation permission status:', result.state)
          if (result.state === 'denied') {
            setGeolocationError('A helymeghatározás engedélye megtagadva. Kérlek, engedélyezd a böngésző beállításaiban.')
            setGeolocationLoading(false)
            return
          }
        })
        .catch((err) => {
          console.warn('⚠️ď¸Ź Could not check permission status:', err)
          // Continue anyway
        })
    }

    console.log('✅ Starting geolocation request...')
    setGeolocationLoading(true)
    setGeolocationNameLoading(false)
    setGeolocationError(null)

    const onSuccess = async (position: GeolocationPosition) => {
      try {
        const { latitude, longitude, accuracy } = position.coords
        console.log('📍 Geolocation success', { latitude, longitude, accuracy })

        // Immediate coarse feedback: set coords and a temporary location query
        const tempDisplay = 'Helymeghatározásâ€¦'
        setLocation(tempDisplay)
        setLocationQuery(`${latitude},${longitude}`)
        setCoordinates({ lat: latitude, lon: longitude })
        setShowSuggestions(false)
        setLocationSuggestions([])

        // Mark initial load as done (so UI becomes responsive) and start reverse lookup in background
        setGeolocationLoading(false)
        setGeolocationNameLoading(true)

        // Perform nearest place lookup in background (don't block initial UI)
        try {
          const start = Date.now()
          const nearest = await searchNearestLocation(latitude, longitude)
          console.log('âŹ± searchNearestLocation duration (ms):', Date.now() - start)
          if (nearest) {
            const displayName = [nearest.name, nearest.region].filter(Boolean).join(', ')
            const queryValue = `${latitude},${longitude}` // Eredeti GPS koordinátákat használunk
            const coords: Coordinates = { lat: latitude, lon: longitude } // Eredeti GPS koordinátákat használunk
            setLocation(displayName)
            setLocationQuery(queryValue)
            setCoordinates(coords)
            setSaveMessage('Az aktuális helyzet alapján betöltöttük az adatokat. Mentsd el, ha szeretnéd naplózni.')
          } else {
            // No nearest place found â€” keep coords and query but show a soft warning
            setGeolocationError('Nem találhatĂł közeli település (csak koordináták alapján folytatjuk).')
          }
        } catch (err) {
          console.error('❌ searchNearestLocation error', err)
          setGeolocationError('Nem sikerült a helyadatok lekérése.')
        } finally {
          setGeolocationNameLoading(false)
        }

        // If initial accuracy is poor, try a high-accuracy retry in the background
        if (accuracy !== undefined && accuracy !== null && accuracy > 2000) {
          console.log('đź” Kezdemény újraprĂłbálkozás magas pontosságért: current accuracy =', accuracy)
          try {
            navigator.geolocation.getCurrentPosition(
              (highPos) => {
                const { latitude: hLat, longitude: hLon, accuracy: hAcc } = highPos.coords
                console.log('📍 High-accuracy retry success', { hLat, hLon, hAcc })
                // If improved, update coords and optionally refresh name lookup
                if (hAcc && hAcc < accuracy) {
                  setCoordinates({ lat: hLat, lon: hLon })
                  setLocationQuery(`${hLat},${hLon}`)
                  setGeolocationNameLoading(true)
                  searchNearestLocation(hLat, hLon)
                    .then((nearest2) => {
                      if (nearest2) {
                        const displayName2 = [nearest2.name, nearest2.region].filter(Boolean).join(', ')
                        const queryValue2 = `${hLat},${hLon}` // Eredeti GPS koordinátákat használunk
                        setLocation(displayName2)
                        setLocationQuery(queryValue2)
                        setCoordinates({ lat: hLat, lon: hLon }) // Eredeti GPS koordinátákat használunk
                        setSaveMessage('Pontsabb hely adatfrissítés elérhető.')
                      }
                    })
                    .catch((e) => {
                      console.error('❌ high-accuracy nearest search failed', e)
                    })
                    .finally(() => setGeolocationNameLoading(false))
                }
              },
              (highError) => {
                console.warn('⚠️ď¸Ź High-accuracy geolocation failed or timed out:', highError)
              },
              { enableHighAccuracy: true, maximumAge: 0, timeout: 7000 },
            )
          } catch (e) {
            console.warn('⚠️ď¸Ź High-accuracy retry error', e)
          }
        }
      } catch (err) {
        console.error('❌ Geolocation processing failed', err)
        setGeolocationError('Nem sikerült feldolgozni a helyadatokat.')
        setGeolocationLoading(false)
        setGeolocationNameLoading(false)
      }
    }

    const onError = (error: GeolocationPositionError) => {
      console.error('❌ Geolocation error:', error.code, error.message)
      switch (error.code) {
        case error.PERMISSION_DENIED:
          console.error('❌ PERMISSION_DENIED - A felhasználĂł nem adta meg az engedélyt')
          setGeolocationError('A helyhozzáférés engedélyezése szükséges. Kérlek, engedélyezd a böngésző beállításaiban.')
          break
        case error.POSITION_UNAVAILABLE:
          console.error('❌ POSITION_UNAVAILABLE - A helyzet nem állapíthatĂł meg')
          setGeolocationError('A helyzet nem állapíthatĂł meg.')
          break
        case error.TIMEOUT:
          console.error('❌ TIMEOUT - A helyadat lekérése túl sok időt vett igénybe')
          setGeolocationError('A helyadat lekérése túl sok időt vett igénybe.')
          break
        default:
          console.error('❌ Unknown error:', error)
          setGeolocationError('Ismeretlen hiba történt a helymeghatározás során.')
      }
      setGeolocationLoading(false)
      setGeolocationNameLoading(false)
    }

    try {
      // Mobilon optimalizált beállítások
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth <= 768

      console.log('đź“± Device type:', isMobile ? 'Mobile' : 'Desktop')
      console.log('đźŚ Protocol:', window.location.protocol)
      console.log('đź”’ Is HTTPS:', window.location.protocol === 'https:')

      // Mobilon először prĂłbáljuk alacsonyabb pontossággal, hogy biztosan jöjjön fel az engedélykérés
      const geolocationOptions = isMobile ? {
        enableHighAccuracy: false, // Először false, hogy biztosan működjön
        maximumAge: 0, // Ne használjon cache-t
        timeout: 20000, // Hosszabb timeout mobilon
      } : {
        enableHighAccuracy: false,
        maximumAge: 60000,
        timeout: 7000,
      }

      console.log('âš™ď¸Ź Geolocation options:', geolocationOptions)
      console.log('đź“ž Calling navigator.geolocation.getCurrentPosition...')

      navigator.geolocation.getCurrentPosition(onSuccess, onError, geolocationOptions)

      console.log('✅ navigator.geolocation.getCurrentPosition called successfully')
    } catch (err) {
      console.error('❌ navigator.geolocation.getCurrentPosition threw', err)
      setGeolocationError('A helymeghatározás nem indíthatĂł.')
      setGeolocationLoading(false)
      setGeolocationNameLoading(false)
    }
  }

  const getLocationWithoutCounty = (locationName: string): string => {
    return locationName.split(',')[0].trim()
  }

  const handleDeleteRecordClick = (recordId: string) => {
    setDeleteConfirmRecordId(recordId)
  }

  const handleDeleteRecordConfirm = async () => {
    if (!deleteConfirmRecordId || !user) {
      setDeleteConfirmRecordId(null)
      return
    }

    const recordId = deleteConfirmRecordId
    setDeleteConfirmRecordId(null)

    try {
      await deleteRecord(user.uid, recordId)
      setSaveMessage('Rekord törölve.')
      setMessage('Rekord törölve.')

      if (selectedRecordId === recordId) {
        setSelectedRecordId(null)
        // Ne töröljük a weatherData-t, hogy a data-card megmaradjon
      }
    } catch (error) {
      setSaveMessage('Rekord törlése sikertelen. Nézd meg a konzolt!')
    }
  }

  const handleDeleteRecordCancel = () => {
    setDeleteConfirmRecordId(null)
  }

  // Helper függvény a tooltip pozíciĂł dinamikus beállításához
  const adjustTooltipPosition = (tooltip: HTMLElement, parent: HTMLElement, isHorizontalTooltip = false) => {
    // Várunk egy kicsit, hogy a tooltip megjelenjen és a méretei kiszámolĂłdjanak
    setTimeout(() => {
      const tooltipRect = tooltip.getBoundingClientRect()
      const parentRect = parent.getBoundingClientRect()
      const viewportWidth = window.innerWidth

      if (isHorizontalTooltip) {
        // Horizontális tooltip (info badge) - vízállás/vízhőmérséklet 'i' ikonok balra jelennek meg alapbĂłl
        const tooltipLeftEdge = parentRect.left - tooltipRect.width - 5 // marginRight: 5px

        // Ha kilĂłg balra, jobbrĂłl jelenítjük meg
        if (tooltipLeftEdge < 10) {
          tooltip.style.left = '100%'
          tooltip.style.right = 'auto'
          tooltip.style.marginLeft = '5px'
          tooltip.style.marginRight = '0'
        } else {
          // Alapértelmezett: balrĂłl (vízállás/vízhőmérséklet tooltip-jei)
          tooltip.style.left = 'auto'
          tooltip.style.right = '100%'
          tooltip.style.marginLeft = '0'
          tooltip.style.marginRight = '5px'
        }
      } else {
        // Függőleges tooltip (data-field) - felülről jelenik meg középre igazítva
        // Alapértelmezett középre igazítás
        tooltip.style.left = '50%'
        tooltip.style.right = 'auto'
        tooltip.style.transform = 'translateX(-50%)'

        // Számoljuk ki, hogy hol lenne a tooltip középre igazítva
        const tooltipCenterX = parentRect.left + parentRect.width / 2
        const tooltipLeftEdge = tooltipCenterX - tooltipRect.width / 2
        const tooltipRightEdge = tooltipCenterX + tooltipRect.width / 2

        // Ha kilĂłg jobbra
        if (tooltipRightEdge > viewportWidth - 10) {
          tooltip.style.left = 'auto'
          tooltip.style.right = '0'
          tooltip.style.transform = 'none'
        }
        // Ha kilĂłg balra
        else if (tooltipLeftEdge < 10) {
          tooltip.style.left = '0'
          tooltip.style.right = 'auto'
          tooltip.style.transform = 'none'
        }
      }
    }, 0)
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

  // TODO: Excel export funkciĂł - jelenleg nincs használatban
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleExportToExcel = async () => {
    if (!user || !waterTemperatureVarId) {
      alert('Be kell jelentkezned és meg kell várnod, amíg a vízhőmérséklet változĂł betöltődik.')
      return
    }

    try {
      console.log('📡 Excel export kezdődik...')

      // Lekérjük az összes víztestet
      const waters = await getWaters()
      console.log(`✅ Víztestek lekérve: ${waters.length} db`)

      // Számoljuk ki az elmúlt 30 nap dátumát
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      const fromdate = thirtyDaysAgo.toISOString().split('T')[0]
      const todate = today.toISOString().split('T')[0]

      // Ă–sszegyűjtjük az összes vízhőmérséklet adatot minden víztestről
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
          console.log(`📡 ${water.name} (waterid: ${water.waterid}) vízhőmérséklet adatok lekérése...`)
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

      console.log(`📊 Ă–sszesen ${allTemperatureData.length} vízhőmérséklet mérés találva`)

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
  void handleExportToExcel // Explicitly mark as intentionally unused

  // Define data for ForecastSection
  const currentWaterLevel = waterData && waterData.measurements && waterData.measurements.length > 0
    ? waterData.measurements[waterData.measurements.length - 1].value
    : null

  // Process past water level data for the graph (simplified structure for ForecastSection)
  const processedPastWaterLevelData = useMemo(() => {
    if (!pastWaterLevelData) return null
    const points: { date: Date | string, value: number }[] = []

    pastWaterLevelData.forEach((item) => {
      // item structure based on state usage: { entry: MeasurementEntry; measurement: Measurement }
      // Or is it just MeasurementEntry based on usage in ForecastSection logic which I just cleaned?
      // Line 79: useState<Array<{ entry: MeasurementEntry; measurement: Measurement }> | null>(null)
      // So 'item' is { entry: ..., measurement: ... }
      if (item.measurement) {
        const val = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
        points.push({
          date: item.measurement.date,
          value: val
        })
      }
    })
    return points
  }, [pastWaterLevelData])

  return (
    <>
      <div className="underwater-background">
        {Array.from({ length: 10 }, (_, index) => (
          <div
            key={index}
            className={`bubble ${poppingBubbles.has(index) ? 'popping' : ''} `}
            onClick={() => handleBubbleClick(index)}
          />
        ))}
        {activeFish && (
          <div
            key={`${activeFish.name}-${animationKey}`}
            className={`fish-container ${fishDirection}`}
            style={{
              /* '--fish-width' is no longer needed for animation */
              '--fish-duration': activeFish.duration,
              '--fish-top': `${fishTopOffset}%`
            } as React.CSSProperties}
            onAnimationEnd={handleAnimationEnd}
          >
            <img
              src={activeFish.src}
              alt={activeFish.name}
              className="fish-image"
            />
          </div>
        )}
      </div>
      <main className="main-container">
        <h1 className="app-title">
          <img
            src={logoImg}
            alt="Logo"
            className="logo-background"
            style={{
              opacity: 0.3,
              filter: 'brightness(0) invert(1)',
            }}
          />
          <span className="app-title-text">PERGETŐNAPLÓ</span>
        </h1>
        <h4
          onClick={() => setIsLightMode(!isLightMode)}
          style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 10 }}
          title={isLightMode ? "Váltás sötét módra" : "Váltás világos módra"}
        >
          by FiSHNOTES
        </h4>
        <section className="auth-section">
          {authLoading ? (
            <p style={{ color: 'rgba(255, 255, 247, 0.9)', fontSize: '0.8rem', margin: 0 }}>Betöltés...</p>
          ) : user ? (
            <div className="auth-container">
              <div className="user-profile">
                {user.photoURL && (
                  <div className="user-avatar-container">
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? 'Fiók'}
                      className="user-avatar"
                    />
                  </div>
                )}
                <div className="user-info">
                  <span className="user-name">{user.displayName ?? 'Felhasználó'}</span>
                  <span className="user-email">{user.email}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={authActionRunning}
                className="auth-button logout"
                title="Kijelentkezés"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          ) : (
            <div className="auth-container" style={{ justifyContent: 'center' }}>
              <span className="login-text">Jelentkezz be a mentéshez:</span>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={authActionRunning}
                className="auth-button login"
              >
                Belépés
              </button>
            </div>
          )}
          {authError && <p className="auth-error">{authError}</p>}
        </section>
        <div className="smart-input-container" style={{ marginBottom: '2rem', position: 'relative', zIndex: 1100 }}>
          {user ? (
            <label style={{ fontSize: 'clamp(0.75rem, 2vw, 0.9rem)', color: '#FFFFF7', marginBottom: '0.5rem', display: 'block' }}>
              Horgászhely keresése
            </label>
          ) : null}

          <div style={{
            display: 'flex',
            position: 'relative',
            width: '100%',
            alignItems: 'stretch',
            border: '1px solid #ccc',
            borderRadius: '0.5rem',
            backgroundColor: isFormDisabled ? '#e2e8f0' : '#FFFFF7',
            transition: 'all 0.2s ease',
          }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={location}
                onChange={handleLocationChange}
                placeholder="Település neve (pl.Tiszalök)..."
                disabled={isFormDisabled}
                style={{
                  width: '100%',
                  color: '#111827',
                  padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                  paddingRight: '0.5rem',
                  border: 'none',
                  outline: 'none',
                  fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  height: '44px', // Fixed height for alignment
                  backgroundColor: 'transparent',
                  cursor: isFormDisabled ? 'not-allowed' : 'text',
                  boxSizing: 'border-box',
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
              {/* Autocomplete Dropdown */}
              {showSuggestions && locationSuggestions.length > 0 && !coordinates && (
                <ul
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    margin: 0,
                    marginTop: '4px',
                    padding: 0,
                    listStyle: 'none',
                    border: '1px solid #cbd5f5',
                    borderRadius: '0.5rem',
                    backgroundColor: '#FFFFF7',
                    maxHeight: '12rem',
                    overflowY: 'auto',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
                    zIndex: 20,
                  }}
                >
                  {locationSuggestions.map((suggestion) => {
                    const displayName = [suggestion.name, suggestion.region, suggestion.country]
                      .filter((value, index, array) => value && array.indexOf(value) === index)
                      .join(', ')

                    return (
                      <li key={`${suggestion.id} -${suggestion.lat} -${suggestion.lon} `}>
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
                            textAlign: 'left',
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
                            {suggestion.lat.toFixed(2)}, {suggestion.lon.toFixed(2)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isFormDisabled || geolocationLoading}
              title="Jelenlegi pozíciĂłm használata"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 0.75rem',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#1f2937',
                cursor: isFormDisabled || geolocationLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                height: '44px',
                minWidth: '44px',
              }}
            >
              {geolocationLoading ? (
                <span className="spinner" style={{ fontSize: '1.2rem', animation: 'spin 1s linear infinite' }}>↻</span>
              ) : (
                <img src={geolocIcon} alt="Helyzetem" style={{ width: '2rem', height: '2rem', objectFit: 'contain' }} />
              )}
              {/* Desktop text label optionally, but icon + tooltip is cleaner for "Integrated" look */}
              <span className="gps-btn-text" style={{ marginLeft: '0.5rem', fontSize: '0.9rem', display: 'none' }}>Helyzetem</span>
            </button>
          </div>

          {/* Messages and Feedback below the input group */}
          <div style={{ marginTop: '0.5rem', minHeight: '1.2em' }}>
            {locationSuggestionLoading && (
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>🔍</span> Települések kereséseâ€¦
              </span>
            )}

            {locationSuggestionError && (
              <span style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>⚠️</span> {locationSuggestionError}
              </span>
            )}

            {geolocationError && (
              <span style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>⚠️</span> {geolocationError}
              </span>
            )}

            {!geolocationError && geolocationNameLoading && (
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span>📍</span> Helynév pontosítása…
              </span>
            )}
          </div>
        </div>



        {/* Navigation Buttons - Vertical Stack below Input/Save */}
        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {/* Statisztikák - Csak ha van adat */}
            {records.length > 0 && (
              <button
                type="button"
                onClick={() => setShowStatistics(!showStatistics)}
                style={{
                  padding: `clamp(0.5rem, 1.5vw, 0.75rem) clamp(1rem, 2.5vw, 1.25rem)`,
                  borderRadius: '0.25rem',
                  border: '1px solid #2563eb',
                  backgroundColor: showStatistics ? '#2563eb' : '#ffffff',
                  color: showStatistics ? '#ffffff' : '#2563eb',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  fontWeight: 500,
                  minHeight: '44px',
                  width: '100%',
                }}
              >
                {showStatistics ? 'Statisztikák elrejtése' : 'Statisztikák'}
              </button>
            )}

            {/* Napló - Mindig látható ha be van lépve */}
            <button
              type="button"
              onClick={() => setShowLogbook(true)}
              style={{
                padding: `clamp(0.5rem, 1.5vw, 0.75rem) clamp(1rem, 2.5vw, 1.25rem)`,
                borderRadius: '0.25rem',
                border: '1px solid #0d9488',
                backgroundColor: '#ffffff',
                color: '#0d9488',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                fontWeight: 500,
                minHeight: '44px',
                width: '100%',
              }}
            >
              Napló
            </button>

            {/* Előrejelzés - Mindig látható ha be van lépve */}
            <button
              type="button"
              onClick={() => setShowForecast(true)}
              style={{
                padding: `clamp(0.5rem, 1.5vw, 0.75rem) clamp(1rem, 2.5vw, 1.25rem)`,
                borderRadius: '0.25rem',
                border: '1px solid #f59e0b',
                backgroundColor: '#ffffff',
                color: '#f59e0b',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                fontWeight: 500,
                minHeight: '44px',
                width: '100%',
              }}
            >
              Előrejelzések
            </button>
          </div>
        )}

        <section
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            width: '100%',
            maxWidth: '100%',
            position: 'relative', // Ensure absolute child (data-card) is positioned relative to this section
            minHeight: '85vh', // Ensure section has height for the absolute card
          }}
        >
          {!user ? (
            <p>Jelentkezz be és adj meg helyszínt, hogy lásd az adatokat.</p>
          ) : weatherLoading ? (
            <p>Időjárási adatok betöltéseâ€¦</p>
          ) : weatherError ? (
            <p style={{ color: '#dc2626' }}>{weatherError}</p>
          ) : weatherData ? (
            <div
              className="statistics-modal-overlay"
              style={{
                zIndex: 2000,
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(5px)',
              }}
              onClick={() => {
                setWeatherData(null)
                setWaterData(null)
                setForecastData(null)
                setLocationQuery('') // Opcionális: mező ürítése
              }}
            >
              <div
                className="statistics-modal-content"
                style={{
                  maxWidth: '650px',
                  padding: '0',
                  width: '100%',
                  backgroundColor: '#FFFFF7',
                  borderRadius: '1rem',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  borderTopLeftRadius: '1rem',
                  borderTopRightRadius: '1rem',
                }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                      Aktuális Adatok
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      {new Date().toLocaleDateString('hu-HU')} • {location}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setWeatherData(null)
                      setWaterData(null)
                      setForecastData(null)
                    }}
                    className="statistics-close-btn"
                    aria-label="Bezárás"
                  >
                    ×
                  </button>
                </div>

                {/* Modal Body matches Saved Card body style */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', backgroundColor: '#f1f5f9' }}>
                  <div
                    ref={dataCardRef}
                    className="data-card"
                    style={{
                      height: 'auto',
                      minHeight: 'auto',
                      marginTop: 0,
                      marginBottom: 0,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      background: 'white'
                    }}
                  >
                    {/* Front side - Időjárási adatok */}
                    <div
                      ref={cardFrontRef}
                      className="card-front"
                    >
                      {/* Card Header - Kiemelt fejléc dátum, helyszín és vízterülettel */}
                      <div className="data-card-header">
                        {/* Vízterület - bal oldal */}
                        {waterData?.water && (
                          <div className="card-header-water">
                            <span className="water-icon">🌊</span>
                            <div className="card-header-water-info">
                              <span className="card-header-water-name">{waterData.water}</span>
                              {waterData.station && (
                                <span
                                  className="info-badge-circle"
                                  onMouseEnter={(e) => {
                                    const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                    if (tooltip) {
                                      tooltip.style.opacity = '1'
                                      tooltip.style.visibility = 'visible'
                                      adjustTooltipPosition(tooltip, e.currentTarget, true)
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
                            </div>
                          </div>
                        )}

                        {/* Helyszín - közép */}
                        <div className="card-header-location">
                          <h3>
                            {weatherData.locationName}
                          </h3>
                        </div>

                        {/* Koordináták - jobb oldal */}
                        {coordinates && (
                          <div className="card-header-coordinates">
                            {coordinates.lat.toFixed(6)}, {coordinates.lon.toFixed(6)}
                          </div>
                        )}
                      </div>

                      {/* Save Button inside Data Card */}
                      <div style={{ marginBottom: '1rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving || isFormDisabled || location.trim().length === 0}
                          className="btn-save-primary"
                        >
                          {isSaving ? (
                            <>
                              <span className="animate-spin">⏳</span> Mentés folyamatban…
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: '1.2em' }}>💾</span> Mentés
                            </>
                          )}
                        </button>
                      </div>
                      {/* Vízállás és vízhőmérséklet egymás mellett keretben */}
                      <div className="data-card-grid">
                        {/* Vízállás */}
                        {waterLoading ? (
                          <div className="data-field"
                          >
                            <div className="data-field-label">
                              <span className="data-field-icon">💧</span>
                              Vízállás
                            </div>
                            <div className="data-field-label">adatok betöltéseâ€¦</div>
                          </div>
                        ) : waterData?.measurements && waterData.measurements.length > 0 ? (() => {
                          const waterValue = waterData.measurements[waterData.measurements.length - 1].value
                          const waterLevel = getWaterLevelLevel(waterValue)
                          const waterVariantClass = getVariantClass(waterLevel, 'water')
                          const waterDescription = getLevelDescription(waterLevel, 'water')
                          return (
                            <div className={`data-field ${waterVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">💧</span>
                                  Vízállás
                                </div>
                                <div className="data-field-description">{waterDescription}</div>
                              </div>
                              <div className="flex-row-center">
                                <div className="data-field-value" >
                                  {waterValue.toFixed(1)}
                                </div>
                                <div className="data-field-label" >{waterData.unit || 'cm'}</div>
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
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginLeft: 'auto',
                                  }}
                                  onMouseEnter={(e) => {
                                    const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                    if (tooltip) {
                                      tooltip.style.opacity = '1'
                                      tooltip.style.visibility = 'visible'
                                      // Vízállás és vízhőmérséklet tooltip-jei balra jelennek meg
                                      adjustTooltipPosition(tooltip, e.currentTarget, true)
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
                                      right: '100%',
                                      left: 'auto',
                                      transform: 'translateY(-50%)',
                                      marginRight: '5px',
                                      marginLeft: '0',
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
                              </div>
                            </div>
                          )
                        })() : null}

                        {/* Időjárási adatok modernizált megjelenítéssel */}
                        {/* Vízhőmérséklet - áthelyezve a gridbe */}
                        {waterTemperatureLoading ? (
                          <div className="data-field variant-temp-loading">
                            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.9rem' }}>🌡️</span>
                              Vízhőmérséklet
                            </div>
                            <div className="data-field-label" >adatok betöltéseâ€¦</div>
                          </div>
                        ) : waterTemperatureError ? (
                          <div className="data-field variant-temp-error">
                            <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: 'calc(var(--icon-size-base) * 1)' }}>🌡️</span>
                              Vízhőmérséklet
                            </div>
                            <div className="data-field-label" >⚠️ď¸Ź {waterTemperatureError}</div>
                          </div>
                        ) : waterTemperatureData && waterTemperatureData.measurements && waterTemperatureData.measurements.length > 0 && waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value != null ? (() => {
                          const tempValue = waterTemperatureData.measurements[waterTemperatureData.measurements.length - 1].value
                          const tempLevel = getWaterTempLevel(tempValue)
                          const tempVariantClass = getVariantClass(tempLevel, 'temp')
                          const tempDescription = getLevelDescription(tempLevel, 'temp')
                          return (
                            <div className={`data-field ${tempVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label">
                                  <span className="data-field-icon">🌡️</span>
                                  Vízhőmérséklet
                                </div>
                                <div className="data-field-description">{tempDescription}</div>
                              </div>
                              <div className="flex-row-center">
                                <div className="data-field-value" >
                                  {typeof tempValue === 'number' ? tempValue.toFixed(1) : tempValue}
                                </div>
                                <div className="data-field-label" >{waterTemperatureData.unit || '°C'}</div>
                                <span
                                  className="info-badge-circle"
                                  style={{ marginLeft: 'auto' }}
                                  onMouseEnter={(e) => {
                                    const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                    if (tooltip) {
                                      tooltip.style.opacity = '1'
                                      tooltip.style.visibility = 'visible'
                                      // Vízállás és vízhőmérséklet tooltip-jei balra jelennek meg
                                      adjustTooltipPosition(tooltip, e.currentTarget, true)
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
                                      right: '100%',
                                      left: 'auto',
                                      transform: 'translateY(-50%)',
                                      marginRight: '5px',
                                      marginLeft: '0',
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
                              </div>
                            </div>
                          )
                        })() : !waterTemperatureLoading && waterTemperatureVarId ? (
                          <div className="data-field" style={{
                            padding: '0.75rem',
                            borderRadius: '0.75rem',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fde68a'
                          }}>
                            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, marginBottom: '0.25rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontSize: 'calc(var(--icon-size-base) * 1)' }}>🌡️</span>
                              Vízhőmérséklet
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>adatok betöltése...</div>
                          </div>
                        ) : null}
                        {/* Levegő hőmérséklet és légnyomás egymás mellett */}

                        {/* Levegő hőmérséklet */}
                        {(() => {
                          const airTempLevel = getAirTempLevel(weatherData.airTemperatureC)
                          const airTempVariantClass = getVariantClass(airTempLevel, 'weather')
                          const airTempDescription = getLevelDescription(airTempLevel, 'weather')
                          return (
                            <div className={`data-field ${airTempVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon-large">🌡️</span>
                                  LEVEGŐ  HŐ MÉRSÉKLET
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{airTempDescription}</div>
                              </div>
                              <div className={`data-field-value ${weatherData.airTemperatureC > 20 ? 'text-hot' :
                                weatherData.airTemperatureC > 10 ? 'text-mild' : 'text-cold'
                                } `}>
                                {weatherData.airTemperatureC.toFixed(1)} °C
                              </div>
                            </div>
                          )
                        })()}

                        {/* Légnyomás */}
                        {(() => {
                          const pressureLevel = getPressureLevel(weatherData.pressureHpa)
                          const pressureVariantClass = getVariantClass(pressureLevel, 'pressure')
                          const pressureDescription = getLevelDescription(pressureLevel, 'pressure')
                          return (
                            <div className={`data-field ${pressureVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon-large">📊</span>
                                  LÉGNYOMÁS
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{pressureDescription}</div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="data-field-value" >
                                  {weatherData.pressureHpa.toFixed(0)} hPa
                                </span>
                                <span className={`trend-badge ${weatherData.pressureTrend === 'emelkedő' ? 'trend-up' :
                                  weatherData.pressureTrend === 'csökkenő' ? 'trend-down' : 'trend-stable'
                                  } `}>
                                  {weatherData.pressureTrend === 'emelkedő' ? '↑ Emelkedik' : weatherData.pressureTrend === 'csökkenő' ? '↓ Csökken' : '→ Stabil'}
                                </span>
                              </div>
                            </div>
                          )
                        })()}



                        {(() => {
                          const cloudLevel = getCloudCoverLevel(weatherData.cloudCoverPercent)
                          const cloudVariantClass = getVariantClass(cloudLevel, 'cloud')
                          const cloudDescription = getLevelDescription(cloudLevel, 'cloud')
                          return (
                            <div className={`data-field ${cloudVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">☁️</span>
                                  FELHŐZET
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{cloudDescription}</div>
                              </div>
                              <div className="data-field-value" >{weatherData.cloudCoverPercent}%</div>
                            </div>
                          )
                        })()}
                        {(() => {
                          const rainLevel = getRainLevel(weatherData.precipitationChancePercent)
                          const rainVariantClass = getVariantClass(rainLevel, 'rain')
                          const rainDescription = getLevelDescription(rainLevel, 'rain')
                          return (
                            <div className={`data-field ${rainVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">☔</span>
                                  CSAPADÉK ESÉLY
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{rainDescription}</div>
                              </div>
                              <div className="data-field-value" >{weatherData.precipitationChancePercent}%</div>
                              <div className="data-field-label" >
                                {weatherData.precipitationIntensityMmPerHour.toFixed(1)} mm/h
                              </div>
                            </div>
                          )
                        })()}


                        {/* Szél és holdfázis egymás mellett */}

                        {(() => {
                          const windLevel = getWindLevel(weatherData.windSpeedKph)
                          const windVariantClass = getVariantClass(windLevel, 'wind')
                          const windDescription = getLevelDescription(windLevel, 'wind')
                          return (
                            <div className={`data-field ${windVariantClass} items-center gap-2`}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon-large">💨</span>
                                  SZÉL
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{windDescription}</div>
                              </div>
                              <div className="data-field-value" >
                                {weatherData.windDirection} {weatherData.windSpeedKph.toFixed(1)} km/h
                              </div>
                            </div>
                          )
                        })()}
                        {(() => {
                          const uvLevel = getUVLevel(weatherData.uvIndex)
                          const uvVariantClass = getVariantClass(uvLevel, 'uv')
                          const uvDescription = getLevelDescription(uvLevel, 'uv')
                          return (
                            <div className={`data-field ${uvVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">☀️</span>
                                  UV-INDEX
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{uvDescription}</div>
                              </div>
                              <div className="data-field-value" >{weatherData.uvIndex.toFixed(1)}</div>
                            </div>
                          )
                        })()}

                        {(() => {
                          const moonLevel = getMoonLevel(weatherData.moonPhase)
                          const moonVariantClass = getVariantClass(moonLevel, 'moon')
                          return (
                            <div className={`data-field ${moonVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">🌔</span>
                                  HOLDFÁZIS
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{getDaysUntilFullMoon(weatherData.moonPhase)}</div>
                              </div>
                              <div className="data-field-value" >{weatherData.moonPhase}</div>
                            </div>
                          )
                        })()}

                        {(() => {
                          const lightChangeLevel = getLightChangeLevel(weatherData.sunrise, weatherData.sunset)
                          const sunVariantClass = `variant-sun-${lightChangeLevel} `
                          return (
                            <div className={`data-field ${sunVariantClass} `}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="data-field-label" >
                                  <span className="data-field-icon">🌅</span>
                                  FÉNYVÁLTÁS
                                </div>
                                <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{isLightChangeTime(weatherData.sunrise, weatherData.sunset)}</div>
                              </div>
                              <div className="data-field-value" >
                                {weatherData.sunrise}
                              </div>
                              <div className="data-field-value" >
                                {weatherData.sunset}
                              </div>
                            </div>
                          )
                        })()}

                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section >

        <section
          style={{
            marginTop: '2rem',
            paddingTop: '1.5rem',
            width: '100%',
            maxWidth: '100%',
          }}
        >

          {!user ? (
            <p>Bejelentkezés után érheted el a mentett rekordokat.</p>
          ) : (
            <>


              {/* Statisztikák szekciĂł - Modal Overlay */}
              {showStatistics && records.length > 0 && (
                <div
                  className="statistics-modal-overlay"
                  onClick={() => setShowStatistics(false)} // Close on backdrop click
                >
                  <div
                    className="statistics-modal-content"
                    onClick={(e) => e.stopPropagation()} // Prevent close on content click
                  >
                    <StatisticsSection records={records} onClose={() => setShowStatistics(false)} />
                  </div>
                </div>
              )}

              {/* Logbook Modal */}
              <LogbookSection
                isOpen={showLogbook}
                onClose={() => setShowLogbook(false)}
                records={records}
                onDeleteRecord={handleDeleteRecordClick}
                onEditRecord={(record) => {
                  setSelectedRecordId(record.id)
                  setShowLogbook(false)
                }}
              />

              {/* Forecast Modal */}
              <ForecastSection
                isOpen={showForecast}
                onClose={() => setShowForecast(false)}
                forecastEntry={forecastData && forecastData.length > 0 ? forecastData[0] : null}
                pastData={processedPastWaterLevelData}
                currentLevel={currentWaterLevel}
                locationName={location}
              />



              {selectedRecord ? (
                <div
                  className="statistics-modal-overlay"
                  onClick={() => setSelectedRecordId(null)}
                  style={{
                    zIndex: 2000,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(15, 23, 42, 0.7)',
                    backdropFilter: 'blur(5px)',
                  }}
                >
                  <div
                    className="statistics-modal-content"
                    style={{
                      maxWidth: '650px',
                      padding: '0',
                      width: '100%',
                      backgroundColor: '#FFFFF7',
                      borderRadius: '1rem',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      position: 'relative'
                    }} // Inline styles to ensure match with ForecastSection
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <div style={{
                      padding: '1.25rem 1.5rem',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: '#f8fafc',
                      borderTopLeftRadius: '1rem', // Match container radius
                      borderTopRightRadius: '1rem',
                    }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                          Részletes Adatok
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                          {selectedRecord.date.toLocaleDateString('hu-HU')} • {getLocationWithoutCounty(selectedRecord.locationName)}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedRecordId(null)}
                        className="statistics-close-btn"
                        aria-label="Bezárás"
                      >
                        ×
                      </button>
                    </div>

                    {/* Modal Body */}
                    <div style={{ padding: '1.5rem', overflowY: 'auto', backgroundColor: '#f1f5f9' }}>
                      <div
                        ref={savedDataCardRef}
                        className={`saved-data-card data-card folded-corner ${savedCardFlipped ? 'flipped' : ''} ${showSavedBackCorner ? 'show-back-corner' : ''} `}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const clickX = e.clientX - rect.right
                          const clickY = e.clientY - rect.bottom

                          // Mindkét oldalon a jobb alsĂł sarok környékén kattintunk (70px körzetben)
                          if (clickX > -70 && clickY > -70) {
                            if (savedCardFlipped) {
                              setShowSavedBackCorner(false)
                              setSavedCardFlipped(false)
                            } else {
                              setShowSavedBackCorner(false)
                              setSavedCardFlipped(true)
                              // 0.6s után (amikor az animáciĂł véget ér) megjelenik a corner a back oldalon
                              setTimeout(() => {
                                setShowSavedBackCorner(true)
                              }, 600)
                            }
                          }
                        }}
                        style={{
                          marginTop: 0,
                          marginBottom: 0,
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', // Subtle shadow inside modal
                          background: 'white' // Ensure card bg
                        }}
                      >
                        {/* Front side - Időjárási adatok */}
                        <div
                          className="card-front"
                        >
                          {/* Card Header - Kiemelt fejléc dátum, helyszín és vízterülettel */}
                          <div className="data-card-header">
                            {/* Vízterület - bal oldal */}
                            {selectedRecord.waterDataSnapshot?.water && (
                              <div className="card-header-water">
                                <span className="water-icon">🌊</span>
                                <div className="card-header-water-info">
                                  <span className="card-header-water-name">{selectedRecord.waterDataSnapshot.water}</span>
                                  {selectedRecord.waterDataSnapshot.station && (
                                    <span
                                      className="info-badge-circle"
                                      onMouseEnter={(e) => {
                                        const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                        if (tooltip) {
                                          tooltip.style.opacity = '1'
                                          tooltip.style.visibility = 'visible'
                                          adjustTooltipPosition(tooltip, e.currentTarget, true)
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
                                </div>
                              </div>
                            )}

                            {/* Helyszín - közép */}
                            <div className="card-header-location">
                              <h3>
                                {getLocationWithoutCounty(selectedRecord.locationName)}
                              </h3>
                            </div>

                            {/* Koordináták - jobb oldal */}
                            {selectedRecord.coordinates && (
                              <div className="card-header-coordinates">
                                {selectedRecord.coordinates.lat.toFixed(6)}, {selectedRecord.coordinates.lon.toFixed(6)}
                              </div>
                            )}
                          </div>
                          {selectedRecord.caughtFish && (
                            (Array.isArray(selectedRecord.caughtFish) && selectedRecord.caughtFish.length > 0) ||
                            (!Array.isArray(selectedRecord.caughtFish) && Object.keys(selectedRecord.caughtFish).length > 0)
                          ) && (
                              <div className="caught-fish-container">
                                <div className="caught-fish-list">
                                  {Array.isArray(selectedRecord.caughtFish) ? (
                                    // Régi formátum kompatibilitás: string[]
                                    (selectedRecord.caughtFish as string[]).map((fish: string, index: number) => (
                                      <span
                                        key={index}
                                        className="fish-chip"
                                      >
                                        {fish}
                                      </span>
                                    ))
                                  ) : (
                                    // Új formátum: Record<string, number>
                                    Object.entries(selectedRecord.caughtFish as Record<string, number>).map(([fish, count]) => (
                                      <span
                                        key={fish}
                                        className="fish-chip"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                      >
                                        <span style={{ textTransform: 'capitalize' }}>{fish}</span>
                                        <span style={{
                                          backgroundColor: '#0369a1',
                                          color: '#ffffff',
                                          borderRadius: '50%',
                                          width: '1.5rem',
                                          height: '1.5rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                        }}>
                                          {count}
                                        </span>
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                          {/* Vízállás és vízhőmérséklet egymás mellett keretben */}
                          {(selectedRecord.waterDataSnapshot?.measurements && selectedRecord.waterDataSnapshot.measurements.length > 0) || (selectedRecord.waterTemperatureSnapshot?.measurements && selectedRecord.waterTemperatureSnapshot.measurements.length > 0 && selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value != null) ? (
                            <div className="data-card-grid">
                              {/* Vízállás */}
                              {selectedRecord.waterDataSnapshot?.measurements && selectedRecord.waterDataSnapshot.measurements.length > 0 ? (() => {
                                const waterValue = selectedRecord.waterDataSnapshot.measurements[selectedRecord.waterDataSnapshot.measurements.length - 1].value
                                const waterLevel = getWaterLevelLevel(waterValue)
                                const waterVariantClass = getVariantClass(waterLevel, 'water')
                                const waterDescription = getLevelDescriptionFromStats(waterLevel, 'water')
                                return (
                                  <div className={`data-field ${waterVariantClass} `}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <div className="data-field-label" >
                                        <span className="data-field-icon">💧</span>
                                        Vízállás
                                      </div>
                                      <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{waterDescription}</div>
                                    </div>
                                    <div className="flex-row-center">
                                      <div className="data-field-value" >
                                        {waterValue.toFixed(1)}
                                      </div>
                                      <div className="data-field-label">{selectedRecord.waterDataSnapshot?.unit || 'cm'}</div>
                                      <span
                                        className="info-badge-circle"
                                        style={{ marginLeft: 'auto' }}
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
                                            right: '100%',
                                            left: 'auto',
                                            transform: 'translateY(-50%)',
                                            marginRight: '5px',
                                            marginLeft: '0',
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
                                          Mérés dátuma: {new Date(selectedRecord.waterDataSnapshot?.measurements[selectedRecord.waterDataSnapshot.measurements.length - 1].date || '').toLocaleString('hu-HU')}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                )
                              })() : null}

                              {/* Vízhőmérséklet */}
                              {selectedRecord.waterTemperatureSnapshot?.measurements && selectedRecord.waterTemperatureSnapshot.measurements.length > 0 && selectedRecord.waterTemperatureSnapshot.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value != null ? (() => {
                                const tempValue = selectedRecord.waterTemperatureSnapshot?.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].value
                                const tempLevel = getWaterTempLevel(tempValue)
                                const tempVariantClass = getVariantClass(tempLevel, 'temp')
                                const tempDescription = getLevelDescription(tempLevel, 'temp')
                                return (
                                  <div className={`data-field ${tempVariantClass} `}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <div className="data-field-label" >
                                        <span className="data-field-icon">🌡️</span>
                                        Vízhőmérséklet
                                      </div>
                                      <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{tempDescription}</div>
                                    </div>
                                    <div className="flex-row-center">
                                      <div className="data-field-value" >
                                        {typeof tempValue === 'number' ? tempValue.toFixed(1) : tempValue}
                                      </div>
                                      <div className="data-field-label">{selectedRecord.waterTemperatureSnapshot?.unit || '°C'}</div>
                                      <span
                                        className="info-badge-circle"
                                        style={{ marginLeft: 'auto' }}
                                        onMouseEnter={(e) => {
                                          const tooltip = e.currentTarget.querySelector('[data-tooltip]') as HTMLElement
                                          if (tooltip) {
                                            tooltip.style.opacity = '1'
                                            tooltip.style.visibility = 'visible'
                                            adjustTooltipPosition(tooltip, e.currentTarget, true)
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
                                            right: '100%',
                                            left: 'auto',
                                            transform: 'translateY(-50%)',
                                            marginRight: '5px',
                                            marginLeft: '0',
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
                                          Mérés dátuma: {new Date(selectedRecord.waterTemperatureSnapshot?.measurements[selectedRecord.waterTemperatureSnapshot.measurements.length - 1].date || '').toLocaleString('hu-HU')}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                )
                              })() : null}
                            </div>
                          ) : null}
                          {selectedRecord.weatherSnapshot ? (
                            <>
                              <div>
                                {/* Időjárási adatok modernizált megjelenítéssel */}
                                <div className="flex-col" style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  flex: 1,
                                  minHeight: 0
                                }}>
                                  {/* Levegő hőmérséklet és légnyomás egymás mellett */}
                                  <div className="data-card-grid">
                                    {/* Levegő hőmérséklet */}
                                    {(() => {
                                      const airTempLevel = getAirTempLevel(selectedRecord.weatherSnapshot.airTemperatureC)
                                      const airTempVariantClass = getVariantClass(airTempLevel, 'weather')
                                      const airTempDescription = getLevelDescription(airTempLevel, 'weather')
                                      return (
                                        <div className={`data-field ${airTempVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon-large">🌡️</span>
                                              LEVEGŐ  HŐ MÉRSÉKLET
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{airTempDescription}</div>
                                          </div>
                                          <div className="data-field-content">
                                            <div className={`data-field-value ${selectedRecord.weatherSnapshot.airTemperatureC > 20 ? 'text-hot' :
                                              selectedRecord.weatherSnapshot.airTemperatureC > 10 ? 'text-mild' : 'text-cold'
                                              } `}>
                                              {selectedRecord.weatherSnapshot.airTemperatureC.toFixed(1)} °C
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Légnyomás */}
                                    {(() => {
                                      const pressureLevel = getPressureLevel(selectedRecord.weatherSnapshot.pressureHpa)
                                      const pressureVariantClass = getVariantClass(pressureLevel, 'pressure')
                                      const pressureDescription = getLevelDescription(pressureLevel, 'pressure')
                                      return (
                                        <div className={`data-field ${pressureVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon-large">📊</span>
                                              LÉGNYOMÁS
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{pressureDescription}</div>
                                          </div>
                                          <div className="data-field-content">
                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
                                              <span className="data-field-value" >
                                                {selectedRecord.weatherSnapshot.pressureHpa.toFixed(0)} hPa
                                              </span>
                                              <span className={`trend-badge ${selectedRecord.weatherSnapshot.pressureTrend === 'emelkedő' ? 'trend-up' :
                                                selectedRecord.weatherSnapshot.pressureTrend === 'csökkenő' ? 'trend-down' : 'trend-stable'
                                                } `}>
                                                {selectedRecord.weatherSnapshot.pressureTrend === 'emelkedő' ? '↑ Emelkedik' : selectedRecord.weatherSnapshot.pressureTrend === 'csökkenő' ? '↓ Csökken' : '→ Stabil'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {(() => {
                                      const cloudLevel = getCloudCoverLevel(selectedRecord.weatherSnapshot.cloudCoverPercent)
                                      const cloudVariantClass = getVariantClass(cloudLevel, 'cloud')
                                      const cloudDescription = getLevelDescription(cloudLevel, 'cloud')
                                      return (
                                        <div className={`data-field ${cloudVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon">☁️</span>
                                              FELHŐZET
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{cloudDescription}</div>
                                          </div>
                                          <div className="data-field-value" >{selectedRecord.weatherSnapshot.cloudCoverPercent}%</div>
                                        </div>
                                      )
                                    })()}
                                    {(() => {
                                      const rainLevel = getRainLevel(selectedRecord.weatherSnapshot.precipitationChancePercent)
                                      const rainVariantClass = getVariantClass(rainLevel, 'rain')
                                      const rainDescription = getLevelDescription(rainLevel, 'rain')
                                      return (
                                        <div className={`data-field ${rainVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon">☔</span>
                                              CSAPADÉK ESÉLY
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{rainDescription}</div>
                                          </div>
                                          <div className="data-field-value" >{selectedRecord.weatherSnapshot.precipitationChancePercent}%</div>
                                          <div className="data-field-label" >
                                            {selectedRecord.weatherSnapshot.precipitationIntensityMmPerHour.toFixed(1)} mm/h
                                          </div>
                                        </div>
                                      )
                                    })()}

                                    {/* Szél és holdfázis egymás mellett */}
                                    {(() => {
                                      const windLevel = getWindLevel(selectedRecord.weatherSnapshot.windSpeedKph)
                                      const windVariantClass = getVariantClass(windLevel, 'wind')
                                      const windDescription = getLevelDescription(windLevel, 'wind')
                                      return (
                                        <div className={`data-field ${windVariantClass} items-center gap-2`}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon-large">💨</span>
                                              SZÉL
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{windDescription}</div>
                                          </div>
                                          <div className="data-field-content">
                                            <div className="data-field-value" >
                                              {selectedRecord.weatherSnapshot.windDirection} {selectedRecord.weatherSnapshot.windSpeedKph.toFixed(1)} km/h
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })()}
                                    {(() => {
                                      const uvLevel = getUVLevel(selectedRecord.weatherSnapshot.uvIndex)
                                      const uvVariantClass = getVariantClass(uvLevel, 'uv')
                                      const uvDescription = getLevelDescription(uvLevel, 'uv')
                                      return (
                                        <div className={`data-field ${uvVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon">☀️</span>
                                              UV-INDEX
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{uvDescription}</div>
                                          </div>
                                          <div className="data-field-value" >{selectedRecord.weatherSnapshot.uvIndex.toFixed(1)}</div>
                                        </div>
                                      )
                                    })()}

                                    {(() => {
                                      const moonLevel = getMoonLevel(selectedRecord.weatherSnapshot.moonPhase)
                                      const moonVariantClass = getVariantClass(moonLevel, 'moon')
                                      return (
                                        <div className={`data-field ${moonVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon">🌔</span>
                                              HOLDFÁZIS
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{getDaysUntilFullMoon(selectedRecord.weatherSnapshot.moonPhase)}</div>
                                          </div>
                                          <div className="data-field-value" >{selectedRecord.weatherSnapshot.moonPhase}</div>
                                        </div>
                                      )
                                    })()}
                                    {(() => {
                                      // Használjuk a rekord mentésének időpontját, ha van date és time, különben a createdAt timestamp-et
                                      let referenceDate: Date | undefined = undefined
                                      if (selectedRecord.date && selectedRecord.time) {
                                        try {
                                          const dateTimeStr = `${selectedRecord.date} ${selectedRecord.time} `
                                          referenceDate = new Date(dateTimeStr)
                                          if (isNaN(referenceDate.getTime())) {
                                            referenceDate = new Date(selectedRecord.createdAt)
                                          }
                                        } catch {
                                          referenceDate = new Date(selectedRecord.createdAt)
                                        }
                                      } else if (selectedRecord.createdAt) {
                                        referenceDate = new Date(selectedRecord.createdAt)
                                      }
                                      const lightChangeLevel = getLightChangeLevel(
                                        selectedRecord.weatherSnapshot.sunrise,
                                        selectedRecord.weatherSnapshot.sunset,
                                        referenceDate
                                      )
                                      const sunVariantClass = `variant-sun-${lightChangeLevel} `
                                      return (
                                        <div className={`data-field ${sunVariantClass} `}>
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <div className="data-field-label" >
                                              <span className="data-field-icon">🌅</span>
                                              FÉNYVÁLTÁS
                                            </div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{isLightChangeTime(
                                              selectedRecord.weatherSnapshot.sunrise,
                                              selectedRecord.weatherSnapshot.sunset,
                                              referenceDate
                                            )}</div>
                                          </div>
                                          <div className="data-field-value" >
                                            {selectedRecord.weatherSnapshot.sunrise}
                                          </div>
                                          <div className="data-field-value" >
                                            {selectedRecord.weatherSnapshot.sunset}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                              Ehhez a rekordhoz még nem tartozik mentett időjárási pillanat. Mentéskor automatikusan rögzül.
                            </p>
                          )}
                        </div>
                        {/* Back side - Vízállás adatok */}
                        <div
                          className="card-back"
                        >
                          {selectedRecord.forecastSnapshot && selectedRecord.forecastSnapshot.forecasts && selectedRecord.forecastSnapshot.forecasts.length > 0 ? (
                            <>
                              <h2 className="card-section-title">
                                <span>💧</span>
                                Vízállás adatok
                              </h2>
                              {(() => {
                                if (!selectedRecord.forecastSnapshot?.forecasts?.[0]) return null as React.ReactNode
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

                                return trend ? (
                                  <p style={{ margin: '0 0 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span style={{ fontSize: '1em', fontWeight: 900, lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>
                                      {trend.type === 'increasing' && '↑'}
                                      {trend.type === 'decreasing' && '↓'}
                                      {trend.type === 'stable' && '→'}
                                    </span>
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
                                          fontSize: '0.625rem',
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
                                          {firstForecast.water && ` - ${firstForecast.water} `}
                                        </span>
                                      </span>
                                    )}
                                  </p>
                                ) : null
                              })()}
                              {/* Grafikon: előző 3 nap, mai nap, következő 3 nap */}
                              {(() => {
                                if (!selectedRecord.forecastSnapshot?.forecasts?.[0]) return null as React.ReactNode
                                const firstForecast = selectedRecord.forecastSnapshot.forecasts[0]
                                const waterData = selectedRecord.waterDataSnapshot
                                const pastData = selectedRecord.pastWaterLevelSnapshot?.data || []

                                if (!firstForecast.forecasts || firstForecast.forecasts.length === 0) return null

                                const chartData: Array<{ date: Date; value: number; isPast: boolean; isToday: boolean; isFuture: boolean }> = []

                                // Előző 3 nap
                                if (pastData && pastData.length > 0) {
                                  pastData.forEach((item) => {
                                    const value = typeof item.measurement.value === 'string' ? parseFloat(item.measurement.value) : item.measurement.value
                                    const date = new Date(item.measurement.date)
                                    chartData.push({ date, value, isPast: true, isToday: false, isFuture: false })
                                  })
                                }

                                // Mai nap
                                if (waterData?.measurements && waterData.measurements.length > 0) {
                                  const lastMeasurement = waterData.measurements[waterData.measurements.length - 1]
                                  const currentWaterLevel = typeof lastMeasurement.value === 'string' ? parseFloat(lastMeasurement.value) : lastMeasurement.value
                                  const today = new Date()
                                  chartData.push({ date: today, value: currentWaterLevel, isPast: false, isToday: true, isFuture: false })
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

                                // Grafikon méretek - reszponzív (20%-kal csökkentve)
                                const baseWidth = 432 // 540 * 0.8
                                const baseHeight = 288 // 360 * 0.8
                                const isMobile = window.innerWidth <= 768
                                const padding = isMobile
                                  ? { top: 10, right: 8, bottom: 20, left: 30 } // Kisebb padding mobilnézetben
                                  : { top: 18, right: 18, bottom: 36, left: 45 }
                                const chartWidth = baseWidth - padding.left - padding.right
                                const chartHeight = baseHeight - padding.top - padding.bottom

                                // Pontok koordinátái
                                const points = chartData.map((data, index) => {
                                  const x = padding.left + (index / (chartData.length - 1 || 1)) * chartWidth
                                  const y = padding.top + chartHeight - ((data.value - minValue) / range) * chartHeight
                                  return { x, y, ...data }
                                })

                                // Vonal path
                                const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y} `).join(' ')

                                return (
                                  <div ref={savedChartRef} className="water-level-chart">
                                    <svg
                                      viewBox={`0 0 ${baseWidth} ${baseHeight} `}
                                      preserveAspectRatio="xMidYMid meet"
                                      style={{ overflow: 'visible', width: '100%', height: '100%', display: 'block' }}
                                    >
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
                                            key={`grid - ${ratio} `}
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
                                            />
                                            <text
                                              x={point.x}
                                              y={baseHeight - padding.bottom + 12}
                                              textAnchor="middle"
                                              fontSize="8"
                                              fill="#64748b"
                                            >
                                              {point.isToday ? 'Mai nap' : (() => {
                                                const date = point.date
                                                const year = date.getFullYear()
                                                const month = String(date.getMonth() + 1).padStart(2, '0')
                                                const day = String(date.getDate()).padStart(2, '0')
                                                return `${year}.${month}.${day} `
                                              })()}
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
                                  </div>
                                )
                              })()}
                            </>
                          ) : (
                            <p className="data-card-italic" style={{ textAlign: 'center', marginTop: '2rem' }}>
                              Ehhez a rekordhoz még nem tartozik mentett előrejelzés. Mentéskor automatikusan rögzül.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              ) : null}

            </>
          )}
        </section >
      </main >

      {/* Halak kiválasztása popup */}
      {
        showFishPopup && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '1rem',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleFishPopupCancel()
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#FFFFF7',
                borderRadius: '0.75rem',
                padding: window.innerWidth <= 480 ? '1.5rem' : '2rem',
                maxWidth: window.innerWidth <= 480 ? '95vw' : '500px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
                color: '#0f172a',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  margin: '0 0 1.5rem 0',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                Mit fogtál?
              </h2>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '2rem',
                }}
              >
                {fishOptions.map((fish) => {
                  const isSelected = !!selectedFish[fish]
                  const count: number = selectedFish[fish] || 0
                  return (
                    <div
                      key={fish}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        backgroundColor: isSelected ? '#e0f2fe' : '#f3f4f6',
                        transition: 'background-color 0.2s ease',
                        border: isSelected ? '2px solid #14b8a6' : '2px solid transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFish(fish)}
                          style={{
                            width: window.innerWidth <= 480 ? '1.5rem' : '1.25rem',
                            height: window.innerWidth <= 480 ? '1.5rem' : '1.25rem',
                            cursor: 'pointer',
                            accentColor: '#14b8a6',
                            minWidth: window.innerWidth <= 480 ? '1.5rem' : '1.25rem',
                            minHeight: window.innerWidth <= 480 ? '1.5rem' : '1.25rem',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '1rem',
                            fontWeight: isSelected ? 600 : 400,
                            textTransform: 'capitalize',
                            color: '#0f172a',
                          }}
                        >
                          {fish}
                        </span>
                      </div>
                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              decreaseFishCount(fish)
                            }}
                            style={{
                              width: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              height: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              minWidth: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              minHeight: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              borderRadius: '0.25rem',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#374151',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.25rem',
                              fontWeight: 600,
                              transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff'
                            }}
                          >
                            −
                          </button>
                          <span
                            style={{
                              minWidth: '2rem',
                              textAlign: 'center',
                              fontSize: '1rem',
                              fontWeight: 600,
                              color: '#0f172a',
                            }}
                          >
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              increaseFishCount(fish)
                            }}
                            style={{
                              width: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              height: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              minWidth: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              minHeight: window.innerWidth <= 480 ? '2.5rem' : '2rem',
                              borderRadius: '0.25rem',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#374151',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.25rem',
                              fontWeight: 600,
                              transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f3f4f6'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff'
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                  gap: '1rem',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={handleFishPopupCancel}
                  style={{
                    padding: window.innerWidth <= 480 ? '0.75rem 1.5rem' : '0.5rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: 500,
                    width: window.innerWidth <= 480 ? '100%' : 'auto',
                    minHeight: window.innerWidth <= 480 ? '44px' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={handleFishPopupConfirm}
                  style={{
                    padding: window.innerWidth <= 480 ? '0.75rem 1.5rem' : '0.5rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #0d9488',
                    backgroundColor: '#14b8a6',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: 500,
                    width: window.innerWidth <= 480 ? '100%' : 'auto',
                    minHeight: window.innerWidth <= 480 ? '44px' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0d9488'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#14b8a6'
                  }}
                >
                  Mentés
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Törlés megerősítés popup */}
      {
        deleteConfirmRecordId && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '1rem',
            }}
            onClick={handleDeleteRecordCancel}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  color: '#1e293b',
                }}
              >
                Rekord törlése
              </h3>
              <p
                style={{
                  margin: '0 0 1.5rem 0',
                  fontSize: '0.95rem',
                  color: '#475569',
                  lineHeight: 1.6,
                }}
              >
                Biztosan törölni szeretnéd ezt a rekordot? Ez a művelet nem vonhatĂł vissza.
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                  gap: '1rem',
                  justifyContent: 'flex-end',
                }}
              >
                <button
                  type="button"
                  onClick={handleDeleteRecordCancel}
                  style={{
                    padding: window.innerWidth <= 480 ? '0.75rem 1.5rem' : '0.5rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: 500,
                    width: window.innerWidth <= 480 ? '100%' : 'auto',
                    minHeight: window.innerWidth <= 480 ? '44px' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff'
                  }}
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRecordConfirm}
                  style={{
                    padding: window.innerWidth <= 480 ? '0.75rem 1.5rem' : '0.5rem 1.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #dc2626',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    fontWeight: 500,
                    width: window.innerWidth <= 480 ? '100%' : 'auto',
                    minHeight: window.innerWidth <= 480 ? '44px' : 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ef4444'
                  }}
                >
                  Törlés
                </button>
              </div>
            </div>
          </div>
        )
      }

    </>
  )
}

export default App

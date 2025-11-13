import { type ChangeEvent, useEffect, useMemo, useState } from 'react'

import { useAuth } from './context/AuthContext.tsx'
import {
  fetchWeather,
  searchLocations,
  searchNearestLocation,
  type LocationSearchResult,
  type WeatherData,
} from './api/weather.ts'
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
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSearchResult[]>([])
  const [locationSuggestionLoading, setLocationSuggestionLoading] = useState(false)
  const [locationSuggestionError, setLocationSuggestionError] = useState<string | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

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
          setMessage('Bejelentkezve. Válassz egy rekordot vagy ments új helyszínt.')
        }
      },
      (error) => {
        console.error('Firestore rekord figyelés sikertelen', error)
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
    if (selectedRecord) {
      setLocation(selectedRecord.locationName)
      setLocationQuery(selectedRecord.locationQuery)
      setCoordinates(selectedRecord.coordinates)
    }
  }, [selectedRecord])

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
        console.error('Helyszín keresés sikertelen', error)
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
    const nextCoordinates = overrides?.coordinates ?? coordinates

    const payload = {
      locationName,
      locationQuery: query,
      coordinates: nextCoordinates,
      weatherSnapshot: snapshot,
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
      console.error('Helyszín mentése sikertelen', error)
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
      console.error('Google bejelentkezés sikertelen', error)
      setAuthError('A Google bejelentkezés sikertelen. Próbáld újra később.')
    }
  }

  useEffect(() => {
    if (!user) {
      setWeatherData(null)
      return
    }

    const trimmedInput = location.trim()
    const trimmedQuery = locationQuery.trim()
    const recordQuery = selectedRecord?.locationQuery?.trim() ?? ''
    const recordName = selectedRecord?.locationName?.trim() ?? ''

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
        console.error('WeatherAPI lekérdezés sikertelen', error)
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
  }, [location, locationQuery, selectedRecord, user])

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
    } catch (error) {
      console.error('Kijelentkezés sikertelen', error)
      setAuthError('A kijelentkezés nem sikerült. Próbáld újra.')
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
      console.error('Helyszín mentése sikertelen', error)
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
          setSaveMessage('Az aktuális helyzet alapján betöltöttük a legközelebbi települést. Mentsd el, ha szeretnéd használni.')

          await saveLocation({
            locationName: displayName,
            locationQuery: queryValue,
            coordinates: coords,
          })
        } catch (error) {
          console.error('Geolokáció feldolgozása sikertelen', error)
          setGeolocationError('Nem sikerült feldolgozni a helyadatokat.')
        } finally {
          setGeolocationLoading(false)
        }
      },
      (error) => {
        console.error('Geolokáció hibája', error)
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
      setLocation(record.locationName)
      setLocationQuery(record.locationQuery)
      setCoordinates(record.coordinates)
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
      console.error('Rekord törlése sikertelen', error)
      setSaveMessage('Rekord törlése sikertelen. Nézd meg a konzolt!')
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Firebase kapcsolat teszt</h1>
      <section
        style={{
          margin: '1.5rem 0',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #cbd5f5',
          backgroundColor: '#eef2ff',
          color: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Google autentikáció</h2>
        {authLoading ? (
          <p>Bejelentkezés állapotának ellenőrzése…</p>
        ) : user ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? user.email ?? 'Felhasználó'}
                  style={{ width: '48px', height: '48px', borderRadius: '50%' }}
                />
              ) : null}
              <div>
                <p style={{ margin: 0, fontWeight: 500 }}>{user.displayName ?? 'Bejelentkezett felhasználó'}</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>{user.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authActionRunning}
              style={{
                alignSelf: 'flex-start',
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: '1px solid #ef4444',
                backgroundColor: authActionRunning ? '#fca5a5' : '#ef4444',
                color: '#ffffff',
                cursor: authActionRunning ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              Kijelentkezés
            </button>
          </>
        ) : (
          <>
            <p>Belépés után tudod menteni a helyszíneket.</p>
            <button
              type="button"
              onClick={handleSignIn}
              disabled={authActionRunning}
              style={{
                alignSelf: 'flex-start',
                padding: '0.5rem 1rem',
                borderRadius: '0.25rem',
                border: '1px solid #2563eb',
                backgroundColor: authActionRunning ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                cursor: authActionRunning ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              Belépés Google fiókkal
            </button>
          </>
        )}
        {authError && <p style={{ color: '#dc2626' }}>{authError}</p>}
      </section>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        Helyszín
        {user ? (
          <span style={{ fontSize: '0.85rem', color: '#475569' }}>
            {selectedRecord
              ? `Kijelölt rekord: ${selectedRecord.locationName}. Új helyszín mentéséhez írd át és kattints a „Mentés” gombra.`
              : 'Adj meg egy helyszínt, majd kattints a „Mentés” gombra.'}
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
            backgroundColor: isFormDisabled ? '#e2e8f0' : '#ffffff',
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
              backgroundColor: '#ffffff',
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
            color: '#ffffff',
            cursor: isFormDisabled || geolocationLoading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
          }}
        >
          {geolocationLoading ? 'Helyzet meghatározása…' : 'Helyzet lekérése'}
        </button>
        {geolocationError && <span style={{ color: '#dc2626' }}>{geolocationError}</span>}
      </div>
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
      {saveMessage && <p>{saveMessage}</p>}
      <p>{message}</p>

      <section
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Aktuális időjárás</h2>
        {!user ? (
          <p>Jelentkezz be és adj meg helyszínt, hogy lásd az időjárási adatokat.</p>
        ) : weatherLoading ? (
          <p>Időjárási adatok betöltése…</p>
        ) : weatherError ? (
          <p style={{ color: '#dc2626' }}>{weatherError}</p>
        ) : weatherData ? (
          <div
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              padding: '1.5rem',
              borderRadius: '0.75rem',
              border: '1px solid #cbd5f5',
              backgroundColor: '#f1f5f9',
              color: '#0f172a',
            }}
          >
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{weatherData.locationName}</h3>
              <p style={{ margin: 0 }}>
                Légnyomás: {weatherData.pressureHpa.toFixed(0)} hPa ({weatherData.pressureTrend})
              </p>
            </div>
            <div>
              <p style={{ margin: 0 }}>
                Levegő hőmérséklet: {weatherData.airTemperatureC.toFixed(1)} °C
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 0.25rem' }}>
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
              <p style={{ margin: '0.25rem 0 0' }}>Holdfázis: {weatherData.moonPhase}</p>
            </div>
          </div>
        ) : (
          <p>Még nincs időjárási adat. Adj meg helyszínt és mentsd el.</p>
        )}
      </section>

      <section
        style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Mentett rekordok</h2>
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
                    color: record.id === selectedRecordId ? '#ffffff' : '#0f172a',
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
                      color: '#ffffff',
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
            {records.length > 0 && (
              <p style={{ marginTop: 0, marginBottom: '1rem', color: '#475569', fontSize: '0.9rem' }}>
                Összesen {records.length} mentett rekord.
              </p>
            )}
            <div
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
              {records.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                  Nincs mentett rekord. Adj meg egy helyszínt fent, majd kattints a „Mentés” gombra.
                </p>
              ) : selectedRecord ? (
                <>
                  <span>
                    <strong>Helyszín:</strong> {selectedRecord.locationName}
                  </span>
                  <span>
                    <strong>Keresési kifejezés:</strong> {selectedRecord.locationQuery}
                  </span>
                  {selectedRecord.coordinates ? (
                    <span>
                      <strong>Koordináták:</strong> {selectedRecord.coordinates.lat.toFixed(4)},{' '}
                      {selectedRecord.coordinates.lon.toFixed(4)}
                    </span>
                  ) : null}
                  <span>
                    <strong>Létrehozva:</strong> {new Date(selectedRecord.createdAt).toLocaleString()}
                  </span>
                  <span>
                    <strong>Frissítve:</strong> {new Date(selectedRecord.updatedAt).toLocaleString()}
                  </span>
                  <span>
                    <strong>Felhasználó UID:</strong> {selectedRecord.ownerUid}
                  </span>
                  {selectedRecord.weatherSnapshot ? (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        display: 'grid',
                        gap: '0.75rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: 600 }}>Mentett időjárás pillanat</p>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#0369a1' }}>
                          Mentve: {new Date(selectedRecord.weatherSnapshot.capturedAt).toLocaleString()}
                        </p>
                        <p style={{ margin: '0.5rem 0 0' }}>
                          Légnyomás: {selectedRecord.weatherSnapshot.pressureHpa.toFixed(0)} hPa (
                          {selectedRecord.weatherSnapshot.pressureTrend})
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0 }}>
                          Levegő: {selectedRecord.weatherSnapshot.airTemperatureC.toFixed(1)} °C
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0 }}>
                          Szél: {selectedRecord.weatherSnapshot.windDirection}{' '}
                          {selectedRecord.weatherSnapshot.windSpeedKph.toFixed(1)} km/h
                        </p>
                        <p style={{ margin: '0.25rem 0 0' }}>
                          Felhőzet: {selectedRecord.weatherSnapshot.cloudCoverPercent}% &nbsp;|&nbsp; UV:{' '}
                          {selectedRecord.weatherSnapshot.uvIndex.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: 0 }}>
                          Csapadék esély: {selectedRecord.weatherSnapshot.precipitationChancePercent}% &nbsp;|&nbsp;
                          Intenzitás: {selectedRecord.weatherSnapshot.precipitationIntensityMmPerHour.toFixed(1)} mm/h
                        </p>
                        <p style={{ margin: '0.25rem 0 0' }}>
                          Napkelte: {selectedRecord.weatherSnapshot.sunrise} &nbsp;|&nbsp; Napnyugta:{' '}
                          {selectedRecord.weatherSnapshot.sunset}
                        </p>
                        <p style={{ margin: '0.25rem 0 0' }}>Holdfázis: {selectedRecord.weatherSnapshot.moonPhase}</p>
                      </div>
                    </div>
                  ) : (
                    <p style={{ marginTop: '1rem', color: '#475569' }}>
                      Ehhez a rekordhoz még nem tartozik mentett időjárási pillanat. Mentéskor automatikusan rögzül.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ textAlign: 'center', color: '#64748b', marginTop: '2rem' }}>
                  Válassz egy rekordot a listából, vagy adj meg egy új helyszínt és mentsd el.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App

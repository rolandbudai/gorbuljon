import React, { useMemo, useState } from 'react'
import type { ForecastEntry } from '../../api/water'
import type { WeatherData } from '../../api/weather'
import { WaterLevelChart, type ChartPoint } from './WaterLevelChart'
import { WeatherForecastChart } from './WeatherForecastChart'

interface ForecastSectionProps {
    isOpen: boolean
    onClose: () => void
    forecastEntry: ForecastEntry | null
    pastData: { date: Date | string, value: number }[] | null
    currentLevel: number | null
    locationName: string
    isLoading?: boolean
    debugStatus?: string
    weatherData?: WeatherData | null
}

export const ForecastSection: React.FC<ForecastSectionProps> = ({
    isOpen,
    onClose,
    forecastEntry,
    pastData,
    currentLevel,
    locationName,
    isLoading,
    debugStatus,
    weatherData
}) => {
    const [activeTab, setActiveTab] = useState<'water' | 'weather'>('water')

    // --- Data Processing Logic (extracted from App.tsx) ---
    const chartData = useMemo<ChartPoint[]>(() => {
        if (!forecastEntry && !currentLevel && !pastData) return []

        const points: ChartPoint[] = []

        // 1. Past Data (Previous 3 days)
        if (pastData && pastData.length > 0) {
            pastData.forEach((item) => {
                points.push({
                    date: new Date(item.date),
                    value: item.value,
                    isPast: true,
                    isToday: false,
                    isFuture: false
                })
            })
        }

        // 2. Current Level (Today)
        if (currentLevel !== null) {
            points.push({
                date: new Date(),
                value: currentLevel,
                isPast: false,
                isToday: true,
                isFuture: false
            })
        }

        // 3. Forecasts (Explicit Logic for Next 3 Days)
        if (forecastEntry && forecastEntry.forecasts) {
            const today = new Date()
            const todayStr = today.toDateString()
            const futureMap = new Map<string, typeof forecastEntry.forecasts[0]>()

            forecastEntry.forecasts.forEach((forecast) => {
                const d = new Date(forecast.date)
                // Skip invalid dates
                if (isNaN(d.getTime())) return

                const dStr = d.toDateString()

                // Skip today and past dates completely
                // We rely on currentLevel for today's data
                if (d < today || dStr === todayStr) {
                    return
                }

                // For future days, pick the measurement closest to noon (12:00)
                const currentBest = futureMap.get(dStr)
                if (!currentBest) {
                    futureMap.set(dStr, forecast)
                } else {
                    const bestDate = new Date(currentBest.date)
                    const bestDiff = Math.abs(bestDate.getHours() - 12)
                    const currDiff = Math.abs(d.getHours() - 12)
                    if (currDiff < bestDiff) {
                        futureMap.set(dStr, forecast)
                    }
                }
            })

            // Sort by date and take the first 3 days
            const sortedFutures = Array.from(futureMap.values())
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 3)

            sortedFutures.forEach((f) => {
                points.push({
                    date: new Date(f.date),
                    value: f.value,
                    isPast: false,
                    isToday: false,
                    isFuture: true
                })
            })
        }

        return points.sort((a, b) => a.date.getTime() - b.date.getTime())

    }, [pastData, currentLevel, forecastEntry])

    if (!isOpen) return null

    return (
        <div className="forecast-modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
        }}>
            <div className="forecast-modal-content" style={{
                backgroundColor: '#ffffff',
                width: '100%',
                maxWidth: '700px',
                borderRadius: '1rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
                maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                            Vízállás Előrejelzés
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                            {locationName} {forecastEntry?.station ? `(${forecastEntry.station})` : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            background: '#e2e8f0',
                            cursor: 'pointer',
                            color: '#475569',
                            fontWeight: 'bold',
                        }}
                    >
                        ✕ Bezárás
                    </button>
                </div>

                {/* Content */}
                {/* Content */}
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', flex: 1 }}>
                        <div style={{ border: '3px solid #f3f3f3', borderTop: '3px solid #3b82f6', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite', marginBottom: '1rem' }}></div>
                        <p style={{ color: '#64748b' }}>Adatok betöltése...</p>
                        <style>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                ) : (
                    <div style={{ padding: '1.5rem', overflowY: 'auto' }}>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                            <button
                                onClick={() => setActiveTab('water')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    backgroundColor: activeTab === 'water' ? '#3b82f6' : 'transparent',
                                    color: activeTab === 'water' ? '#ffffff' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                💧 Vízállás
                            </button>
                            <button
                                onClick={() => setActiveTab('weather')}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: 'none',
                                    backgroundColor: activeTab === 'weather' ? '#3b82f6' : 'transparent',
                                    color: activeTab === 'weather' ? '#ffffff' : '#64748b',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                🌤️ Időjárás
                            </button>
                        </div>

                        {/* Chart Container */}
                        <div style={{
                            marginBottom: '2rem',
                            backgroundColor: '#FFFFF7',
                            padding: '1rem',
                            borderRadius: '0.75rem',
                            border: '1px solid #e2e8f0'
                        }}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#334155' }}>
                                {activeTab === 'water' ? 'Vízállás Grafikon' : 'Időjárás Előrejelzés'}
                            </h3>

                            {activeTab === 'water' ? (
                                <WaterLevelChart points={chartData} />
                            ) : (
                                <WeatherForecastChart forecasts={weatherData?.forecasts || []} />
                            )}
                        </div>


                    </div>


                )}

                {/* DEBUG INFO - Temporary */}
                <div style={{ padding: '0.5rem', fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', borderTop: '1px solid #f1f5f9' }}>
                    Debug: R:{forecastEntry?.forecasts?.length || 0} /
                    F:{chartData.filter(p => p.isFuture).length}
                    ({forecastEntry?.forecasts?.[0]?.date || 'n/a'})
                    <br />
                    Status: {debugStatus || 'No status'}
                </div>
            </div>
        </div >
    )
}

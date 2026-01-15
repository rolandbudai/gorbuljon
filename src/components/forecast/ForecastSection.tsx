import React, { useMemo } from 'react'
import type { ForecastEntry } from '../../api/water'
import { WaterLevelChart, type ChartPoint } from './WaterLevelChart'

interface ForecastSectionProps {
    isOpen: boolean
    onClose: () => void
    forecastEntry: ForecastEntry | null
    pastData: { date: Date | string, value: number }[] | null
    currentLevel: number | null
    locationName: string
}

export const ForecastSection: React.FC<ForecastSectionProps> = ({
    isOpen,
    onClose,
    forecastEntry,
    pastData,
    currentLevel,
    locationName
}) => {

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

        // 3. Forecasts (Next days)
        if (forecastEntry && forecastEntry.forecasts) {
            // Filter logic from App.tsx to deduplicate and pick noon values
            // Use explicit type Array<typeof forecastEntry.forecasts[0]>
            const dailyForecasts = forecastEntry.forecasts.reduce<Array<typeof forecastEntry.forecasts[0]>>((acc, forecast) => {
                const date = new Date(forecast.date)
                const dateKey = date.toISOString().split('T')[0]
                const existing = acc.find((f) => {
                    const fDate = new Date(f.date)
                    return fDate.toISOString().split('T')[0] === dateKey
                })

                if (!existing) {
                    acc.push(forecast)
                } else {
                    // Pick closest to noon
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

            // Filter future only
            const todayMidnight = new Date()
            todayMidnight.setHours(0, 0, 0, 0)

            const futureForecasts = dailyForecasts.filter(f => {
                const d = new Date(f.date)
                d.setHours(0, 0, 0, 0)
                return d.getTime() > todayMidnight.getTime()
            }).slice(0, 5) // Next 5 days? App.tsx showed 3. Let's show up to 5 in modal.

            futureForecasts.forEach(f => {
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
                <div style={{ padding: '1.5rem', overflowY: 'auto' }}>

                    {/* Chart Container */}
                    <div style={{
                        marginBottom: '2rem',
                        backgroundColor: '#FFFFF7',
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#334155' }}>Grafikon</h3>
                        <WaterLevelChart points={chartData} />
                    </div>

                    {/* Simple Table */}
                    <div>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#334155' }}>Részletes adatok</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Dátum</th>
                                        <th style={{ padding: '0.75rem' }}>Vízállás (cm)</th>
                                        <th style={{ padding: '0.75rem' }}>Tipus</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartData.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                                                {row.date.toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                                                {row.value.toFixed(0)}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {row.isPast && <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b', fontSize: '0.75rem' }}>Múlt</span>}
                                                {row.isToday && <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>MA</span>}
                                                {row.isFuture && <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontSize: '0.75rem' }}>Előrejelzés</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

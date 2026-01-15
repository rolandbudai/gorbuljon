import React from 'react'
import type { WeatherForecastDay } from '../../api/weather'

interface WeatherForecastChartProps {
    forecasts: WeatherForecastDay[]
}

export const WeatherForecastChart: React.FC<WeatherForecastChartProps> = ({ forecasts }) => {
    if (!forecasts || forecasts.length === 0) {
        return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Nincs elérhető időjárás előrejelzés.</div>
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {forecasts.map((day) => (
                <div key={day.dateEpoch} style={{
                    backgroundColor: '#f8fafc',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    border: '1px solid #e2e8f0'
                }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>
                        {new Date(day.date).toLocaleDateString('hu-HU', { weekday: 'short', month: 'numeric', day: 'numeric' })}
                    </div>

                    <img src={day.conditionIcon} alt={day.conditionText} style={{ width: '48px', height: '48px', marginBottom: '0.5rem' }} />

                    <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', marginBottom: '0.5rem', height: '2.5em', display: 'flex', alignItems: 'center' }}>
                        {day.conditionText}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{Math.round(day.maxTempC)}°</span>
                        <span style={{ fontSize: '0.875rem', color: '#64748b' }}>/ {Math.round(day.minTempC)}°</span>
                    </div>

                    <div style={{ width: '100%', fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>💨 Szél:</span>
                            <span style={{ fontWeight: 500 }}>{day.maxWindKph} km/h</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>☔ Eső:</span>
                            <span style={{ fontWeight: 500 }}>{day.dailyChanceOfRain}%</span>
                        </div>
                        {day.dailyChanceOfSnow > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>❄️ Hó:</span>
                                <span style={{ fontWeight: 500 }}>{day.dailyChanceOfSnow}%</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

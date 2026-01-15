import { useState, useMemo, useEffect } from 'react'
import { Radar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js'
import type { LocationRecord } from '../../services/records'
import type { DataType } from '../../utils/statistics'
import { analyzeFishType, getAllFishTypes } from '../../utils/fishStatistics'
import { getLevelDescription, getDataTypeConfig } from '../../utils/statistics'

// Register Chart.js components
ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
)

interface FishTypeAnalysisProps {
    records: LocationRecord[]
}

export function FishTypeAnalysis({ records }: FishTypeAnalysisProps) {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const isMobile = windowWidth <= 768
    const fishTypes = useMemo(() => getAllFishTypes(records), [records])
    const [selectedFish, setSelectedFish] = useState<string>(fishTypes[0] || '')

    const analysisData = useMemo(() => {
        if (!selectedFish) return null
        return analyzeFishType(records, selectedFish)
    }, [records, selectedFish])

    const chartData = useMemo(() => {
        if (!analysisData) {
            return {
                labels: [],
                datasets: [],
                preferences: [],
            }
        }

        // Csak azokat a környezeti tényezőket mutatjuk, amelyekhez van adat
        const validPreferences = analysisData.environmentalPreferences.filter(
            pref => pref.description !== 'Nincs adat'
        )

        return {
            labels: validPreferences.map(pref => getDataTypeConfig(pref.dataType).label),
            datasets: [{
                label: selectedFish,
                data: validPreferences.map(pref => pref.averageLevel),
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderColor: '#2563EB',
                borderWidth: 2,
                pointBackgroundColor: '#2563EB',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#2563EB',
                pointRadius: 5,
                pointHoverRadius: 7,
            }],
            preferences: validPreferences,
        }
    }, [analysisData, selectedFish])

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context: any) => {
                        const dataType = chartData.preferences[context.dataIndex]?.dataType
                        if (!dataType) return ''

                        const level = context.parsed.r
                        const description = getLevelDescription(Math.round(level), dataType)

                        return [
                            `${selectedFish}`,
                            `Átlagos szint: ${level.toFixed(1)}`,
                            `Leírás: ${description}`,
                        ]
                    },
                },
            },
        },
        scales: {
            r: {
                min: -3,
                max: 3,
                ticks: {
                    stepSize: 1,
                    display: true,
                    backdropColor: 'rgba(255, 255, 255, 0.8)',
                    color: '#64748b',
                    font: {
                        size: isMobile ? 9 : 11,
                    },
                },
                pointLabels: {
                    font: {
                        size: isMobile ? 10 : 12,
                        weight: 600,
                    },
                    color: '#1e293b',
                },
                grid: {
                    color: '#E5E7EB',
                    lineWidth: 1,
                },
                angleLines: {
                    color: '#E5E7EB',
                    lineWidth: 1,
                },
            },
        },
    }), [chartData.preferences, selectedFish, isMobile])

    if (fishTypes.length === 0) {
        return (
            <div className="fish-type-analysis">
                <div className="fish-type-empty">
                    <p>Nincs halfaj adat a statisztikák megjelenítéséhez.</p>
                    <p className="fish-type-hint">Mentsd el az első fogásodat halfaj megadásával!</p>
                </div>
            </div>
        )
    }

    return (
        <div className="fish-type-analysis">
            <div className="fish-type-header">
                <h3 className="fish-type-title">Halfaj Elemzés</h3>
                <p className="fish-type-description">
                    Milyen környezeti feltételeket preferál az adott halfaj? A radar diagram megmutatja az átlagos kategóriákat.
                </p>
            </div>

            <div className="fish-selector">
                <label htmlFor="fish-type-select" className="fish-selector-label">
                    Halfaj:
                </label>
                <select
                    id="fish-type-select"
                    className="fish-selector-select"
                    value={selectedFish}
                    onChange={(e) => setSelectedFish(e.target.value)}
                >
                    {fishTypes.map(fish => (
                        <option key={fish} value={fish}>
                            {fish.charAt(0).toUpperCase() + fish.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {analysisData && (
                <>
                    <div className="fish-stats-summary">
                        <div className="fish-stat-card">
                            <div className="fish-stat-label">Összes fogás</div>
                            <div className="fish-stat-value">{analysisData.totalCatches} db</div>
                        </div>
                        <div className="fish-stat-card">
                            <div className="fish-stat-label">Halfaj</div>
                            <div className="fish-stat-value">{selectedFish}</div>
                        </div>
                    </div>

                    <div className="chart-container radar-chart-container">
                        <Radar data={chartData} options={chartOptions} />
                    </div>

                    <div className="fish-conditions-summary">
                        <h4 className="conditions-title">Ideális Körülmények</h4>
                        <div className="conditions-grid">
                            {analysisData.environmentalPreferences
                                .filter(pref => pref.description !== 'Nincs adat')
                                .map(pref => {
                                    const config = getDataTypeConfig(pref.dataType)
                                    const level = Math.round(pref.averageLevel)
                                    const description = getLevelDescription(level, pref.dataType)

                                    return (
                                        <div key={pref.dataType} className="condition-item">
                                            <div className="condition-label">{config.label}</div>
                                            <div className="condition-value">
                                                <span className="condition-level">
                                                    {pref.averageLevel > 0 ? '+' : ''}{pref.averageLevel.toFixed(1)}
                                                </span>
                                                <span className="condition-desc">{description}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

import { useState, useMemo, useEffect } from 'react'
import { Bar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js'
import type { LocationRecord } from '../../services/records'
import type { DataType } from '../../utils/statistics'
import { aggregateCatchesByEnvironment } from '../../utils/fishStatistics'
import { getVariantColor, getLevelDescription, getAllDataTypes, getDataTypeConfig } from '../../utils/statistics'

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
)

interface FishSuccessViewProps {
    records: LocationRecord[]
}

export function FishSuccessView({ records }: FishSuccessViewProps) {
    const [selectedDataType, setSelectedDataType] = useState<DataType>('waterLevel')
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const isMobile = windowWidth <= 768

    const chartData = useMemo(() => {
        const data = aggregateCatchesByEnvironment(records, selectedDataType)

        return {
            labels: data.categories.map(c => {
                const sign = c.level > 0 ? '+' : ''
                return `${sign}${c.level}`
            }),
            datasets: [{
                label: 'Fogások száma',
                data: data.categories.map(c => c.catchCount),
                backgroundColor: data.categories.map(c => getVariantColor(selectedDataType, c.level).bg),
                borderColor: data.categories.map(c => getVariantColor(selectedDataType, c.level).border),
                borderWidth: 2,
                borderRadius: 4,
            }],
            categories: data.categories, // Tooltip-hez szükséges
        }
    }, [records, selectedDataType])

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    title: (context: any) => {
                        const level = parseInt(context[0].label.replace('+', ''))
                        return getLevelDescription(level, selectedDataType)
                    },
                    label: (context: any) => {
                        const levelStr = context.label.replace('+', '')
                        const level = parseInt(levelStr)
                        const category = chartData.categories.find((c: any) => c.level === level)

                        if (!category) return ''

                        const lines = [
                            `Fogások: ${context.parsed.y} db`,
                            `Rekordok: ${category.recordCount} db`,
                        ]

                        if (category.recordCount > 0) {
                            lines.push(`Átlag: ${category.averageCatchPerRecord.toFixed(1)} fogás/rekord`)
                        }

                        // Top 3 halfaj ebben a kategóriában
                        const fishEntries = Object.entries(category.fishTypes)
                            .sort(([, a], [, b]) => (b as number) - (a as number))
                            .slice(0, 3)

                        if (fishEntries.length > 0) {
                            lines.push('') // Üres sor
                            lines.push('Top halfajok:')
                            fishEntries.forEach(([fish, count]) => {
                                lines.push(`  ${fish}: ${count} db`)
                            })
                        }

                        return lines
                    },
                },
            },
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Kategória',
                    font: { size: 14, weight: 600 },
                    color: '#1e293b',
                },
                ticks: {
                    font: { size: isMobile ? 10 : 12 },
                    color: '#64748b',
                    maxRotation: isMobile ? 45 : 0,
                    minRotation: isMobile ? 45 : 0,
                },
                grid: {
                    display: false,
                },
            },
            y: {
                title: {
                    display: true,
                    text: 'Fogások száma',
                    font: { size: 14, weight: 600 },
                    color: '#1e293b',
                },
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                    precision: 0,
                    font: { size: 12 },
                    color: '#64748b',
                },
                grid: {
                    color: '#E5E7EB',
                    lineWidth: 0.5,
                },
            },
        },
    }), [selectedDataType, chartData.categories, isMobile])

    const dataTypeOptions = getAllDataTypes()

    return (
        <div className="fish-success-view">
            <div className="fish-success-header">
                <h3 className="fish-success-title">Fogási Sikeresség Környezeti Feltételek Szerint</h3>
                <p className="fish-success-description">
                    Melyik környezeti kategóriában fogtak a legtöbb halat? Válassz egy tényezőt az elemzéshez.
                </p>
            </div>

            <div className="data-type-selector">
                <label htmlFor="data-type-select" className="data-type-label">
                    Környezeti tényező:
                </label>
                <select
                    id="data-type-select"
                    className="data-type-select"
                    value={selectedDataType}
                    onChange={(e) => setSelectedDataType(e.target.value as DataType)}
                >
                    {dataTypeOptions.map(type => {
                        const config = getDataTypeConfig(type)
                        return (
                            <option key={type} value={type}>
                                {config.label}
                            </option>
                        )
                    })}
                </select>
            </div>

            <div className="chart-container">
                <Bar data={chartData} options={chartOptions} />
            </div>

            <div className="fish-success-legend">
                <p className="legend-title">Kategóriák:</p>
                <div className="legend-items">
                    {chartData.categories.map((cat: any) => (
                        <div key={cat.level} className="legend-item">
                            <div
                                className="legend-color"
                                style={{
                                    backgroundColor: getVariantColor(selectedDataType, cat.level).bg,
                                    borderColor: getVariantColor(selectedDataType, cat.level).border,
                                }}
                            />
                            <span className="legend-text">
                                {cat.level > 0 ? '+' : ''}{cat.level}: {getLevelDescription(cat.level, selectedDataType)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

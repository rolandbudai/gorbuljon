import React, { useLayoutEffect, useRef, useState } from 'react'

export interface ChartPoint {
    date: Date
    value: number
    isPast: boolean
    isToday: boolean
    isFuture: boolean
}

interface WaterLevelChartProps {
    points: ChartPoint[]
}

export const WaterLevelChart: React.FC<WaterLevelChartProps> = ({ points }) => {
    const chartRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)

    useLayoutEffect(() => {
        if (chartRef.current) {
            setWidth(chartRef.current.offsetWidth)
        }

        const handleResize = () => {
            if (chartRef.current) {
                setWidth(chartRef.current.offsetWidth)
            }
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    if (!points || points.length === 0) {
        return <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Nincs megjeleníthető adat</div>
    }

    // --- Chart Dimensions & Scales ---
    const minValue = -100
    const maxValue = 800
    const range = maxValue - minValue

    // Maintain aspect ratio logic but use responsive width
    // Base dimensions from original design
    const baseHeight = 300 // slightly taller for better mobile view
    // Calculate responsive height based on width if needed, or fixed height with scroll?
    // Let's use flexible width and fixed height for simplicity, expanding to container
    const chartHeight = baseHeight
    const chartWidth = width || 100 // Prevent division by zero

    const isMobile = window.innerWidth <= 768
    const padding = isMobile
        ? { top: 10, right: 8, bottom: 20, left: 30 }
        : { top: 18, right: 18, bottom: 36, left: 45 }

    // Recalculate plot area based on dynamic padding
    const plotWidth = chartWidth - padding.left - padding.right
    const plotHeight = chartHeight - padding.top - padding.bottom

    // --- Calculations ---
    const calculateY = (value: number) => {
        return padding.top + plotHeight - ((value - minValue) / range) * plotHeight
    }

    const calculateX = (index: number) => {
        return padding.left + (index / (points.length - 1 || 1)) * plotWidth
    }

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${calculateX(i)} ${calculateY(p.value)}`).join(' ')

    return (
        <div ref={chartRef} className="water-level-chart" style={{ width: '100%', height: `${baseHeight}px`, position: 'relative' }}>
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${chartHeight}`}
                style={{ overflow: 'visible' }}
            >
                {/* Y Axis Grid & Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const value = minValue + range * ratio
                    const y = padding.top + plotHeight - ratio * plotHeight
                    return (
                        <g key={ratio}>
                            {/* Grid Line */}
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={padding.left + plotWidth}
                                y2={y}
                                stroke="#e2e8f0"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                            />
                            {/* Label */}
                            <text
                                x={padding.left - 8}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="9"
                                fill="#64748b"
                            >
                                {value.toFixed(0)} cm
                            </text>
                            {/* Tick mark */}
                            <line
                                x1={padding.left - 5}
                                y1={y}
                                x2={padding.left}
                                y2={y}
                                stroke="#cbd5e1"
                                strokeWidth="1"
                            />
                        </g>
                    )
                })}

                {/* Main Line */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data Points */}
                {points.map((point, index) => {
                    const x = calculateX(index)
                    const y = calculateY(point.value)

                    let color = '#3b82f6'
                    let radius = 6

                    if (point.isPast) {
                        color = '#64748b'
                        radius = 6
                    } else if (point.isToday) {
                        color = '#10b981'
                        radius = 7
                    } else if (point.isFuture) {
                        color = '#f59e0b'
                        radius = 6
                    }

                    return (
                        <g key={index} className="chart-point-group">
                            {/* Touch target (invisible larger circle) */}
                            <circle cx={x} cy={y} r="15" fill="transparent" />

                            {/* Visible Point */}
                            <circle
                                cx={x}
                                cy={y}
                                r={radius}
                                fill={color}
                                stroke="#ffffff"
                                strokeWidth="1.5"
                            />

                            {/* Date Label on X Axis */}
                            <text
                                x={x}
                                y={chartHeight - padding.bottom + 12}
                                textAnchor="middle"
                                fontSize="8"
                                fill="#64748b"
                            >
                                {point.isToday ? 'Mai nap' : (() => {
                                    const date = point.date
                                    const year = date.getFullYear()
                                    const month = String(date.getMonth() + 1).padStart(2, '0')
                                    const day = String(date.getDate()).padStart(2, '0')
                                    return `${year}.${month}.${day}`
                                })()}
                            </text>
                        </g>
                    )
                })}

                {/* X Axis Line */}
                <line
                    x1={padding.left}
                    y1={padding.top + plotHeight}
                    x2={padding.left + plotWidth}
                    y2={padding.top + plotHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                />

                {/* Y Axis Line */}
                <line
                    x1={padding.left}
                    y1={padding.top}
                    x2={padding.left}
                    y2={padding.top + plotHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                />
            </svg>
        </div>
    )
}

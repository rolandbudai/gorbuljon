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

    const padding = { top: 20, right: 30, bottom: 30, left: 40 }
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
                                strokeDasharray="4,4"
                            />
                            {/* Label */}
                            <text
                                x={padding.left - 8}
                                y={y + 4}
                                textAnchor="end"
                                fontSize="11"
                                fill="#64748b"
                            >
                                {value.toFixed(0)}
                            </text>
                        </g>
                    )
                })}

                {/* Main Line */}
                <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data Points */}
                {points.map((point, index) => {
                    const x = calculateX(index)
                    const y = calculateY(point.value)

                    let color = '#3b82f6'
                    let radius = 5

                    if (point.isPast) {
                        color = '#94a3b8' // Slate 400
                        radius = 4
                    } else if (point.isToday) {
                        color = '#10b981' // Emerald 500
                        radius = 6
                    } else if (point.isFuture) {
                        color = '#f59e0b' // Amber 500
                        radius = 5
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
                                stroke="white"
                                strokeWidth="2"
                            />

                            {/* Value Label (only for Today and future, or all?) - Let's show on hover/touch via simple tooltip or all for mobile?
                                 Showing all might be cluttered. Let's show values above points for Today and Future.
                             */}
                            {(point.isToday || point.isFuture) && (
                                <text
                                    x={x}
                                    y={y - 12}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fontWeight="600"
                                    fill={color}
                                >
                                    {point.value.toFixed(0)}
                                </text>
                            )}
                            {/* Date Label on X Axis (simplified) */}
                            <text
                                x={x}
                                y={chartHeight - 10}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#64748b"
                            >
                                {point.date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

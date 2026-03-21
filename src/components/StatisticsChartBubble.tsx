import React, { useMemo } from 'react'
import { Bubble } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  CategoryScale,
} from 'chart.js'
import type { BubbleChartDataPoint } from '../utils/statistics'
import {
  getDataTypeConfig,
  getLevelDescription,
  getWaterLevelLevel,
  getWaterTempLevel,
  getAirTempLevel,
  getPressureLevel,
  getCloudCoverLevel,
  getRainLevel,
  getWindLevel,
  getUVLevel,
} from '../utils/statistics'
import type { DataType } from '../utils/statistics'

// Chart.js regisztráció
ChartJS.register(
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  CategoryScale
)

interface StatisticsChartBubbleProps {
  data: BubbleChartDataPoint[]
  xAxisType: DataType
  yAxisType: DataType
}

export const StatisticsChartBubble = React.memo(function StatisticsChartBubble({ data, xAxisType, yAxisType }: StatisticsChartBubbleProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  // Chart konfiguráció memoizálva
  const chartData = useMemo(() => {
    return {
      datasets: [
        {
          label: 'Fogások',
          data: data.map(point => ({
            x: point.x,
            y: point.y,
            r: point.r,
          })),
          backgroundColor: data.map(point => point.backgroundColor),
          borderColor: data.map(point => point.borderColor),
          borderWidth: 2,
        },
      ],
    }
  }, [data])

  // Chart opciók memoizálva
  const chartOptions = useMemo(() => {
    const xConfig = getDataTypeConfig(xAxisType)
    const yConfig = getDataTypeConfig(yAxisType)

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Később hozzáadjuk a színkódolás legendjét
        },
        tooltip: {
          enabled: true,
          backgroundColor: '#1e293b',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            title: () => '',
            label: (context: any) => {
              const point = data[context.dataIndex]
              if (!point) return ''

              const xConfig = getDataTypeConfig(xAxisType)
              const yConfig = getDataTypeConfig(yAxisType)
              const decimalsX = xAxisType === 'pressure' ? 0 :
                xAxisType === 'airTemperature' || xAxisType === 'waterTemperature' ? 1 : 0
              const decimalsY = yAxisType === 'pressure' ? 0 :
                yAxisType === 'airTemperature' || yAxisType === 'waterTemperature' ? 1 : 0

              // Szint meghatározása az X tengely alapján
              let level = 0
              if (xAxisType === 'waterLevel') {
                level = getWaterLevelLevel(point.x)
              } else if (xAxisType === 'waterTemperature') {
                level = getWaterTempLevel(point.x)
              } else if (xAxisType === 'airTemperature') {
                level = getAirTempLevel(point.x)
              } else if (xAxisType === 'pressure') {
                level = getPressureLevel(point.x)
              } else if (xAxisType === 'cloudCover') {
                level = getCloudCoverLevel(point.x)
              } else if (xAxisType === 'precipitationChance') {
                level = getRainLevel(point.x)
              } else if (xAxisType === 'windSpeed') {
                level = getWindLevel(point.x)
              } else if (xAxisType === 'uvIndex') {
                level = getUVLevel(point.x)
              } else if (xAxisType === 'moonPhase') {
                const daysUntilFull = point.x
                if (daysUntilFull === 0) level = 0
                else if (daysUntilFull <= 1) level = -1
                else if (daysUntilFull <= 2) level = -2
                else if (daysUntilFull <= 3) level = -3
                else if (daysUntilFull <= 4) level = 1
                else if (daysUntilFull <= 5) level = 2
                else level = 3
              } else if (xAxisType === 'lightChange') {
                level = point.x === 1 ? 1 : 0
              }

              const levelDescription = getLevelDescription(level, xAxisType)

              return [
                `${xConfig.label}: ${point.x.toFixed(decimalsX)}${xConfig.unit ? ` ${xConfig.unit}` : ''}`,
                `${yConfig.label}: ${point.y.toFixed(decimalsY)}${yConfig.unit ? ` ${yConfig.unit}` : ''}`,
                `Szint: ${levelDescription || level}`,
                `Fogások: ${point.fishCount}`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          title: {
            display: true,
            text: `${xConfig.label}${xConfig.unit ? ` (${xConfig.unit})` : ''}`,
            font: {
              size: isMobile ? 12 : 14,
              weight: '600' as const,
            },
            color: '#1e293b',
          },
          ticks: {
            font: {
              size: isMobile ? 10 : 12,
            },
            color: '#64748b',
          },
          grid: {
            color: '#E5E7EB',
            lineWidth: 0.5,
          },
        },
        y: {
          type: 'linear' as const,
          title: {
            display: true,
            text: `${yConfig.label}${yConfig.unit ? ` (${yConfig.unit})` : ''}`,
            font: {
              size: isMobile ? 12 : 14,
              weight: '600' as const,
            },
            color: '#1e293b',
          },
          ticks: {
            font: {
              size: isMobile ? 10 : 12,
            },
            color: '#64748b',
          },
          grid: {
            color: '#E5E7EB',
            lineWidth: 0.5,
          },
        },
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart' as const,
        onComplete: () => {
          // Animáció befejezése után
        },
      },
      transitions: {
        active: {
          animation: {
            duration: 200,
          },
        },
      },
      interaction: {
        intersect: false,
        mode: 'point' as const,
      },
      onHover: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          event.native.target.style.cursor = 'pointer'
        } else {
          event.native.target.style.cursor = 'default'
        }
      },
      elements: {
        point: {
          hoverRadius: 8, // Hover esetén nagyobb sugár
          hoverBorderWidth: 3, // Hover esetén vastagabb border
        },
      },
    }
  }, [data, xAxisType, yAxisType, isMobile])

  if (data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Nincs megjeleníthető adat
      </div>
    )
  }

  return (
    <div
      className="statistics-chart-bubble"
      style={{
        width: '100%',
        height: isMobile ? '400px' : '500px',
        position: 'relative',
      }}
    >
      <Bubble data={chartData} options={chartOptions as any} />
    </div>
  )
})


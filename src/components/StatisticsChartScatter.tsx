import React, { useMemo } from 'react'
import { Scatter } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ScatterChartDataPoint } from '../utils/statistics'
import { getAllDataTypes, getDataTypeConfig, getLevelDescription } from '../utils/statistics'

// Chart.js regisztráció
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
)

interface StatisticsChartScatterProps {
  data: ScatterChartDataPoint[]
}

export const StatisticsChartScatter = React.memo(function StatisticsChartScatter({ data }: StatisticsChartScatterProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  // Adattípusok és címkék előkészítése
  const dataTypes = getAllDataTypes()
  const dataTypeLabels = dataTypes.map(type => getDataTypeConfig(type).label)

  // Chart adatok memoizálva
  const chartData = useMemo(() => {
    // Maximum fogásszám számítása a Y tengely skálázásához
    // const _maxFishCount = data.length > 0 
    //   ? Math.max(...data.map(point => point.totalFishCount))
    //   : 10

    // Maximum rekordok száma a pont méret normalizálásához
    const maxRecordCount = data.length > 0
      ? Math.max(...data.map(point => point.recordCount))
      : 1

    // Dataset-ek létrehozása adattípus szerint
    // Minden adattípus egy dataset, minden szint egy pont
    const datasets = dataTypes.map((type, typeIndex) => {
      // Adott adattípushoz tartozó pontok
      const typePoints = data.filter(point => point.dataType === type)

      return {
        label: getDataTypeConfig(type).label,
        data: typePoints.map(point => ({
          x: typeIndex, // X pozíció: adattípus index
          y: point.totalFishCount, // Y pozíció: összesített fogásszám
          // További adatok a tooltip-hez (Chart.js-ben ezek a point objektumban lesznek)
          level: point.level,
          recordCount: point.recordCount,
          avgValue: point.avgValue,
          dataType: point.dataType,
        })),
        backgroundColor: typePoints.map(point => point.color.bg),
        borderColor: typePoints.map(point => point.color.border),
        pointRadius: typePoints.map(point => {
          // Pont méret: rekordok száma alapján (6-12px)
          const range = maxRecordCount > 0 ? maxRecordCount : 1
          return isMobile
            ? 6 + ((point.recordCount / range) * 4) // Mobile: 6-10px
            : 8 + ((point.recordCount / range) * 4) // Desktop: 8-12px
        }),
        pointHoverRadius: typePoints.map(point => {
          const range = maxRecordCount > 0 ? maxRecordCount : 1
          const baseRadius = isMobile
            ? 6 + ((point.recordCount / range) * 4)
            : 8 + ((point.recordCount / range) * 4)
          return baseRadius + 2 // Hover esetén nagyobb
        }),
        borderWidth: 2,
      }
    }).filter(dataset => dataset.data.length > 0) // Csak azokat az adattípusokat, amelyeknek vannak pontjai

    return {
      datasets,
    }
  }, [data, dataTypes, isMobile])

  // Chart opciók memoizálva
  const chartOptions = useMemo(() => {
    const maxFishCount = data.length > 0
      ? Math.max(...data.map(point => point.totalFishCount))
      : 10

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false, // Nincs legend, mert minden adattípus egy helyen van
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
          displayColors: true,
          callbacks: {
            title: (context: any[]) => {
              if (context.length > 0) {
                const point = context[0].raw as any
                if (point && point.dataType) {
                  const config = getDataTypeConfig(point.dataType)
                  return config.label
                }
              }
              return ''
            },
            label: (context: any) => {
              const point = context.raw as any

              if (!point || !point.dataType) return ''

              const config = getDataTypeConfig(point.dataType)
              const levelDescription = getLevelDescription(point.level, point.dataType)
              const decimals = point.dataType === 'pressure' ? 0 :
                point.dataType === 'airTemperature' || point.dataType === 'waterTemperature' ? 1 : 0

              return [
                `Szint: ${levelDescription} (${point.level})`,
                `Fogások: ${point.y}`,
                `Rekordok: ${point.recordCount}`,
                `Átlagos érték: ${point.avgValue.toFixed(decimals)}${config.unit ? ` ${config.unit}` : ''}`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          min: -0.5,
          max: dataTypeLabels.length - 0.5,
          title: {
            display: true,
            text: 'Környezeti tényezők',
            font: {
              size: isMobile ? 12 : 14,
              weight: '600' as const,
            },
            color: '#1e293b',
          },
          ticks: {
            stepSize: 1,
            font: {
              size: isMobile ? 10 : 12,
            },
            color: '#64748b',
            maxRotation: isMobile ? 45 : 0,
            minRotation: isMobile ? 45 : 0,
            callback: function (value: any) {
              const index = Math.round(value)
              if (index >= 0 && index < dataTypeLabels.length) {
                return dataTypeLabels[index]
              }
              return ''
            },
          },
          grid: {
            color: '#E5E7EB',
            lineWidth: 0.5,
          },
        },
        y: {
          type: 'linear' as const,
          min: 0,
          max: Math.max(maxFishCount * 1.1, 10), // 10% padding, minimum 10
          title: {
            display: true,
            text: 'Fogásszám',
            font: {
              size: isMobile ? 12 : 14,
              weight: '600' as const,
            },
            color: '#1e293b',
          },
          ticks: {
            stepSize: 1,
            precision: 0,
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
    }
  }, [data, dataTypeLabels, chartData, isMobile])

  if (data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Nincs megjeleníthető adat
      </div>
    )
  }

  return (
    <div
      className="statistics-chart-scatter"
      style={{
        width: '100%',
        height: isMobile ? '350px' : '500px',
        position: 'relative',
      }}
    >
      <Scatter data={chartData} options={chartOptions as any} />
    </div>
  )
})


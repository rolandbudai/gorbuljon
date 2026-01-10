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
import type { MultiScaleDataPoint } from '../utils/statistics'
import { getLevelDescription } from '../utils/statistics'

// Chart.js regisztráció
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
)

interface StatisticsChartMultiScaleProps {
  data: MultiScaleDataPoint[]
}

export const StatisticsChartMultiScale = React.memo(function StatisticsChartMultiScale({ data }: StatisticsChartMultiScaleProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  
  // Chart adatok memoizálva
  // Minden adattípushoz létrehozunk egy dataset-et
  const chartData = useMemo(() => {
    // Összes fogásszám számítása a teljes normalizáláshoz
    const allFishCounts: number[] = []
    data.forEach(typeData => {
      typeData.values.forEach(v => allFishCounts.push(v.fishCount))
    })
    const globalMinFishCount = allFishCounts.length > 0 ? Math.min(...allFishCounts) : 1
    const globalMaxFishCount = allFishCounts.length > 0 ? Math.max(...allFishCounts) : 1
    const globalRange = globalMaxFishCount - globalMinFishCount
    
    const datasets = data.map((typeData, typeIndex) => {
      return {
        label: typeData.label,
        data: typeData.values.map(value => ({
          x: typeIndex, // X pozíció: adattípus index (category scale)
          y: value.normalizedValue, // Y pozíció: normalizált érték (0-100%)
        })),
        backgroundColor: typeData.values.map(v => v.color.bg),
        borderColor: typeData.values.map(v => v.color.border),
        borderWidth: 2,
        pointRadius: typeData.values.map(value => {
          // Pont méret: fogásszám alapján (5-30px sugár)
          return globalRange > 0 
            ? 5 + ((value.fishCount - globalMinFishCount) / globalRange) * 25 
            : 15
        }),
        pointHoverRadius: typeData.values.map(value => {
          const baseRadius = globalRange > 0 
            ? 5 + ((value.fishCount - globalMinFishCount) / globalRange) * 25 
            : 15
          return baseRadius + 3 // Hover esetén nagyobb
        }),
      }
    })
    
    return {
      datasets,
    }
  }, [data])
  
  // Chart opciók memoizálva
  const chartOptions = useMemo(() => {
    const labels = data.map(d => d.label)
    
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
                const datasetIndex = context[0].datasetIndex
                const dataIndex = context[0].dataIndex
                const typeData = data[datasetIndex]
                if (typeData) {
                  return typeData.label
                }
              }
              return ''
            },
            label: (context: any) => {
              const datasetIndex = context.datasetIndex
              const dataIndex = context.dataIndex
              const typeData = data[datasetIndex]
              const value = typeData?.values[dataIndex]
              
              if (!value || !typeData) return ''
              
              const decimals = typeData.dataType === 'pressure' ? 0 : 
                             typeData.dataType === 'airTemperature' || typeData.dataType === 'waterTemperature' ? 1 : 0
              
              const levelDescription = getLevelDescription(value.level, typeData.dataType)
              
              return [
                `Érték: ${value.value.toFixed(decimals)}${typeData.unit ? ` ${typeData.unit}` : ''}`,
                `Szint: ${levelDescription || value.level}`,
                `Fogások: ${value.fishCount}`,
                `Normalizált: ${value.normalizedValue.toFixed(1)}%`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear' as const,
          min: -0.5,
          max: data.length - 0.5,
          title: {
            display: true,
            text: 'Adattípusok',
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
            callback: function(value: any) {
              const index = Math.round(value)
              if (index >= 0 && index < labels.length) {
                return labels[index]
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
          max: 100,
          title: {
            display: true,
            text: 'Normalizált érték (%)',
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
            callback: function(value: any) {
              return value + '%'
            },
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
      elements: {
        point: {
          hoverRadius: 8,
          hoverBorderWidth: 3,
        },
      },
    }
  }, [data, isMobile])
  
  if (data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        Nincs megjeleníthető adat
      </div>
    )
  }
  
  return (
    <div 
      className="statistics-chart-multiscale" 
      style={{ 
        width: '100%', 
        height: isMobile ? '400px' : '500px',
        position: 'relative',
      }}
    >
      <Scatter data={chartData} options={chartOptions} />
    </div>
  )
})


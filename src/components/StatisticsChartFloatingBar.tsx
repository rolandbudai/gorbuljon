import React, { useMemo } from 'react'
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
import type { FloatingBarChartDataPoint } from '../utils/statistics'
import { getDataTypeConfig, getLevelDescription } from '../utils/statistics'
import type { DataType } from '../utils/statistics'

// Chart.js regisztráció
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface StatisticsChartFloatingBarProps {
  data: FloatingBarChartDataPoint[]
}

export const StatisticsChartFloatingBar = React.memo(function StatisticsChartFloatingBar({ data }: StatisticsChartFloatingBarProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  
  // Chart adatok memoizálva
  const chartData = useMemo(() => {
    return {
      labels: data.map(point => point.label),
      datasets: [
        {
          label: 'Értéktartomány',
          data: data.map(point => point.data), // [min, max] tömbök
          backgroundColor: data.map(point => point.backgroundColor),
          borderColor: data.map(point => point.borderColor),
          borderWidth: 2,
        },
      ],
    }
  }, [data])
  
  // Chart opciók memoizálva
  const chartOptions = useMemo(() => {
    return {
      indexAxis: 'y' as const, // Horizontális bar-ok
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
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
                return context[0].label || ''
              }
              return ''
            },
            label: (context: any) => {
              const point = data[context.dataIndex]
              if (!point) return ''
              
              // Meghatározzuk az adattípust a label alapján
              const dataTypes = require('../utils/statistics').getAllDataTypes()
              const type = dataTypes.find((t: DataType) => {
                const config = getDataTypeConfig(t)
                return config.label === point.label
              }) as DataType | undefined
              
              if (!type) return ''
              
              const config = getDataTypeConfig(type)
              const decimals = type === 'pressure' ? 0 : 
                             type === 'airTemperature' || type === 'waterTemperature' ? 1 : 0
              
              const levelDescription = getLevelDescription(point.level, type)
              
              return [
                `Minimum: ${point.minValue.toFixed(decimals)}${config.unit ? ` ${config.unit}` : ''}`,
                `Maximum: ${point.maxValue.toFixed(decimals)}${config.unit ? ` ${config.unit}` : ''}`,
                `Átlag: ${point.avgValue.toFixed(decimals)}${config.unit ? ` ${config.unit}` : ''}`,
                `Szint: ${levelDescription || point.level}`,
                `Rekordok: ${point.recordCount}`,
                `Fogások: ${point.totalFishCount}`,
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
            text: 'Érték',
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
          type: 'category' as const,
          title: {
            display: true,
            text: 'Adattípus',
            font: {
              size: isMobile ? 12 : 14,
              weight: '600' as const,
            },
            color: '#1e293b',
          },
          ticks: {
            font: {
              size: isMobile ? 11 : 13,
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
        mode: 'index' as const,
      },
      onHover: (event: any, elements: any[]) => {
        if (elements.length > 0) {
          event.native.target.style.cursor = 'pointer'
        } else {
          event.native.target.style.cursor = 'default'
        }
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
      className="statistics-chart-floating-bar" 
      style={{ 
        width: '100%', 
        height: isMobile ? '400px' : '500px',
        position: 'relative',
      }}
    >
      <Bar data={chartData} options={chartOptions} />
    </div>
  )
})


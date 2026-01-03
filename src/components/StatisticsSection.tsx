import React from 'react'
import type { LocationRecord } from '../services/records'
import { prepareD3Data } from '../utils/statistics'
import { StatisticsChart } from './StatisticsChart'

interface StatisticsSectionProps {
  records: LocationRecord[]
  onClose: () => void
}

export function StatisticsSection({ records, onClose }: StatisticsSectionProps) {
  const data = prepareD3Data(records)
  
  return (
    <div className="statistics-section">
      <div className="statistics-header">
        <h2>Statisztikák</h2>
        <button
          onClick={onClose}
          className="statistics-close-btn"
          aria-label="Bezárás"
        >
          ×
        </button>
      </div>
      
      {records.length === 0 ? (
        <p className="statistics-empty">Nincs mentett rekord a statisztikák megjelenítéséhez.</p>
      ) : (
        <div className="statistics-content">
          <p className="statistics-description">
            Az alábbi diagram az összes mentett rekord adatait mutatja. Minden adattípusnak saját vertikális skálája van, 
            ahol a kék pontok jelzik a mentett értékeket.
          </p>
          <StatisticsChart data={data} />
        </div>
      )}
    </div>
  )
}


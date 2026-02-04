import { useState } from 'react'
import type { LocationRecord } from '../services/records'
import { FishSuccessView } from './statistics/FishSuccessView'
import { FishTypeAnalysis } from './statistics/FishTypeAnalysis'
import { StatsSummaryCards } from './statistics/StatsSummaryCards'
import { EnvironmentalCorrelation } from './statistics/EnvironmentalCorrelation'

interface StatisticsSectionProps {
  records: LocationRecord[]
  onClose: () => void
}

type StatView = 'success' | 'fishType' | 'summary' | 'correlation'

export function StatisticsSection({ records, onClose }: StatisticsSectionProps) {
  const [activeView, setActiveView] = useState<StatView>('summary')

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
        <>
          <div className="statistics-tabs">
            <button
              className={`stat-tab ${activeView === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveView('summary')}
            >
              <span className="tab-icon">📋</span>
              <span className="tab-label">Összefoglaló</span>
            </button>
            <button
              className={`stat-tab ${activeView === 'success' ? 'active' : ''}`}
              onClick={() => setActiveView('success')}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-label">Fogási Sikeresség</span>
            </button>
            <button
              className={`stat-tab ${activeView === 'fishType' ? 'active' : ''}`}
              onClick={() => setActiveView('fishType')}
            >
              <span className="tab-icon">🐟</span>
              <span className="tab-label">Halfaj Elemzés</span>
            </button>
            <button
              className={`stat-tab ${activeView === 'correlation' ? 'active' : ''}`}
              onClick={() => setActiveView('correlation')}
            >
              <span className="tab-icon">🔥</span>
              <span className="tab-label">Korreláció</span>
            </button>
          </div>

          <div className="statistics-content">
            {activeView === 'summary' && <StatsSummaryCards records={records} />}
            {activeView === 'success' && <FishSuccessView records={records} />}
            {activeView === 'fishType' && <FishTypeAnalysis records={records} />}
            {activeView === 'correlation' && <EnvironmentalCorrelation records={records} />}
          </div>
        </>
      )}
    </div>
  )
}

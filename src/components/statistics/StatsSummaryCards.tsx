import { useMemo } from 'react'
import type { LocationRecord } from '../../services/records'
import { calculateFishCatchStats, findBestConditions } from '../../utils/fishStatistics'
import { getLevelDescription, getDataTypeConfig } from '../../utils/statistics'

interface StatsSummaryCardsProps {
    records: LocationRecord[]
}

export function StatsSummaryCards({ records }: StatsSummaryCardsProps) {
    const stats = useMemo(() => calculateFishCatchStats(records), [records])
    const bestConditions = useMemo(() => findBestConditions(records).slice(0, 5), [records])

    const topFishTypes = useMemo(() => {
        return Object.entries(stats.fishTypeBreakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
    }, [stats.fishTypeBreakdown])

    const totalFishTypes = Object.keys(stats.fishTypeBreakdown).length

    if (records.length === 0) {
        return (
            <div className="stats-summary-cards">
                <div className="summary-empty">
                    <p>Nincs mentett rekord a statisztikák megjelenítéséhez.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="stats-summary-cards">
            <div className="summary-header">
                <h3 className="summary-title">Összefoglaló Statisztikák</h3>
                <p className="summary-description">
                    Gyors áttekintés a legfontosabb fogási adatokról és körülményekről.
                </p>
            </div>

            <div className="summary-grid">
                {/* Összesített Statisztikák */}
                <div className="summary-card highlight-card">
                    <div className="card-icon">📊</div>
                    <h4 className="card-title">Összesített Adatok</h4>
                    <div className="card-stats">
                        <div className="stat-row">
                            <span className="stat-label">Összes fogás:</span>
                            <span className="stat-value primary">{stats.totalCatches} db</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Összes horgászat:</span>
                            <span className="stat-value">{stats.totalRecords} alkalom</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Átlag fogás/alkalom:</span>
                            <span className="stat-value">{stats.averageCatchPerRecord.toFixed(1)} db</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Halfaj típusok:</span>
                            <span className="stat-value">{totalFishTypes} féle</span>
                        </div>
                    </div>
                </div>

                {/* Top Halfajok */}
                <div className="summary-card">
                    <div className="card-icon">🐟</div>
                    <h4 className="card-title">Top Halfajok</h4>
                    <div className="card-content">
                        {topFishTypes.length > 0 ? (
                            <div className="fish-list">
                                {topFishTypes.map(([fish, count], index) => {
                                    const percentage = ((count / stats.totalCatches) * 100).toFixed(0)
                                    return (
                                        <div key={fish} className="fish-item">
                                            <div className="fish-rank">{index + 1}.</div>
                                            <div className="fish-info">
                                                <div className="fish-name">{fish.charAt(0).toUpperCase() + fish.slice(1)}</div>
                                                <div className="fish-stats-bar">
                                                    <div className="fish-bar" style={{ width: `${percentage}%` }} />
                                                </div>
                                            </div>
                                            <div className="fish-count">
                                                {count} db<span className="fish-percent">({percentage}%)</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="card-empty">Nincs halfaj adat</p>
                        )}
                    </div>
                </div>

                {/* Legjobb Körülmények */}
                <div className="summary-card">
                    <div className="card-icon">🌟</div>
                    <h4 className="card-title">Legjobb Körülmények</h4>
                    <div className="card-content">
                        {bestConditions.length > 0 ? (
                            <div className="conditions-list">
                                {bestConditions.map((condition) => {
                                    const config = getDataTypeConfig(condition.dataType)
                                    const description = getLevelDescription(condition.level, condition.dataType)
                                    return (
                                        <div key={condition.dataType} className="condition-row">
                                            <div className="condition-name">{config.label}</div>
                                            <div className="condition-detail">
                                                <span className="condition-level-badge">
                                                    {condition.level > 0 ? '+' : ''}{condition.level}
                                                </span>
                                                <span className="condition-desc">{description}</span>
                                            </div>
                                            <div className="condition-catches">{condition.catchCount} fogás</div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="card-empty">Nincs adat</p>
                        )}
                    </div>
                </div>

                {/* Legjobb Nap és Helyszín */}
                <div className="summary-card">
                    <div className="card-icon">🏆</div>
                    <h4 className="card-title">Rekordok</h4>
                    <div className="card-content">
                        <div className="record-item">
                            <div className="record-label">🗓️ Legjobb nap</div>
                            {stats.bestDay ? (
                                <div className="record-value">
                                    <div className="record-primary">{stats.bestDay.date}</div>
                                    <div className="record-secondary">{stats.bestDay.count} db hal</div>
                                </div>
                            ) : (
                                <div className="record-value">
                                    <div className="record-empty">Nincs adat</div>
                                </div>
                            )}
                        </div>
                        <div className="record-divider" />
                        <div className="record-item">
                            <div className="record-label">📍 Legjobb helyszín</div>
                            {stats.bestLocation ? (
                                <div className="record-value">
                                    <div className="record-primary">{stats.bestLocation.name}</div>
                                    <div className="record-secondary">{stats.bestLocation.count} db hal</div>
                                </div>
                            ) : (
                                <div className="record-value">
                                    <div className="record-empty">Nincs adat</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

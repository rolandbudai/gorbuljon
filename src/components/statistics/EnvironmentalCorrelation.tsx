import { useMemo } from 'react'
import type { LocationRecord } from '../../services/records'
import { aggregateCatchesByEnvironment } from '../../utils/fishStatistics'
import { getLevelDescription, getDataTypeConfig, getAllDataTypes } from '../../utils/statistics'

interface EnvironmentalCorrelationProps {
    records: LocationRecord[]
}

export function EnvironmentalCorrelation({ records }: EnvironmentalCorrelationProps) {
    const dataTypes = getAllDataTypes()

    // Aggregáljuk az összes környezeti tényező adatait
    const correlationData = useMemo(() => {
        return dataTypes.map(dataType => {
            const data = aggregateCatchesByEnvironment(records, dataType)
            return {
                dataType,
                categories: data.categories,
            }
        })
    }, [records, dataTypes])

    // Meghatározzuk a maximum fogásszámot a színskálához
    const maxCatches = useMemo(() => {
        let max = 0
        correlationData.forEach(row => {
            row.categories.forEach(cat => {
                if (cat.catchCount > max) max = cat.catchCount
            })
        })
        return max
    }, [correlationData])

    // Színintenzitás számítása
    const getColorIntensity = (catchCount: number): string => {
        if (catchCount === 0) return '#f8fafc'
        const intensity = Math.min(catchCount / maxCatches, 1)

        // Kék színskála
        if (intensity < 0.2) return '#dbeafe'
        if (intensity < 0.4) return '#bfdbfe'
        if (intensity < 0.6) return '#93c5fd'
        if (intensity < 0.8) return '#60a5fa'
        return '#3b82f6'
    }

    if (records.length === 0) {
        return (
            <div className="environmental-correlation">
                <div className="correlation-empty">
                    <p>Nincs mentett rekord a statisztikák megjelenítéséhez.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="environmental-correlation">
            <div className="correlation-header">
                <h3 className="correlation-title">Környezeti Korreláció</h3>
                <p className="correlation-description">
                    Melyik környezeti kategóriában hány fogás volt? A sötétebb színek több fogást jeleznek.
                </p>
            </div>

            {/* Legend */}
            <div className="correlation-legend">
                <span className="legend-label">Fogások száma:</span>
                <div className="legend-scale">
                    <div className="legend-item">
                        <div className="legend-box" style={{ backgroundColor: '#f8fafc' }} />
                        <span>0</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-box" style={{ backgroundColor: '#dbeafe' }} />
                        <span>Kevés</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-box" style={{ backgroundColor: '#93c5fd' }} />
                        <span>Közepes</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-box" style={{ backgroundColor: '#3b82f6' }} />
                        <span>Sok ({maxCatches})</span>
                    </div>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="correlation-grid-container">
                <div className="correlation-grid">
                    {/* Header Row - Kategóriák */}
                    <div className="grid-header-cell"></div>
                    {[-3, -2, -1, 0, 1, 2, 3].map(level => (
                        <div key={level} className="grid-header-cell category-header">
                            {level > 0 ? '+' : ''}{level}
                        </div>
                    ))}

                    {/* Data Rows */}
                    {correlationData.map(row => {
                        const config = getDataTypeConfig(row.dataType)

                        return (
                            <div key={row.dataType} className="grid-row">
                                {/* Row Header - Tényező neve */}
                                <div className="grid-row-header">
                                    {config.label}
                                </div>

                                {/* Data Cells */}
                                {row.categories.map(cat => {
                                    const color = getColorIntensity(cat.catchCount)
                                    const description = getLevelDescription(cat.level, row.dataType)

                                    return (
                                        <div
                                            key={cat.level}
                                            className="grid-cell"
                                            style={{ backgroundColor: color }}
                                            title={`${config.label}: ${description}\nFogások: ${cat.catchCount} db\nRekordok: ${cat.recordCount} db${cat.recordCount > 0 ? `\nÁtlag: ${cat.averageCatchPerRecord.toFixed(1)} fogás/rekord` : ''}`}
                                        >
                                            <span className="cell-value">{cat.catchCount > 0 ? cat.catchCount : ''}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Summary */}
            <div className="correlation-summary">
                <div className="summary-stat">
                    <span className="summary-label">Összes fogás:</span>
                    <span className="summary-value">
                        {correlationData.reduce((sum, row) =>
                            sum + row.categories.reduce((s, cat) => s + cat.catchCount, 0), 0
                        )} db
                    </span>
                </div>
                <div className="summary-stat">
                    <span className="summary-label">Legtöbb fogás egy kategóriában:</span>
                    <span className="summary-value">{maxCatches} db</span>
                </div>
            </div>
        </div>
    )
}

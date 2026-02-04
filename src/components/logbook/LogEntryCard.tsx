import React, { useState } from 'react'
import type { LocationRecord } from '../../services/records'

interface LogEntryCardProps {
    record: LocationRecord
    onDelete: (id: string) => void
    onEdit?: (record: LocationRecord) => void
}

export const LogEntryCard: React.FC<LogEntryCardProps> = ({ record, onDelete, onEdit }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    // Format catch summary
    const getCatchSummary = () => {
        if (!record.caughtFish) return 'Nincs rögzített fogás'
        if (Array.isArray(record.caughtFish)) {
            return record.caughtFish.join(', ') || 'Nincs rögzített fogás'
        }
        const entries = Object.entries(record.caughtFish)
        if (entries.length === 0) return 'Nincs rögzített fogás'
        return entries.map(([fish, count]) => `${count}db ${fish}`).join(', ')
    }

    // Format date
    const dateStr = record.date ? record.date.replace(/\./g, '. ') : 'Ismeretlen dátum'
    const timeStr = record.time ? record.time : ''

    return (
        <div
            className="log-entry-card"
            style={{
                backgroundColor: '#FFFFF7', // Papír szín
                borderRadius: '0.75rem',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                marginBottom: '1rem',
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Header / Summary View */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#0d9488',
                            backgroundColor: '#ccfbf1',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '999px',
                        }}>
                            {dateStr} {timeStr}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                            {record.locationName}
                        </h3>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
                        🐟 {getCatchSummary()}
                    </div>
                </div>

                {/* Quick Stats or Chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>

                    <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        ▼
                    </span>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div style={{
                    padding: '0 1rem 1rem 1rem',
                    borderTop: '1px solid #f1f5f9',
                    marginTop: '0.5rem',
                    paddingTop: '1rem'
                }}>
                    {/* Details Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>




                        {/* Other Conditions */}
                        {record.otherConditions && (
                            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', gridColumn: '1 / -1' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#64748b' }}>Egyéb körülmények</h4>
                                <div style={{ fontSize: '0.95rem', fontWeight: 600, whiteSpace: 'pre-wrap', color: '#334155' }}>
                                    {record.otherConditions}
                                </div>
                            </div>
                        )}

                        {/* Other stats could go here */}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(record.id)
                            }}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '0.375rem',
                                border: '1px solid #ef4444',
                                backgroundColor: 'transparent',
                                color: '#ef4444',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#ef4444'
                                e.currentTarget.style.color = 'white'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                                e.currentTarget.style.color = '#ef4444'
                            }}
                        >
                            Törlés
                        </button>
                        {/* Edit button placeholder - using onEdit to suppress lint if needed, or implement */}
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit(record)
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.375rem',
                                    border: '1px solid #3b82f6',
                                    color: '#3b82f6',
                                    backgroundColor: 'transparent',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6'
                                    e.currentTarget.style.color = 'white'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                    e.currentTarget.style.color = '#3b82f6'
                                }}
                            >
                                📂 Megnyitás
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


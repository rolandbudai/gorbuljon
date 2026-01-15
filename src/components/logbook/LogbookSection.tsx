import React, { useMemo, useState } from 'react'
import type { LocationRecord } from '../../services/records'
import { LogEntryCard } from './LogEntryCard'

interface LogbookSectionProps {
    isOpen: boolean
    onClose: () => void
    records: LocationRecord[]
    onDeleteRecord: (id: string) => void
    onEditRecord?: (record: LocationRecord) => void
}

export const LogbookSection: React.FC<LogbookSectionProps> = ({
    isOpen,
    onClose,
    records,
    onDeleteRecord,
    onEditRecord
}) => {
    // Local state for filters
    const [filterYear, setFilterYear] = useState<string>('')
    const [filterLocation, setFilterLocation] = useState<string>('')

    // Calculate available years for filter
    const availableYears = useMemo(() => {
        const years = new Set(records.map(r => r.date?.split('.')[0]).filter(Boolean))
        return Array.from(years).sort((a, b) => Number(b) - Number(a))
    }, [records])

    // Calculate available locations for filter
    const availableLocations = useMemo(() => {
        const locs = new Set(records.map(r => r.locationName).filter(Boolean))
        return Array.from(locs).sort()
    }, [records])

    // Filter logic
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            // Year filter
            if (filterYear) {
                const year = record.date?.split('.')[0]
                if (year !== filterYear) return false
            }

            // Location filter
            if (filterLocation) {
                if (record.locationName !== filterLocation) return false
            }

            return true
        })
    }, [records, filterYear, filterLocation])

    if (!isOpen) return null

    return (
        <div className="logbook-modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
        }}>
            <div className="logbook-modal-content" style={{
                backgroundColor: '#FFFFF7',
                width: '100%',
                maxWidth: '800px',
                height: '90vh',
                borderRadius: '1rem',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>Fogási Napló</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                            {filteredRecords.length} / {records.length} rögzített horgászat
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.5rem',
                            border: 'none',
                            background: '#e2e8f0',
                            cursor: 'pointer',
                            color: '#475569',
                            fontWeight: 'bold',
                        }}
                    >
                        ✕ Bezárás
                    </button>
                </div>

                {/* Toolbar / Filters */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    backgroundColor: '#ffffff',
                    alignItems: 'center',
                }}>
                    {/* Year Filter */}
                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            minWidth: '120px',
                        }}
                    >
                        <option value="">Összes év</option>
                        {availableYears.map(year => (
                            <option key={year} value={year as string}>{year}</option>
                        ))}
                    </select>

                    {/* Location Filter */}
                    <select
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        style={{
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.875rem',
                            minWidth: '160px',
                            maxWidth: '200px',
                        }}
                    >
                        <option value="">Összes helyszín</option>
                        {availableLocations.map(loc => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>

                    {(filterYear || filterLocation) && (
                        <button
                            onClick={() => { setFilterYear(''); setFilterLocation('') }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                textDecoration: 'underline',
                            }}
                        >
                            Szűrők törlése
                        </button>
                    )}
                </div>

                {/* Scrollable List Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.5rem',
                    backgroundColor: '#f1f5f9', // Slightly darker list background
                }}>
                    {filteredRecords.length > 0 ? (
                        filteredRecords.map(record => (
                            <LogEntryCard
                                key={record.id}
                                record={record}
                                onDelete={onDeleteRecord}
                                onEdit={onEditRecord}
                            />
                        ))
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            color: '#94a3b8',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <span style={{ fontSize: '3rem' }}>📝</span>
                            <p>Nincs a szűrésnek megfelelő bejegyzés.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

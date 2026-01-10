import React from 'react'
import type { DataType } from '../utils/statistics'
import { getAllDataTypes, getDataTypeConfig } from '../utils/statistics'

interface AxisSelectorProps {
  xAxisType: DataType
  yAxisType: DataType
  onXAxisChange: (type: DataType) => void
  onYAxisChange: (type: DataType) => void
}

export const AxisSelector = React.memo(function AxisSelector({ xAxisType, yAxisType, onXAxisChange, onYAxisChange }: AxisSelectorProps) {
  const dataTypes = getAllDataTypes()
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  
  return (
    <div 
      className="axis-selector" 
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '12px' : '20px',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '20px',
        padding: isMobile ? '12px' : '16px',
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
        borderRadius: '8px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: isMobile ? '100%' : '200px' }}>
        <label 
          htmlFor="x-axis-select"
          style={{
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '600',
            color: '#1e293b',
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          X tengely:
        </label>
        <select
          id="x-axis-select"
          value={xAxisType}
          onChange={(e) => onXAxisChange(e.target.value as DataType)}
          style={{
            padding: '8px 12px',
            fontSize: isMobile ? '13px' : '14px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#1e293b',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {dataTypes.map((type) => {
            const config = getDataTypeConfig(type)
            return (
              <option key={type} value={type}>
                {config.label}
              </option>
            )
          })}
        </select>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: isMobile ? '100%' : '200px' }}>
        <label 
          htmlFor="y-axis-select"
          style={{
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '600',
            color: '#1e293b',
            textAlign: isMobile ? 'center' : 'left',
          }}
        >
          Y tengely:
        </label>
        <select
          id="y-axis-select"
          value={yAxisType}
          onChange={(e) => onYAxisChange(e.target.value as DataType)}
          style={{
            padding: '8px 12px',
            fontSize: isMobile ? '13px' : '14px',
            borderRadius: '6px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#FFFFFF',
            color: '#1e293b',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {dataTypes.map((type) => {
            const config = getDataTypeConfig(type)
            return (
              <option key={type} value={type}>
                {config.label}
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
})


import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { D3DataTypeData } from '../utils/statistics'
import { getAllDataTypes, getDataTypeConfig } from '../utils/statistics'

interface StatisticsChartProps {
  data: D3DataTypeData[]
}

/**
 * Reszponzív font méret számítása
 */
function getResponsiveFontSize(
  isMobile: boolean,
  minSize: number,
  maxSize: number,
  divisor: number
): number {
  const baseSize = window.innerWidth / divisor
  return Math.max(minSize, Math.min(maxSize, baseSize))
}

/**
 * Skála tartomány számítása az értékek alapján (egyszerűsített, padding nélkül)
 */
function calculateScaleDomain(
  values: number[],
  configMin: number,
  configMax: number,
  avgValue: number
): { min: number; max: number } {
  const actualMin = values.length > 0 ? Math.min(...values) : configMin
  const actualMax = values.length > 0 ? Math.max(...values) : configMax
  
  const minValue = Math.min(actualMin, configMin)
  const maxValue = Math.max(actualMax, configMax, avgValue)
  const range = maxValue - minValue
  
  return {
    min: minValue,
    max: range > 0 ? maxValue : minValue + 1 // Ensure a range for single values
  }
}

/**
 * Átlagos érték számítása
 */
function calculateAverage(values: number[], fallback: number): number {
  return values.length > 0 
    ? values.reduce((sum, v) => sum + v, 0) / values.length 
    : fallback
}

/**
 * Tizedesjegyek számának meghatározása adattípus alapján
 */
function getDecimals(type: string): number {
  if (type === 'pressure') return 0
  if (type === 'airTemperature' || type === 'waterTemperature') return 1
  return 0
}

/**
 * Gradient szín számítása az érték pozíciója alapján a skálán
 * Low values: kék színek, High values: piros/narancs színek
 */
function getGradientColor(valuePosition: number): string {
  // Clamp value position between 0 and 1
  const clamped = Math.max(0, Math.min(1, valuePosition))
  
  // Interpolate between blue (low) and red/orange (high)
  const lowColor = d3.rgb('#3B82F6') // Blue
  const midColor = d3.rgb('#FACC15') // Yellow
  const highColor = d3.rgb('#F97316') // Orange
  
  if (clamped < 0.5) {
    // Interpolate between blue and yellow
    return d3.interpolateRgb(lowColor, midColor)(clamped * 2).toString()
  } else {
    // Interpolate between yellow and orange
    return d3.interpolateRgb(midColor, highColor)((clamped - 0.5) * 2).toString()
  }
}

export function StatisticsChart({ data }: StatisticsChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || data.length === 0) return
    
    const renderChart = () => {
      // Töröljük a korábbi tartalmat
      d3.select(svgRef.current).selectAll('*').remove()
    
      const dataTypes = getAllDataTypes()
      const chartData = dataTypes.map((type) => {
        const typeData = data.find(d => d.type === type)
        return {
          type,
          label: typeData?.label || getDataTypeConfig(type).label,
          unit: typeData?.unit || getDataTypeConfig(type).unit,
          min: typeData?.min || getDataTypeConfig(type).min,
          max: typeData?.max || getDataTypeConfig(type).max,
          values: typeData?.values || [],
        }
      }).filter(item => item.values.length > 0)
      
      if (chartData.length === 0) return
      
      const isMobile = window.innerWidth <= 768
      const chartHeight = 500
      
      const chartPadding = { 
        top: 50, 
        right: 20, 
        bottom: 80,  // Címkék zóna
        left: isMobile ? 50 : 70  // Skála címkékhez
      }
      
      const barWidth = isMobile ? 40 : 60
      const barGap = isMobile ? 15 : 25
      const chartWidth = chartData.length * (barWidth + barGap) + chartPadding.left + chartPadding.right
      
      const svg = d3.select(svgRef.current)
        .attr('viewBox', `0 0 ${chartWidth} ${chartHeight + chartPadding.top + chartPadding.bottom}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('width', '100%')
        .style('height', 'auto')
        .style('min-height', `${chartHeight + chartPadding.top + chartPadding.bottom}px`)
        .style('display', 'block')
      
      const xScale = d3.scaleBand()
        .domain(chartData.map(d => d.type))
        .range([chartPadding.left, chartWidth - chartPadding.right])
        .padding(0.3)
      
      // Minden adattípushoz külön Y-tengely skála létrehozása
      const scaleData = new Map<string, {
        scale: d3.ScaleLinear<number, number>
        domain: { min: number; max: number }
        avgValue: number
        actualValues: number[]
      }>()
      
      chartData.forEach((typeData) => {
        const actualValues = typeData.values.map(v => v.value)
        const avgValue = calculateAverage(actualValues, typeData.min)
        const domain = calculateScaleDomain(actualValues, typeData.min, typeData.max, avgValue)
        
        const yScale = d3.scaleLinear()
          .domain([domain.min, domain.max])
          .range([chartHeight, chartPadding.top])
        
        scaleData.set(typeData.type, {
          scale: yScale,
          domain,
          avgValue,
          actualValues
        })
      })
      
      // ===== ZÓNA 1: Y-tengelyek renderelése háttérben =====
      chartData.forEach((typeData) => {
        const x = xScale(typeData.type)
        if (x === undefined) return
        
        const scaleInfo = scaleData.get(typeData.type)
        if (!scaleInfo) return
        
        const typeYScale = scaleInfo.scale
        const axisX = x + xScale.bandwidth() / 2
        const tickCount = isMobile ? 4 : 6
        const decimals = getDecimals(typeData.type)
        
        // Y tengely létrehozása
        const yAxis = d3.axisLeft(typeYScale)
          .ticks(tickCount)
          .tickFormat((d) => {
            return `${Number(d).toFixed(decimals)}${typeData.unit ? ` ${typeData.unit}` : ''}`
          })
        
        const yAxisGroup = svg.append('g')
          .attr('transform', `translate(${axisX}, 0)`)
          .attr('class', 'y-axis-background')
          .style('pointer-events', 'none')
          .call(yAxis)
        
        // Tengely vonal
        yAxisGroup.select('.domain')
          .attr('stroke', '#94a3b8')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.6)
        
        // Grid vonalak - csak az oszlop szélességében
        const halfBarWidth = xScale.bandwidth() / 2
        yAxisGroup.selectAll('.tick line')
          .attr('stroke', '#E2E8F0')
          .attr('stroke-width', 0.5)
          .attr('stroke-opacity', 0.3)
          .attr('x1', -halfBarWidth)
          .attr('x2', halfBarWidth)
        
        // Tick szövegek
        const tickFontSize = getResponsiveFontSize(isMobile, 11, 16, isMobile ? 25 : 40)
        const labelOffset = -halfBarWidth - (isMobile ? 6 : 8)
        
        yAxisGroup.selectAll('text')
          .attr('font-size', tickFontSize)
          .attr('fill', '#475569')
          .attr('font-weight', 600)
          .attr('dx', labelOffset)
          .attr('text-anchor', 'end')
          .style('pointer-events', 'none')
          .style('user-select', 'none')
      })
      
      // ===== ZÓNA 2: Oszlopok renderelése =====
      chartData.forEach((typeData) => {
        const x = xScale(typeData.type)
        if (x === undefined) return
        
        const scaleInfo = scaleData.get(typeData.type)
        if (!scaleInfo) return
        
        const yScale = scaleInfo.scale
        const domain = scaleInfo.domain
        const avgValue = scaleInfo.avgValue
        
        // Oszlop pozíció és méret
        const barX = x
        const barWidth = xScale.bandwidth()
        const barY = yScale(avgValue)
        const barHeight = chartHeight - barY
        
        // Gradient szín számítása az érték pozíciója alapján
        const valuePosition = (avgValue - domain.min) / (domain.max - domain.min)
        const barColor = getGradientColor(valuePosition)
        
        // Oszlop renderelése
        const bar = svg.append('rect')
          .attr('x', barX)
          .attr('y', barY)
          .attr('width', barWidth)
          .attr('height', 0)
          .attr('fill', barColor)
          .attr('stroke', '#1e293b')
          .attr('stroke-width', 1)
          .attr('rx', 4)
          .attr('ry', 4)
          .style('cursor', 'pointer')
          .attr('data-type', typeData.type)
          .attr('data-value', avgValue)
        
        // Animáció
        bar.transition()
          .duration(400)
          .attr('height', barHeight)
        
        // Hover animáció
        bar.on('mouseenter', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 0.8)
            .attr('stroke-width', 2)
        })
        .on('mouseleave', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('opacity', 1)
            .attr('stroke-width', 1)
        })
      })
      
      // ===== ZÓNA 3: Címkék renderelése vízszintesen az oszlopok alatt =====
      chartData.forEach((typeData) => {
        const x = xScale(typeData.type)
        if (x === undefined) return
        
        const labelX = x + xScale.bandwidth() / 2
        const labelY = chartHeight + chartPadding.top - 20
        
        const labelFontSize = getResponsiveFontSize(isMobile, 13, 18, isMobile ? 25 : 40)
        
        svg.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('font-size', labelFontSize)
          .attr('fill', '#1e293b')
          .attr('font-weight', 700)
          .style('pointer-events', 'none')
          .style('user-select', 'none')
          .text(typeData.label)
      })
      
      // ===== Tooltip létrehozása =====
      const tooltipFontSize = getResponsiveFontSize(isMobile, 13, 18, isMobile ? 25 : 35)
      const tooltipPadding = isMobile ? '12px 16px' : '14px 18px'
      
      let tooltip = d3.select('.statistics-tooltip')
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('class', 'statistics-tooltip')
          .style('position', 'absolute')
          .style('background-color', '#1e293b')
          .style('color', '#ffffff')
          .style('padding', tooltipPadding)
          .style('border-radius', '8px')
          .style('font-size', `${tooltipFontSize}px`)
          .style('font-weight', '500')
          .style('line-height', '1.5')
          .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)')
          .style('backdrop-filter', 'blur(10px)')
          .style('-webkit-backdrop-filter', 'blur(10px)')
          .style('opacity', 0)
          .style('pointer-events', 'none')
          .style('z-index', 10000)
          .style('transition', 'opacity 0.2s ease-in-out')
      } else {
        tooltip
          .style('font-size', `${tooltipFontSize}px`)
          .style('padding', tooltipPadding)
      }
      
      // Tooltip eseménykezelők az oszlopokhoz
      svg.selectAll('rect[data-type]')
        .on('mouseover', function(event) {
          const rect = d3.select(this)
          const type = rect.attr('data-type')
          const value = parseFloat(rect.attr('data-value'))
          
          const item = chartData.find(d => d.type === type)
          if (!item) return
          
          const scaleInfo = scaleData.get(type)
          if (!scaleInfo) return
          
          const decimals = getDecimals(type)
          const actualValues = scaleInfo.actualValues
          const minValue = actualValues.length > 0 ? Math.min(...actualValues) : item.min
          const maxValue = actualValues.length > 0 ? Math.max(...actualValues) : item.max
          
          const titleFontSize = getResponsiveFontSize(isMobile, 15, 20, isMobile ? 22 : 30)
          
          tooltip
            .html(`
              <div style="font-weight: 700; margin-bottom: 8px; font-size: ${titleFontSize}px;">${item.label}</div>
              <div style="margin-bottom: 5px; font-size: ${tooltipFontSize}px;">Átlagos érték: ${value.toFixed(decimals)}${item.unit ? ` ${item.unit}` : ''}</div>
              <div style="margin-bottom: 5px; font-size: ${tooltipFontSize}px;">Minimum: ${minValue.toFixed(decimals)}${item.unit ? ` ${item.unit}` : ''}</div>
              <div style="font-size: ${tooltipFontSize}px;">Maximum: ${maxValue.toFixed(decimals)}${item.unit ? ` ${item.unit}` : ''}</div>
            `)
            .transition()
            .duration(200)
            .style('opacity', 1)
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
        })
        .on('mouseout', function() {
          tooltip.transition()
            .duration(200)
            .style('opacity', 0)
        })
    }
    
    // Első renderelés
    renderChart()
    
    // Resize eseménykezelő
    const handleResize = () => {
      renderChart()
    }
    
    window.addEventListener('resize', handleResize)
    
    // Cleanup függvény
    return () => {
      window.removeEventListener('resize', handleResize)
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove()
      }
    }
  }, [data])
  
  if (data.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Nincs megjeleníthető adat</div>
  }
  
  return (
    <div ref={containerRef} className="statistics-chart" style={{ width: '100%', overflowX: 'auto' }}>
      <svg ref={svgRef}></svg>
    </div>
  )
}

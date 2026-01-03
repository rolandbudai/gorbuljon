import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { D3DataTypeData } from '../utils/statistics'
import { getAllDataTypes, getDataTypeConfig, getLevelDescription } from '../utils/statistics'

interface StatisticsChartProps {
  data: D3DataTypeData[]
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
      const chartPadding = { top: 40, right: 40, bottom: 80, left: 60 }
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
      
      // Normalizáljuk az értékeket 0-100 skálára minden adattípushoz
      // Az oszlop magassága a normalizált értékek összege lesz
      const maxStackHeight = 100 // Maximum normalizált összeg
      
      const yScale = d3.scaleLinear()
        .domain([0, maxStackHeight])
        .range([chartHeight, chartPadding.top])
      
      // Oszlop szín számítása az értékek számától függően
      const getBarColorByValueCount = (count: number, maxCount: number): string => {
        if (maxCount === 0) return '#E5E7EB'
        const ratio = count / maxCount
        
        // Gradiens: világos (#E5E7EB) → közepes (#9CA3AF) → sötét (#1E293B)
        if (ratio <= 0.33) return '#E5E7EB' // Világos
        if (ratio <= 0.66) return '#9CA3AF' // Közepes
        return '#1E293B' // Sötét
      }
      
      // Maximum értékek száma minden oszlopban
      const maxValueCount = Math.max(...chartData.map(d => d.values.length))
      
      // Opacity számítás függvény a fogásszám alapján
      const getOpacityByFishCount = (fishCount: number, maxFishCount: number): number => {
        if (maxFishCount === 0) return 0.3
        const ratio = fishCount / maxFishCount
        // Minimum opacity: 0.3, Maximum opacity: 1.0
        // Lineáris skálázás: 0.3 + (ratio * 0.7)
        return Math.max(0.3, Math.min(1.0, 0.3 + (ratio * 0.7)))
      }
      
      // Rendereljük a stacked bar-okat
      chartData.forEach((typeData) => {
        // Maximum fogásszám számítása az adott oszlopban
        const maxFishCountForType = Math.max(
          ...typeData.values.map(v => v.fishCount),
          1 // Minimum 1, hogy elkerüljük a 0-val való osztást
        )
        const x = xScale(typeData.type)
        if (x === undefined) return
        
        const range = typeData.max - typeData.min
        let yOffset = chartHeight
        
        // Normalizáljuk az értékeket és számoljuk az összeget
        // Fényváltás esetén külön kezelés: minden érték ugyanolyan magas legyen, hogy látható legyen
        let normalizedValues = typeData.values.map(v => {
          let normalized: number
          if (typeData.type === 'lightChange') {
            // Fényváltás esetén ideiglenes érték, később módosítjuk
            normalized = 50
          } else {
            normalized = range > 0 ? ((v.value - typeData.min) / range) * 100 : 50
          }
          return {
            ...v,
            normalizedValue: Math.max(0, Math.min(100, normalized)),
          }
        })
        
        // Fényváltás esetén az oszlop magasságát úgy állítjuk be, hogy minden réteg látható legyen
        if (typeData.type === 'lightChange' && normalizedValues.length > 0) {
          // Minden réteg egyenlő magasságú: 100% / értékek száma
          // Minimum magasság: ha csak 1-2 érték van, akkor is legyen látható (minimum 50% oszlop magasság)
          const minTotalHeight = 50 // Minimum 50% oszlop magasság
          const calculatedHeight = 100 // Teljes magasság
          const totalNormalized = Math.max(minTotalHeight, calculatedHeight)
          const layerHeight = totalNormalized / normalizedValues.length
          
          normalizedValues = normalizedValues.map(v => ({
            ...v,
            normalizedValue: layerHeight,
          }))
        }
        
        // Oszlop magasság egyenletesítése: minden oszlopban a normalizált értékek összege legyen 100%
        // Ez biztosítja, hogy minden oszlop ugyanolyan magas legyen
        const currentTotal = normalizedValues.reduce((sum, v) => sum + v.normalizedValue, 0)
        if (currentTotal > 0) {
          // Skálázzuk az értékeket úgy, hogy az összegük 100% legyen
          const scaleFactor = maxStackHeight / currentTotal
          normalizedValues = normalizedValues.map(v => ({
            ...v,
            normalizedValue: v.normalizedValue * scaleFactor,
          }))
        }
        
        // Oszlop háttérszíne az értékek számától függően
        const barBackgroundColor = getBarColorByValueCount(typeData.values.length, maxValueCount)
        
        // Oszlop háttér réteg (overlay)
        const totalHeight = normalizedValues.reduce((sum, v) => {
          const layerHeight = (v.normalizedValue / maxStackHeight) * (chartHeight - chartPadding.top)
          return sum + layerHeight
        }, 0)
        
        if (totalHeight > 0) {
          svg.append('rect')
            .attr('x', x)
            .attr('y', chartHeight - totalHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', totalHeight)
            .attr('fill', barBackgroundColor)
            .attr('opacity', 0.2) // Átlátszó overlay
            .attr('pointer-events', 'none')
        }
        
        // Kumulatív fogásszám számítása
        let cumulativeFishCount = 0
        
        // Legmagasabb fogásszámú réteg azonosítása az adott oszlopban
        const maxFishCountValue = normalizedValues.reduce((max, v) => Math.max(max, v.fishCount), 0)
        
        // Rétegek renderelése (alulról felfelé)
        normalizedValues.forEach((value, index) => {
          const layerHeight = (value.normalizedValue / maxStackHeight) * (chartHeight - chartPadding.top)
          cumulativeFishCount += value.fishCount
          
          // Opacity számítása a fogásszám alapján (az adott oszlop maximuma alapján)
          const layerOpacity = getOpacityByFishCount(value.fishCount, maxFishCountForType)
          
          // Ellenőrizzük, hogy ez a legmagasabb fogásszámú réteg-e
          const isMaxFishCount = value.fishCount === maxFishCountValue && maxFishCountValue > 0
          
          const layer = svg.append('rect')
            .attr('x', x)
            .attr('y', yOffset - layerHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', layerHeight)
            .attr('fill', value.color.bg)
            .attr('stroke', isMaxFishCount ? '#1E293B' : value.color.border) // Sötét keret a legmagasabb értéknél
            .attr('stroke-width', isMaxFishCount ? 3 : 1) // Vastagabb keret a legmagasabb értéknél
            .attr('opacity', layerOpacity)
            .attr('data-record-id', value.recordId)
            .attr('data-type', typeData.type)
            .attr('data-value', value.value)
            .attr('data-level', value.level)
            .attr('data-fish-count', cumulativeFishCount)
            .style('cursor', 'pointer')
            .style('transition', 'opacity 0.2s')
          
          // Fogásszám megjelenítése a rétegen belül
          if (layerHeight > 15 && cumulativeFishCount > 0) { // Csak ha elég magas a réteg és van fogás
            const textY = yOffset - layerHeight / 2
            
            // Szöveg színének meghatározása
            let textColor = '#000000' // Alapértelmezett fekete
            
            if (isMaxFishCount) {
              // Legmagasabb értéknél mindig fehér szín, hogy kontrasztos legyen
              textColor = '#FFFFFF'
            } else {
              // Szöveg színének meghatározása a háttér szín világossága alapján
              const bgColor = value.color.bg
              
              // HEX szín RGB értékeinek kinyerése
              const hex = bgColor.replace('#', '')
              if (hex.length === 6) {
                const r = parseInt(hex.substring(0, 2), 16)
                const g = parseInt(hex.substring(2, 4), 16)
                const b = parseInt(hex.substring(4, 6), 16)
                
                // Relatív világosság számítása (0-1 skála)
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
                
                // Ha a háttér sötét (luminance < 0.5), fehér szöveg
                if (luminance < 0.5) {
                  textColor = '#FFFFFF'
                }
              } else {
                // Ha nem 6 karakteres HEX, használjuk a level alapján
                textColor = value.level <= 0 ? '#FFFFFF' : '#000000'
              }
            }
            
            // Font méret és súly a legmagasabb értéknél
            const fontSize = isMaxFishCount 
              ? (isMobile ? 13 : 16) // Nagyobb font-size
              : (isMobile ? 9 : 11)
            const fontWeight = isMaxFishCount ? 900 : 700 // Vastagabb font-weight
            
            svg.append('text')
              .attr('x', x + xScale.bandwidth() / 2)
              .attr('y', textY)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', fontSize)
              .attr('font-weight', fontWeight)
              .attr('fill', textColor)
              .attr('pointer-events', 'none')
              .text(cumulativeFishCount.toString())
          }
          
          yOffset -= layerHeight
        })
        
        // Adattípus címke alul
        svg.append('text')
          .attr('x', x + xScale.bandwidth() / 2)
          .attr('y', chartHeight + chartPadding.top + 25)
          .attr('text-anchor', 'middle')
          .attr('font-size', isMobile ? 10 : 12)
          .attr('fill', '#1e293b')
          .attr('font-weight', 600)
          .text(typeData.label)
      })
      
      // Y tengely (normalizált értékek)
      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d}%`)
      
      svg.append('g')
        .attr('transform', `translate(${chartPadding.left}, 0)`)
        .call(yAxis)
        .selectAll('text')
        .attr('font-size', isMobile ? 9 : 10)
        .attr('fill', '#64748b')
      
      // Y tengely címke
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(chartHeight / 2))
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', isMobile ? 10 : 12)
        .attr('fill', '#64748b')
        .attr('font-weight', 600)
        .text('Normalizált érték (%)')
      
      // Tooltip létrehozása (csak ha még nincs)
      let tooltip = d3.select('.statistics-tooltip')
      if (tooltip.empty()) {
        tooltip = d3.select('body').append('div')
          .attr('class', 'statistics-tooltip')
          .style('position', 'absolute')
          .style('background-color', '#1e293b')
          .style('color', '#ffffff')
          .style('padding', '8px 12px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('box-shadow', '0 2px 8px rgba(0, 0, 0, 0.2)')
          .style('opacity', 0)
          .style('pointer-events', 'none')
          .style('z-index', 10000)
      }
      
      // Tooltip eseménykezelők
      svg.selectAll('rect[data-record-id]')
        .on('mouseover', function(event) {
          const rect = d3.select(this)
          const recordId = rect.attr('data-record-id')
          const type = rect.attr('data-type')
          const value = parseFloat(rect.attr('data-value'))
          const level = parseInt(rect.attr('data-level'))
          const originalOpacity = parseFloat(rect.attr('opacity')) || 1
          
          const item = chartData.find(d => d.type === type)
          if (!item) return
          
          const decimals = type === 'pressure' ? 0 : 
                          type === 'airTemperature' || type === 'waterTemperature' ? 1 : 0
          
          const levelDescription = getLevelDescription(level, type)
          const fishCount = parseInt(rect.attr('data-fish-count')) || 0
          
          tooltip
            .html(`
              <div style="font-weight: 600; margin-bottom: 4px;">${item.label}</div>
              <div>Érték: ${value.toFixed(decimals)}${item.unit ? ` ${item.unit}` : ''}</div>
              <div>Szint: ${levelDescription || level}</div>
              <div>Fogások: ${fishCount}</div>
            `)
            .style('opacity', 1)
          
          // Hover esetén kissé emeljük az opacity-t, de ne legyen túl erős
          rect.style('opacity', Math.min(1.0, originalOpacity + 0.2))
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
        })
        .on('mouseout', function() {
          const rect = d3.select(this)
          const originalOpacity = parseFloat(rect.attr('opacity')) || 1
          tooltip.style('opacity', 0)
          // Visszaállítjuk az eredeti opacity-t
          rect.style('opacity', originalOpacity)
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

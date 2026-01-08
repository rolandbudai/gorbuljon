import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { D3DataTypeData } from '../utils/statistics'
import { getAllDataTypes, getDataTypeConfig, getLevelDescription } from '../utils/statistics'

interface StatisticsChartProps {
  data: D3DataTypeData[]
}

// Helper függvények a modernizáláshoz

/**
 * Szín világosítása százalékos értékkel
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * (percent / 100)))
  const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * (percent / 100)))
  const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * (percent / 100)))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * Border radius meghatározása réteg pozíció alapján
 * SVG-ben a rect rx/ry minden sarkot lekerekít, ezért csak az első és utolsó rétegnél alkalmazzuk
 */
function getBorderRadius(layerIndex: number, totalLayers: number): { rx: number, ry: number } {
  if (totalLayers === 1) {
    return { rx: 4, ry: 4 } // Egyetlen réteg: minden sarok lekerekítve
  }
  // Csak az első (alsó) és utolsó (felső) rétegnél alkalmazunk lekerekítést
  if (layerIndex === 0 || layerIndex === totalLayers - 1) {
    return { rx: 4, ry: 4 }
  }
  return { rx: 0, ry: 0 } // Közbenső rétegek: nincs lekerekítés
}

/**
 * Gradiens létrehozása egy színhez
 */
function createGradientForColor(defs: d3.Selection<SVGDefsElement, unknown, null, undefined>, baseColor: string, id: string): string {
  const lightColor = lightenColor(baseColor, 15)
  const gradient = defs.append('linearGradient')
    .attr('id', id)
    .attr('x1', '0%')
    .attr('y1', '0%')
    .attr('x2', '0%')
    .attr('y2', '100%')
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', lightColor)
    .attr('stop-opacity', 1)
  
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', baseColor)
    .attr('stop-opacity', 1)
  
  return `url(#${id})`
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
      
      // Modern glow effekt SVG filter létrehozása (egyszer)
      const defs = svg.append('defs')
      const glowFilter = defs.append('filter')
        .attr('id', 'glow-filter')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%')
      
      // Glow effekt létrehozása
      glowFilter.append('feGaussianBlur')
        .attr('stdDeviation', '4')
        .attr('result', 'coloredBlur')
      
      const feMerge = glowFilter.append('feMerge')
      feMerge.append('feMergeNode').attr('in', 'coloredBlur')
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic')
      
      // Drop shadow filter létrehozása - erősebb árnyék
      const shadowFilter = defs.append('filter')
        .attr('id', 'drop-shadow')
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%')
      
      shadowFilter.append('feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', '4')
        .attr('result', 'blur')
      
      shadowFilter.append('feOffset')
        .attr('in', 'blur')
        .attr('dx', '0')
        .attr('dy', '4')
        .attr('result', 'offsetBlur')
      
      const feComponentTransfer = shadowFilter.append('feComponentTransfer')
        .attr('in', 'offsetBlur')
        .attr('result', 'shadow')
      
      feComponentTransfer.append('feFuncA')
        .attr('type', 'linear')
        .attr('slope', '0.4')
      
      const shadowMerge = shadowFilter.append('feMerge')
      shadowMerge.append('feMergeNode').attr('in', 'shadow')
      shadowMerge.append('feMergeNode').attr('in', 'SourceGraphic')
      
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
      
      // Gradiens cache: minden egyedi színhez gradiens definíciók
      const gradientCache = new Map<string, string>()
      
      // Helper függvény gradiens létrehozásához vagy cache-ből való lekéréséhez
      const getOrCreateGradient = (baseColor: string): string => {
        if (gradientCache.has(baseColor)) {
          return gradientCache.get(baseColor)!
        }
        
        const gradientId = `gradient-${baseColor.replace('#', '')}`
        const gradientUrl = createGradientForColor(defs, baseColor, gradientId)
        gradientCache.set(baseColor, gradientUrl)
        return gradientUrl
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
        
        // Először számoljuk ki az összes kumulatív fogásszámot, hogy megtaláljuk a maximumot
        const cumulativeFishCounts: number[] = []
        normalizedValues.forEach((value) => {
          cumulativeFishCount += value.fishCount
          cumulativeFishCounts.push(cumulativeFishCount)
        })
        
        // Legmagasabb kumulatív fogásszámú réteg azonosítása az adott oszlopban
        const maxCumulativeFishCount = Math.max(...cumulativeFishCounts, 0)
        
        // Reset cumulative counter
        cumulativeFishCount = 0
        
        // Rétegek renderelése (alulról felfelé)
        const totalLayers = normalizedValues.length
        normalizedValues.forEach((value, index) => {
          const layerHeight = (value.normalizedValue / maxStackHeight) * (chartHeight - chartPadding.top)
          cumulativeFishCount += value.fishCount
          
          // Opacity számítása a fogásszám alapján (az adott oszlop maximuma alapján)
          const layerOpacity = getOpacityByFishCount(value.fishCount, maxFishCountForType)
          
          // Ellenőrizzük, hogy ez a legmagasabb kumulatív fogásszámú réteg-e
          const isMaxFishCount = cumulativeFishCount === maxCumulativeFishCount && maxCumulativeFishCount > 0
          
          // Border radius meghatározása
          const borderRadius = getBorderRadius(index, totalLayers)
          
          // Gradiens létrehozása vagy cache-ből lekérése
          const gradientFill = getOrCreateGradient(value.color.bg)
          
          // Réteg renderelése animációval
          const centerX = x + xScale.bandwidth() / 2
          const centerY = yOffset - layerHeight / 2
          
          const layer = svg.append('rect')
            .attr('x', x)
            .attr('y', yOffset - layerHeight)
            .attr('width', xScale.bandwidth())
            .attr('height', layerHeight)
            .attr('rx', borderRadius.rx)
            .attr('ry', borderRadius.ry)
            .attr('fill', gradientFill)
            .attr('stroke', isMaxFishCount ? '#FACC15' : value.color.border)
            .attr('stroke-width', isMaxFishCount ? 3 : 1)
            .attr('opacity', 0) // Kezdetben láthatatlan az animációhoz
            .attr('filter', isMaxFishCount ? 'url(#glow-filter)' : 'url(#drop-shadow)')
            .attr('data-record-id', value.recordId)
            .attr('data-type', typeData.type)
            .attr('data-value', value.value)
            .attr('data-level', value.level)
            .attr('data-fish-count', cumulativeFishCount)
            .style('cursor', 'pointer')
          
          // Animáció: fade-in és scale-up
          // SVG-ben a transform origin-t translate-dal kell szimulálni
          layer.attr('transform', `translate(${centerX}, ${centerY}) scale(0.95) translate(${-centerX}, ${-centerY})`)
          
          layer.transition()
            .duration(400)
            .delay(index * 25)
            .attr('opacity', layerOpacity)
            .attr('transform', `translate(${centerX}, ${centerY}) scale(1) translate(${-centerX}, ${-centerY})`)
          
          // Hover animáció
          layer.on('mouseenter', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('transform', `translate(${centerX}, ${centerY}) scale(1.02) translate(${-centerX}, ${-centerY})`)
          })
          .on('mouseleave', function() {
            d3.select(this)
              .transition()
              .duration(200)
              .attr('transform', `translate(${centerX}, ${centerY}) scale(1) translate(${-centerX}, ${-centerY})`)
          })
          
          // Fogásszám megjelenítése a rétegen belül
          if (layerHeight > 15 && cumulativeFishCount > 0) { // Csak ha elég magas a réteg és van fogás
            const textY = yOffset - layerHeight / 2
            
            // Szöveg színének meghatározása a háttér szín világossága alapján
            const bgColor = value.color.bg
            let textColor = '#000000' // Alapértelmezett fekete
            
            // HEX szín RGB értékeinek kinyerése
            const hex = bgColor.replace('#', '')
            if (hex.length === 6) {
              const r = parseInt(hex.substring(0, 2), 16)
              const g = parseInt(hex.substring(2, 4), 16)
              const b = parseInt(hex.substring(4, 6), 16)
              
              // Relatív világosság számítása (0-1 skála)
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
              
              // Ha a háttér világos (luminance >= 0.5), sötét szöveg
              // Ha a háttér sötét (luminance < 0.5), világos szöveg
              if (luminance < 0.5) {
                textColor = '#FFFFFF' // Világos háttér → fehér szöveg
              } else {
                textColor = '#000000' // Világos háttér → fekete szöveg
              }
            } else {
              // Ha nem 6 karakteres HEX, használjuk a level alapján
              textColor = value.level <= 0 ? '#FFFFFF' : '#000000'
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
        
        // Adattípus címke alul (függőlegesen)
        const labelFontSize = isMobile 
          ? Math.max(11, Math.min(14, window.innerWidth / 30)) // Mobil: 11-14px között, reszponzív
          : Math.max(13, Math.min(16, window.innerWidth / 50)) // Desktop: 13-16px között, reszponzív
        
        svg.append('text')
          .attr('x', x + xScale.bandwidth() / 2)
          .attr('y', chartHeight + chartPadding.top + 25)
          .attr('text-anchor', 'middle')
          .attr('transform', `rotate(-90, ${x + xScale.bandwidth() / 2}, ${chartHeight + chartPadding.top + 25})`)
          .attr('font-size', labelFontSize)
          .attr('fill', '#1e293b')
          .attr('font-weight', 600)
          .text(typeData.label)
      })
      
      // Y tengely (normalizált értékek) - modernizálva
      const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${d}%`)
      
      const yAxisGroup = svg.append('g')
        .attr('transform', `translate(${chartPadding.left}, 0)`)
        .call(yAxis)
      
      // Tengely vonal modernizálása
      yAxisGroup.select('.domain')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 0.5)
      
      // Grid vonalak hozzáadása
      yAxisGroup.selectAll('.tick line')
        .attr('stroke', '#E5E7EB')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0.3)
        .attr('x2', chartWidth - chartPadding.left - chartPadding.right)
      
      // Tick szövegek modernizálása
      yAxisGroup.selectAll('text')
        .attr('font-size', isMobile ? 9 : 10)
        .attr('fill', '#64748b')
        .attr('font-weight', 500)
      
      // Y tengely címke modernizálása
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
          .style('padding', '10px 14px')
          .style('border-radius', '8px')
          .style('font-size', '12px')
          .style('font-weight', '500')
          .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.15)')
          .style('backdrop-filter', 'blur(10px)')
          .style('-webkit-backdrop-filter', 'blur(10px)')
          .style('opacity', 0)
          .style('pointer-events', 'none')
          .style('z-index', 10000)
          .style('transition', 'opacity 0.2s ease-in-out')
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
              <div style="font-weight: 600; margin-bottom: 6px; font-size: 13px;">${item.label}</div>
              <div style="margin-bottom: 3px;">Érték: ${value.toFixed(decimals)}${item.unit ? ` ${item.unit}` : ''}</div>
              <div style="margin-bottom: 3px;">Szint: ${levelDescription || level}</div>
              <div>Fogások: ${fishCount}</div>
            `)
            .transition()
            .duration(200)
            .style('opacity', 1)
          
          // Hover esetén kissé emeljük az opacity-t, de ne legyen túl erős
          rect.transition()
            .duration(200)
            .attr('opacity', Math.min(1.0, originalOpacity + 0.2))
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY - 10}px`)
        })
        .on('mouseout', function() {
          const rect = d3.select(this)
          const originalOpacity = parseFloat(rect.attr('opacity')) || 1
          tooltip.transition()
            .duration(200)
            .style('opacity', 0)
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

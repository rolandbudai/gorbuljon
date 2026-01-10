# Statisztikai Modul Teljes Tervezése

## 1. Áttekintés

A statisztikai modul célja: **Fogási adatok és környezeti tényezők vizualizálása egyszerűen értelmezhető, mobilon is jól használható formában.**

### Fő UX célok:
- **Ne nyers adatot mutassunk, hanem mintázatot**
- **Gyors válasz a kérdésre**: "Milyen körülmények között volt sikeres a horgászat?"
- **Mobilon**: egy kézzel kezelhető, egyszerre kevés információ, lapozható/választható statisztikák

### Technológiai megkötések:
- React (functional components, hooks)
- Chart.js (react-chartjs-2 wrapper)
- Minimális külső függőség
- Reszponzív, mobile-first layout
- Egyszerű, jól karbantartható kód

---

## 2. Komponens Architektúra

### 2.1 Mappa Struktúra

```
src/
├── components/
│   └── stats/
│       ├── StatsDashboard.tsx          # Fő dashboard komponens
│       ├── StatTypeSelector.tsx        # Statisztika típus választó (tabs/swipe)
│       ├── charts/
│       │   ├── CategoryBarChart.tsx    # Körülmény-Fogás eloszlás (Bar chart)
│       │   ├── TimelineChart.tsx       # Időbeli trend (Line chart)
│       │   └── RadarSummaryChart.tsx    # Ideális körülmény profil (Radar chart)
│       └── cards/
│           └── StatSummaryCard.tsx      # Egyszerű összefoglaló kártyák
└── utils/
    └── stats/
        ├── normalize.ts                 # Normalizálási függvények
        ├── colorScale.ts                # Színkezelés (-3 to +3 skála)
        └── aggregations.ts              # Adat aggregációs függvények
```

### 2.2 Komponens Felelősségek

#### **StatsDashboard.tsx** (Fő komponens)
**Felelősség**:
- Statisztikai nézetek központi kezelése
- Aktuális nézet state kezelése
- Adatok előkészítése és továbbítása a megfelelő chart komponenseknek
- Mobile/desktop layout kezelése

**Props**:
```typescript
interface StatsDashboardProps {
  records: LocationRecord[]
  onClose: () => void
}
```

**State**:
- `selectedView`: 'bar' | 'timeline' | 'radar' | 'cards'
- `selectedDataType`: DataType (bar chart-hoz)

**Funkciók**:
- Adatok aggregálása (`prepareAggregatedData()`)
- Aktuális nézet renderelése
- Mobile swipe navigáció kezelése

---

#### **StatTypeSelector.tsx** (Nézet választó)
**Felelősség**:
- Statisztikai nézetek közötti váltás
- Mobile: swipe-olható tabs
- Desktop: tabs vagy buttons

**Props**:
```typescript
interface StatTypeSelectorProps {
  selectedView: 'bar' | 'timeline' | 'radar' | 'cards'
  onViewChange: (view: 'bar' | 'timeline' | 'radar' | 'cards') => void
}
```

**Funkciók**:
- 4 nézet közötti váltás
- Mobile swipe gesture támogatás (opcionális)
- Aktív nézet kiemelése

---

#### **CategoryBarChart.tsx** (Bar Chart)
**Felelősség**:
- Körülmény-Fogás eloszlás megjelenítése
- X tengely: -3 to +3 kategóriák
- Y tengely: fogások száma
- Egy kiválasztott adattípusra

**Props**:
```typescript
interface CategoryBarChartProps {
  data: CategoryBarData[]  // [{ level: -3, fishCount: 5 }, ...]
  dataType: DataType
  onDataTypeChange: (type: DataType) => void
}
```

**Chart.js Config**:
```typescript
{
  type: 'bar',
  data: {
    labels: ['-3', '-2', '-1', '0', '+1', '+2', '+3'],
    datasets: [{
      label: 'Fogások',
      data: [5, 12, 8, 20, 15, 10, 3],
      backgroundColor: colors.map(c => c.bg),
      borderColor: colors.map(c => c.border),
      borderWidth: 2
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { type: 'category' },
      y: { 
        type: 'linear',
        min: 0,
        title: { display: true, text: 'Fogásszám' }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: () => '',
          label: (context) => {
            const level = parseInt(context.label)
            const description = getLevelDescription(level, dataType)
            return `${description}: ${context.parsed.y} fogás`
          }
        }
      }
    }
  }
}
```

**Mobile optimalizáció**:
- Teljes szélesség
- Max 7 oszlop (fix, mert -3 to +3 = 7 kategória)
- Dropdown felül: adattípus választás

---

#### **TimelineChart.tsx** (Line Chart)
**Felelősség**:
- Időbeli trend megjelenítése
- X tengely: idő (nap/óra)
- Y tengely: kiválasztott adattípus normalizált értéke
- Fogások megjelenítése: pontok a grafikonon

**Props**:
```typescript
interface TimelineChartProps {
  data: TimelineDataPoint[]  // [{ date: Date, value: number, fishCount: number }, ...]
  dataType: DataType
  onDataTypeChange: (type: DataType) => void
}
```

**Chart.js Config**:
```typescript
{
  type: 'line',
  data: {
    datasets: [
      {
        label: 'Környezeti tényező',
        data: timelinePoints,
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Fogások',
        data: fishPoints,  // Csak azok a pontok, ahol volt fogás
        pointRadius: 8,
        pointBackgroundColor: '#FACC15',
        pointBorderColor: '#F59E0B',
        showLine: false  // Csak pontok, nincs vonal
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day'
        },
        title: { display: true, text: 'Idő' }
      },
      y: {
        type: 'linear',
        min: 0,
        max: 100,
        title: { display: true, text: 'Normalizált érték (%)' }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  }
}
```

**Cél**: "Mikor történt a fogás a körülményekhez képest?"

---

#### **RadarSummaryChart.tsx** (Radar Chart)
**Felelősség**:
- Ideális körülmény profil megjelenítése
- Tengelyek: a 10 adattípus
- Érték: átlagos kategória csak sikeres fogásoknál

**Props**:
```typescript
interface RadarSummaryChartProps {
  data: RadarDataPoint[]  // [{ dataType: DataType, avgLevel: number }, ...]
}
```

**Chart.js Config**:
```typescript
{
  type: 'radar',
  data: {
    labels: dataTypes.map(t => getDataTypeConfig(t).label),
    datasets: [{
      label: 'Ideális körülmények',
      data: data.map(d => d.avgLevel),  // -3 to +3 értékek
      backgroundColor: 'rgba(37, 99, 235, 0.2)',
      borderColor: '#2563EB',
      pointBackgroundColor: '#2563EB',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: '#2563EB'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        min: -3,
        max: 3,
        ticks: {
          stepSize: 1,
          display: false
        },
        pointLabels: {
          font: { size: 12 }
        }
      }
    },
    plugins: {
      legend: { display: false }
    }
  }
}
```

**Megjegyzés**: Csak landscape vagy tablet méret felett jelenik meg.

---

#### **StatSummaryCard.tsx** (Summary Cards)
**Felelősség**:
- Egyszerű összefoglaló kártyák
- Minden adattípushoz: ikon, átlagos kategória, színkód
- "jobb / rosszabb mint az összesített átlag" jelzés

**Props**:
```typescript
interface StatSummaryCardProps {
  dataType: DataType
  avgLevel: number
  overallAvgLevel: number
  recordCount: number
}
```

**Struktúra**:
```tsx
<div className="stat-summary-card">
  <div className="card-icon">{icon}</div>
  <div className="card-content">
    <h3>{dataTypeLabel}</h3>
    <div className="card-level">
      <span className="level-badge" style={{ backgroundColor: color.bg }}>
        {levelDescription}
      </span>
    </div>
    <div className="card-comparison">
      {avgLevel > overallAvgLevel ? '↑ Jobb' : avgLevel < overallAvgLevel ? '↓ Rosszabb' : '= Átlag'}
    </div>
  </div>
</div>
```

**Mobile**: 2 oszlopos grid

---

## 3. Utils Struktúra

### 3.1 normalize.ts

**Funkciók**:
```typescript
/**
 * Normalizál egy értéket 0-100 skálára
 */
export function normalizeValue(
  value: number,
  min: number,
  max: number
): number

/**
 * Normalizál egy értéket -3 to +3 skálára
 */
export function normalizeToLevel(
  value: number,
  type: DataType
): number

/**
 * Normalizál egy dátumot Chart.js time scale-hez
 */
export function normalizeDate(date: Date | string): number
```

---

### 3.2 colorScale.ts

**Funkciók**:
```typescript
/**
 * Visszaadja a színt egy adattípus és szint alapján
 */
export function getColorForLevel(
  type: DataType,
  level: number
): { bg: string, border: string, text: string }

/**
 * Visszaadja a színvilágot egy adattípushoz (-3 to +3)
 */
export function getColorScaleForType(type: DataType): ColorScale

/**
 * Színvilág definíciók minden adattípushoz
 */
const COLOR_SCALES: Record<DataType, ColorScale>
```

**Szabályok**:
- Minden adattípusnak saját színvilága
- -3 → halvány szín
- +3 → erős szín
- Vízzel kapcsolatos: kék árnyalatok
- Hőmérséklet: kék → piros átmenet

---

### 3.3 aggregations.ts

**Funkciók**:
```typescript
/**
 * Szint szerint csoportosítja és összesíti a fogásszámokat
 */
export function aggregateByLevel(
  records: LocationRecord[],
  dataType: DataType
): CategoryBarData[]

/**
 * Időbeli trend adatok előkészítése
 */
export function prepareTimelineData(
  records: LocationRecord[],
  dataType: DataType
): TimelineDataPoint[]

/**
 * Radar chart adatok előkészítése (csak sikeres fogások)
 */
export function prepareRadarData(
  records: LocationRecord[]
): RadarDataPoint[]

/**
 * Summary cards adatok előkészítése
 */
export function prepareSummaryData(
  records: LocationRecord[]
): SummaryCardData[]
```

---

## 4. Adatmodell és Típusok

### 4.1 Típus Definíciók

```typescript
// Bar Chart adatok
export type CategoryBarData = {
  level: number  // -3 to +3
  fishCount: number
  recordCount: number
  color: { bg: string, border: string }
}

// Timeline Chart adatok
export type TimelineDataPoint = {
  date: Date
  value: number  // Normalizált érték (0-100%)
  fishCount: number
  level: number  // -3 to +3
}

// Radar Chart adatok
export type RadarDataPoint = {
  dataType: DataType
  avgLevel: number  // Átlagos szint csak sikeres fogásoknál
  recordCount: number
}

// Summary Card adatok
export type SummaryCardData = {
  dataType: DataType
  avgLevel: number
  overallAvgLevel: number
  recordCount: number
  trend: 'better' | 'worse' | 'same'
}
```

---

## 5. Implementációs Lépések

### 5.1 Fázis 1: Alapstruktúra

1. **Mappa struktúra létrehozása**
   - `src/components/stats/` mappa
   - `src/utils/stats/` mappa

2. **Utils fájlok létrehozása**
   - `normalize.ts`: Normalizálási függvények
   - `colorScale.ts`: Színkezelés
   - `aggregations.ts`: Aggregációs függvények

3. **Alap komponensek**
   - `StatsDashboard.tsx`: Fő komponens
   - `StatTypeSelector.tsx`: Nézet választó

### 5.2 Fázis 2: Chart Komponensek

1. **CategoryBarChart.tsx**
   - Bar chart implementáció
   - Dropdown adattípus választó
   - Tooltip testreszabás

2. **TimelineChart.tsx**
   - Line chart implementáció
   - Time scale konfiguráció
   - Fogás pontok megjelenítése

3. **RadarSummaryChart.tsx**
   - Radar chart implementáció
   - Csak sikeres fogások adatai
   - Reszponzív megjelenítés (csak tablet+)

4. **StatSummaryCard.tsx**
   - Kártya komponens
   - 2 oszlopos grid mobile-on

### 5.3 Fázis 3: Integráció és Finomhangolás

1. **StatisticsSection.tsx módosítása**
   - `StatsDashboard` használata
   - Régi komponensek eltávolítása vagy backup

2. **Reszponzív optimalizálás**
   - Mobile breakpoint-ok
   - Swipe navigáció (opcionális)
   - Touch interakciók

3. **Teljesítmény optimalizálás**
   - useMemo aggregációkhoz
   - React.memo chart komponensekhez

---

## 6. Chart.js Konfiguráció Példák

### 6.1 Bar Chart Konfiguráció

```typescript
// src/components/stats/charts/CategoryBarChart.tsx

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        title: () => '',
        label: (context: any) => {
          const level = parseInt(context.label)
          const description = getLevelDescription(level, dataType)
          return `${description}: ${context.parsed.y} fogás`
        },
      },
    },
  },
  scales: {
    x: {
      type: 'category' as const,
      title: {
        display: true,
        text: 'Szint',
        font: { size: 14, weight: '600' },
        color: '#1e293b',
      },
      ticks: {
        font: { size: 12 },
        color: '#64748b',
      },
      grid: {
        display: false,
      },
    },
    y: {
      type: 'linear' as const,
      min: 0,
      title: {
        display: true,
        text: 'Fogásszám',
        font: { size: 14, weight: '600' },
        color: '#1e293b',
      },
      ticks: {
        stepSize: 1,
        precision: 0,
        font: { size: 12 },
        color: '#64748b',
      },
      grid: {
        color: '#E5E7EB',
        lineWidth: 0.5,
      },
    },
  },
}
```

---

### 6.2 Radar Chart Konfiguráció

```typescript
// src/components/stats/charts/RadarSummaryChart.tsx

import { Radar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (context: any) => {
          const dataType = dataTypes[context.dataIndex]
          const level = context.parsed.r
          const description = getLevelDescription(level, dataType)
          return `${description} (${level})`
        },
      },
    },
  },
  scales: {
    r: {
      min: -3,
      max: 3,
      ticks: {
        stepSize: 1,
        display: false,
      },
      pointLabels: {
        font: { size: 12 },
        color: '#64748b',
      },
      grid: {
        color: '#E5E7EB',
        lineWidth: 0.5,
      },
    },
  },
}
```

---

## 7. Normalizálás és Aggregáció Logika

### 7.1 Normalizálás (normalize.ts)

```typescript
/**
 * Normalizál egy értéket 0-100 skálára
 */
export function normalizeValue(value: number, min: number, max: number): number {
  if (max === min) return 50 // Ha minden érték ugyanaz
  const normalized = ((value - min) / (max - min)) * 100
  return Math.max(0, Math.min(100, normalized))
}

/**
 * Meghatározza a szintet (-3 to +3) egy érték alapján
 */
export function getLevelForValue(value: number, type: DataType): number {
  // Használjuk a meglévő get{Type}Level() függvényeket
  switch (type) {
    case 'waterLevel':
      return getWaterLevelLevel(value)
    case 'waterTemperature':
      return getWaterTempLevel(value)
    // ... stb.
    default:
      return 0
  }
}

/**
 * Normalizál egy dátumot Chart.js time scale-hez
 */
export function normalizeDate(date: Date | string): number {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.getTime()
}
```

---

### 7.2 Aggregáció (aggregations.ts)

```typescript
/**
 * Szint szerint csoportosítja és összesíti a fogásszámokat
 */
export function aggregateByLevel(
  records: LocationRecord[],
  dataType: DataType
): CategoryBarData[] {
  const groupedByLevel = new Map<number, {
    fishCounts: number[]
    recordIds: string[]
  }>()
  
  // Értékek kinyerése és szint szerinti csoportosítás
  records.forEach(record => {
    const value = extractValueFromRecord(record, dataType)
    const fishCount = calculateFishCount(record)
    
    if (value !== null && fishCount > 0) {
      const level = getLevelForValue(value, dataType)
      
      if (!groupedByLevel.has(level)) {
        groupedByLevel.set(level, {
          fishCounts: [],
          recordIds: [],
        })
      }
      
      const group = groupedByLevel.get(level)!
      group.fishCounts.push(fishCount)
      group.recordIds.push(record.id)
    }
  })
  
  // Kategóriák létrehozása (-3 to +3)
  const categories: CategoryBarData[] = []
  for (let level = -3; level <= 3; level++) {
    const group = groupedByLevel.get(level)
    const totalFishCount = group 
      ? group.fishCounts.reduce((sum, count) => sum + count, 0)
      : 0
    const recordCount = group ? group.fishCounts.length : 0
    
    categories.push({
      level,
      fishCount: totalFishCount,
      recordCount,
      color: getColorForLevel(dataType, level),
    })
  }
  
  return categories
}

/**
 * Időbeli trend adatok előkészítése
 */
export function prepareTimelineData(
  records: LocationRecord[],
  dataType: DataType
): TimelineDataPoint[] {
  const points: TimelineDataPoint[] = []
  
  // Minden rekordból kinyerjük az értéket és dátumot
  records.forEach(record => {
    const value = extractValueFromRecord(record, dataType)
    const fishCount = calculateFishCount(record)
    
    if (value !== null) {
      // Dátum meghatározása
      let date: Date
      if (record.date && record.time) {
        try {
          date = new Date(`${record.date} ${record.time}`)
          if (isNaN(date.getTime())) {
            date = new Date(record.createdAt)
          }
        } catch {
          date = new Date(record.createdAt)
        }
      } else {
        date = new Date(record.createdAt)
      }
      
      // Normalizálás
      const config = getDataTypeConfig(dataType)
      const normalizedValue = normalizeValue(value, config.min, config.max)
      const level = getLevelForValue(value, dataType)
      
      points.push({
        date,
        value: normalizedValue,
        fishCount,
        level,
      })
    }
  })
  
  // Dátum szerint rendezés
  return points.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Radar chart adatok előkészítése (csak sikeres fogások)
 */
export function prepareRadarData(
  records: LocationRecord[]
): RadarDataPoint[] {
  const dataTypes = getAllDataTypes()
  const radarData: RadarDataPoint[] = []
  
  // Csak sikeres fogásokat tartalmazó rekordok
  const successfulRecords = records.filter(record => {
    const fishCount = calculateFishCount(record)
    return fishCount > 0
  })
  
  dataTypes.forEach(type => {
    const levels: number[] = []
    
    successfulRecords.forEach(record => {
      const value = extractValueFromRecord(record, type)
      if (value !== null) {
        const level = getLevelForValue(value, type)
        levels.push(level)
      }
    })
    
    if (levels.length > 0) {
      const avgLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length
      
      radarData.push({
        dataType: type,
        avgLevel: Math.round(avgLevel * 10) / 10, // 1 tizedesjegy
        recordCount: levels.length,
      })
    }
  })
  
  return radarData
}

/**
 * Summary cards adatok előkészítése
 */
export function prepareSummaryData(
  records: LocationRecord[]
): SummaryCardData[] {
  const dataTypes = getAllDataTypes()
  const summaryData: SummaryCardData[] = []
  
  // Összesített átlagos szintek számítása
  const overallLevels: number[] = []
  dataTypes.forEach(type => {
    records.forEach(record => {
      const value = extractValueFromRecord(record, type)
      if (value !== null) {
        const level = getLevelForValue(value, type)
        overallLevels.push(level)
      }
    })
  })
  const overallAvgLevel = overallLevels.length > 0
    ? overallLevels.reduce((sum, level) => sum + level, 0) / overallLevels.length
    : 0
  
  // Minden adattípushoz
  dataTypes.forEach(type => {
    const levels: number[] = []
    let recordCount = 0
    
    records.forEach(record => {
      const value = extractValueFromRecord(record, type)
      if (value !== null) {
        const level = getLevelForValue(value, type)
        levels.push(level)
        recordCount++
      }
    })
    
    if (levels.length > 0) {
      const avgLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length
      const trend = avgLevel > overallAvgLevel ? 'better' :
                   avgLevel < overallAvgLevel ? 'worse' : 'same'
      
      summaryData.push({
        dataType: type,
        avgLevel: Math.round(avgLevel * 10) / 10,
        overallAvgLevel: Math.round(overallAvgLevel * 10) / 10,
        recordCount,
        trend,
      })
    }
  })
  
  return summaryData
}
```

---

## 8. Reszponzivitás

### 8.1 Mobile-First Breakpoint-ok

```css
/* Mobile */
@media (max-width: 480px) {
  .stats-dashboard {
    padding: 0.5rem;
  }
  
  .stat-type-selector {
    display: flex;
    overflow-x: auto;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }
  
  .stat-summary-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  
  .radar-chart-container {
    display: none; /* Csak tablet+ */
  }
}

/* Tablet */
@media (min-width: 481px) and (max-width: 768px) {
  .stats-dashboard {
    padding: 1rem;
  }
  
  .radar-chart-container {
    display: block;
  }
}

/* Desktop */
@media (min-width: 769px) {
  .stats-dashboard {
    padding: 1.5rem;
  }
  
  .stat-type-selector {
    display: flex;
    gap: 1rem;
  }
}
```

### 8.2 Chart.js Reszponzív Konfiguráció

```typescript
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  // Aspect ratio dinamikus beállítás
  aspectRatio: isMobile ? 1.5 : 2,
  // ...
}
```

---

## 9. Teljesítmény Optimalizálás

### 9.1 Memoization Stratégia

```typescript
// StatsDashboard.tsx
const aggregatedData = useMemo(
  () => prepareAggregatedData(records),
  [records]
)

const barChartData = useMemo(
  () => aggregateByLevel(records, selectedDataType),
  [records, selectedDataType]
)

const timelineData = useMemo(
  () => prepareTimelineData(records, selectedDataType),
  [records, selectedDataType]
)

const radarData = useMemo(
  () => prepareRadarData(records),
  [records]
)

const summaryData = useMemo(
  () => prepareSummaryData(records),
  [records]
)
```

### 9.2 Komponens Memoization

```typescript
// Minden chart komponens React.memo-val
export const CategoryBarChart = React.memo(function CategoryBarChart({ ... }) {
  // ...
})

export const TimelineChart = React.memo(function TimelineChart({ ... }) {
  // ...
})

export const RadarSummaryChart = React.memo(function RadarSummaryChart({ ... }) {
  // ...
})
```

---

## 10. Bővíthetőség: Előrejelzés

### 10.1 Jövőbeli Funkciók

**Előrejelzés modul** (`src/utils/stats/prediction.ts`):
```typescript
/**
 * Előrejelzi a fogási siker valószínűségét adott körülményekhez
 */
export function predictFishingSuccess(
  conditions: Record<DataType, number>
): {
  probability: number  // 0-100%
  confidence: number   // 0-100%
  factors: Array<{
    dataType: DataType
    impact: number  // -3 to +3
    reason: string
  }>
}

/**
 * Ajánlott időpontok számítása
 */
export function getRecommendedTimes(
  records: LocationRecord[],
  forecast: WeatherForecast
): Array<{
  date: Date
  score: number  // 0-100
  factors: string[]
}>
```

**Integráció**:
- Új nézet: "Előrejelzés" tab
- Machine learning modell (opcionális, jövőbeli)
- Egyszerű szabályalapú előrejelzés (kezdetben)

---

## 11. Implementációs Összefoglaló

### 11.1 Lépések Sorrendje

1. **Utils fájlok létrehozása**
   - `normalize.ts`
   - `colorScale.ts`
   - `aggregations.ts`

2. **Komponens struktúra**
   - `StatsDashboard.tsx`
   - `StatTypeSelector.tsx`
   - Chart komponensek (Bar, Line, Radar)
   - `StatSummaryCard.tsx`

3. **Integráció**
   - `StatisticsSection.tsx` módosítása
   - Régi komponensek eltávolítása vagy backup

4. **Tesztelés**
   - Funkcionális tesztek
   - Reszponzív tesztek
   - Teljesítmény tesztek

### 11.2 Főbb Előnyök

- **Egyszerű karbantarthatóság**: Minden chart külön komponens
- **Mobile-first**: Reszponzív, touch-friendly
- **Gyors értelmezhetőség**: Mintázatok, nem nyers adatok
- **Bővíthetőség**: Könnyen hozzáadható új nézetek
- **Minimális függőség**: Csak Chart.js

---

## 12. Példa Használat

```tsx
// StatisticsSection.tsx
import { StatsDashboard } from './stats/StatsDashboard'

export function StatisticsSection({ records, onClose }: StatisticsSectionProps) {
  return (
    <div className="statistics-section">
      <div className="statistics-header">
        <h2>Statisztikák</h2>
        <button onClick={onClose}>×</button>
      </div>
      <StatsDashboard records={records} onClose={onClose} />
    </div>
  )
}
```

```tsx
// StatsDashboard.tsx
export function StatsDashboard({ records, onClose }: StatsDashboardProps) {
  const [selectedView, setSelectedView] = useState<'bar' | 'timeline' | 'radar' | 'cards'>('bar')
  const [selectedDataType, setSelectedDataType] = useState<DataType>('waterLevel')
  
  // Adatok előkészítése
  const barData = useMemo(
    () => aggregateByLevel(records, selectedDataType),
    [records, selectedDataType]
  )
  
  const timelineData = useMemo(
    () => prepareTimelineData(records, selectedDataType),
    [records, selectedDataType]
  )
  
  const radarData = useMemo(
    () => prepareRadarData(records),
    [records]
  )
  
  const summaryData = useMemo(
    () => prepareSummaryData(records),
    [records]
  )
  
  return (
    <div className="stats-dashboard">
      <StatTypeSelector 
        selectedView={selectedView} 
        onViewChange={setSelectedView} 
      />
      
      {selectedView === 'bar' && (
        <CategoryBarChart 
          data={barData}
          dataType={selectedDataType}
          onDataTypeChange={setSelectedDataType}
        />
      )}
      
      {selectedView === 'timeline' && (
        <TimelineChart 
          data={timelineData}
          dataType={selectedDataType}
          onDataTypeChange={setSelectedDataType}
        />
      )}
      
      {selectedView === 'radar' && (
        <RadarSummaryChart data={radarData} />
      )}
      
      {selectedView === 'cards' && (
        <div className="stat-summary-cards">
          {summaryData.map(data => (
            <StatSummaryCard key={data.dataType} {...data} />
          ))}
        </div>
      )}
    </div>
  )
}
```

---

Ez a terv egy **reálisan implementálható, nem túltervezett** megoldást nyújt, amely egy hobbi horgász számára is érthető UI-val rendelkezik.


import type { LocationRecord } from '../services/records'
import type { DataType } from './statistics'
import {
    calculateFishCount,
    extractDataValues,
    getWaterLevelLevel,
    getWaterTempLevel,
    getAirTempLevel,
    getPressureLevel,
    getCloudCoverLevel,
    getRainLevel,
    getWindLevel,
    getUVLevel,
} from './statistics'

/**
 * Összesített fogási statisztikák
 */
export type FishCatchStats = {
    totalCatches: number
    totalRecords: number
    averageCatchPerRecord: number
    fishTypeBreakdown: Record<string, number>
    bestDay: { date: string; count: number } | null
    bestLocation: { name: string; count: number } | null
}

/**
 * Környezeti tényező szerinti fogások
 */
export type EnvironmentalCatchData = {
    dataType: DataType
    categories: {
        level: number // -3 to +3
        catchCount: number
        recordCount: number
        averageCatchPerRecord: number
        fishTypes: Record<string, number>
    }[]
}

/**
 * Halfaj-specifikus elemzés
 */
export type FishTypeAnalysis = {
    fishType: string
    totalCatches: number
    environmentalPreferences: {
        dataType: DataType
        averageLevel: number // -3 to +3
        description: string
    }[]
    bestConditions: string
}

/**
 * Összes halfaj típus lekérése a rekordokból
 */
export function getAllFishTypes(records: LocationRecord[]): string[] {
    const fishTypesSet = new Set<string>()

    records.forEach(record => {
        if (!record.caughtFish) return

        if (Array.isArray(record.caughtFish)) {
            record.caughtFish.forEach(fish => fishTypesSet.add(fish))
        } else if (typeof record.caughtFish === 'object') {
            Object.keys(record.caughtFish).forEach(fish => fishTypesSet.add(fish))
        }
    })

    return Array.from(fishTypesSet).sort()
}

/**
 * Összesített fogási statisztikák számítása
 */
export function calculateFishCatchStats(records: LocationRecord[]): FishCatchStats {
    let totalCatches = 0
    const fishTypeBreakdown: Record<string, number> = {}
    const catchesByDay: Record<string, number> = {}
    const catchesByLocation: Record<string, number> = {}

    records.forEach(record => {
        const fishCount = calculateFishCount(record)
        totalCatches += fishCount

        // Halfaj szerinti bontás
        if (record.caughtFish) {
            if (Array.isArray(record.caughtFish)) {
                record.caughtFish.forEach(fish => {
                    fishTypeBreakdown[fish] = (fishTypeBreakdown[fish] || 0) + 1
                })
            } else if (typeof record.caughtFish === 'object') {
                Object.entries(record.caughtFish).forEach(([fish, count]) => {
                    fishTypeBreakdown[fish] = (fishTypeBreakdown[fish] || 0) + (typeof count === 'number' ? count : 0)
                })
            }
        }

        // Nap szerinti bontás
        if (record.date && fishCount > 0) {
            catchesByDay[record.date] = (catchesByDay[record.date] || 0) + fishCount
        }

        // Helyszín szerinti bontás
        if (record.locationName && fishCount > 0) {
            catchesByLocation[record.locationName] = (catchesByLocation[record.locationName] || 0) + fishCount
        }
    })

    // Legjobb nap meghatározása
    let bestDay: { date: string; count: number } | null = null
    Object.entries(catchesByDay).forEach(([date, count]) => {
        if (!bestDay || count > bestDay.count) {
            bestDay = { date, count }
        }
    })

    // Legjobb helyszín meghatározása
    let bestLocation: { name: string; count: number } | null = null
    Object.entries(catchesByLocation).forEach(([name, count]) => {
        if (!bestLocation || count > bestLocation.count) {
            bestLocation = { name, count }
        }
    })

    return {
        totalCatches,
        totalRecords: records.length,
        averageCatchPerRecord: records.length > 0 ? totalCatches / records.length : 0,
        fishTypeBreakdown,
        bestDay,
        bestLocation,
    }
}

/**
 * Szint meghatározása érték és adattípus alapján
 */
function getLevelForValue(value: number, type: DataType): number {
    switch (type) {
        case 'waterLevel':
            return getWaterLevelLevel(value)
        case 'waterTemperature':
            return getWaterTempLevel(value)
        case 'airTemperature':
            return getAirTempLevel(value)
        case 'pressure':
            return getPressureLevel(value)
        case 'cloudCover':
            return getCloudCoverLevel(value)
        case 'precipitationChance':
            return getRainLevel(value)
        case 'windSpeed':
            return getWindLevel(value)
        case 'uvIndex':
            return getUVLevel(value)
        case 'moonPhase':
            // Moon phase érték már napok száma (0-29.5)
            const daysUntilFull = value
            if (daysUntilFull === 0) return 0
            if (daysUntilFull <= 1) return -1
            if (daysUntilFull <= 2) return -2
            if (daysUntilFull <= 3) return -3
            if (daysUntilFull <= 4) return 1
            if (daysUntilFull <= 5) return 2
            return 3
        case 'lightChange':
            // Light change érték már 0 vagy 1
            return value === 1 ? 1 : 0
        default:
            return 0
    }
}

/**
 * Környezeti tényező szerinti fogások aggregálása
 */
export function aggregateCatchesByEnvironment(
    records: LocationRecord[],
    dataType: DataType
): EnvironmentalCatchData {
    // Inicializáljuk az összes kategóriát (-3 to +3)
    const categories = new Map<number, {
        level: number
        catchCount: number
        recordCount: number
        fishTypes: Record<string, number>
    }>()

    // LightChange esetén csak 0 és 1 szintek vannak
    const levels = dataType === 'lightChange' ? [0, 1] : [-3, -2, -1, 0, 1, 2, 3]

    levels.forEach(level => {
        categories.set(level, {
            level,
            catchCount: 0,
            recordCount: 0,
            fishTypes: {},
        })
    })

    // Adatok kinyerése
    const dataValues = extractDataValues(records)

    // Szűrjük az adott típusú értékeket
    const relevantValues = dataValues.filter(v => v.type === dataType)

    // Csoportosítás szint szerint
    relevantValues.forEach(value => {
        const level = getLevelForValue(value.value, dataType)
        const category = categories.get(level)

        if (category) {
            category.catchCount += value.fishCount
            category.recordCount += 1

            // Halfaj szerinti bontás
            const record = records.find(r => r.id === value.recordId)
            if (record?.caughtFish) {
                if (Array.isArray(record.caughtFish)) {
                    record.caughtFish.forEach(fish => {
                        category.fishTypes[fish] = (category.fishTypes[fish] || 0) + 1
                    })
                } else if (typeof record.caughtFish === 'object') {
                    Object.entries(record.caughtFish).forEach(([fish, count]) => {
                        category.fishTypes[fish] = (category.fishTypes[fish] || 0) + (typeof count === 'number' ? count : 0)
                    })
                }
            }
        }
    })

    // Átlagok számítása
    const result: EnvironmentalCatchData = {
        dataType,
        categories: Array.from(categories.values()).map(cat => ({
            level: cat.level,
            catchCount: cat.catchCount,
            recordCount: cat.recordCount,
            averageCatchPerRecord: cat.recordCount > 0 ? cat.catchCount / cat.recordCount : 0,
            fishTypes: cat.fishTypes,
        })),
    }

    return result
}

/**
 * Halfaj-specifikus elemzés
 */
export function analyzeFishType(
    records: LocationRecord[],
    fishType: string
): FishTypeAnalysis {
    // Szűrjük azokat a rekordokat, amelyek tartalmazzák az adott halfajt
    const relevantRecords = records.filter(record => {
        if (!record.caughtFish) return false

        if (Array.isArray(record.caughtFish)) {
            return record.caughtFish.includes(fishType)
        } else if (typeof record.caughtFish === 'object') {
            return fishType in record.caughtFish && (record.caughtFish[fishType] || 0) > 0
        }

        return false
    })

    // Összes fogás számítása
    let totalCatches = 0
    relevantRecords.forEach(record => {
        if (Array.isArray(record.caughtFish)) {
            totalCatches += record.caughtFish.filter(f => f === fishType).length
        } else if (typeof record.caughtFish === 'object') {
            totalCatches += record.caughtFish[fishType] || 0
        }
    })

    // Környezeti preferenciák számítása minden adattípushoz
    const dataTypes: DataType[] = [
        'waterLevel',
        'waterTemperature',
        'airTemperature',
        'pressure',
        'windSpeed',
        'cloudCover',
        'precipitationChance',
        'uvIndex',
        'moonPhase',
        'lightChange',
    ]

    const environmentalPreferences = dataTypes.map(dataType => {
        const dataValues = extractDataValues(relevantRecords).filter(v => v.type === dataType)

        if (dataValues.length === 0) {
            return {
                dataType,
                averageLevel: 0,
                description: 'Nincs adat',
            }
        }

        const levels = dataValues.map(v => getLevelForValue(v.value, dataType))
        const averageLevel = levels.reduce((sum, level) => sum + level, 0) / levels.length

        return {
            dataType,
            averageLevel,
            description: `Átlag: ${averageLevel.toFixed(1)}`,
        }
    })

    // Legjobb körülmények szöveges összefoglalása
    const bestConditions = environmentalPreferences
        .filter(pref => Math.abs(pref.averageLevel) > 0.5) // Csak jelentős eltérések
        .map(pref => `${pref.dataType}: ${pref.averageLevel > 0 ? '+' : ''}${pref.averageLevel.toFixed(1)}`)
        .join(', ') || 'Nincs jelentős preferencia'

    return {
        fishType,
        totalCatches,
        environmentalPreferences,
        bestConditions,
    }
}

/**
 * Legjobb körülmények meghatározása (ahol a legtöbb fogás volt)
 */
export function findBestConditions(records: LocationRecord[]): {
    dataType: DataType
    level: number
    description: string
    catchCount: number
}[] {
    const dataTypes: DataType[] = [
        'waterLevel',
        'waterTemperature',
        'airTemperature',
        'pressure',
        'windSpeed',
        'cloudCover',
        'precipitationChance',
        'uvIndex',
        'moonPhase',
        'lightChange',
    ]

    const bestConditions = dataTypes.map(dataType => {
        const data = aggregateCatchesByEnvironment(records, dataType)

        // Keressük meg a kategóriát a legtöbb fogással
        let bestCategory = data.categories[0]
        data.categories.forEach(cat => {
            if (cat.catchCount > bestCategory.catchCount) {
                bestCategory = cat
            }
        })

        return {
            dataType,
            level: bestCategory.level,
            description: `Szint: ${bestCategory.level}`,
            catchCount: bestCategory.catchCount,
        }
    })

    // Rendezzük fogásszám szerint csökkenő sorrendbe
    return bestConditions.sort((a, b) => b.catchCount - a.catchCount)
}

/**
 * Időbeli trend számítása (hónapok szerint)
 */
export function calculateTimeTrend(records: LocationRecord[]): {
    month: string
    catchCount: number
}[] {
    const catchesByMonth: Record<string, number> = {}

    records.forEach(record => {
        if (!record.date) return

        const fishCount = calculateFishCount(record)
        if (fishCount === 0) return

        // Dátum formátum: YYYY.MM.DD
        const [year, month] = record.date.split('.')
        const monthKey = `${year}.${month}`

        catchesByMonth[monthKey] = (catchesByMonth[monthKey] || 0) + fishCount
    })

    // Rendezzük időrend szerint
    return Object.entries(catchesByMonth)
        .map(([month, catchCount]) => ({ month, catchCount }))
        .sort((a, b) => a.month.localeCompare(b.month))
}

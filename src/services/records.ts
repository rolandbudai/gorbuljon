import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'

import { firestore } from '../firebase/firestore'
import type { WeatherData } from '../api/weather'
import type { MeasurementEntry, ForecastEntry, Measurement } from '../api/water'

export type WeatherSnapshot = WeatherData & {
  capturedAt: number
}

export type Coordinates = {
  lat: number
  lon: number
}

export type WaterDataSnapshot = MeasurementEntry & {
  capturedAt: number
}

export type WaterTemperatureSnapshot = MeasurementEntry & {
  capturedAt: number
}

export type ForecastSnapshot = {
  forecasts: ForecastEntry[]
  capturedAt: number
}

export type PastWaterLevelSnapshot = {
  data: Array<{ entry: MeasurementEntry; measurement: Measurement }>
  capturedAt: number
}

export type LocationRecordData = {
  locationName: string
  locationQuery: string
  coordinates?: Coordinates
  weatherSnapshot?: WeatherSnapshot
  waterDataSnapshot?: WaterDataSnapshot
  waterTemperatureSnapshot?: WaterTemperatureSnapshot
  forecastSnapshot?: ForecastSnapshot
  pastWaterLevelSnapshot?: PastWaterLevelSnapshot
  caughtFish?: string[] | Record<string, number> // Fogott halak listája vagy mennyiségekkel
  otherConditions?: string // Egyéb körülmények (pl. módszer, mélység)
}

export type LocationRecord = LocationRecordData & {
  id: string
  ownerUid: string
  createdAt: number
  updatedAt: number
  date?: string
  time?: string
}

export type LocationRecordPayload = LocationRecordData

const recordsCollection = (uid: string) => collection(firestore, 'users', uid, 'records')

const mapDoc = (uid: string, snapshot: QueryDocumentSnapshot<DocumentData>): LocationRecord => {
  const data = snapshot.data() as Omit<LocationRecord, 'id' | 'ownerUid'> & Partial<LocationRecord>

  return {
    id: snapshot.id,
    ownerUid: data.ownerUid ?? uid,
    locationName: data.locationName ?? '',
    locationQuery: data.locationQuery ?? '',
    coordinates: data.coordinates,
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt ?? Date.now(),
    weatherSnapshot: data.weatherSnapshot,
    waterDataSnapshot: data.waterDataSnapshot,
    waterTemperatureSnapshot: data.waterTemperatureSnapshot,
    forecastSnapshot: data.forecastSnapshot,
    pastWaterLevelSnapshot: data.pastWaterLevelSnapshot,
    caughtFish: data.caughtFish,
    otherConditions: data.otherConditions,
    date: data.date,
    time: data.time,
  }
}

const sanitize = <T extends Record<string, unknown>>(input: T) => {
  const result: Record<string, unknown> = {}

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value
    }
  })

  return result as T
}

export const listenToRecords = (
  uid: string,
  callback: (records: LocationRecord[]) => void,
  onError?: (error: Error) => void,
) => {
  // Próbáljuk meg először az orderBy-os lekérdezést
  const qWithOrderBy = query(recordsCollection(uid), orderBy('updatedAt', 'desc'))

  let fallbackUnsubscribe: (() => void) | null = null
  let isUsingFallback = false

  const unsubscribe = onSnapshot(
    qWithOrderBy,
    (snapshot) => {
      const records = snapshot.docs.map((docSnapshot) =>
        mapDoc(uid, docSnapshot as QueryDocumentSnapshot<DocumentData>),
      )
      callback(records)
    },
    (error) => {
      // Ha az orderBy lekérdezés hibát dob (pl. hiányzó index), próbáljuk meg az egyszerű lekérdezést
      if (!isUsingFallback) {
        console.warn('Az orderBy lekérdezés hibát dobott, fallback megoldást használunk:', error)
        isUsingFallback = true

        const qSimple = query(recordsCollection(uid))
        fallbackUnsubscribe = onSnapshot(
          qSimple,
          (snapshot) => {
            const records = snapshot.docs.map((docSnapshot) =>
              mapDoc(uid, docSnapshot as QueryDocumentSnapshot<DocumentData>),
            )
            // Kliens oldalon rendezzük updatedAt szerint csökkenő sorrendben
            records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
            callback(records)
          },
          (fallbackError) => {
            // Ha a fallback lekérdezés is hibát dob, akkor jelzünk hibát
            console.error('A fallback lekérdezés is hibát dobott:', fallbackError)
            onError?.(fallbackError as Error)
          },
        )
      } else {
        // Ha már fallback-et használunk és az is hibát dob, akkor jelzünk hibát
        onError?.(error)
      }
    },
  )

  // Wrapper unsubscribe függvény, ami mindkét subscription-t leiratkoztatja
  return () => {
    unsubscribe()
    if (fallbackUnsubscribe) {
      fallbackUnsubscribe()
    }
  }
}

export const addRecord = async (uid: string, payload: LocationRecordPayload) => {
  const ref = await addDoc(
    recordsCollection(uid),
    sanitize({
      ...payload,
      ownerUid: uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  )

  return ref
}

export const updateRecord = async (
  uid: string,
  recordId: string,
  payload: Partial<LocationRecordPayload>,
) => {
  const ref = doc(recordsCollection(uid), recordId) as DocumentReference<LocationRecordPayload>
  await updateDoc(
    ref,
    sanitize({
      ...payload,
      updatedAt: Date.now(),
    }),
  )
}

export const deleteRecord = async (uid: string, recordId: string) => {
  const ref = doc(recordsCollection(uid), recordId)
  await deleteDoc(ref)
}


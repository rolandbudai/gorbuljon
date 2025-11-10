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

export type WeatherSnapshot = WeatherData & {
  capturedAt: number
}

export type Coordinates = {
  lat: number
  lon: number
}

export type LocationRecordData = {
  locationName: string
  locationQuery: string
  coordinates?: Coordinates
  weatherSnapshot?: WeatherSnapshot
}

export type LocationRecord = LocationRecordData & {
  id: string
  ownerUid: string
  createdAt: number
  updatedAt: number
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
  const q = query(recordsCollection(uid), orderBy('updatedAt', 'desc'))

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const records = snapshot.docs.map((docSnapshot) =>
        mapDoc(uid, docSnapshot as QueryDocumentSnapshot<DocumentData>),
      )
      callback(records)
    },
    (error) => {
      onError?.(error)
    },
  )

  return unsubscribe
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


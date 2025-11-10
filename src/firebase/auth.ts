import { GoogleAuthProvider, getAuth } from 'firebase/auth'

import { firebaseApp } from './firebaseApp'

export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()



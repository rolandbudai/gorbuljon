import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

import { auth, googleProvider } from '../firebase/auth'

type AuthContextValue = {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  authActionRunning: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthActionRunning, setIsAuthActionRunning] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (isAuthActionRunning) return

    setIsAuthActionRunning(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } finally {
      setIsAuthActionRunning(false)
    }
  }, [isAuthActionRunning])

  const signOutUser = useCallback(async () => {
    if (isAuthActionRunning) return

    setIsAuthActionRunning(true)
    try {
      await signOut(auth)
    } finally {
      setIsAuthActionRunning(false)
    }
  }, [isAuthActionRunning])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signOutUser,
      authActionRunning: isAuthActionRunning,
    }),
    [isAuthActionRunning, loading, signOutUser, signInWithGoogle, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth csak AuthProvider-en belül használható.')
  }

  return context
}



import { GoogleAuthProvider, getAuth, deleteUser, reauthenticateWithPopup } from 'firebase/auth'

import { firebaseApp } from './firebaseApp'

export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

/**
 * Törli a jelenleg bejelentkezett felhasználó fiókját
 * @throws Error ha a törlés sikertelen
 */
export const deleteCurrentUserAccount = async (): Promise<void> => {
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('Nincs bejelentkezett felhasználó')
  }

  try {
    // Próbáljuk meg közvetlenül törölni
    await deleteUser(user)
  } catch (error: unknown) {
    // Ha a token lejárt, újra kell hitelesíteni
    if (error instanceof Error && error.message.includes('requires-recent-login')) {
      // Újrahitelesítés Google-lal
      await reauthenticateWithPopup(user, googleProvider)
      // Újrapróbálkozás a törléssel
      await deleteUser(user)
    } else {
      throw error
    }
  }
}



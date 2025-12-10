# Firebase Cloud Functions Proxy - Deployment Útmutató

## Előfeltételek

1. **Firebase CLI telepítése:**
   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase bejelentkezés:**
   ```bash
   firebase login
   ```

3. **Firebase projekt inicializálása** (ha még nem történt meg):
   ```bash
   firebase init
   ```
   Válaszd ki:
   - Functions: Configure a Cloud Functions directory
   - Hosting: Configure files for Firebase Hosting

## Konfiguráció

### 1. Firebase Projekt ID beállítása

Szerkeszd a `.firebaserc` fájlt és cseréld le a `your-firebase-project-id`-t a valódi Firebase projekt ID-dre:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

### 2. Környezeti változók beállítása

#### Development (.env.local)
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_OVSZ_API_TOKEN=your-ovsz-api-token
```

#### Production (.env.production vagy hosting környezeti változók)
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
VITE_OVSZ_API_TOKEN=your-ovsz-api-token
# Opcionális: explicit Cloud Function URL
# VITE_FIREBASE_FUNCTIONS_URL=https://us-central1-your-project-id.cloudfunctions.net/ovszwsProxy
```

**Megjegyzés:** Ha nem adsz meg explicit `VITE_FIREBASE_FUNCTIONS_URL`-t, a kód automatikusan generálja a `VITE_FIREBASE_PROJECT_ID` alapján.

## Deployment Lépések

### 1. Functions függőségek telepítése

```bash
cd functions
npm install
cd ..
```

### 2. Cloud Functions build és deploy

```bash
# Functions build
cd functions
npm run build
cd ..

# Functions deploy
firebase deploy --only functions
```

Vagy egyszerre:
```bash
firebase deploy --only functions
```

A deploy után megkapod a Cloud Function URL-t, pl:
```
https://us-central1-your-project-id.cloudfunctions.net/ovszwsProxy
```

### 3. Frontend build

```bash
npm run build
```

### 4. Frontend deploy (Firebase Hosting)

```bash
firebase deploy --only hosting
```

Vagy mindkettő egyszerre:
```bash
firebase deploy
```

## Ellenőrzés

1. **Cloud Function tesztelése:**
   Nyisd meg a böngészőben:
   ```
   https://us-central1-your-project-id.cloudfunctions.net/ovszwsProxy?token=YOUR_TOKEN&view=getvariables
   ```

2. **Frontend tesztelése:**
   Nyisd meg a Firebase Hosting URL-t és ellenőrizd, hogy az API hívások működnek-e.

## Hibaelhárítás

### CORS hiba továbbra is fennáll
- Ellenőrizd, hogy a Cloud Function sikeresen deploy-olva lett-e
- Ellenőrizd, hogy a `VITE_FIREBASE_PROJECT_ID` helyesen van-e beállítva
- Ellenőrizd a böngésző konzolját a pontos hibaüzenetért

### Cloud Function nem érhető el
- Ellenőrizd a Firebase Console-ban, hogy a Function aktív-e
- Ellenőrizd a Function logokat: `firebase functions:log`

### Build hiba
- Ellenőrizd, hogy a `functions/package.json` függőségei telepítve vannak-e
- Futtasd: `cd functions && npm install && npm run build`




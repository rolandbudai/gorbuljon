# HALNAPLÓ

Egy modern, React-alapú horgász napló alkalmazás, amely időjárási és vízállás adatokat jelenít meg, előrejelzéseket készít, és lehetővé teszi a helyszínek mentését és kezelését.

## Főbb funkciók

### 1. Időjárás és körülmények
- Levegő hőmérséklet, légnyomás, szél, felhőzet
- Csapadék, napkelte/napnyugta, holdfázis
- Helyszín keresés és automatikus helymeghatározás (geolocation)

### 2. Vízállás és vízhőmérséklet
- Legközelebbi mérőállomás vízállás adatai
- Vízhőmérséklet mérések
- Vízállás előrejelzés (7 nap: előző 3 nap, mai nap, következő 3 nap)
- Interaktív grafikon a vízállás változásáról
- Trend számítás (legkisebb-legnagyobb érték különbsége)

### 3. Adatkezelés
- Helyszínek mentése és kezelése
- Mentett rekordok megtekintése
- Excel export funkció
- Google bejelentkezéses autentikáció

### 4. UI/UX
- Kockásfüzet stílusú háttér az adatszekcióban
- Tooltip-ek információs ikonokkal
- Responsive design

## Technológiai stack

### Frontend
- **React 19.1.1** - UI framework (TypeScript)
- **Vite 7.1.7** - Build tool és fejlesztői szerver
- **CSS-in-JS** - Inline styles a komponensekben

### Backend/Szolgáltatások
- **Firebase** - Autentikáció és Firestore adatbázis
- **WeatherAPI** - Időjárás adatok lekérése
- **Vízmérési API** - Vízállás, vízhőmérséklet és előrejelzés adatok

### Egyéb könyvtárak
- **XLSX** - Excel export funkció
- **Geolocation API** - Böngésző alapú helymeghatározás
- **Haversine formula** - Távolság számítás mérőállomások között

### Fejlesztői eszközök
- **TypeScript 5.9.3** - Típusbiztos JavaScript
- **ESLint** - Kód minőség ellenőrzés
- **React Hooks** - useState, useEffect, useMemo

## Telepítés és futtatás

### Előfeltételek
- Node.js (v18 vagy újabb)
- npm vagy yarn

### Telepítés
```bash
npm install
```

### Fejlesztői mód
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Preview
```bash
npm run preview
```

## Konfiguráció

### WeatherAPI konfiguráció

A WeatherAPI használatához szerezz egy API kulcsot a [weatherapi.com](https://www.weatherapi.com/) oldalon, majd add hozzá a projekt `.env.local` fájljához:

```
VITE_WEATHER_API_KEY=ide_írd_az_api_kulcsot
```

A Vite csak `VITE_` prefixű változókat ad át a kliensnek. A kulcs nem kerül verziókezelésbe, mivel a `.env.local` már git-ignorált.

### Firebase konfiguráció

A Firebase használatához szükséges:
1. Firebase projekt létrehozása
2. Firestore adatbázis beállítása
3. Google Authentication engedélyezése
4. Firebase konfigurációs adatok hozzáadása a projektbe

## Firestore struktúra

Minden felhasználó a saját dokumentumai alatt tárolja a mentett helyszíneket:

- `users/{uid}/records/{recordId}`
  - `locationName`: a felhasználó által megadott megjelenítendő név
  - `locationQuery`: WeatherAPI lekérdezéshez használt kifejezés vagy koordináta (`lat,lon`)
  - `coordinates`: opcionális objektum `{ lat, lon }`
  - `createdAt`, `updatedAt`: Unix epoch milliszekundumban
  - `weatherSnapshot`: opcionális pillanatkép az aktuális időjárási adatokkal (`capturedAt`, `pressureHpa`, `pressureTrend`, stb.)

### Security rules példa

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/records/{recordId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Ezzel minden felhasználó csak a saját rekordjait látja és módosíthatja. Ha további metaadatokat (pl. `users/{uid}` dokumentum) tárolsz, bővítsd a szabályokat ennek megfelelően.

## Projekt struktúra

```
src/
├── App.tsx              # Fő alkalmazás komponens
├── main.tsx             # Alkalmazás belépési pont
├── index.css            # Globális stílusok
├── api/
│   ├── weather.ts       # WeatherAPI integráció
│   └── water.ts         # Vízmérési API integráció
├── context/
│   └── AuthContext.tsx  # Firebase autentikáció context
└── services/
    └── records.ts       # Firestore rekord kezelés
```

## Licenc

Ez a projekt privát és nem nyilvános használatra készült.

<!-- b6cc4680-e108-4b4f-b46c-bdf121a9e0d6 6d7fc6df-8c86-4aff-af31-c55755a5bd1e -->
# Mentett bejegyzések gombok felirat módosítása

## Cél

A mentett bejegyzések gombjainak feliratát módosítani úgy, hogy dátum + hely (megye nélkül) formátumban jelenjen meg, a jelenlegi "Település, Megye" helyett.

## Jelenlegi állapot

- A gombok jelenleg csak a `record.locationName`-t jelenítik meg (2609. sor)
- A `locationName` formátuma: "Település, Megye" (1104. sor: `[suggestion.name, suggestion.region].join(', ')`)
- A rekordokban van `date` és `time` mező (yyyy.mm.dd és HH:MM formátumban)

## Módosítások

### 1. Gomb felirat módosítása (`src/App.tsx`)

- **Hely**: ~2609. sor
- **Művelet**: 
- A `record.locationName` helyett egy formázott szöveget jelenítsünk meg
- A helynév megye nélkül: a `locationName`-ből a vessző előtti részt venni (vagy a `locationName.split(',')[0]` használata)
- A dátum: `record.date` (ha van), különben üres vagy fallback
- Formátum: Dátum és helynév egymás alatt (flexDirection: 'column' vagy két külön `<div>` vagy `<span>` elem)
- Stílus: A gomb stílusát módosítani, hogy a tartalom vertikálisan legyen elrendezve

### 2. Helper függvény létrehozása (opcionális)

- **Hely**: A komponensben, a `handleSelectRecord` közelében
- **Művelet**: 
- Létrehozni egy helper függvényt, ami kinyeri a helynevet megye nélkül
- Formátum: `const getLocationWithoutCounty = (locationName: string) => locationName.split(',')[0].trim()`
- Dátum formázás: `const formatRecordLabel = (record: LocationRecord) => { ... }`

## Fájlok módosítása

- `src/App.tsx`: 
- Helper függvény hozzáadása (~1200. sor körül)
- Gomb felirat módosítása (~2609. sor)

## Megjegyzések

- A `locationName` formátuma: "Település, Megye", szóval a vessző előtti részt vesszük
- Ha nincs dátum (`record.date`), csak a helynevet jelenítjük meg
- A dátum már yyyy.mm.dd formátumban van tárolva, szóval nem kell formázni
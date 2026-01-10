# Statisztikák Adattípusok Dokumentációja

Ez a dokumentum részletesen leírja az összes adattípust, amelyek a statisztikákban megjelennek, azok skáláját, mértékegységét, min-max értékeit és a -3-tól +3-ig terjedő kategorizálásukat.

## 1. Vízállás (waterLevel)

**Mértékegység**: `cm` (centiméter)

**Alapértelmezett skála**:
- **Minimum**: 0 cm
- **Maximum**: 500 cm

**Tárolás**: A `waterDataSnapshot.measurements` tömb utolsó mérésének értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | < 20 cm | Extrém alacsony |
| **-2** | 20 ≤ érték < 70 cm | Alacsony |
| **-1** | 70 ≤ érték < 120 cm | Kissé alacsony |
| **0** | 120 ≤ érték < 200 cm | Normál |
| **+1** | 200 ≤ érték < 400 cm | Kissé magas |
| **+2** | 400 ≤ érték < 700 cm | Magas |
| **+3** | ≥ 700 cm | Extrém magas |

---

## 2. Vízhőmérséklet (waterTemperature)

**Mértékegység**: `°C` (Celsius fok)

**Alapértelmezett skála**:
- **Minimum**: 0 °C
- **Maximum**: 30 °C

**Tárolás**: A `waterTemperatureSnapshot.measurements` tömb utolsó mérésének értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 2 °C | Extrém hideg |
| **-2** | > 2 és ≤ 6 °C | Hideg |
| **-1** | > 6 és ≤ 10 °C | Hűvös |
| **0** | > 10 és ≤ 16 °C | Mérsékelt |
| **+1** | > 16 és ≤ 20 °C | Meleg |
| **+2** | > 20 és ≤ 24 °C | Nagyon meleg |
| **+3** | > 24 °C | Extrém meleg |

---

## 3. Levegő hőmérséklet (airTemperature)

**Mértékegység**: `°C` (Celsius fok)

**Alapértelmezett skála**:
- **Minimum**: -20 °C
- **Maximum**: 40 °C

**Tárolás**: `weatherSnapshot.airTemperatureC` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ -10 °C | Extrém hideg |
| **-2** | > -10 és ≤ -2 °C | Hideg |
| **-1** | > -2 és ≤ 6 °C | Hűvös |
| **0** | > 6 és ≤ 16 °C | Mérsékelt |
| **+1** | > 16 és ≤ 24 °C | Meleg |
| **+2** | > 24 és ≤ 32 °C | Forró |
| **+3** | > 32 °C | Extrém forró |

---

## 4. Légnyomás (pressure)

**Mértékegység**: `hPa` (hektopascal)

**Alapértelmezett skála**:
- **Minimum**: 980 hPa
- **Maximum**: 1040 hPa

**Tárolás**: `weatherSnapshot.pressureHpa` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 985 hPa | Extrém alacsony |
| **-2** | > 985 és ≤ 995 hPa | Alacsony |
| **-1** | > 995 és ≤ 1005 hPa | Kissé alacsony |
| **0** | > 1005 és ≤ 1018 hPa | Normál |
| **+1** | > 1018 és ≤ 1025 hPa | Kissé magas |
| **+2** | > 1025 és ≤ 1035 hPa | Magas |
| **+3** | > 1035 hPa | Extrém magas |

---

## 5. Szélsebesség (windSpeed)

**Mértékegység**: `km/h` (kilométer per óra)

**Alapértelmezett skála**:
- **Minimum**: 0 km/h
- **Maximum**: 50 km/h

**Tárolás**: `weatherSnapshot.windSpeedKph` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 2 km/h | Szélcsend |
| **-2** | > 2 és ≤ 9 km/h | Gyenge szél |
| **-1** | > 9 és ≤ 18 km/h | Mérsékelt szél |
| **0** | > 18 és ≤ 29 km/h | Élénk szél |
| **+1** | > 29 és ≤ 40 km/h | Erős szél |
| **+2** | > 40 és ≤ 61 km/h | Viharos szél |
| **+3** | > 61 km/h | Erős vihar |

---

## 6. Felhőzet (cloudCover)

**Mértékegység**: `%` (százalék)

**Alapértelmezett skála**:
- **Minimum**: 0%
- **Maximum**: 100%

**Tárolás**: `weatherSnapshot.cloudCoverPercent` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 10% | Teljesen derült |
| **-2** | > 10 és ≤ 30% | Gyengén felhős |
| **-1** | > 30 és ≤ 50% | Közepesen felhős |
| **0** | > 50 és ≤ 70% | Változóan felhős |
| **+1** | > 70 és ≤ 85% | Erősen felhős |
| **+2** | > 85 és ≤ 95% | Borult |
| **+3** | > 95% | Teljesen borult |

---

## 7. Csapadék esély (precipitationChance)

**Mértékegység**: `%` (százalék)

**Alapértelmezett skála**:
- **Minimum**: 0%
- **Maximum**: 100%

**Tárolás**: `weatherSnapshot.precipitationChancePercent` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 5% | Nincs csapadék |
| **-2** | > 5 és ≤ 20% | Nagyon kicsi esély |
| **-1** | > 20 és ≤ 40% | Kicsi esély |
| **0** | > 40 és ≤ 60% | Közepes esély |
| **+1** | > 60 és ≤ 75% | Valószínű |
| **+2** | > 75 és ≤ 90% | Nagyon valószínű |
| **+3** | > 90% | Szinte biztos |

---

## 8. UV index (uvIndex)

**Mértékegység**: Nincs (dimenzió nélküli érték)

**Alapértelmezett skála**:
- **Minimum**: 0
- **Maximum**: 12

**Tárolás**: `weatherSnapshot.uvIndex` értéke

**Kategorizálás (-3 to +3)**:
| Szint | Értéktartomány | Leírás |
|-------|----------------|--------|
| **-3** | ≤ 1 | Minimális |
| **-2** | > 1 és ≤ 2 | Alacsony |
| **-1** | > 2 és ≤ 4 | Mérsékelt |
| **0** | > 4 és ≤ 6 | Közepes |
| **+1** | > 6 és ≤ 7 | Erős |
| **+2** | > 7 és ≤ 10 | Nagyon erős |
| **+3** | > 10 | Extrém |

---

## 9. Holdfázis (moonPhase)

**Mértékegység**: `nap` (napok száma a teliholdig)

**Alapértelmezett skála**:
- **Minimum**: 0 nap (telihold)
- **Maximum**: 29.5 nap (teljes holdciklus)

**Tárolás**: `weatherSnapshot.moonPhase` string értéke, amelyet átalakítunk napok számává:
- **"Full Moon"** → 0 nap
- **"Waxing Gibbous"** → ~4 nap
- **"First Quarter"** → ~7 nap
- **"Waxing Crescent"** → ~11 nap
- **"New Moon"** → ~15 nap
- **"Waning Crescent"** → ~19 nap
- **"Last Quarter"** → ~22 nap
- **"Waning Gibbous"** → ~26 nap

**Kategorizálás (-3 to +3)**:

A holdfázis kategorizálása a teliholdhoz viszonyított napok száma alapján történik. A `getMoonLevel()` függvény a következőképpen működik:

| Szint | Napok száma a teliholdig | Leírás (getLevelDescription alapján) |
|-------|---------------------------|--------------------------------------|
| **0** | napok = 0 | Telihold |
| **-1** | 0 < napok ≤ 1 | Első negyed |
| **-2** | 1 < napok ≤ 2 | Növő sarló |
| **-3** | 2 < napok ≤ 3 | Újhold |
| **+1** | 3 < napok ≤ 4 | Fogyó hold |
| **+2** | 4 < napok ≤ 5 | Utolsó negyed |
| **+3** | napok > 5 | Fogyó sarló |

**Megjegyzés**: 
- A `getMoonLevel()` függvény a napok számát a teliholdhoz viszonyítja
- A `getLevelDescription()` függvény a szint alapján adja vissza a leírást
- A leírások és a kód logikája között lehetnek eltérések, ezért a tényleges megjelenítés a `getLevelDescription()` függvény által visszaadott értéket használja

**Megjegyzés**: A holdfázis kategorizálása a teliholdhoz viszonyított napok száma alapján történik. A pozitív értékek a telihold után következő fázisokat, a negatív értékek a telihold előtti fázisokat jelölik.

---

## 10. Fényváltás (lightChange)

**Mértékegység**: Nincs (bináris érték: 0 vagy 1)

**Alapértelmezett skála**:
- **Minimum**: 0 (Nincs váltás)
- **Maximum**: 1 (Fényváltás)

**Tárolás**: Számított érték a `weatherSnapshot.sunrise`, `weatherSnapshot.sunset` és a rekord `date`/`time` alapján

**Számítási logika**:
- Az érték **1** (Fényváltás), ha a rekord időpontja a napkelte vagy napnyugta időpontjához képest **±30 perc** intervallumban van
- Az érték **0** (Nincs váltás), ha a rekord időpontja ezen intervallumon kívül esik

**Kategorizálás (0 to +1)**:
| Szint | Érték | Leírás |
|-------|-------|--------|
| **0** | 0 | Nincs váltás |
| **+1** | 1 | Fényváltás |

**Megjegyzés**: A fényváltás csak 2 szintet használ (0 és +1), nem a teljes -3 to +3 skálát.

---

## Általános Megjegyzések

### Dinamikus Skálázás

A statisztikák megjelenítésénél a tényleges adatok alapján dinamikusan módosulhatnak a min-max értékek:
- Ha a tényleges értékek kisebbek, mint az alapértelmezett minimum, akkor a tényleges minimumot használjuk
- Ha a tényleges értékek nagyobbak, mint az alapértelmezett maximum, akkor a tényleges maximumot használjuk
- Ha minden érték ugyanaz, akkor egy kis tartományt adunk hozzá (`min - 1`, `max + 1`)

### Normalizálás

A statisztikák megjelenítésénél minden adattípus értékei **0-100%** skálára normalizálódnak:
```
normalizedValue = ((value - min) / (max - min)) * 100
```

### Színkódolás

Minden szinthez (-3 to +3) tartozik egy egyedi háttérszín és border szín, amely az adattípus típusától függ. A színek a `getVariantColor()` függvényben vannak definiálva.

### Fogásszám

Minden rekordhoz tartozik egy **fogásszám** (`fishCount`), amely a `caughtFish` mezőből számolódik ki:
- Ha `caughtFish` egy tömb: a tömb hossza
- Ha `caughtFish` egy objektum: az összes érték összege
- Egyébként: 0

A fogásszám a statisztikákban a bubble/pont méretét határozza meg.


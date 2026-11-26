# Plan: un recorrido en el mapa grande

Diseño: [`../specs/2026-11-26-recorrido-en-el-mapa-design.md`](../specs/2026-11-26-recorrido-en-el-mapa-design.md),
aprobado por Abel el 26 de noviembre. Sus secciones «Decisiones de la revisión» y «Segunda revisión» mandan sobre lo
anterior. Rama: `claude/recorrido-en-el-mapa`, que sale de `claude/mapa-de-un-lugar` (PR #54).

Se apoya en lo que ya hay: `src/resources/v3/placesV3.ts`, `src/app/frame/PlaceMap.tsx` (la hoja `PlaceSheet` y la
vista `PlaceSheetView`), `mapTheme.ts`, y en bt-synergy `trip`, `travelDays`, `passagePlaces`, `drawMap` (`route`,
`badge`), `fit` y `project`.

Cada tarea termina con `npm run typecheck` y sus pruebas en verde, y un commit.

## 1. El cálculo, puro y probado (`src/resources/v3/routeV3.ts`)

- `type Leg = { from: PlaceAt; to: PlaceAt; km?: number; days?: { foot; horse; ship? }; why?: 'dudoso' | 'region' | 'agua' | 'cerca' | 'sinPunto'; offMap: boolean }`.
- **`legsOf(stops, bbox): Leg[]`**, un tramo por cada par seguido.
  - Usa `trip(a, b)`; si no da `days`, deduce `why` en este orden:
    1. `sure` 0 → `sinPunto`;
    2. `form` 2 → `region`;
    3. `form` 3 → `agua`;
    4. `near` → `cerca`;
    5. `sure` 1 → `dudoso`.
  - `km` sale de `trip` cuando lo da, o de `distance` cuando los dos lugares tienen punto.
  - `offMap` es verdadero si alguno de los dos lugares no está dentro de `bbox` (`inBasemap`).
- **`totalOf(legs)`**: la suma de los km; la suma de los `low` y la de los `high` a pie y a caballo, solo si todos los
  tramos tienen días; nunca el barco.
- **`roundKm(km)`**: a 10 si pasa de 100 y a 1 si no.
- **`daysText(range)`**: devuelve una clave y sus valores, sin texto suelto:
  - `{0,1}` → «menos de un día»;
  - `low ≥ 60` → «más de dos meses»;
  - `low == high` → «unos N días»;
  - si no, «de N a M días».
- **`badgesOf(stops)`**: `Map<id, string>` con los números de parada, por ejemplo «1, 3» si el lugar se repite.
- **`canAdd(stops, place)`**: falso si el lugar es igual a la última parada o tiene `sure` 0.
- **`nearestStop(frame, points, x, y, radius = 22)`**: con `project`, el punto más cercano a menos de 22 px, o `null`.
- **`routeFrame(current, stops, width, height)`**:
  - devuelve el `Frame` actual si todas las paradas dibujables caben;
  - si no, uno nuevo que cubre el anterior y las paradas;
  - nunca achica.
- **Pruebas:**
  - dos tramos y su total;
  - un tramo con un lugar dudoso, con una región, con agua y casi en el mismo lugar, y que el total no dé días si
    falta uno;
  - el barco solo entre puertos y nunca en el total;
  - los redondeos y las cuatro formas de los días;
  - un badge «1, 3»;
  - `canAdd` con la última parada repetida;
  - `nearestStop` dentro y fuera del radio;
  - un `routeFrame` que crece y que no se achica;
  - las cifras de Jope a Nínive con coordenadas fijas en la prueba, no de memoria.

## 2. Los lugares del libro

- **`bookPlaces(reader, book)`** en `placesV3.ts`: `passagePlaces` del primer al último versículo del libro, sin
  repetidos, en orden de aparición. Con su prueba.
- **La cita de un lugar** sale de su versículo, no del capítulo de la sección:
  - capítulo = `Math.floor(verse / 1000) % 1000`, versículo = `verse % 1000`;
  - se cambia `citeOf` en `PlaceMap.tsx` para que use eso; si es otro capítulo, se dice el capítulo también (`3:3`).

## 3. La hoja con el recorrido (`PlaceMap.tsx`, o un `RouteSheet.tsx` aparte si `PlaceMap.tsx` pasa de unas 400 líneas)

- **El estado vive en `PlaceSheet`:** `stops: PlaceAt[]`, `frame`, el aviso «Ya es la última parada» y si «Lugares
  de todo el libro» está abierto. Al cerrar la hoja se pierde.
- **El mapa:**
  - fijo arriba con `position: sticky`, 280 px de alto en el teléfono; en la computadora, al lado de la lista si cabe,
    como el resto de las hojas de dos columnas de la app;
  - con paradas, `drawMap` recibe:
    - los lugares del capítulo dentro del mapa, como `ref`, salvo los elegidos;
    - las paradas dibujables, como puntos normales, con `form: 1`, `sure: 3` y su `badge`;
    - `route` con los ids de las paradas dibujables, en orden;
    - `frame` de `routeFrame`.
  - Sin paradas, se dibuja como hoy.
- **Tocar el mapa:** un `onClick` en la caja del SVG pasa el toque a coordenadas del SVG y llama a `nearestStop` con
  los puntos dibujados. Si encuentra uno, lo agrega como si se tocara en la lista.
- **La lista:**
  - **«Recorrido»:**
    - la indicación «Toque los lugares en el orden del viaje» sin paradas, o «Toque otro lugar para ver el camino» con
      una (las dos con su forma `.computadora`);
    - las paradas, cada una con «Parada N» y «Quitar»;
    - los tramos y el total, la aclaración de la línea recta, y «Borrar el recorrido».
  - **«Lugares de este capítulo»:**
    - todos, también los de más de 1.000 km y los que están fuera del mapa;
    - cada uno es un botón de 44 px que lo agrega;
    - los `sure` 0, en gris y sin botón, con «sin punto en el mapa»;
    - los que quedan fuera del mapa siguen diciendo «fuera de este mapa».
  - **«+ Lugares de todo el libro»:** un `<details>` con los demás lugares del libro, que se cargan al abrirlo con
    `useLookup` y `bookPlaces`.
- **Un tramo fuera del mapa** dice «Este tramo no se ve en el mapa».
- **El `summary` del mapa** con paradas: «Recorrido: Jope, Nínive».
- **Textos nuevos** en es, pt y en, todos con prefijo `ayudas.recorrido…`, y los números con `Intl.NumberFormat` del
  idioma de la app.
- **Pruebas** con `renderToStaticMarkup` sobre una vista pura de la lista (como `PlaceSheetView`):
  - sin paradas, con una y con dos;
  - un tramo sin tiempo;
  - un tramo fuera del mapa;
  - el aviso de la última parada.

## 4. Comprobar en la app (lo hace el encargado, no el subagente)

- **Contra staging** (`.claude/dev.mjs` con `VITE_SERVOS_PACKS=staging`), Jonás 1:3 en es-419:
  - Jope y Nínive;
  - agregar Tarsis (fuera del mapa);
  - quitar una parada;
  - tocar un punto en el mapa;
  - abrir «Lugares de todo el libro».
- **Lista de comprobación de `FILOSOFIA_DE_DISENO.md`:** a 375 px, en es, pt y en, y en los temas claro, oscuro y
  modo sol.

## 5. Cerrar

- `npm test` y `npm run typecheck` completos.
- Revisión del código por un pez dorado.
- PR con el OK de Abel.

## Correcciones de la revisión del plan (26 nov)

Valen sobre lo de arriba.

1. **La línea la dibuja Servos, no `route` de `drawMap`.**
   - `drawMap` une todos los ids de `route` que estén en `points`, aunque falte uno en medio, y solo acepta un
     recorrido.
   - Por eso a `drawMap` se le pasan solo los puntos, sin `route`. Servos dibuja cada tramo cuyos dos extremos están en
     el mapa en un SVG encima, del mismo tamaño y sin recibir toques, con `project(frame, lat, lon)`.
   - Cada tramo es una línea punteada (`stroke-dasharray="6 4"`) del color `--map-route`.
   - Así, en Jope → Tarsis → Nínive no aparece una línea Jope → Nínive que no es un tramo.
2. **Puntos sin repetir.** Cada lugar va una sola vez en `points`, con su `badge` («1, 3» si se repite). Las
   repeticiones solo cuentan en la lista y en los tramos. En React, la llave de cada parada es su posición, no su id.
3. **El encuadre se guarda en grados, no en píxeles.**
   - La hoja guarda los **límites** del recorrido: una lista de puntos `LatLon` que deben verse.
   - El `Frame` se calcula en cada dibujo con `fit(límites, ancho, alto)`, así que sigue bien cuando cambia el ancho
     y no se aleja un poco más en cada toque.
   - Al abrir la hoja, los límites son el lugar tocado, los lugares del capítulo que están en el mapa y las dos
     esquinas de 150 km (`sheetBounds`, en `placesV3.ts`, con su prueba).
   - Al agregar una parada en el mapa que cae fuera del `Frame` actual, se suma a los límites. Los límites nunca
     pierden puntos.
   - `routeFrame` se cambia por `growBounds(bounds, stop)`.
4. **Un nuevo `useRouteSvg`** (o un `useMapSvg` ampliado) recibe los puntos, los límites y los tramos. Devuelve
   `{ setBox, svg, overlay, frame }`, y con `frame` se resuelve `nearestStop`.
5. **El alto del mapa en la hoja:** 280 px en el teléfono, con `position: sticky`. Comprobar en el navegador que
   queda fijo dentro de `.sheet-body`; si el envoltorio `<div dir>` o el margen negativo lo impiden, mover el mapa
   fuera del envoltorio.
6. **Los días:**
   - un tramo `near` cuenta como `{ low: 0, high: 0 }` para el total, y en su fila dice «Están casi en el mismo lugar»;
   - el texto de un rango:
     - `high` 0 o 1 con `low` 0: «menos de un día»;
     - `low` 0 y `high` mayor: «hasta M días»;
     - `low == high == 1`: «un día»;
     - `low == high`: «unos N días»;
     - `low` 60 o más: «más de dos meses»;
     - si no: «de N a M días»;
   - cada forma es su propia clave de i18n, así que no hace falta una regla de plurales.
7. **`bookPlaces`** usa `passagePlaces` sobre el rango del libro (ya da cada lugar una vez y en orden); se puede
   reusar `chapterRangeV3` para los extremos.
8. **«fuera de este mapa»** significa solo fuera del mapa base. Un lugar del capítulo a más de 1.000 km pero dentro
   del mapa no lleva esa marca: no se dibuja como gris, pero se dibuja si se elige.

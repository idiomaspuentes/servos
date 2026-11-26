# Plan: el mapa de un lugar

Diseño: [`../specs/2026-11-26-mapa-de-un-lugar-design.md`](../specs/2026-11-26-mapa-de-un-lugar-design.md), aprobado por
Abel el 26 de noviembre. Issue: idiomaspuentes/servos#46. Rama: `claude/mapa-de-un-lugar`.

Hecho antes de este plan: `bt-synergy.ref` = `3cb4fc75` (commit propio; 857 pruebas y tipos pasan).

## Lo confirmado al planear

- `xtopics` (de `common`) y `topics` (del idioma) están en `DEFAULT_UNITS` del cliente
  (`language-pack-client/src/plan.ts:18`): se instalan con cada libro, porque Servos instala con `defaults` por omisión.
  Un aparato que instaló antes de que existieran los recibe en su próxima actualización.
- Servos **no** llama hoy a `fetchComplements`, y `exportBookV3` (`src/resources/v3/filesV3.ts:248`) exporta sin
  `complements`. Las dos cosas se agregan.
- Número de versículo de las consultas: `libro × 1.000.000 + capítulo × 1.000 + versículo`, con el libro según su
  posición en `BOOKS` más 1 (así lo lee `companionsV3.ts:75`).
- Artículo a concepto: `articleIdV3({ kind: 'tw', path })` (`src/resources/v3/lookups.ts:231`) da `tw:names/joppa`.
- La tarjeta lee el paquete con `useMapHere(language, unit)` y `useLookup(open, language, key, ask)`
  (`src/app/frame/acrossBooks.tsx:29,50`), como «En toda la Biblia».
- Temas: `:root[data-theme='dark']`, `[data-theme='sun']` y `prefers-color-scheme` (`src/app/styles.css:56-130`).

## Tareas

Cada tarea termina con `npm run typecheck` y sus pruebas en verde, y un commit.

### 1. Tipos de bt-synergy

En `src/resources/btSynergy.d.ts`, declarar lo que el mapa usa, copiando las firmas reales de bt-synergy `3cb4fc75`:

- en `@bt-synergy/language-pack-client`:
  - las consultas `placesOf`, `passagePlaces`, `placeQuery` y `distance`, con sus tipos `PlaceRef`, `PlaceAt`,
    `PlaceData` y `LatLon`;
  - el dibujo `drawMap`, `fit`, `project`, `LIGHT_THEME` y `LIGHT_REFERENCE`, con sus tipos `DrawMapOptions`,
    `MapPoint`, `Theme` y `Frame`;
  - en `LanguagePackClient`: `fetchComplements` y `FetchComplementsReport`, y la opción `complements` de
    `exportTransfer`;
- en `@bt-synergy/language-pack-v3`: `basemapOf`, `decodeBasemap`, `Basemap` y `BASEMAP_MAX_BYTES`, y los complementos
  del catálogo (`complements` en el tipo del catálogo verificado), si faltan.

### 2. Qué lugar es la palabra (`src/resources/v3/placesV3.ts`, puro y probado)

- `verseIdV3(book, chapter, verse): number`.
- `inBasemap(p: LatLon, bbox)`: dentro del rectángulo del mapa base (grados × 100).
- `placeOfWord(reader, article, verseId, bbox): Promise<PlaceAt | null>`, en cuatro pasos:
  1. pide `placesOf` del versículo y quita los de `sure` 0 y los que quedan fuera de `bbox`;
  2. pide `placeQuery` de cada uno y se queda con los que tienen `articleIdV3` del artículo en `tw`;
  3. elige el de mayor `sure`, y si empatan, el primero;
  4. devuelve `null` si no hay lugar, o si la respuesta dice que algo no está instalado.
- `neighbours(place, candidates): PlaceAt[]`: los otros lugares que no sean el mismo `id`, con `sure` mayor que 0 y
  dentro del mapa base; los seis más cercanos y a menos de 1.000 km (`distance`).
- `mapPoints(place, neighbours, names): MapPoint[]`: el lugar con `sure: 3` y `form: 1`; los vecinos con `ref: true`.
- `mapFrame(place, neighbours, width, height): Frame`: `fit` de todos (sin `ref`) más dos esquinas a 150 km al
  noroeste y al sureste del lugar (latitud ± 1,35°; longitud ± 1,35° / cos(latitud)).
- Pruebas (con un `PackReader` falso que responde `placesOf` y `placeQuery`):
  - ningún lugar, uno, dos con distinta certeza, `sure` 0, fuera del mapa base, y un artículo que no es del lugar;
  - los vecinos: siete cercanos (quedan seis) y uno a 1.200 km (no entra);
  - el encuadre: un lugar solo cubre unos 300 km, y con Nínive el encuadre la incluye.

### 3. El mapa base sin internet (`src/resources/v3/basemapV3.ts`)

- `fetchBasemapV3(client, lang)`: `fetchComplements(lang, { kinds: ['basemap'] })`. Nunca falla: su error se ignora.
  Se llama al final de cada instalación que termina en `listo` (en `installV3` de `onlineV3.ts`, o donde el código la
  llame).
- `basemapV3(): Promise<Basemap | null>`:
  - lee los catálogos guardados de `common` (como `catalogsFrom` en `client.ts`) y saca `basemapOf(complements)`;
  - luego `store.get(id)` y `decodeBasemap`;
  - guarda el resultado en memoria por id y lo olvida cuando se olvidan los lectores (`forgetReadersV3`);
  - devuelve `null` si no está o si algo falla.
- `exportBookV3` pasa `complements: true`. Comprobar que `importTransfer` guarda los complementos que trae el archivo;
  si no los guarda, parar y escribirle al encargado del formato 3.
- Pruebas: extender `src/resources/v3/testing/sample.ts` con un complemento `basemap` pequeño (`encodeBasemap`) en
  el catálogo `common` de la muestra, y probar:
  - que después de instalar y `fetchBasemapV3`, `basemapV3()` lo devuelve;
  - que un libro exportado e importado en otro almacén lo trae;
  - que sin complemento da `null`.

### 4. Los colores del mapa

- En `styles.css`, variables `--map-sea`, `--map-land`, `--map-coast`, `--map-lake`, `--map-river`, `--map-route`,
  `--map-point`, `--map-point-hollow`, `--map-label`, `--map-halo`, `--map-cluster`, `--map-cluster-text`,
  `--map-reference` y `--map-reference-label`, con su valor en el tema claro, el oscuro (los dos selectores) y el modo
  sol. En el tema oscuro, el halo también es oscuro.
- `src/app/frame/mapTheme.ts`: `mapTheme(style: CSSStyleDeclaration): Theme`. Si falta una variable, usa el valor de
  `LIGHT_THEME`. Prueba con un objeto de estilo falso.
- `measureText(fontSize)`: con un `canvas` y la fuente del cuerpo de la app.

### 5. El mapa en la tarjeta (`src/app/frame/PlaceMap.tsx`)

- **`usePlaceMap(data, article, verseId)`:**
  - con `useMapHere(language, 'xmap')` y `useLookup`, pide `placeOfWord`; si encuentra el lugar, pide los vecinos con
    `passagePlaces` del capítulo, más `basemapV3()`;
  - la clave de la consulta incluye el artículo y el versículo;
  - devuelve `undefined` mientras busca, `null` si no hay lugar, y `{ place, neighbours, basemap | null }`.
- **`<PlaceMap>`**, dentro de la ayuda `palabra` de `TouchWords.tsx` (entre la cita y «Leer sobre…»):
  - **Mientras busca:** nada. `placesOf` del versículo es rápido; la altura se reserva solo cuando ya hay lugar y
    faltan los vecinos.
  - **Con lugar y mapa base:** un SVG de `drawMap` del ancho de la ayuda y 180 px de alto, sin borde.
    - Recibe `summary`, `dir` (la dirección del proyecto) y `measure`.
    - Se dibuja con `dangerouslySetInnerHTML`. El SVG lo hace `drawMap` con datos del paquete firmado; comprobar que
      escapa los nombres y, si no, escaparlos antes.
    - Se vuelve a dibujar cuando cambia `data-theme` (un `MutationObserver` en `document.documentElement`) o el
      esquema de color.
  - **Con `sure` 1:** debajo, la línea `ayudas.mapaDudoso`.
  - **La fila «Ver el mapa grande ›»** (`ayudas.mapaGrande`), de 44 px, del mismo estilo que `word-help-read`. Tocar el
    SVG hace lo mismo.
  - **Con lugar y sin mapa base:** solo la línea `ayudas.mapaNoEsta`.
- **La hoja grande:** se abre con el mismo marco de hoja que `ArticleSheet` (cerrar, foco, diálogo en la
  computadora).
  - Muestra el mapa a todo el ancho y unos 360 px de alto, con todos los lugares del capítulo con nombre (los vecinos
    sin el límite de seis, pero con el de 1.000 km), y el lugar tocado marcado.
  - Debajo, la lista «Nombre · 1:3» de los lugares, y el crédito `ayudas.mapaCredito`: el del mapa base, de su
    complemento, y las fuentes del lugar (`placeQuery().sources`).
- **Textos nuevos** en `es.json`, `pt.json` y `en.json`: `ayudas.mapaGrande`, `ayudas.mapaDudoso`, `ayudas.mapaNoEsta`,
  `ayudas.mapaCredito`, `ayudas.mapaResumen` (el `summary`), y el título de la hoja. Cada uno lleva su forma
  `.computadora` si dice «toque».
- **Pruebas:** con `@testing-library/react`, como las de la tarjeta:
  - con lugar y mapa base se ve el SVG y la fila;
  - con lugar sin mapa base, la línea;
  - sin lugar, nada;
  - con `sure` 1, la línea de duda.

### 6. Comprobar en la app

- **Contra staging** (`VITE_SERVOS_PACKS`), con el servidor de desarrollo:
  1. bajar Jonás en es-419;
  2. abrir 1:3, tocar «Jope» y ver el mapa con Nínive;
  3. abrir la hoja grande;
  4. cortar internet (ver las herramientas de red) y repetir.
- **Lista de comprobación de `FILOSOFIA_DE_DISENO.md`:** a 375 px, en es, pt y en, y en tema claro, oscuro y modo sol.
- **Un libro recibido:** exportar Jonás, borrar los datos del sitio, importar el archivo sin internet y ver el mapa.
- **Sin mapa base:** borrar solo el complemento del almacén y ver la línea «no está en este aparato».

### 7. Cerrar

- `npm test` y `npm run typecheck` completos.
- Revisión de un pez dorado (Sonnet) con el diseño, este plan y el diff.
- PR con «Closes #46» y capturas a 375 px.

## Riesgos

- `drawMap` y su SVG en un contenedor de 343 px: si los nombres se ven muy chicos, usar `fontSize` 13 en la tarjeta.
- Si `importTransfer` no guarda los complementos, el caso del libro recibido depende del formato 3: pedirlo a su
  encargado y dejar ese caso fuera del PR, diciéndolo.

## Correcciones de la revisión (26 nov)

Valen sobre lo de arriba.

1. **La unidad es `xtopics`, no `xmap`.** `useMapHere` se amplía a `'xmap' | 'map' | 'xtopics'`, y `PlaceMap` usa
   `'xtopics'`. Al revisar si algo falta instalado en `placesOf`, se mira solo `xtopics`.
2. **La exportación ya lleva los complementos.** `exportTransfer` los incluye salvo con `complements: false`
   (`transfer.ts:416`), e `importTransfer` los guarda (`transfer.ts:200-226`). Lo que falta es una prueba de que un
   libro exportado lleva el mapa base: que el catálogo `common` esté entre los que exporta Servos. El riesgo de
   «escribirle al encargado del formato 3» se quita.
3. **El id del mapa base es binario.** `basemapOf` recibe los complementos de **todos** los catálogos (el del idioma
   y `common`), y solo devuelve algo si hay exactamente un `basemap` versión «1». Devuelve la entrada del catálogo,
   cuyo `id` es un `Uint8Array`: hay que pasarlo a hex (64 caracteres) antes de `store.get`, como hace
   `catalogsFrom`.
4. **`basemapV3(lang)` lleva el idioma.** Llega al almacén con `parts.get(client)` dentro de `client.ts` (se escribe
   ahí o se exporta desde ahí un ayudante), y a los catálogos con `status(lang).active.id`, como `catalogsFrom`. La
   memoria guarda por id del complemento y se borra en `forgetReadersV3`.
5. **Las regiones.** `placeOfWord` acepta las regiones (`form` 2) como lugar tocado, porque el diseño dice que se
   muestran como punto. Se dibujan con `form: 1`. Los vecinos salen de `passagePlaces`, que ya las quita.
6. **`mapPoints(place, neighbours)`**, sin `names`: `PlaceAt.name` es el `label`.
7. **El encuadre**, dicho claro: `fit` recibe el lugar, los vecinos y las dos esquinas, todos **sin** `ref`, y su
   `Frame` se pasa a `drawMap` como `frame`. Al dibujar, los vecinos llevan `ref: true` y las esquinas no se dibujan.
8. **Muestra para las pruebas.** `testing/sample.ts` no tiene `xtopics`, `topics` ni `map`. Las pruebas de
   `placeOfWord` y de la tarjeta usan un `PackReader` falso que responde `placesOf`, `passagePlaces` y `placeQuery`.
   La muestra solo gana el complemento `basemap` en `common`, y un `xtopics` mínimo si la prueba de instalación lo
   necesita.
9. **El versículo en la tarjeta.** La ayuda `palabra` no lleva versículo. `TouchWords` ya conoce el versículo de la
   palabra tocada (cerca de la línea 550, `l.verse`). `PlaceMap` recibe libro, capítulo y versículo de ahí y arma
   `verseIdV3`. El número es el de la Biblia del texto puente, que es el de `xtopics`: la numeración hebrea
   (`inHebrewNumbering`) es solo para el original y no se usa aquí. Comprobarlo con Jonás 1:3 (es igual en las dos).
10. **Bajar el mapa base también al actualizar.** `fetchBasemapV3` se llama después de cada `installV3` y de cada
    `refreshV3` que terminan bien. Además, si `basemapV3(lang)` no lo encuentra y hay internet, se pide una vez por
    sesión. Así un aparato que ya tenía el libro lo recibe sin reinstalar.
11. **En la computadora** (`inColumn`, `TouchWords.tsx:398`): la hoja grande se abre igual que `ArticleSheet` se abre
    desde la columna, y `dir` sale de la dirección del proyecto (`data.direction` o la que use el panel de texto).
12. **Mientras busca:** no se reserva nada. Cuando `placeOfWord` encuentra el lugar, se reserva un bloque de 180 px del
    color del mar del mapa hasta que llegan los vecinos y el mapa base.

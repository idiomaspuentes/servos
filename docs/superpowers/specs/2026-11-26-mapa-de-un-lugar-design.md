# El mapa de un lugar (tarjeta de la palabra)

Fecha: 26 de noviembre de 2026. Estado: diseño por aprobar. Issue: idiomaspuentes/servos#46.

## Para qué

Cuando un versículo nombra un lugar (Jope, Nínive, Tarsis), el traductor necesita saber dónde queda: si es un puerto,
si está lejos de lo demás, hacia dónde va quien viaja. Hoy la tarjeta de la palabra solo ofrece el artículo de las
palabras («Leer sobre Jope ›»). Este diseño le agrega **el mapa del lugar**, dibujado en el aparato, sin internet, con
los nombres en la lengua de las ayudas del proyecto.

Decisiones de Abel:

- **2 de noviembre** (`docs/INVESTIGACION_MAPAS_E_IMAGENES.md`, «Lo que decidió Abel»): un mapa base propio con los
  nombres en cada lengua; nada de mapas ya dibujados en inglés.
- **26 de noviembre:** primero el mapa de un lugar. Las imágenes de animales y plantas esperan a la clase `images` del
  formato 3, que todavía no tiene fase (#53).

## Lo que traen los paquetes

Todo está en bt-synergy `master` (tc-study #106 a #109). La carpeta compartida `../bt-synergy` ya está en `3cb4fc75`, y
Servos sube su `bt-synergy.ref` a ese commit.

- **Los lugares** (`xtopics.geo`, del catálogo `common`): cada `lug:` tiene latitud y longitud, su certeza `sure` y su
  forma `form` (1 ciudad o sitio, 2 región, 3 a 4 otros puntos, 5 puerto). `sure` 3 es seguro, 2 probable, 1 dudoso y
  0 sin punto. El nombre en la lengua sale de `topics.places` del idioma. Si el idioma no lo tiene, sale del título en
  inglés.
- **Las consultas** (`@bt-synergy/language-pack-client`):
  - `placesOf(reader, verse)` da los lugares de un versículo como `PlaceAt` (id, nombre, lat, lon, `sure`, `form`).
  - `passagePlaces(reader, first, last)` da los de un pasaje, sin las regiones.
  - `placeQuery(reader, id)` da un lugar con sus artículos `tw` y sus fuentes.
- **El mapa base:** el complemento `basemap` del catálogo `common` (5,8 KB):
  - costas, lagos y ríos de Natural Earth, de dominio público;
  - cubre de 8° a 52° este y de 22° a 43° norte (de Italia a Persia, de Egipto al mar Negro);
  - se baja con `fetchComplements` y queda en el `BlobStore` con su sha256 como id;
  - `exportTransfer({ complements: true })` lo lleva en un archivo.
- **El dibujo:** `drawMap({ points, basemap, frame, theme, dir, summary, measure })` devuelve un SVG en texto, sin usar
  la red. Separa solo los puntos que se tocan y los nombres que chocan.

## Qué lugar es la palabra

1. La palabra tocada tiene un artículo `tw` (por ejemplo `bible/names/joppa`, el concepto `tw:names/joppa`).
2. Se piden los lugares del versículo con `placesOf`. Se quitan los de `sure` 0 (sin punto) y los que quedan fuera del
   mapa base.
3. Para cada uno se pide `placeQuery` (son pocos por versículo) y se queda el que tiene ese concepto en su lista `tw`.
4. Si hay varios, se elige el de mayor `sure`, y si empatan, el primero.
5. Si no hay ninguno (el versículo no tiene el lugar en `xtopics`, o le falta el punto), la ayuda queda como hoy. No se
   busca el lugar por otro camino: si el paquete no lo pone en ese versículo, Servos tampoco.

## Dónde aparece

**En la tarjeta de la palabra, dentro de la ayuda «palabra» del lugar.** Ahí ya están la cita del artículo y el botón
«Leer sobre Jope ›». El mapa va entre los dos, como parte de la misma ayuda:

```
  Jope
  «Ciudad portuaria en la costa…»        ← la cita del artículo, como hoy
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     ← el mapa, de borde a borde de la ayuda, sin marco propio;
  ░░░ ● Jope        · Nínive ░░░░░░░░░     unos 180 px de alto
  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  No se sabe con certeza dónde quedaba    ← solo con sure 1, en letra tenue
  Ver el mapa grande ›                    ← fila de 44 px
  Leer sobre Jope ›                       ← como hoy
```

- **El mapa no lleva caja propia** (principio 12): es una franja de la ayuda, sin borde ni sombra.
- **La acción tiene palabra** (principio 12): «Ver el mapa grande ›» es una fila como «Leer sobre…», de 44 px. Tocar
  el mapa hace lo mismo, pero la fila es la que se ve.
- **Los puntos:**
  - el lugar va siempre con su punto lleno y su nombre: se le pasa a `drawMap` con `sure: 3` y `form: 1`. Si no,
    `drawMap` dibujaría un anillo hueco para `sure` 2 y 1, igual que los grises, y solo el nombre, sin punto, para
    una región. La duda la dice la línea de abajo, no el dibujo;
  - van también los otros lugares del capítulo (`passagePlaces` del capítulo, sin `sure` 0 y dentro del mapa base), en
    gris y con nombre pequeño;
  - de esos se toman los seis más cercanos al lugar y que estén a menos de 1.000 km (`distance`). Así Jope muestra
    Nínive, pero no a Tarsis si la ponen en España, y el lugar nunca queda como un punto perdido.
- **El encuadre:** como `fit` ignora los puntos `ref`, el encuadre se calcula con `fit` sobre **todos** los puntos
  elegidos (el lugar y los grises, sin `ref`) y se pasa como `frame`. Al dibujar, los grises van con `ref: true`, para
  que se vean de referencia. Para que el mapa nunca quede demasiado cerca, a esos puntos se les suman dos esquinas
  invisibles, a 150 km del lugar hacia el noroeste y hacia el sureste. Así se ven al menos unos 300 km alrededor (la
  costa, el río), aunque el lugar esté solo o sus vecinos estén muy cerca.
- **Nombres que no caben:** `drawMap` deja sin nombre un punto gris si su nombre choca con otro. En la tarjeta se
  acepta así; la hoja grande lista todos los lugares con su nombre.
- **La certeza:**
  - `sure` 3 y 2 no dicen nada;
  - `sure` 1 agrega una línea tenue, «No se sabe con certeza dónde quedaba». No es un aviso (principio 6).
- **Una región** (`form` 2) se muestra como punto, igual que un sitio. Sus límites no vienen en los paquetes.

**La hoja grande** («Ver el mapa grande ›»):
- Es la misma hoja que abre un artículo (`ArticleSheet`): igual se cierra, igual vuelve el foco y, en la computadora,
  igual se ve como diálogo.
- Muestra el mapa del capítulo a todo el ancho, con todos los lugares del capítulo y su nombre, y el lugar tocado
  marcado.
- Debajo, la lista de esos lugares («Jope · 1:3») y el crédito.

Por qué ahí y no en otro lugar: la tarjeta de la palabra es donde el traductor ya pregunta «¿qué es esto?» (principio
4). El texto sigue en el centro y el mapa llega solo si se toca la palabra (principio 3). Un mapa del libro o del
capítulo fuera de la tarjeta, como el de Mini, queda para después.

## Sin internet

- **Bajar:** el mapa base se baja **junto con el libro**, en el mismo paso, cuando el idioma se instala o se actualiza
  en formato 3. Pesa 6 KB, así que no se pregunta aparte.
- **Compartir y recibir:** al compartir un libro como archivo, el archivo lleva el mapa base, y al recibirlo queda
  guardado.
- **Lugar con punto, pero sin mapa base en el aparato:**
  - en lugar del mapa va una línea tenue, «El mapa no está en este aparato. Llega al actualizar las ayudas con
    internet, o al recibir un libro de alguien que lo tenga.»;
  - no se dibujan puntos sobre un fondo vacío;
  - no se esconde que el mapa existe (principio 8).
- **Sin `xtopics` instalado o en formato 2.0:** no hay lugares que mostrar, así que nada cambia.

## Cómo se ve

- **Colores:**
  - el tema del mapa (los 14 colores de `Theme`) se lee de variables CSS nuevas, `--map-sea`, `--map-land`, etc.;
  - cada tema de la app (claro, oscuro y modo sol) les da su valor en `styles.css`, el halo de los nombres incluido
    (en el tema oscuro, oscuro, o los nombres grises quedan con un borde blanco);
  - `drawMap` escribe colores literales, así que el SVG se vuelve a dibujar cuando cambia el tema.
- **Tamaño:**
  - en el teléfono, el ancho de la ayuda (unos 343 px a 375 px de pantalla) y 180 px de alto;
  - en la hoja grande, el ancho de la hoja y unos 360 px de alto;
  - en la computadora, la hoja es más ancha.
- **Letras:** las de la app. `measure` usa un `canvas` con la fuente de la app, para que `drawMap` separe bien los
  nombres.
- **Derecha a izquierda:** si el proyecto es de una lengua RTL, se pasa `dir: 'rtl'` (los nombres van a la izquierda
  del punto) y la hoja sigue la dirección de la app.
- **Sin saltos:** la cita y «Leer sobre…» salen enseguida, como hoy. Leer los lugares del capítulo puede tardar si
  esa parte del libro no está abierta, así que el espacio del mapa queda reservado y el mapa aparece en él cuando está
  listo. Si al final no hay lugar, ese espacio no se reserva: la consulta de `placesOf` del versículo, que es rápida,
  decide antes si hay mapa.
- **Accesible:** `summary` dice en la lengua de la app qué muestra el mapa («Mapa: Jope, con Nínive de referencia»).
- **Textos nuevos** en es, pt y en, con su forma `.computadora` cuando hace falta.
- **Nombres en inglés:** si el idioma no tiene el nombre de un lugar, se muestra el título en inglés que trae el
  paquete. Casi siempre es el mismo nombre transliterado. Se acepta así en esta etapa.

## Fuera de esta etapa

- Las imágenes de animales y plantas (#53) y las de OBS (con #28).
- Rutas de viaje (`route`), distancias y días de camino (`trip`, `travelDays`): servirían en Jonás 1:3 («huyó a
  Tarsis»), pero piden su propio diseño.
- Zoom, arrastre y el relieve.
- Un mapa del libro o del capítulo fuera de la tarjeta.

## Hecho cuando

- **Jonás (es-419 en staging):** tocar «Jope» en 1:3 muestra su mapa **sin internet**, con Nínive de referencia, y la
  hoja grande lleva el crédito.
- **Un libro recibido:** un aparato que recibe el libro como archivo, sin haber bajado nada, también ve el mapa.
- **Sin mapa base:** un aparato sin el mapa base muestra la línea «El mapa no está en este aparato…».
- **Lista de comprobación:** la tarjeta y la hoja pasan la lista de `FILOSOFIA_DE_DISENO.md` a 375 px en es, pt y en,
  y en tema claro, oscuro y modo sol.
- **Pruebas de:**
  - qué lugar es la palabra: ninguno, uno, varios, `sure` 0 y fuera del mapa base;
  - los vecinos: los seis más cercanos y el límite de 1.000 km;
  - el encuadre con referencias y el de un lugar solo;
  - el tema desde las variables;
  - el mapa base que viaja en el archivo;
  - la tarjeta sin mapa base.

## Lo que se confirma al planear

Ninguno de estos cambia el diseño, solo cómo se construye:

- Si Servos ya instala `xtopics` (de `common`) y `topics` (del idioma) al bajar un libro, o si hay que pedirlos en el
  `Want`.
- Que el número de versículo que pide `placesOf` (`libro × 1.000.000 + capítulo × 1.000 + versículo`) sea el que
  Servos ya usa con el `xmap`.
- La conversión entre el artículo de la tarjeta (`bible/names/joppa`) y el concepto de `placeQuery.tw`
  (`tw:names/joppa`): ya existe `articleIdV3` en `lookups.ts`.
- Cómo leer del `BlobStore` los bytes del mapa base: `basemapOf` sobre los complementos del catálogo da su id
  (sha256); después `store.get(id)` y `decodeBasemap`. El mapa base decodificado se guarda en memoria una vez, para
  que volver a dibujar al cambiar el tema no lo decodifique de nuevo.

# Las imágenes de UBS y un mapa dibujado por Servos caben en los paquetes sin choques de licencia

*2 de noviembre de 2026.* Investigación pedida para saber qué se podría hacer con mapas bíblicos e imágenes de
animales, plantas y objetos de la Biblia antes de decidir nada. La pregunta es qué fuentes abiertas existen, cuánto
pesarían en un teléfono y cómo se unirían a los conceptos que ya tiene el formato 3 de los paquetes de idioma
(`xmap`, en bt-synergy, `packages/language-pack-v3/spec/`). No se escribió código ni se publicó nada. Solo se bajaron
muestras pequeñas para ver formatos y medir tamaños. Todas las fuentes se consultaron el 2 de noviembre de 2026.

## Recomendación

**Imágenes: empezar por los manuales de fauna y flora de las Sociedades Bíblicas Unidas (UBS) y por las imágenes de
Open Bible Stories.**

- **UBS.** En 2025 UBS publicó con licencia CC BY-SA 4.0, la misma de los paquetes, tres manuales para traductores:
  animales, plantas y objetos. Unas 450 fotos de animales y plantas acompañan a los dos primeros. Cada entrada trae
  la palabra hebrea o griega y cada versículo donde aparece
  ([ubsicap/ubs-open-license](https://github.com/ubsicap/ubs-open-license)).
- **Revisar foto por foto.** Cada foto conserva su licencia de origen, así que hay que filtrarlas una por una. Unas
  pocas no sirven: una es «sin derivadas», otras son de origen desconocido, otras vienen de Pixabay.
- **Open Bible Stories (OBS).** Sus 598 imágenes (Sweet Publishing, CC BY-SA 3.0) se unen una a una con los cuadros
  de las historias y pesarían unos 20 MB.

**Mapas: dos pasos.**

- **Primero, mapas ya dibujados.** Biblica publicó 542 mapas bíblicos con licencia CC BY-SA 4.0
  ([BiblicaOpenBibleMaps](https://github.com/BibleAquifer/BiblicaOpenBibleMaps)). Son de buena calidad, pero los
  nombres van en inglés y fundidos en la imagen.
- **Después, un mapa base propio.** El mapa útil para un traductor que no lee inglés lo dibujaría Servos. Se
  armaría con piezas de dominio público o CC BY: costas, ríos y regiones de Natural Earth; relieve del SRTM; caminos
  romanos de Itiner-e. Encima irían las rutas de UBS (CC BY-SA 4.0) y los lugares que el `xmap` ya trae de TIPNR. Los
  nombres saldrían del mapa del idioma, así que el mapa quedaría en español, portugués o la lengua que sea.
  Pesaría entre 10 y 30 MB (estimado).
- **Qué no usar.** Nada derivado de OpenStreetMap ni del Ancient World Mapping Center entra en los paquetes como
  CC BY-SA: su licencia ODbL no es compatible. Tampoco los mosaicos de DARE, que llevan capas no comerciales.

**Formato: dos clases nuevas de complemento en el catálogo, `images` y `basemap`.** Cada complemento lleva dentro su
propio índice, que dice qué imagen va con qué concepto (`tw:other/lion`, `lug:…`, `obs:10:3`) o con qué versículos.
También lleva el crédito de cada imagen. Así ni el `xmap` ni los mapas de idioma cambian.

## Cómo se hizo

- Se leyeron las licencias en su fuente: los README y LICENSE de cada repositorio y las páginas de condiciones de cada
  sitio. Se citan textualmente.
- Los tamaños de las descargas se midieron con peticiones HEAD a los servidores. Los de los mosaicos de
  OpenStreetMap se midieron leyendo el directorio de los archivos PMTiles del planeta.
- Para estimar el peso en WebP se convirtieron muestras pequeñas: dos mapas de Biblica, tres fotos de Commons y una
  imagen de OBS.
- Lo que es estimado se dice estimado. Lo que no se pudo confirmar va en su propia sección, al final.
- Los conteos de Translation Words (tW) salen de la API de Door43 (`unfoldingWord/en_tw`, rama `master`).

## 1. Mapas

### Lo que ya está y lo que falta

El `xmap` del formato 3 ya tendrá los lugares con sus coordenadas, que vienen de STEPBible TIPNR y de Theographic.
Ambos las toman de OpenBible.info. Falta el dibujo de fondo: costas, ríos, lagos, relieve, regiones, caminos y
fronteras antiguas. Sin ese fondo, un lugar es solo un punto en blanco.

### Fuentes para el dibujo de fondo

| Fuente | Licencia (dónde se leyó) | ¿Cabe en un paquete CC BY-SA 4.0? | Formato | Tamaño para la región |
|---|---|---|---|---|
| **Natural Earth** | Dominio público: «All versions of Natural Earth raster + vector map data found on this website are in the public domain» ([condiciones](https://www.naturalearthdata.com/about/terms-of-use/)) | **Sí**, sin condiciones | Shapefile, GeoJSON, GeoPackage, TIFF | Capas físicas a 1:10m recortadas: ≈1,5 MB de GeoJSON (estimado) |
| **Itiner-e** (caminos antiguos, 2024) | «licensed under CC BY 4.0» ([itiner-e.org/about](https://itiner-e.org/about)) | **Sí**, con crédito | GeoJSON 78 MB, GPKG 34 MB (todo el Imperio) | ≈30–43 MB en bruto; mucho menos simplificado (estimado) |
| **Pleiades** (lugares antiguos) | CC BY 3.0 ([descargas](https://pleiades.stoa.org/downloads)) | **Sí**, con crédito | JSON, CSV, KMZ | Son casi solo puntos; no es un dibujo de fondo |
| **SRTM** (relieve, USGS) | Dominio público ([USGS](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)) | **Sí** | GeoTIFF | Sombreado de la región a ≈500 m: 6–15 MB (estimado) |
| **GEBCO** (fondo del mar) | «placed in the public domain» ([GEBCO](https://www.gebco.net/data-products/gridded-bathymetry-data)) | **Sí** | GeoTIFF | — |
| **Copernicus DEM** (relieve) | Licencia propia, gratuita, con avisos que pasan al usuario ([licencia, PDF](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf)) | Sí, pero como capa aparte con su aviso; no se puede volver CC BY-SA | GeoTIFF | Mosaicos de relieve sin pérdida: 88 MB la región hasta zoom 8 (medido en Mapterhorn) |
| **OpenStreetMap** (Protomaps, Geofabrik, osmdata) | ODbL ([OSM](https://www.openstreetmap.org/copyright)) | **No como CC BY-SA**; solo como archivo aparte bajo ODbL, o pintado como imagen | PMTiles, PBF, Shapefile | Protomaps completo: 29 MB la región (zoom 0–8) y 29 MB Tierra Santa (zoom 0–12), medido |
| **Ancient World Mapping Center**, datos | ODbL: «The GeoJson files are offered under the ODC Open Database License» ([AWMC/geodata](https://github.com/AWMC/geodata)) | **No como CC BY-SA** (igual que OSM) | GeoJSON | Caminos 5,3 MB; provincias del año 200: 226 KB |
| **Ancient World Mapping Center**, mosaicos | CC BY-NC 3.0 según el anuncio de 2014 ([Digital Classicist](https://wiki.digitalclassicist.org/AWMC_Map_Tiles)) | **No** (no comercial) | Imágenes | — |
| **DARE** (Åhlfeldt) | El sitio dice «Creative Commons BY-SA», pero su propia leyenda marca capas «AWMC, CC BY-NC 3.0» y «CC BY-NC-SA» ([acerca de](https://imperium.ahlfeldt.se/info_about.php), [leyenda](https://imperium.ahlfeldt.se/info_legend.php)) | **No** los mosaicos. Los puntos de su API (CC BY-SA 3.0) sí | PNG por mosaico; API GeoJSON | 37–46 KB por mosaico |
| **MapTiler / OpenMapTiles**, descargas | «limited to non-commercial and evaluation use with a maximum of 100 monthly active users» ([condiciones](https://www.maptiler.com/terms/server-data/)) | **No** | MBTiles | — |
| **OpenBible.info** | CC BY 4.0, pero la geometría `precise` es «geometry from OpenStreetMap» ([readme](https://github.com/openbibleinfo/Bible-Geocoding-Data)) | Sí lo propio; la geometría que viene de OSM es ODbL | JSONL, GeoJSON, KML | Sin dibujo de fondo |

**Por qué OpenStreetMap no entra.**

- La ODbL exige que toda base de datos derivada se publique «only under the terms of» la misma ODbL o una licencia
  compatible ([ODbL 1.0, 4.4](https://opendatacommons.org/licenses/odbl/1-0/)).
- La lista de Creative Commons de licencias compatibles con BY-SA 4.0 solo nombra la Free Art License 1.3 y la GPLv3
  ([compatibles](https://creativecommons.org/share-your-work/licensing-considerations/compatible-licenses/)).
- Por eso un recorte vectorial de OSM no se puede publicar como CC BY-SA. Quedan dos salidas: llevarlo como archivo
  aparte bajo ODbL, o pintarlo como imagen, que la guía de la OSMF trata como «Produced Work»
  ([guía](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)).
- Esa guía no menciona los mosaicos vectoriales, así que no está claro dónde quedan. Lo prudente es tratarlos como
  base de datos.

### Mapas ya dibujados

| Fuente | Licencia | Cuántos | Formato y nombres | Veredicto |
|---|---|---|---|---|
| **Biblica Open Bible Maps** | «Biblica Open Bible Maps, © 2023–2025 Biblica, Inc. This work is licensed under Creative Commons Attribution-ShareAlike 4.0 International» ([README](https://github.com/BibleAquifer/BiblicaOpenBibleMaps)) | 542 en inglés; 53 también en indonesio, ruso y chino | PNG de 2400×1800 en el repositorio (1,08 GB). Los originales de Illustrator tienen los nombres como texto aparte. En los PNG van fundidos, en inglés | **Sí.** Al traducir o cambiar un mapa hay que quitar la marca Biblica® y decir qué se cambió ([condiciones en STEPBible](https://www.stepbible.org/html/biblica_maps.html)) |
| **FIA Maps** | CC BY-SA 4.0. El README nombra como titular a Biblica en un lugar y a Word Collective en otro ([FIAMaps](https://github.com/BibleAquifer/FIAMaps)) | 227, en inglés | PNG de 4000×3000, 1–9 MB cada uno, alojados en Amazon S3 (≈1,4 GB) | Sí, dando crédito a los dos titulares |
| **Tyndale Open Bible Dictionary** | CC BY-SA 4.0 (`_README.txt` del [ZIP](https://tyndaleopenresources.com/wp-content/themes/tyndale-openresources/files/TyndaleOpenBibleDictionary.zip)) | 80 | PDF de CorelDRAW con los nombres convertidos en curvas | Sí, pero traducirlos es redibujarlos. Sus 210 fotos no vienen: «we are unable to include the images themselves» |
| **UBS Bible Routes** (Leen Ritmeyer) | CC BY-SA 4.0, «© United Bible Societies 2023» ([README](https://github.com/ubsicap/ubs-open-license/tree/main/ubs-bible-routes)) | 179 rutas | GeoJSON (723 KB en total) y SVG | **Sí.** Son líneas para poner encima de un mapa. No traen versículos, solo el nombre del viaje en el nombre del archivo |
| **Wikimedia Commons**, «Biblical maps» | Una licencia por archivo, a menudo CC BY-SA 3.0 ([categoría](https://commons.wikimedia.org/wiki/Category:Biblical_maps)) | Muchos | SVG y PNG | Sirve archivo por archivo |
| **Map Creator** (SIL / fmosoft), BibleAtlas.org, mapas de UBS | No se encontró licencia abierta. Las Biblias que usan Map Creator dicen «used by permission» | — | — | **No**, mientras no haya condiciones escritas |
| **Bible Mapper** (David P. Barrett) | Sus mapas hechos son de uso no comercial | — | — | **No** los mapas hechos |

Probamos un mapa de Biblica (OT050, «Joshua's Conquests in the North») reducido a 900 px de ancho. Pesa 84 KB en WebP
y se lee bien en pantalla. Pero en un mapa así un traductor de Otras Lenguas lee «Sea of Galilee», «Valley of
Mizpah» y la leyenda en inglés.

### Qué conviene

1. **Ahora, si se quiere algo pronto.** Llevar una selección de los mapas de Biblica como imágenes, con su lista de
   versículos y lugares. Es poco trabajo, pero solo sirve bien a quien lee inglés.
2. **Lo que de verdad sirve a Servos.** Un mapa base propio, sin nombres fundidos:
   - las capas físicas de Natural Earth para la región (de Egipto a Mesopotamia y Roma);
   - el relieve sombreado del SRTM;
   - los caminos de Itiner-e;
   - las rutas de UBS.

   Encima, los puntos del `xmap` (`lug:`) con el nombre que les da el mapa del idioma. Así el mismo dibujo sirve para
   todas las lenguas. Natural Earth es muy grueso para Tierra Santa a mucho zoom: el Jordán son unos pocos puntos.
   Para el detalle de Tierra Santa, el relieve del SRTM (o los PDF de Biblica, si se redibujan) da más que las costas.
3. **Más adelante.** Traducir los nombres de los originales vectoriales de Biblica a cada lengua. Es una obra
   derivada, permitida si se quita la marca Biblica® y se dice qué cambió.

## 2. Imágenes

### UBS: la fuente más completa y ya ligada a versículos

- **Licencia.** UBS dice que sus recursos abiertos están «released, in their entirety, under the Creative Commons
  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0) license»
  ([translation.bible](https://translation.bible/open-access-resources/)). El repositorio declara CC BY-SA 4.0
  ([ubsicap/ubs-open-license](https://github.com/ubsicap/ubs-open-license)).
- **Tres manuales** (`flora-fauna-realia/`, XML en inglés y chino):
  - *Animals in the Bible*, adaptado de Edward R. Hope (2005);
  - *Plants and Trees in the Bible*, adaptado de Robert Koops (2012);
  - *Human-made Things in the Bible*, adaptado de Ray Pritz (2009).
- **Qué trae cada entrada.** El manual de animales tiene una entrada por animal (león, íbice, damán…). Cada entrada
  trae:
  - el lema hebreo o griego («אֲרִי, אַרְיֵה» para el león);
  - cada aparición en el texto, con un código de libro, capítulo, versículo y palabra (`00104900900004`);
  - sus imágenes.
- **Las fotos**, en archivos ZIP aparte:

  | ZIP | Imágenes | Peso |
  |---|---|---|
  | Fauna | 235 | 392 MB |
  | Flora | 213 | 369 MB |
  | Realia | 495 | 1,6 GB |

  Son originales grandes (1,7–3,3 MB cada una) que habría que reducir.
- **Cada foto conserva su licencia.** UBS lo dice: «All will need to carry their original © info when reused»
  ([README de imágenes](https://github.com/ubsicap/ubs-open-license)). Los créditos vienen en dos PDF (fauna y flora) y,
  para la colección general, en `images/ubs-release.xml`: 1563 fichas con su línea de copyright, la dirección de
  origen y títulos en inglés, español, ruso y chino.
- **Hay que quitar algunas:**
  - **Sin derivadas.** Una foto CC BY-ND 2.0, el gato montés de Flickr. Está también en el manual de fauna como
    `Wildcat.jpg`.
  - **Origen desconocido.** 29 fotos dicen «Source unknown».
  - **Pixabay.** 81 dicen «CC0, via Pixabay», pero la licencia actual de Pixabay prohíbe distribuir las fotos tal cual,
    «on a Standalone basis» ([Pixabay](https://pixabay.com/service/license-summary/)). Fuera, salvo que se compruebe
    que eran subidas CC0 antiguas.
  - **Licencia 1.0.** Una CC BY-SA 1.0, que no permite pasar a una versión posterior.
  - **Condiciones propias.** Unas pocas de Free Bible Images (David Padfield), y algunas solo GFDL o Free Art License,
    que habría que estudiar aparte.
- **Para decidir: las imágenes hechas con IA.** 163 dicen «Image generated by ChatGPT using OpenAI technology». No está
  claro quién tiene derechos sobre ellas.
- **Lo que queda.** Dominio público, CC0, CC BY y CC BY-SA de varias versiones, más las fotos propias de UBS
  (Ray Pritz, Elbert Boot, la Sociedad Bíblica Alemana). Todo eso cabe en un paquete CC BY-SA 4.0, si cada foto lleva
  su propio crédito.

**El libro *Fauna and Flora of the Bible* de UBS** (1972 y 1980) no tiene versión abierta que se haya podido
encontrar, así que se supone que sigue protegido. Sus sucesores, los manuales de Hope y Koops, sí son abiertos, y son
los de arriba.

### Imágenes de Open Bible Stories (Sweet Publishing)

- **Licencia.** El LICENSE de `en_obs` dice: «All images used in these stories are © Sweet Publishing … and are made
  available under a Creative Commons Attribution-Share Alike License (…/by-sa/3.0)»
  ([en_obs](https://git.door43.org/unfoldingWord/en_obs/raw/branch/master/LICENSE.md)).
- **Juegos.** Door43 publica 598 imágenes:
  - `obs-images-360px.zip`, 37,7 MB, con imágenes de 640×360;
  - `obs-images-2160px.zip`, 807 MB. La muestra medida era de 1920×1080
    ([cdn.door43.org/obs/jpg/](https://cdn.door43.org/obs/jpg/obs-images-360px.zip)).
- **Peso en WebP.** A 640×360, unos 36 KB por imagen, así que unos 20 MB el juego entero. Está estimado desde una
  sola imagen.
- **La 3.0 en un paquete 4.0.** La licencia BY-SA 3.0 deja publicar adaptaciones bajo «a later version of this
  License» ([3.0, §4(b)](https://creativecommons.org/licenses/by-sa/3.0/legalcode.en)). Una colección no cambia la
  licencia de sus piezas ([preguntas frecuentes de CC](https://creativecommons.org/faq/)).
- **Contradicción.** Las copias de OBS en Commons y los metadatos de `uW/obs_images_360` dicen CC BY-SA 4.0, pero el
  texto de unfoldingWord dice 3.0. Lo seguro es acreditar «© Sweet Publishing, CC BY-SA 3.0».
- **Otras ilustraciones de Sweet.** Commons tiene 2358, de las que salen las de OBS
  ([categoría](https://commons.wikimedia.org/wiki/Category:Bible_illustrations_by_Sweet_Media)). Servirían para otras
  historias, con la misma licencia.

### FIA Images: muchas fotos, pero sin autor por foto

- **Licencia.** «© 2025 Word Collective … licensed under the CC BY-SA 4.0 license»
  ([FIAImages](https://github.com/BibleAquifer/FIAImages)).
- **Contenido.** 1670 piezas, 1627 de ellas fotos de 1000 px (unos 170 MB en total). 1028 están ligadas a un animal,
  con títulos también en portugués, español y otras lenguas.
- **Otra copia.** Door43 tiene 793 de estas fotos a 500 px en `BurritoTruck/en_fiaimages`, con el aviso
  «© SRV Partners 2023, CC BY-SA 4.0».
- **El problema.** Ninguna de las dos copias dice quién tomó cada foto, y algunos nombres sugieren fotos de banco. No
  se pudo confirmar que el titular tenga los derechos de todas. Sirve si Word Collective o SRV Partners confirman la
  procedencia.

### Wikimedia Commons y Wikidata: para llenar huecos

- **Licencias.** Commons no acepta NC ni ND. Diez conceptos de muestra dieron CC BY-SA 4.0 o 3.0, CC BY 2.0 o 4.0, o
  dominio público, todas usables: león, íbice, hisopo, olivo, mostaza, langosta, higuera, cedro, shofar y lámpara de
  aceite.
- **Cómo filtrar.** La API devuelve por archivo el autor, la licencia y si pide atribución (`prop=imageinfo`, campos
  `LicenseShortName`, `Artist`, `LicenseUrl`, `AttributionRequired`;
  [CommonsMetadata](https://www.mediawiki.org/wiki/Extension:CommonsMetadata)). Se rechaza todo lo que no sea dominio
  público, CC0, CC BY o CC BY-SA 2.0 en adelante.
- **El crédito.** Se da al autor, no a quien subió el archivo, y Wikimedia no garantiza la licencia
  ([Reusing content outside Wikimedia](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)).
- **Tamaños.** Commons ya no sirve miniaturas de 600 px. Solo da tamaños fijos (500, 960, 1280…), así que se baja la
  de 960 y se reduce
  ([Common thumbnail sizes](https://www.mediawiki.org/wiki/Common_thumbnail_sizes)).
- **Wikidata (CC0).** La propiedad P18 une cada especie con una foto de Commons (Q140 león, Q328516 íbice de Nubia,
  Q37083 olivo). Pero hay que revisarlas: la «lámpara de aceite» de Wikidata es una lámpara de Diwali.
- **Curación.** No existe una categoría curada de «plantas de la Biblia» con fotos. La colección WEB de UBS ya hizo
  ese trabajo para unas 800 fotos de Commons.

### Dominio público histórico

- **Colección Matson** de la Biblioteca del Congreso (American Colony, 1898–1940): más de 23 000 fotos de Palestina,
  plantas, paisajes y vida diaria. Sus fichas dicen «No known restrictions on publication». La biblioteca bloqueó la
  lectura automática, así que esto sale de las fichas vistas en el buscador y hay que comprobarlo ficha por ficha.
- **Tristram, *The Natural History of the Bible*** (1867–1898). Grabados del siglo XIX, en dominio público, en el
  Internet Archive.
- **Biodiversity Heritage Library.** Sus obras de dominio público se pueden reusar «including commercial reuse»
  ([BHL](https://about.biodiversitylibrary.org/help/copyright-and-reuse/)).

### Descartadas o marcadas

| Fuente | Por qué |
|---|---|
| LUMO (Big Book Media) | «does not permit any reproduction, distribution or modification without their permission» |
| FreeBibleimages como fuente | La mayoría de sus juegos son no comerciales, y sus condiciones prohíben publicar juegos completos ([reuse](https://www.freebibleimages.org/help/reuse/)). Las de Sweet se toman de Door43 o de Commons |
| BiblePlaces.com, Life in the Holy Land, BibleWalks, HolyLandPhotos | Con derechos reservados; redistribuir pide permiso ([BiblePlaces](https://www.bibleplaces.com/copyright/)) |
| David C. Cook y Horace Knowles (BFBS) | Solo «used by permission» en las Biblias que las llevan; sin licencia abierta |
| Digital Bible Society | CC BY-NC-SA 4.0 según el buscador; su página dio error, sin confirmar |
| iNaturalist | Por defecto CC BY-NC. Para el íbice de Nubia solo un 6 % de las fotos son CC0, BY o BY-SA |
| Neot Kedumim, Flora of Israel Online | No se encontraron condiciones |
| Imágenes del Tyndale Open Bible Dictionary | No se publicaron, para proteger a sus dueños |

## 3. Cuánto pesaría

Como referencia, hoy un idioma entero pesa 10 MB y los originales 23 MB
([PAQUETES_DE_IDIOMA.md](PAQUETES_DE_IDIOMA.md)). Todo lo de abajo es WebP con calidad 75.

| Conjunto | Cuántos | Peso por pieza | Total | Cómo se sabe |
|---|---|---|---|---|
| Animales y plantas de UBS, 600 px | ≈400 (tras filtrar) | ≈80 KB (de 41 a 118 KB en tres fotos) | **≈32 MB** | Estimado desde muestras medidas |
| Los mismos, 360 px | ≈400 | ≈25 KB | **≈10 MB** | Estimado desde muestras medidas |
| 200 animales y plantas, 600 px | 200 | ≈80 KB | **≈16 MB** | Estimado |
| Objetos de UBS (Realia), 600 px | ≈450 | ≈80 KB | ≈36 MB | Estimado |
| Imágenes de OBS, 640×360 | 598 | ≈33–36 KB | **≈20 MB** | Estimado desde una imagen |
| Mapas de Biblica, 1200 px | 542 | 84–119 KB (dos medidos) | ≈55 MB | Estimado |
| Una selección de 50 mapas de Biblica, 1200 px | 50 | ≈100 KB | ≈5 MB | Estimado |
| Mapa base propio: capas físicas, caminos y rutas | 1 | — | **5–15 MB** | Estimado (sin construir) |
| Relieve sombreado de la región, ≈500 m por píxel | 1 | — | 6–15 MB | Estimado |
| Relieve de Tierra Santa, ≈32 m por píxel | 1 | — | 30–70 MB | Estimado |
| Rutas de UBS | 179 | ≈4 KB | 0,7 MB | Medido |

En un teléfono con poco espacio, lo razonable es partir en piezas que se instalen aparte:

- animales y plantas a 360 px (≈10 MB);
- OBS (≈20 MB);
- el mapa base con el relieve de la región (≈15–30 MB).

Cada una pesa como uno o dos idiomas, y nadie tiene que bajar el relieve detallado de Tierra Santa si no lo pide.

## 4. Cómo se unirían a los conceptos del formato 3

### Lo que ya permite unir

- **Translation Words.** De los 408 artículos de `bible/other`, 78 son cosas que se pueden mostrar en una imagen:
  - 16 animales, como `tw:other/lion`, `tw:other/locust` y `tw:other/donkey`;
  - 16 plantas, como `tw:other/olive`, `tw:other/fig` y `tw:other/cedar`;
  - 46 objetos, como `tw:other/lampstand`, `tw:other/yoke` y `tw:other/winepress`.

  Además hay unos 15 en `kt`, como `tw:kt/arkofthecovenant`, `tw:kt/altar` y `tw:kt/tabernacle`. El conteo se hizo a
  mano sobre la lista de Door43.
- **Los manuales de UBS** tienen muchas más entradas que tW: el de animales tiene 99 entradas con su palabra del
  original (algunas son grupos, como «animales domésticos»), contra 16 artículos de animales en tW. Cada entrada trae los
  versículos y las palabras del original donde aparece. Así se puede unir por versículo cruzándola con los enlaces de
  palabras (tWL), que ya unen palabras del original con `tw:other/lion`.
- **ACAI** (CC BY-SA 4.0, [BibleAquifer/ACAI](https://github.com/BibleAquifer/ACAI)) tiene 97 animales, 104 plantas,
  345 objetos y 1418 lugares, con enlaces a:
  - TIPNR (`Abraham@Gen.11.26-1Pe`);
  - Wikidata;
  - los manuales de UBS (`fauna:2.24`);
  - los artículos de tW, pero por el número de artículo de Aquifer (`26827|Lion|UWTranslationWords`), no por la ruta
    `tw:`.

  Sirve como tabla de cruce. Una advertencia: sus términos clave usan datos de Paratext «used by permission».
- **Los mapas de Biblica y FIA** traen, cada uno, sus pasajes y sus lugares en ids de ACAI, que llevan a TIPNR y, de
  ahí, a `lug:`. Esos enlaces se hicieron por pasaje, no mirando el mapa, así que hay que revisarlos.
- **OBS** se une uno a uno: `obs-en-10-03.jpg` es el cuadro `obs:10:3`.
- **Las rutas de UBS** solo traen el nombre del viaje («Abram's Journey to Haran»). Unirlas a versículos o a eventos
  `ev:` es trabajo a mano, 179 veces.

### Propuesta

**Dos clases nuevas de complemento: `images` y `basemap`.** Los complementos ya viajan por el catálogo con su versión,
su sha256 y su licencia, y el formato no lee sus bytes (`spec/catalog.md`, «Complements»). Hoy sus clases son
herramientas: `classifier`, `vectors`, `numbers`, `language-id` y `model` (`cddl/catalog.cddl`). Una imagen no es una
herramienta, pero cumple lo mismo: es opcional, es grande, cambia a su ritmo y nadie está obligado a leerla.

**Qué lleva un complemento `images`.** Un archivo con las imágenes y un índice. Cada entrada del índice dice:

- qué archivo es, con su ancho y alto;
- con qué conceptos va (`tw:other/lion`, `lug:jerusalem`, `obs:10:3`);
- con qué versículos va, como rangos de ids de versículo (`spec/ids.md`: el entero `1049009` es Génesis 49:9), para
  lo que no tiene artículo en tW;
- su crédito: autor, licencia, dirección de origen y qué se cambió («reducida y pasada a WebP»).

```json
{
  "file": "fauna/lion-1.webp", "w": 600, "h": 400,
  "concepts": ["tw:other/lion"],
  "verses": [[1049009, 1049009], [4023024, 4023024]],
  "credit": { "author": "Charles J. Sharp", "license": "CC-BY-SA-4.0",
              "source": "https://commons.wikimedia.org/wiki/File:Lion_(Panthera_leo)_male_6y.jpg",
              "changes": "reducida a 600 px y pasada a WebP" },
  "via": "UBS, Animals in the Bible (CC BY-SA 4.0)"
}
```

**Qué lleva un complemento `basemap`.** Las capas del dibujo de fondo, en un archivo de mosaicos (PMTiles) o en
GeoJSON simplificado. No lleva nombres de lugares. La app pone los puntos de `lug:` del `xmap` y les da el nombre del
mapa del idioma. El relieve iría en un segundo `basemap` aparte, porque pesa más y tiene su propio aviso de licencia.

**Qué cambia en el formato:**

- **Las clases.** Agregar `images` y `basemap` a la lista del comentario de `complement.kind`.
- **La licencia.** Decir que, en un complemento con piezas de varias licencias, el campo `license` es la licencia del
  conjunto (`CC-BY-SA-4.0`) y que la de cada pieza va en su índice.
- **El idioma.** Un complemento con textos fundidos en un idioma, como los mapas de Biblica en inglés, lleva `lang`.
  Uno sin textos, como las fotos o el mapa base, no lo lleva.
- **La versión.** El campo `for` nombra la revisión del `xmap` contra la que se armó el índice, para saber si un
  concepto renombrado dejó una imagen sin dueño.

**Lo que no cambia:** el `xmap`, los mapas de idioma y las unidades. La unión va de la imagen al concepto, dentro del
complemento. Una app sin el complemento no pierde nada. Una app con él busca en su índice el concepto que está
mostrando.

**Los nombres al pie de la imagen** salen del mapa del idioma: el título del artículo de tW o el nombre del lugar. Así
un mismo complemento de imágenes sirve para todas las lenguas. Solo los títulos propios de una foto («León macho en
Masai Mara») necesitarían traducción, y no hacen falta.

**Los animales y plantas sin artículo en tW**, como el damán o el íbice, se unen por versículos. Una entrada aparte
del formato, como un espacio `fauna:` alineado con ACAI, puede esperar a ver si hace falta.

## Lo que no se pudo confirmar

- **FIA.** Quién tomó cada foto de FIA Images, y por qué FIA Maps nombra dos titulares distintos.
- **Las fotos marcadas de UBS:**
  - si las 81 «CC0, via Pixabay» se subieron antes del cambio de licencia de Pixabay;
  - quién tiene derechos sobre las 163 hechas con ChatGPT.
- **Sweet Publishing.** Su sitio hoy es solo una tienda, así que no hay declaración de licencia propia. La licencia
  CC BY-SA 3.0 consta en unfoldingWord y en Commons.
- **La página de mapas de open.bible** dio error, así que la lista de sus descargas (archivos de Illustrator y relieve
  en JPG) sale de [freely-given.org](https://freely-given.org/BibleMaps/).
- **La licencia actual de los mosaicos del Ancient World Mapping Center.** Su nuevo servidor en Iowa no respondió.
- **Los mosaicos vectoriales de OSM.** La guía de la OSMF no dice si son «Produced Work».
- **La licencia de `klokantech/roman-empire`**, que no tiene archivo LICENSE.
- **Las condiciones de Map Creator** (SIL / fmosoft).
- **Las condiciones de CGIAR para su versión del SRTM.** Lo seguro es usar el SRTM de USGS o NASADEM.
- **Si alguna coordenada que ya trae el `xmap` viene de nodos de OSM.** El readme de OpenBible.info dice que su
  geometría `precise` sale de OSM.
- **El estado del libro *Fauna and Flora of the Bible* de 1972 y 1980.**
- **Los tamaños de la sección 3** marcados como estimados. Solo una construcción de prueba los fijaría.

## Qué tiene que decidir Abel

1. **Si se hace ahora y qué va primero.** La propuesta es este orden: animales y plantas de UBS, luego las imágenes de
   OBS, y el mapa base después.
2. **Qué fotos quedan fuera:**
   - las hechas con IA (163 en UBS);
   - las de Pixabay que no se puedan comprobar;
   - FIA Images, mientras Word Collective no confirme de dónde salen sus fotos.
3. **Mapas.** Si conviene llevar ya los mapas de Biblica con nombres en inglés, o esperar al mapa base propio con
   nombres en cada lengua.
4. **Tamaño.** Si las imágenes van a 360 px (≈10 MB los animales y plantas) o a 600 px (≈32 MB), o en dos juegos.
5. **Formato.** Si se agregan las clases `images` y `basemap` a los complementos del formato 3, en bt-synergy.

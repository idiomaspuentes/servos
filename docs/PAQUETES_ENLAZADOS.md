# Los paquetes enlazados (v3: el índice entre libros)

La siguiente versión de los paquetes de idioma ([`PAQUETES_DE_IDIOMA.md`](PAQUETES_DE_IDIOMA.md)): poder ir de una
palabra, una nota o un artículo a **todos los lugares de la Biblia** donde aparece, aunque cada libro llegue en su
propia parte. Escrito el 26 de octubre de 2026 y **revisado el 28 de octubre** contra el código de ese día: el formato
2.0 en partes y su importador (unfoldingWord/tc-study#51, fusionado el 28 en `c663f78`). El mismo 28, con Abel, se
cambió el modelo: en vez de un índice por pregunta, **las palabras del original numeradas por libro**, y cada enlace
como la lista de las palabras que toca (sección 4). Todo lo que aquí se propone es **propuesto**; lo **hecho** dice el
archivo de donde sale. Las medidas son de los paquetes reales del 27 de octubre (`wt/paquetes-q9a12`, compat
`f1.1-u2.3.0-p6000230-q9-a12-t1`).

- Plan de la etapa 1, parte de bt-synergy: `bt-synergy/docs/superpowers/plans/2026-10-28-language-packs-index-stage1.md`
  (rama `docs/packs-index-stage1`, worktree `wt/tcs-packs-index`).
- Plan de la etapa 1, parte de Servos: [`superpowers/plans/2026-10-28-en-toda-la-biblia.md`](superpowers/plans/2026-10-28-en-toda-la-biblia.md).

## 1. Lo que se quiere

Enlazar los recursos entre libros como hoy se enlazan dentro de un libro (notas, palabras, alineación y Academia):

1. **Cómo se tradujo una palabra del original en todos los libros**: tocar «gracia» en Tito 2:11 y ver dónde más está
   χάρις (G5485; en el Antiguo Testamento, חֵן, H2580) y con qué palabras la alineó el texto puente en cada lugar.
2. **Cómo la tradujeron distintas versiones alineadas**: en el mismo lugar del original, qué puso el texto literal y
   qué el simple (GLT y GST), y qué pusieron otros idiomas puente (es-419, pt-br, en). Es un objetivo de primera, no
   un «más adelante».
3. **Qué notas y qué libros usan un artículo**: todas las metáforas (`translate/figs-metaphor`) de la Biblia; lo mismo
   con un artículo de Palabras (`bible/kt/grace`): todos sus enlaces.
4. **Decir lo que falta**: cuando hay coincidencias en un libro que no está en el aparato, decirlo («y 23 notas en
   Romanos, Efesios y Hebreos, que no están en este aparato»). Lo que no está aquí no es lo mismo que no existe
   (`FILOSOFIA_DE_DISENO.md`).

Sin perder lo que hace bueno al paquete de hoy: cada libro llega por separado, se pasa en un mensaje y se reemplaza
solo.

## 2. Lo que cambió desde el 26 de octubre

Cada punto se comprobó en el código del 28 de octubre (bt-synergy `c663f78`; Servos `origin/main` `61053d7` y su PR
#10; translation-helps-mcp `unfoldingword/v2` `03417f35`).

1. **Los originales ya no llegan siempre enteros.** En el formato 2.0, cada libro del UGNT y del UHB es una parte
   `original` de la unidad `book <libro>` (`language-pack/src/parts/partSlots.ts`, `placeRow`; `partsList.ts`,
   `BOOK_KINDS`). Un aparato que solo bajó Tito tiene solo el griego de Tito. Solo el paquete 1.1 `originals` (el de
   los instaladores) es entero. Por eso el índice del original **no puede viajar con los libros del original**: va en
   partes propias, compartidas (sección 5).
2. **Un lector de partes no tolera lo que no conoce.** `applyParts` rechaza la unidad entera si una fila trae una
   capa fuera de `PART_LAYERS` (`parts/apply.ts:183`, `parts/partFile.ts:17`), y rechaza toda la aplicación
   (`refused: 'versions'`) si la versión de una capa que el lector conoce es distinta (`apply.ts`, `differingLayers`);
   no hay `skippedLayers` como en el paquete entero. Una clase de parte nueva cae en la unidad `shared` y la hace
   fallar. **Ninguna app abre partes todavía** (ninguna parte de `apps/` usa el importador; Servos lo usará con su PR
   #10, abierto): es el momento barato de enseñar a los lectores a saltar lo que no conocen.
3. **El paquete entero sí tolera una capa nueva**: el importador recorre un orden fijo de seis capas
   (`pack.ts:407`) y solo rechaza una versión mayor del formato (`pack.ts:220`). Servos ignora las capas que no
   conoce, pero rechaza **el paquete entero** si difiere la versión de una capa que sí conoce (`src/resources/packs.ts`,
   `madeForOtherVersion`): el índice no debe entrar en esa comprobación.
4. **Las versiones de hoy**: `usjProcessing 2.3.0-usj`, `scripturePrepare 6000230`, `helpsQuote 9`, `helpsAlign 12`,
   `helpsText 1` (`resource-pipeline/src/language/packVersions.ts`); compat `f2.0-u2.3.0-p6000230-q9-a12-t1`.
   `compatKeyOf` lee solo esas cinco (`language-pack/src/catalog.ts:40-58`) y el Worker valida el compat con una
   expresión de segmentos fijos (`COMPAT_RE`, `packsStatus.ts:28`): **una versión `index` no debe entrar en el compat**.
   En cambio, toda constante de versión tiene que estar en `partsCodeVersions` (lo exige `partsCode.test.ts`): una
   versión del índice cambia el `code` y las huellas de **todas** las partes, una reconstrucción en el servidor. Los
   aparatos no vuelven a bajar una parte cuyo sha no cambió (`parts/plan.ts`, `planParts` compara el sha).
5. **Cómo se escribe el número Strong.** El UGNT agrega un dígito (`G54850` es la entrada 5485; 210 palabras del NT
   tienen ese dígito distinto de 0), el UHB antepone las partículas (`c:H0853`) y distingue homónimos con una letra
   (`H1121a`). La clave usa el número del léxico: `G5485`, `H0853`, `H1121a`, con las mismas reglas que Servos ya
   aplica (`src/lexicon/lexicon.ts`, `strongParts` y `strongCode`). El 26 de octubre se contaron 5436 «lemas» en el NT;
   con esta regla son 5320 números.
6. **El artículo de Academia de una nota viene como enlace**: en es-419, `SupportReference` es
   `rc://*/ta/man/translate/figs-metaphor`, no `figs-metaphor`. La clave usa `translate/figs-metaphor`.
7. **Lo preparado no trae Strong.** `InternedToken.a` son índices a `matchKeys` (`scripturePreparer.ts:65-72`), sin
   Strong ni lema. La alineación con Strong, lema, forma y ocurrencia de cada palabra del original está solo en el
   `alignmentMap` de `sot` (`{ sources: [{ strong, lemma, morph, content, occurrence, occurrences }], targets: [{ word,
   occurrence, occurrences }] }`). La tarjeta de Servos toma el Strong del USJ del original (`reading.ts`,
   `originalWordsOf`), no de lo preparado.
8. **Hay sellos por libro** (commit `59924f3`): `bookContentStamp` (`resource-catalog/src/ingestReceipt.ts:55-65`); las
   claves de citas y alineaciones llevan el sello del libro del original, y al abrir se descartan las que no
   coinciden con el original del aparato (`pack.ts:400-405`). El índice usa los mismos sellos.
9. **es-419 tiene dos textos alineados**: el GLT en 6 libros (3jn, est, jon, neh, rut, tit) y el GST en 4 (3jn, jon,
   rut, tit). Con eso ya se puede probar el objetivo 2 dentro de un idioma.
10. **El MCP**: las vistas tienen esquema 1 (`v1/{idioma}/notes/…`, `word-links/…`; `questions/…` se escriben y no se
    leen) y solo las leen las rutas de notas y de enlaces (`src/api/routes/packViews.ts`). `mcp-views` lee un paquete
    entero, no partes. No hay ninguna herramienta por Strong o lema; la más cercana es `GET /api/v1/quote`. Son 13
    herramientas (`src/mcp/toolRegistry.ts`).
11. **Sigue igual**: el léxico trae versículos solo para las palabras de más de un sentido (`lexicon.ts:23`); sirve
    para la tarjeta, no como índice.

12. **El constructor ya sabe qué cambió.** La huella de cada parte (`language-pack/src/parts/fingerprint.ts`) sale
    de los sha de git de sus archivos en Door43, que el Worker lee del árbol sin bajar nada, y del manifiesto sin
    `version`, `modified`, `issued` ni el `?v=` de las relaciones. Un release que solo sube la versión o cambia el
    README no mueve ninguna huella; y una parte rehecha con el mismo contenido tiene el mismo sha, así que ningún
    aparato la vuelve a bajar (`parts/plan.ts`).

## 3. Cuánto pesa (medido el 28 de octubre)

Con scripts sobre los paquetes del 27 de octubre (gzip nivel 9):

| Qué | Medida |
|---|---|
| Palabras del original | 444 472 en 31 103 versículos (UHB v3.0.0, UGNT v0.34); el índice del AT se arma en 3,0 s, el del NT en 1,3 s |
| Dónde empieza cada versículo, toda la Biblia | 18 KB |
| Listas de Strong, **numerando por libro** (59 279 listas Strong × libro) | **691 KB** en total; por libro, mediana 6 KB, la mayor (Salmos) 33 KB, la menor (2 Juan) 1 KB |
| Las mismas listas numerando toda la Biblia de corrido | 599 KB (15 % menos, pero un cambio en un libro movería los números de todos los siguientes) |
| El índice del plan anterior (versículos como texto, por Strong) | 1,06 MB |
| Traducción del GLT palabra por palabra, 6 libros | 26 KB; unió 6205 de 6205 palabras alineadas |
| Traducción del GST, 4 libros | 18 KB; unió 3114 de 3116 (las 2 que faltan, por revisar; tal vez ketiv/qere) |
| Una consulta («cómo tradujo el GLT χάρις») | menos de 1 ms: «gracia» ×3, «Gracia» ×1 |
| Notas → artículo de Academia (es-419, 4 libros) | 376 notas, 45 artículos; `figs-idiom` 52, `figs-explicit` 39, `figs-metaphor` 38 |
| Enlaces TWL (es-419, 4 libros) | 770 enlaces, 209 artículos |

χάρις está **156 veces en 23 libros** (en Tito, 1:4, 2:11, 3:7 y 3:15); חֵן, 69 en 16; ὁ, 19 808. El tamaño no es el
problema; lo son que el índice esté al día sin volver a bajar todo, que los lectores viejos no se rompan y que se sepa
lo que falta.

## 4. El modelo: palabras numeradas por libro

Todos estos recursos ya están unidos por **las palabras del original**: la alineación dice qué palabras del texto
puente traducen cuáles del original; la cita de una nota y la de un enlace de TWL se hallan en el original (capa
`quote`); el número Strong es de cada palabra del original. Entonces:

1. **Cada palabra del original tiene un número dentro de su libro**: su posición, desde 0, en el orden del texto
   (capítulo 1 en adelante; el capítulo 0, el de los títulos, no cuenta). Una palabra es `{libro}:{posición}`. Se
   numera por libro y no de Génesis a Apocalipsis para que un cambio en un libro no mueva los números de los demás.
2. **Cada enlace es la lista ordenada de las palabras que toca**, en un libro: un Strong, una nota, un enlace de TWL,
   un artículo (la unión de sus notas). Un texto alineado es una **columna**: para cada palabra del original, con qué
   palabras se tradujo.
3. **Las preguntas son operaciones con listas**: a qué está conectado (leer una lista), cuántos (su largo; por libro,
   una lista por libro), si hay de esto en aquello (si dos listas comparten números: «metáforas que tocan χάρις»),
   cómo lo tradujo cada versión (leer la columna de cada texto en esas palabras).
4. **El ancla para unir un texto alineado** es `{cap}:{vers} {forma}#{ocurrencia}` de la palabra del original, como la
   escribe el `alignmentMap`: el constructor la convierte en posición con el texto del original. Es la misma en todo
   texto alineado contra la misma edición del original, en cualquier idioma: así se comparan GLT, GST, ULT y el texto
   en portugués palabra por palabra.

Las listas viajan como enteros en orden, guardados como diferencias en LEB128 y en base64 dentro del JSON de la fila
(las partes son filas JSON; gzip recupera casi todo lo que agrega el base64). Una biblioteca pequeña en bt-synergy,
TypeScript sin dependencias, las lee igual en el teléfono, en el navegador, en Node y en un Worker.

## 5. Las claves, las partes y las versiones

### 5.1 Claves

El recurso va primero, como en las demás capas, para que `scansFor` y `bookOfRow` (`language-pack/src/keys.ts`) lo
encuentren; después el id y el libro al final, para que una consulta lea todos los libros con un solo rango de claves
(terminado en `:`, para que `G548` no traiga `G5485`).

| Clave | Valor | Etapa |
|---|---|---|
| `index:verses:{original}:{libro}` | `{ "stamp", "words": 659, "verses": "1:1 1:2 …", "starts": "<lista>" }` (Tito: 659 palabras) | 1 |
| `index:strong:{original}:{código}:{libro}` | `{ "stamp", "lemma", "words": "<lista>" }` | 1 |
| `index:render:{texto}:{libro}` | `{ "stamp", "words": "<lista>", "renderings": "<ids>", "strings": ["gracia", …] }` | 2 |
| `index:notes:{notas}:{libro}` | `{ "stamp", "notes": [{ "id", "ref", "article", "words": "<lista>" }] }` | 2 |
| `index:links:{enlaces}:{libro}` | `{ "stamp", "links": [{ "id", "ref", "article", "words": "<lista>" }] }` | 2 |
| `index:summary:{recurso}` | `{ "books": { "rom": { "stamp", "articles": { "translate/figs-metaphor": 12 } } } }` | 3 |

- `{código}`: `G5485`, `H0853`, `H1121a` (punto 2.5). `{artículo}`: `translate/figs-metaphor`, `bible/kt/grace`.
- `stamp` es el sello del libro del original contra el que se numeró (`bookContentStamp`). Va en el valor, no en la
  clave, para que un libro nuevo reemplace sus filas en lugar de dejar dos.
- «Todas las metáforas» se arma leyendo `index:notes:{notas}:` (a lo más 66 filas) y filtrando por artículo; si se
  usa mucho, la etapa 2 agrega filas pequeñas `index:ta:{notas}:{artículo}:{libro}` con solo los ids.

### 5.2 Partes

- Una clase de parte nueva, `index`, **aparte** de las que ya existen (decisión 1).
- **Del original**: una parte por libro (`{ kind: 'index', resource: <original>, book }`, unos 1–33 KB), en la lista de
  originales, **unidad `shared`**: todo aparato baja las 66 (unos 0,7 MB), tenga o no el texto de esos libros. Así el
  índice cubre siempre toda la Biblia, y cada parte cambia solo cuando cambia su libro. Su huella: el blob de ese libro
  del original y el `code`.
- **Del idioma** (etapa 2): una parte `index` por recurso y libro, en la unidad `book <libro>`. Su huella: el blob de
  ese libro del recurso, el sello del libro del original y el `code`.
- **El resumen** (etapa 3): una parte en la unidad `shared` del idioma.

### 5.3 Versiones

- `versions.index.helpsIndex` (decisión 2), con `HELPS_INDEX_VERSION = 1` en `packVersions.ts` y en
  `partsCodeVersions`. **No entra en el compat.** La capa `index` es opcional: no está en `REQUIRED_LAYERS`.
- Regla del lector: si la versión del índice no es la suya, o no conoce la capa o la clase, **salta el índice** y sigue
  con lo demás. Esto pide un cambio pequeño en `planParts`/`applyParts` (etapa 1, tarea 1) que debe estar en la
  versión de bt-synergy que Servos fije con su PR #10 o justo después, antes de publicar la primera parte `index`
  (decisión 3).
- Servos no pone `index` en la comprobación que rechaza paquetes enteros: si difiere, se salta la capa.

## 6. Qué se recalcula y cuándo

Se recalcula **solo lo que cambió**, con la maquinaria de huellas que ya existe (punto 2.12): el Worker compara las
huellas con el árbol de Door43 y pide una construcción solo si alguna se movió; la construcción rehace solo las partes
cuya huella cambió; el aparato baja solo las partes cuyo sha cambió.

| Si cambia… | Se rehace | Cada cuánto |
|---|---|---|
| Un libro del griego o del hebreo | Su parte del índice del original; y, en cada idioma, en su siguiente construcción, las partes de índice de ese libro (sus posiciones apuntan al original) | Muy rara vez: el UGNT es v0.34 de 2023, el UHB v3.0.0 de agosto de 2026 |
| Un libro de un texto alineado (GLT Rut) | Solo la columna del GLT en Rut | Cuando se publica ese texto |
| Las notas o los enlaces de TWL de un libro | Solo esas filas de ese recurso en ese libro, y el resumen del idioma | En los idiomas activos, a menudo |
| Solo el manifiesto (versión, fechas), el README o la licencia | Nada | — |
| El código que hace el índice (`HELPS_INDEX_VERSION`) | Todas las partes `index`; los textos y ayudas no | Cuando cambia el formato del índice |

Recalcular es barato (segundos); lo caro son las bajadas a los teléfonos, y por eso cada libro cambia por su lado.

**Mientras un idioma no se reconstruye** tras un cambio del original, sus filas traen el sello viejo: el aparato ve
que no coincide con el original que tiene y no usa sus posiciones (dice los versículos solo si los tiene de otra
fuente). Un texto alineado contra otra edición del original se salta como hoy sus citas (`requires`), o se hace una
tabla de equivalencias de la edición vieja a la nueva para los libros que cambiaron (decisión 5).

## 7. Cómo lo usa cada sistema

| Sistema | Qué guarda | Peso |
|---|---|---|
| **Servos** (teléfono, sin internet) | Las 66 partes del original, una vez; las del idioma, de los libros que tiene; en IndexedDB | ~0,7 MB del original, decenas de KB por libro |
| **tc-study** (web) | Lo mismo, con el mismo código; sus filtros de ayudas por artículo (PR #37) pasan de lo abierto a toda la Biblia | Igual |
| **translation-helps-mcp** (Worker) | Las mismas filas en R2, por libro; cada pregunta lee solo los libros que necesita | Unos KB por pregunta, sin base de datos nueva |
| **translationCore 4** (escritorio) | La misma biblioteca; si se quiere SQL libre, una exportación a SQLite hecha desde las mismas listas | Igual |

En el teléfono, una palabra del original es **un rango de claves** (`index:strong:{original}:G5485:`, 23 filas) y las
tablas de versículos de esos libros; las palabras muy comunes (ὁ, אֵת) traen listas largas, pero son enteros: la
tarjeta muestra primero la cuenta por libro (decisión 4).

## 8. Los objetivos 2 y 4, con lo que necesitan

**Objetivo 2, varias versiones.** Necesita varios textos alineados por idioma, cada uno con su columna por libro
(es-419 ya tiene dos: GLT en 6 libros, GST en 4), y varios idiomas en el aparato o en el MCP: el ancla (sección 4) es
la misma en todo texto alineado contra la misma edición del original. Los grupos de alineación de varias palabras (443
de 5674 en el GLT, 478 de 2461 en el GST) ponen la misma traducción en cada palabra del grupo, y la vista lo dice. Las
traducciones se comparan sin mayúsculas ni acentos (como `quoteFolded` de TWL), para que «Gracia» y «gracia» cuenten
juntas. En el MCP, con todos los idiomas publicados, es donde rinde más: «¿cómo tradujeron χάρις es-419, pt-br y en?».

**Objetivo 4, lo que no está.** Para el original, el índice siempre está entero: cada libro se marca «en este
aparato» o no, por las filas del original que tiene. Para el idioma, el resumen (etapa 3) da las cuentas de los libros
que faltan.

## 9. Las etapas

### Etapa 1: el índice del original y «En toda la Biblia» (planes listos)

En bt-synergy: los lectores de partes saltan lo que no conocen; la capa `index`, los códigos Strong y las listas; el
constructor del índice de un libro del original; sus filas en el paquete `originals` y sus partes en la lista de
originales, una por libro, rehechas solo si cambió el libro; `findOccurrences` para leerlo. En Servos: la sección
«En toda la Biblia» en la tarjeta de la palabra, con los libros del aparato y los que faltan. **Lo que toque
`packages/language-pack` se escribe sobre `c663f78` o después**: el importador de partes (#51) ya está fusionado.

### Etapa 2: el detalle por libro

- Constructor en `resource-pipeline`: de cada libro, la columna de cada texto alineado (`index:render`, desde el
  `alignmentMap`) y las palabras de cada nota y cada enlace de TWL (`index:notes`, `index:links`, desde la capa
  `quote`, que ya halla las citas en el original). Así un artículo de Palabras queda unido a sus números Strong.
- Partes `index` por recurso y libro en la unidad del libro; capa `index` en los paquetes `book` y `language`.
- Servos: en la tarjeta, cómo lo tradujo cada texto del aparato en cada lugar (objetivo 1 completo) y, lado a lado,
  GLT y GST (objetivo 2 dentro del idioma); en el artículo de Academia, «Todas las notas que lo citan»; el revisor de
  palabras compara con los otros libros del proyecto.
- Revisar las 2 palabras del GST que no se unieron, y medir con el inglés (ULT, UST).

### Etapa 3: el resumen del idioma

- `index:summary` en la unidad `shared` del idioma: por libro, su sello y cuántas notas y enlaces tiene cada artículo.
  Se rehace con cada construcción del idioma (es pequeño).
- Servos: «y 23 notas en Romanos, Efesios y Hebreos, que no están en este aparato», con cómo conseguirlos (con
  internet, la bajada de ese libro del PR #10).

### Etapa 4: el MCP y `find_occurrences`

- La biblioteca de listas corre en el Worker. `mcp-views` (que pasará a leer partes) copia las filas `index` a R2 por
  libro (`v1/originals/index/{libro}.json`, `v1/{idioma}/index/{libro}.json`), con esquema propio y sin cambiar las
  vistas de esquema 1.
- Una ruta `GET /api/v1/occurrences` en translation-helps-mcp (`src/api/routes/`) que lee esas filas por `PackViews`,
  y una herramienta `find_occurrences({ strong | lemma | academy | word, language?, languages?, books? })` en
  `toolRegistry.ts`. Con `languages`, junta por el ancla cómo tradujo cada idioma (objetivo 2).
- Sin vistas (producción hoy), la herramienta dice que no hay índice; no lo arma desde Door43.
- Opcional: una exportación a SQLite para escritorio y análisis (translationCore 4), hecha desde las mismas filas.

## 10. Decisiones abiertas

| # | Qué | Recomendación |
|---|---|---|
| 1 | El índice en partes `index` aparte, o como filas dentro de las partes que ya existen | **Aparte**: una versión nueva rehace solo el índice, y un lector viejo lo salta sin perder los textos |
| 2 | Un solo nombre de versión (`index.helpsIndex`) o uno por índice | **Uno** |
| 3 | Cuándo enseñar a los lectores de partes a saltar lo que no conocen | **Antes de que Servos fije su versión de bt-synergy con el PR #10, o en el PR siguiente**, y en todo caso antes de publicar una parte `index` |
| 4 | Las palabras muy comunes: listas enteras o solo cuentas | **Enteras**; la tarjeta las muestra por libro |
| 5 | Si el original cambia: saltar los textos alineados a la edición vieja, o hacer una tabla de equivalencias | **Saltarlos** hasta que pase; la tabla solo si un cambio del UHB o del UGNT deja idiomas sin índice mucho tiempo |
| 6 | La etapa 1 solo con lugares, o también cómo se tradujo, calculado al vuelo | **Solo lugares**; la traducción llega en la etapa 2, ya hecha |
| 7 | Quién hace cada tarea: Claude o Cursor | Lo decide Abel, tarea por tarea, antes de escribir código |
| 8 | Subir este documento a GitHub | Lo decide Abel |

## 11. Lo hecho y lo propuesto

| Qué | Estado | Dónde |
|---|---|---|
| Lema, Strong y morfología de cada palabra del original | Hecho, viaja | USJ del original (`original` por libro en 2.0; paquete `originals` en 1.1) |
| Alineación con Strong, forma y ocurrencia | Hecho, viaja | `alignmentMap` en `sot` (no en `prepared`) |
| Citas de notas y TWL halladas en el original | Hecho, viaja | Capa `quote` |
| Sellos por libro; huellas de partes por blob | Hecho | `bookContentStamp`; `parts/fingerprint.ts` |
| Partes 2.0 y su importador | Hecho; ninguna app lo usa aún | `language-pack/src/parts/`; Servos PR #10 |
| Lectores de partes que saltan lo desconocido | Propuesto, etapa 1 | `parts/plan.ts`, `parts/apply.ts` |
| Palabras numeradas por libro y listas de Strong | Propuesto, etapa 1 | Secciones 4 y 5 |
| Columnas de traducción, palabras de notas y TWL, resumen | Propuesto, etapas 2 y 3 | Sección 9 |
| `findOccurrences` y la biblioteca de listas | Propuesto, etapa 1 | `language-pack/src/index/` |
| `find_occurrences` en el MCP | Propuesto, etapa 4 | Sección 9 |

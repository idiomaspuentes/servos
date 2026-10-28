# Los paquetes enlazados (v3: el índice entre libros)

La siguiente versión de los paquetes de idioma ([`PAQUETES_DE_IDIOMA.md`](PAQUETES_DE_IDIOMA.md)): poder ir de una
palabra, una nota o un artículo a **todos los lugares de la Biblia** donde aparece, aunque cada libro llegue en su
propia parte. Escrito el 26 de octubre de 2026 y **revisado el 28 de octubre** contra el código de ese día: el formato
2.0 en partes y su importador (unfoldingWord/tc-study#51, fusionado el 28 en `c663f78`). Todo lo que aquí se propone
es **propuesto**; lo **hecho** dice el archivo de donde sale. Las medidas son de los paquetes reales del 27 de
octubre (`wt/paquetes-q9a12`, compat `f1.1-u2.3.0-p6000230-q9-a12-t1`).

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

## 3. Cuánto pesa (medido el 28 de octubre)

Con un script sobre los paquetes del 27 de octubre (JSON por línea, como las filas de una parte, gzip nivel 9):

| Índice | Qué junta | Tamaño |
|---|---|---|
| Strong → versículos, NT (una fila por Strong) | 137 990 palabras, 5320 números, 27 libros; 1,3 s | 1,6 MB; **325 KB** gz. La fila mayor, ὁ (G3588): 19 808 lugares, 165 KB |
| Strong → versículos, AT (una fila por Strong) | 300 493 palabras, 9260 números, 39 libros; 3,0 s | 3,3 MB; **734 KB** gz. La fila mayor, אֵת (H0853): 10 977 lugares, 88 KB |
| Lo mismo, partido por rangos de 1000 | 7 grupos NT, 9 AT | el mayor, 145 KB gz (H0–999) |
| Lo mismo, una fila por Strong y libro | 59 279 filas | 1,4 MB gz en total: 35 % más que por Strong |
| Strong → cómo lo tradujo el GLT, por libro | 5674 grupos de alineación en 6 libros | 1,8–18,8 KB gz por libro |
| Lo mismo, el GST | 2461 grupos en 4 libros | 2,5–10,8 KB gz por libro |
| Artículo de Academia → notas (es-419, 4 libros) | 376 notas, 45 artículos; `figs-idiom` 52, `figs-explicit` 39, `figs-metaphor` 38 | 2,7 KB gz |
| Artículo de Palabras → enlaces (es-419, 4 libros) | 770 enlaces, 209 artículos; `kt/yahweh` 41, `kt/god` 32 | 12 KB gz |

Ejemplos: χάρις está **156 veces en 23 libros** (en Tito, 1:4, 2:11, 3:7 y 3:15); חֵן, 69 en 16. El índice del original
entero son **1,06 MB** comprimidos, frente a 23 MB del paquete `originals`. El tamaño sigue sin ser el problema; lo son
que el índice esté al día, que los lectores viejos no se rompan y que se sepa lo que falta.

## 4. Tres niveles (se mantiene, con un cambio)

1. **El índice del original**: Strong → versículos de toda la Biblia. **Cambio**: ya no viaja «con los originales»,
   porque en 2.0 llegan por libro. Va en la lista de originales, en partes compartidas propias (sección 5), y en el
   paquete 1.1 `originals` como capa `index`. Siempre está entero, aunque el aparato tenga pocos libros.
2. **El detalle del idioma, por libro**: artículo de Academia → notas, artículo de Palabras → enlaces, y Strong → cómo
   lo tradujo cada texto alineado. Va y viene con su libro, en la unidad `book <libro>`.
3. **El resumen del idioma**: para cada artículo y cada Strong, cuántas veces aparece en cada libro, con el sello del
   libro que contó. Números, no lugares; va en la unidad `shared` del idioma y se rehace con cada publicación.

La consulta «¿dónde más está `figs-metaphor`?» lee el detalle de los libros que están y el resumen de los que no.
La consulta «¿dónde más está χάρις?» lee el índice del original (todos los libros), y el detalle de cada texto
alineado que esté en el aparato.

## 5. Las claves, las partes y las versiones

### 5.1 Claves

El recurso va primero, como en las demás capas, para que `scansFor` y `bookOfRow` (`language-pack/src/keys.ts`) lo
encuentren; después el id; el libro al final, para que una consulta lea todos los libros con un solo rango de claves.

| Clave | Valor | Nivel |
|---|---|---|
| `index:strong:{original}:{código}` | `{ "lemma", "n", "books": { "tit": "1:4 2:11 3:7 3:15" }, "stamps": { "tit": "<sello del libro>" } }` | 1 |
| `index:render:{texto}:{código}:{libro}` | `{ "stamp", "places": { "2:11": { "χάρις#1": "gracia" } } }` | 2 |
| `index:ta:{notas}:{artículo}:{libro}` | `{ "stamp", "notes": [{ "id", "ref" }] }` | 2 |
| `index:tw:{enlaces}:{artículo}:{libro}` | `{ "stamp", "links": [{ "id", "ref", "origWords", "occurrence" }] }` | 2 |
| `index:summary:{recurso}:{tipo}:{id}` | `{ "books": { "rom": { "n": 12, "stamp": "…" } } }` | 3 |

- `{código}`: `G5485`, `H0853`, `H1121a` (punto 2.5). `{artículo}`: `translate/figs-metaphor`, `bible/kt/grace`.
- En `books`, los versículos de un libro van en una cadena, sin repetir; `n` cuenta las ocurrencias.
- `stamp` es el sello del libro del original contra el que se hizo (`bookContentStamp`). Va en el valor, no en la
  clave, para que un libro nuevo reemplace sus filas en lugar de dejar dos.
- **El ancla del objetivo 2** es `{libro} {cap}:{vers} {forma}#{ocurrencia}` de la palabra del original, tal como la
  escribe el `alignmentMap` (`content` y `occurrence` de cada `source`). Es la misma en todo texto alineado contra la
  misma publicación del original, en cualquier idioma: así se juntan, palabra por palabra, el GLT, el GST, el ULT o el
  texto en portugués.

### 5.2 Partes

- Una clase de parte nueva, `index`, **aparte** de las partes que ya existen (decisión 1): el índice del original en
  la lista de originales, unidad `shared`, agrupado por rango de 1000 Strong (`G0`…`G5`, `H0`…`H8`; ninguna pasa de
  150 KB gz); el detalle de un libro en la unidad `book <libro>` de la lista del idioma, una parte por recurso y libro;
  el resumen en `shared`, grupo `summary`.
- Así, una versión nueva del índice rehace solo las partes `index`, y un lector que no conoce la clase o la versión
  salta esas partes sin tocar los textos.

### 5.3 Versiones

- `versions.index.helpsIndex` (decisión 2), con `HELPS_INDEX_VERSION = 1` en `packVersions.ts` y en
  `partsCodeVersions`. **No entra en el compat.** La capa `index` es opcional: no está en `REQUIRED_LAYERS`.
- Regla del lector: si la versión del índice no es la suya, o no conoce la capa o la clase, **salta el índice** y
  sigue con lo demás. Esto pide un cambio pequeño en `planParts`/`applyParts` (etapa 1, tarea 1) que debe estar en
  la versión de bt-synergy que Servos fije con su PR #10 o justo después, antes de publicar la primera parte `index`
  (decisión 3).
- Servos no pone `index` en `RESOURCE_VERSIONS` para rechazar paquetes: si difiere, se salta la capa.

## 6. Versiones y descargas parciales

- **Un libro nuevo trae su detalle nuevo.** Las filas `index:…:{libro}` se reemplazan con su parte, por las reglas de
  hoy: nunca se vuelve atrás (`src/resources/freshness.ts`).
- **El índice del original y un libro de otra edición.** Si el sello de un libro en `stamps` no es el del original del
  aparato, se muestran igual sus versículos (casi nunca cambian), pero no se usan para marcar palabras.
- **El resumen puede ser de otro momento que un libro del aparato.** Para los libros que están, manda su detalle; el
  resumen solo cuenta los que faltan, y puede no ser exacto; se dice igual, porque sirve para saber qué pedir.
- **Un aparato sin índice** (paquete viejo, o de otra versión): sin la sección; nada se rehace en el teléfono en la
  etapa 1. Rehacer el detalle de un libro en segundo plano queda para la etapa 2, si hace falta.
- **Sin resumen**: solo se habla de los libros que están, sin inventar.

## 7. Cuánto cuesta en un teléfono barato

- **Guardar**: el índice del original, unos 5 MB sin comprimir en IndexedDB (14 580 filas), frente a los 82 MB de la
  fuente del hebreo. El detalle de un libro, decenas de KB.
- **Consultar**: una palabra del original es **una lectura**. Un artículo es **un rango de claves**, a lo más una fila
  por libro. Cómo la tradujeron los textos del aparato es un rango por texto (`keysUnder`, `src/resources/store.ts`).
  No hace falta un motor de búsqueda.
- **Las palabras muy comunes** (ὁ, καί, אֵת, וְ) tienen filas de 50 a 165 KB. Se guardan enteras (decisión 4), y la
  tarjeta muestra primero la cuenta por libro y abre la lista solo a pedido.
- **Hacer el índice del original en el teléfono**: no; viaja hecho.

## 8. Los objetivos 2 y 4, con lo que necesitan

**Objetivo 2, varias versiones.** Necesita:

- **Varios textos alineados por idioma**, cada uno con su fila `index:render` por libro. es-419 ya tiene dos (GLT en
  6 libros, GST en 4); los demás idiomas, lo que Door43 tenga alineado.
- **Varios idiomas en el aparato o en el MCP**: el ancla de la sección 5.1 es la misma para todos los textos alineados
  contra la misma publicación del original. Uno alineado contra otra publicación se salta, igual que hoy sus citas
  (`requires`, `PAQUETES_DE_IDIOMA.md` 2.2).
- **Grupos de alineación con varias palabras** (443 de 5674 en el GLT; 478 de 2461 en el GST): la traducción se guarda
  en cada palabra del grupo, y la vista dice que es una traducción de varias palabras juntas.
- En el MCP, donde están todos los idiomas publicados, es donde el objetivo 2 rinde más: «¿cómo tradujeron χάρις
  es-419, pt-br y en?» (etapa 4).

**Objetivo 4, lo que no está.** Para el original, el índice siempre está entero: cada libro se marca «en este aparato»
o no, por el registro de partes o el catálogo. Para el idioma, el resumen (nivel 3) da las cuentas de los libros que
faltan.

## 9. Las etapas

### Etapa 1: el índice del original y «En toda la Biblia» (planes listos)

En bt-synergy: los lectores saltan lo que no conocen; la capa `index`; el constructor del índice del original; sus
partes en la lista de originales y su capa en el paquete `originals`; `findOccurrences` para leerlo. En Servos: la
sección «En toda la Biblia» en la tarjeta de la palabra, con los libros del aparato y los que faltan. Detalle y orden
en los dos planes de arriba. **Lo que toque `packages/language-pack` se escribe sobre `c663f78` o después**: el
importador de partes (#51) ya está fusionado.

### Etapa 2: el detalle por libro

- Constructor en `resource-pipeline`: de cada libro, `index:ta`, `index:tw` y `index:render` de cada texto alineado,
  desde `sot` (notas, enlaces, `alignmentMap`). El de TW usa la cita ya hallada (`quote`) para dar también el Strong
  de cada enlace, y une así un artículo de Palabras con sus números Strong.
- Partes `index` por recurso y libro en la unidad del libro; capa `index` en los paquetes `book` y `language`.
- Servos: en la tarjeta, cómo lo tradujo cada texto del aparato en cada lugar (objetivo 1 completo) y, lado a lado,
  GLT y GST (objetivo 2 dentro del idioma); en el artículo de Academia, «Todas las notas que lo citan»; el revisor
  de palabras compara con los otros libros del proyecto.
- Medir con el inglés (ULT y UST) antes de decidir si `index:render` cabe en la parte del libro o va aparte.

### Etapa 3: el resumen del idioma

- `index:summary` en la unidad `shared` del idioma, hecho al final de cada construcción con los sellos de cada libro.
- Servos: «y 23 notas en Romanos, Efesios y Hebreos, que no están en este aparato», con cómo conseguirlos (con
  internet, la bajada de ese libro del PR #10).

### Etapa 4: las vistas del MCP y `find_occurrences`

- `mcp-views` (que pasará a leer partes) escribe, con esquema 2 y sin cambiar las vistas de esquema 1:
  `v1/originals/index/strong/{código}.json`, `v1/{idioma}/index/render/{código}.json` (todos los textos del idioma,
  por libro), `v1/{idioma}/index/ta/{artículo}.json`, `v1/{idioma}/index/tw/{artículo}.json`.
- Una ruta `GET /api/v1/occurrences` en `translation-helps-mcp` (`src/api/routes/`), que lee esas vistas por
  `PackViews`, y una herramienta `find_occurrences({ strong | lemma | academy | word, language?, languages?, books? })`
  en `toolRegistry.ts`. Con `languages`, junta por el ancla cómo tradujo cada idioma (objetivo 2).
- Sin vistas (producción hoy), la herramienta dice que no hay índice; no lo arma desde Door43.

## 10. Decisiones abiertas

| # | Qué | Recomendación |
|---|---|---|
| 1 | El índice en partes `index` aparte, o como filas dentro de las partes que ya existen | **Aparte**: una versión nueva rehace solo el índice, y un lector viejo lo salta sin perder los textos |
| 2 | Un solo nombre de versión (`index.helpsIndex`) o uno por índice | **Uno**: menos combinaciones; subir la versión solo hace que los aparatos salten el índice hasta la próxima construcción |
| 3 | Cuándo enseñar a los lectores de partes a saltar lo que no conocen | **Antes de que Servos fije su versión de bt-synergy con el PR #10, o en el PR siguiente**, y en todo caso antes de publicar una parte `index` |
| 4 | Las palabras muy comunes: filas enteras o solo cuentas | **Enteras** (165 KB la mayor); la tarjeta las muestra por libro |
| 5 | La etapa 1 solo con lugares, o también cómo se tradujo en los libros del aparato, calculado al vuelo | **Solo lugares**; la traducción llega en la etapa 2, ya hecha |
| 6 | Quién hace cada tarea: Claude o Cursor | Lo decide Abel, tarea por tarea, antes de escribir código |
| 7 | Subir este documento (`ff72335` y lo que sigue) a GitHub | Lo decide Abel |

## 11. Lo hecho y lo propuesto

| Qué | Estado | Dónde |
|---|---|---|
| Lema, Strong y morfología de cada palabra del original | Hecho, viaja | USJ del original (`original` por libro en 2.0; paquete `originals` en 1.1) |
| Alineación con Strong, forma y ocurrencia | Hecho, viaja | `alignmentMap` en `sot` (no en `prepared`) |
| `SupportReference` de las notas (como enlace `rc://`), enlaces de TWL | Hecho, viaja | TN y TWL por libro |
| Sellos por libro | Hecho | `bookContentStamp`; claves de citas y alineaciones |
| Partes 2.0 y su importador | Hecho; ninguna app lo usa aún | `language-pack/src/parts/`; Servos PR #10 |
| Lectores de partes que saltan lo desconocido | Propuesto, etapa 1 | `parts/plan.ts`, `parts/apply.ts` |
| Capa `index`: original | Propuesto, etapa 1 | Secciones 5 y 9 |
| Capa `index`: detalle por libro, resumen | Propuesto, etapas 2 y 3 | Sección 9 |
| `findOccurrences` compartida | Propuesto, etapa 1 | `language-pack` |
| Vistas del índice y `find_occurrences` en el MCP | Propuesto, etapa 4 | Sección 9 |

# Los paquetes enlazados

La siguiente versión de los paquetes de idioma ([`PAQUETES_DE_IDIOMA.md`](PAQUETES_DE_IDIOMA.md)): poder ir de una
palabra, una nota o un artículo a **todos los lugares de la Biblia** donde aparece, aunque cada libro llegue en su
propio paquete. Escrito el 26 de octubre de 2026, a pedido de Abel. Todo lo que aquí se propone es **propuesto**; lo
**hecho** dice el archivo de donde sale. Las medidas se tomaron con los paquetes reales de
`servos-paquetes/2026-10-20-acentos`.

## 1. Lo que se quiere

- Tocar «gracia» en Tito 2:11 y ver **todos los libros donde aparece** la misma palabra del original (χάρις, G5485; en
  el Antiguo Testamento, חֵן, H2580), con cómo la tradujo el texto puente en cada lugar.
- Abrir el artículo de Academia «Metáfora» (`figs-metaphor`) y ver **todas las notas que lo citan**, en toda la Biblia.
- Lo mismo con un artículo de Palabras de Traducción (`kt/grace`): todos sus enlaces.
- Y saber, cuando un libro **no está** en el aparato, que también aparece allí: «aparece también en 3 libros que no
  están en este aparato».

Sin perder lo que hace bueno al paquete de hoy: cada libro llega por separado, se pasa en un mensaje y se reemplaza
solo.

## 2. Lo que los paquetes ya traen para enlazar

Todo esto **ya viaja** en los paquetes; falta juntarlo:

| Enlace | Dato | Dónde viaja | Ejemplo real |
|---|---|---|---|
| Palabra del original → lema y Strong | Cada palabra (`w`) del USJ del original lleva `lemma`, `strong` y `x-morph` | Paquete `originals`, capa `sot` (`scripture-usj:unfoldingWord/el-x-koine/ugnt:1co:1`) | Παῦλος, `G39720` |
| Palabra del texto puente → palabra del original | El `alignmentMap` de cada versículo: qué palabras del original (con Strong y lema) traduce qué palabras del texto puente | Paquete del libro, capa `sot` (`scripture-usj:es-419_gl/es-419/glt:tit:1`) | «Pablo» ← Παῦλος `G39720`; «de Dios» ← Θεοῦ `G23160` |
| Lo mismo, listo para mostrar | Cada palabra del capítulo completo lleva los índices de sus palabras del original (`a`, en `matchKeys`) | Capa `prepared` (`…:tit:1:full`; `InternedToken`, `src/resources/btSynergy.d.ts`) | `{"c":"Pablo","o":1,"k":0,"a":[1]}` |
| Nota → artículo de Academia | La columna `SupportReference` de cada nota | Paquete del libro, TN (`NotesLightRow.supportReference`) | `figs-metaphor` |
| Nota → palabras del original | La cita de cada nota, hallada en el original | Capa `quote` (`helps-quote:…:{libro}:{cap}`) | |
| Palabra → artículo de Palabras | Cada enlace de TWL: `origWords`, `occurrence`, `twLink`, `articlePath` | Paquete del libro, TWL | Θεοῦ → `bible/kt/god` |
| Lema → versículos de toda la Biblia, por sentido | `refs` de cada sentido del léxico, por libro («1:7,9;2:3») | Paquete `base`, léxicos (`…/ugl/content/5485.json`) | χάρις, sentido 88.66: Lucas 1:30; 2:40; Hechos 6:8… |
| Lema → campo de sentido | `domainCode` de cada sentido, y los archivos `domains/` | Léxicos | 088009, «Bondad, dureza» |
| Palabra del original → oración y referente | Las oraciones y referentes de MACULA, por libro, con Strong | Paquete `originals` (`Biblica/el-x-koine/macula/referents/1CO`) | χάριτι, `G5485` |

Dos cosas de esa tabla cambian el problema:

1. **Los originales llegan siempre enteros.** El paquete `originals` trae toda la Biblia en griego y hebreo
   (`bt-synergy/packages/language-pack/src/pack.ts`, tipo `originals`). Un índice de **lema → versículos** hecho desde
   él no tiene ningún problema de modularidad: cubre los 66 libros, estén o no los del idioma.
2. **El léxico ya trae un índice de toda la Biblia**, pero solo para las palabras de **más de un sentido**: las de un
   solo sentido no llevan `refs` (`src/lexicon/lexicon.ts`, tipo `LexiconSense`). Sirve para decir «en este versículo
   significa esto», como ya hace la tarjeta de la palabra; no alcanza como índice completo.

Lo que llega **por libro** es lo del idioma: notas, enlaces de palabras y la alineación del texto puente. Ahí está el
problema de verdad.

**Lo que Servos ya enlaza**, dentro de un libro: el revisor de palabras compara cómo se tradujo una misma palabra en
todos sus usos del libro (`src/app/miniapps/revisorPalabras/revisorPalabras.tsx`, `src/app/projects/wordChecks.ts`),
y la tarjeta de la palabra muestra primero el sentido del léxico para ese versículo (`DISENO.md`, sección 7).
tc-study filtra las ayudas de lo que está abierto por artículo de Academia y por TWL (PR #37 de tc-study).

## 3. Cuánto pesa

Medido con un script sobre los paquetes del 20 de octubre (en JSON, con gzip nivel 9):

| Índice | Qué junta | Tamaño |
|---|---|---|
| Strong → versículos, Nuevo Testamento | 137 990 palabras, 5436 lemas, 27 libros | 975 KB; **211 KB** comprimido. Por libro: mediana 3 KB, el mayor (Lucas) 30 KB |
| Strong → versículos, Antiguo Testamento | 306 482 palabras, 9272 lemas, 39 libros | 2,3 MB; **542 KB** comprimido. Por libro: mediana 10 KB, el mayor (Salmos) 44 KB |
| Artículo de Academia → notas (es-419, 4 libros) | 45 artículos, 376 notas. Los más citados: `figs-idiom` 52, `figs-explicit` 39, `figs-metaphor` 38 | Pocos KB |
| Artículo de Palabras → enlaces (es-419, 4 libros) | 209 artículos, 770 enlaces | 2 KB comprimido |

Toda la Biblia cabe en **menos de 1 MB comprimido** para los originales, frente a los 23 MB del paquete `originals`.
Los índices del idioma son, por libro, de unos pocos KB. **El tamaño no es el problema**; lo son que estén al día y que
se sepa lo que falta.

## 4. Dos caminos para seguir modular

### 4.1 Cada paquete trae su índice

Cada paquete de libro (o cada parte de libro, en el formato 2.0) trae una capa nueva, `index`, con el índice **de ese
libro**: sus notas por artículo de Academia, sus enlaces por artículo de Palabras y su texto puente por Strong. Al
abrirlo, sus filas quedan junto a las de los otros libros, y una consulta las lee todas.

- **A favor:** el índice llega y se va con su libro. Si el libro se reemplaza, su índice también, con las mismas
  claves; nunca queda un índice viejo de un libro nuevo. No hace falta ningún paquete más.
- **En contra:** solo sabe de los libros que están. No puede decir «aparece también en Romanos» si Romanos no está.

### 4.2 Paquetes de índice aparte

Un paquete por idioma con el índice de todos los libros.

- **A favor:** sabe de todos los libros, estén o no.
- **En contra:** hay que mantenerlo al día con cada libro. Si llega una versión nueva de Rut, el índice aparte dice lo
  de la vieja hasta que llegue otro índice. Es un archivo más que pasar, y si no llega, no hay enlaces. Con el
  inglés o un idioma grande, el detalle de todos los libros pesa.

### 4.3 La recomendación: el detalle con su libro, un resumen con el idioma

Juntar lo mejor de los dos, en tres niveles:

1. **El índice del original, en el paquete `originals`**: Strong → versículos de toda la Biblia (unos 750 KB
   comprimido). Como los originales llegan enteros, siempre está completo.
2. **El detalle del idioma, en cada paquete de libro** (camino 4.1): artículo de Academia → notas, artículo de
   Palabras → enlaces, Strong → palabras del texto puente que lo traducen. Va y viene con su libro.
3. **Un resumen del idioma, en el paquete `base`** (o en una parte compartida del formato 2.0): para cada artículo y
   cada Strong, **cuántas veces aparece en cada libro**, con el sello del libro que contó. Es pequeño: números, no
   versículos. Es lo único del camino 4.2, y por ser tan pequeño se rehace con cada publicación del idioma.

Con eso, la consulta «¿dónde más está `figs-metaphor`?» se responde así: los libros que están en el aparato, con su
detalle (sus notas, cada una con su versículo); los que no están, con el resumen (por ejemplo, «y 23 notas en Romanos,
Efesios y Hebreos, que no están en este aparato», con cómo conseguirlos). Lo que no está aquí no es lo mismo que no existe
(`FILOSOFIA_DE_DISENO.md`).

## 5. Las claves y la capa nueva

La capa `index` sigue las reglas de las otras capas derivadas (`PAQUETES_DE_IDIOMA.md`, sección 2.5): tiene su
versión (`versions.index.helpsIndex`), viaja si es de la versión del lector y si no se salta, y **se puede reconstruir
desde la fuente**, porque todo lo que junta ya está en `sot`. Un paquete viejo sin índice sigue sirviendo.

Claves propuestas, con el id antes del libro para que una consulta lea todos los libros con un solo rango de claves:

| Clave | Valor | Viaja en |
|---|---|---|
| `index:strong:{original}:{strong}` | `{ "stamp", "books": { "tit": ["2:11", "3:7"], … } }` | `originals` |
| `index:ta:{notas}:{artículo}:{libro}` | `{ "stamp", "notes": [{ "id", "ref" }] }` | El paquete del libro |
| `index:tw:{enlaces}:{artículo}:{libro}` | `{ "stamp", "links": [{ "id", "ref", "origWords" }] }` | El paquete del libro |
| `index:render:{texto}:{strong}:{libro}` | `{ "stamp", "words": { "gracia": ["2:11"], "favor": ["3:7"] } }` | El paquete del libro |
| `index:summary:{recurso}:{tipo}:{id}` | `{ "books": { "rom": { "n": 12, "stamp": "…" }, … } }` | `base` |

El sello va dentro del valor y no en la clave, para que un libro nuevo reemplace sus filas en lugar de dejar dos. Con
las claves por libro del formato 2.0 (sellos por libro, PR #45 de tc-study), cada fila de detalle lleva el sello de
su libro.

El código que hace el índice va **en bt-synergy**, junto al que hace las otras capas (`packages/resource-pipeline`),
para que tc-study, Servos y el MCP lo compartan, como hoy comparten las citas.

## 6. Versiones y descargas parciales

- **Un libro nuevo trae su detalle nuevo.** Las filas `index:…:{libro}` se reemplazan con el libro, por las mismas
  reglas de hoy (`src/resources/freshness.ts`): nunca se vuelve atrás.
- **El resumen puede ser de otro momento que un libro del aparato.** Para los libros que están, manda su detalle; el
  resumen solo cuenta los que faltan. Si el resumen es más viejo, la cuenta de un libro que falta puede no ser exacta;
  se dice igual, porque sirve para saber qué pedir.
- **El original contra el que se alineó.** Un texto puente alineado contra otra publicación del griego o del hebreo ya
  se maneja con `requires` (`PAQUETES_DE_IDIOMA.md`, sección 2.2): el índice del texto puente se salta igual que sus
  citas.
- **Un paquete sin índice** (viejo, o de otra versión del código): el aparato puede rehacer el detalle de ese libro
  desde la fuente, en segundo plano. Hasta entonces, ese libro se cuenta con el resumen, como si no estuviera.
- **Sin resumen** (llegaron libros sueltos, sin el `base`): solo se habla de los libros que están, sin inventar.

## 7. Cuánto cuesta en un teléfono barato

- **Guardar:** el índice del original ocupa unos 3 MB sin comprimir en IndexedDB, frente a los 82 MB que ocupa
  solo la fuente del hebreo abierta (`bt-synergy/packages/language-pack/src/lines.ts`). El detalle de un libro, decenas de KB.
- **Consultar:** una palabra del original es **una lectura** (`index:strong:…:G5485`). Un artículo de Academia o de
  Palabras es **un rango de claves** (`index:ta:…:figs-metaphor:`), a lo más una fila por libro: 66 filas. Es el
  mismo tipo de lectura que Servos ya hace para saber qué libros tiene un recurso (`keysUnder`,
  `src/resources/store.ts`). No hace falta un motor de búsqueda.
- **Hacer el índice en el teléfono:** solo como reserva, libro por libro. Hacer el del original entero (444 472
  palabras) no conviene en un teléfono; por eso viaja hecho.
- **Buscar una palabra escrita** («gracia» tecleada, no tocada): con `index:render`, la palabra del texto puente lleva
  a sus Strong, y de ahí a todo lo demás. Las formas distintas («gracias», «agraciado») necesitan comparar sin
  acentos ni mayúsculas, como ya hace TWL con `quoteFolded`. Una búsqueda libre en todo el texto queda para después.

## 8. Cómo lo consultarían

Una sola función compartida en bt-synergy (por ejemplo, `findOccurrences(stores, { strong | ta | tw, language })`),
que devuelve los lugares de los libros que están y las cuentas de los que no. Sobre ella:

- **Servos:**
  - La tarjeta de la palabra: «En toda la Biblia» con χάρις y cómo se tradujo en cada lugar.
  - El artículo de Academia: «Todas las notas que lo citan».
  - El revisor de palabras, que hoy compara dentro del libro, podría comparar con los otros libros del proyecto.
  - El glosario, para ver si una palabra se tradujo igual en todos los libros.
- **tc-study:** lo mismo en la página Read; sus filtros de ayudas por artículo (PR #37) pasarían de lo abierto a
  toda la Biblia.
- **translation-helps-mcp:** una herramienta nueva, por ejemplo
  `find_occurrences({ language, strong | lemma | academy | word, books? })`, servida desde vistas
  (`v1/{idioma}/index/…`, como las de notas; `src/api/routes/packViews.ts`). Un asistente podría responder «muéstrame
  todas las metáforas de Romanos» o «¿cómo se tradujo χάρις en las cartas de Pablo?», con o sin internet
  (`PAQUETES_DE_IDIOMA.md`, sección 7.2).

## 9. Más adelante

Con los mismos datos se pueden hacer otros enlaces, cada uno como otra clave de la misma capa:

- **Campos de sentido** del léxico (`domainCode`): todas las palabras de «Bondad» y dónde aparecen.
- **MACULA**: dónde una palabra es sujeto o complemento, o quién es el referente de un pronombre.
- **Entre idiomas puente**: cómo tradujeron χάρις el español, el portugués y el inglés en el mismo versículo, con los
  paquetes de cada idioma en el aparato.
- **OBS y la Biblia**: de una historia a los versículos que cuenta.

## 10. Por dónde empezar

1. **El índice del original** en el paquete `originals`, y «En toda la Biblia» en la tarjeta de la palabra de Servos.
   Lo más útil, sin el problema de los libros que faltan.
2. **El detalle por libro** (Academia, Palabras, texto puente), en los paquetes de libro y en las partes 2.0.
3. **El resumen del idioma** en el `base`, y el «aparece también en…».
4. **Las vistas del MCP** y la herramienta `find_occurrences`.

## 11. Lo hecho y lo propuesto

| Qué | Estado | Dónde |
|---|---|---|
| Lema, Strong y morfología de cada palabra del original | Hecho, viaja | Paquete `originals`, USJ |
| Alineación del texto puente al original, por versículo | Hecho, viaja | `alignmentMap` en `sot`; `InternedToken.a` en `prepared` |
| `SupportReference` de las notas, enlaces de TWL | Hecho, viaja | TN y TWL en los paquetes de libro |
| Versículos por sentido en el léxico (palabras de más de un sentido) | Hecho, viaja | Léxicos, `refs` |
| Comparar una palabra en todo un libro | Hecho, en Servos | `revisorPalabras.tsx`, `wordChecks.ts` |
| Capa `index`: original, detalle por libro, resumen | Propuesto | Secciones 4 y 5 |
| «Aparece también en libros que no están» | Propuesto | Sección 6 |
| `findOccurrences` compartida | Propuesto | Sección 8 |
| `find_occurrences` en el MCP | Propuesto | Sección 8 |

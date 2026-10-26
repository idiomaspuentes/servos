# Los paquetes de idioma

Qué es el paquete de idioma con que Servos recibe sus textos y ayudas, cómo se hace, cómo viaja y cómo lo usan Servos,
tc-study y translation-helps-mcp; qué podrían hacer otras apps con él, y qué le falta para ser un formato compartido.
La siguiente versión, con los enlaces entre libros, está en [`PAQUETES_ENLAZADOS.md`](PAQUETES_ENLAZADOS.md).

Escrito el 26 de octubre de 2026. Cada afirmación dice de dónde sale. **Hecho** quiere decir que está en el código
(con el repositorio y el archivo); **propuesto**, que es una idea de este documento o de un plan que todavía no se
construye. Las rutas de bt-synergy son de `github.com/unfoldingWord/tc-study`: las que solo están en `origin/master`
(no en la copia que Servos usa al lado, que va 55 commits atrás) se marcan **[origin/master]**. Las de
translation-helps-mcp son de la rama `v2` de `github.com/unfoldingWord/translation-helps-mcp`.

## 1. En una frase

Un paquete de idioma es **un archivo que trae un idioma ya preparado**: sus textos puente con la alineación al
original, sus notas, preguntas, palabras y academia, con las citas de cada nota ya halladas en el griego o el hebreo y
en cada texto puente, los títulos de los artículos y los léxicos. Se abre sin internet y queda listo para leer.

**Su principal ventaja** es que el trabajo caro se hace una sola vez, en una computadora con internet, y no en cada
teléfono. Bajar de Door43 los recursos de un idioma, leerlos y hallar las citas de las notas en el original le toma a
una computadora de 7 a 9 minutos y más de 1 GB de memoria para el español (`bt-synergy/docs/LANGUAGE_PACKS_PLAN.md`,
76-80; la especificación del MCP, abajo). Un teléfono barato no podría, y sin internet no podría nada. Con el paquete,
abre en segundos lo que otro ya preparó, con **el mismo código y las mismas claves** que tc-study: lo que una app
prepara, la otra lo lee sin traducir nada.

## 2. El formato de hoy (1.1)

**Hecho**, en `bt-synergy/packages/language-pack` (`src/types.ts`, `src/pack.ts`, `src/keys.ts`, `README.md`) y
descrito en `bt-synergy/apps/tc-study/docs/cache-data-structure.md`, sección 6.

### 2.1 El archivo

Es un zip (JSZip, DEFLATE nivel 9; `pack.ts:199-203`) que termina en `.langpack.zip`:

```
manifest.json                         qué es, de qué idioma, de qué versión, qué trae
catalog.json                          [{ key, metadata }]: la fila del catálogo de Door43 de cada recurso
rows/{capa}/{recurso}.jsonl           una fila por línea: {"key", "entry"}, tal como la guarda la caché
```

El nombre de cada archivo de filas es solo para personas (`es-419_gl~2Fes-419~2Ftn.jsonl`, con `fileSafe`,
`keys.ts:220-223`); la clave de verdad va dentro de cada fila. Un paquete es, por tanto, **un volcado de la caché de
tc-study**: las mismas filas que tc-study guarda en IndexedDB al leer un idioma con internet, con sus claves y sus
envolturas.

### 2.2 El manifiesto

`PackManifest` (`types.ts:67-90`). Uno real, de `servos-paquetes/2026-10-20-acentos/es-419-tit.langpack.zip`:

```json
{
  "format": "bt-synergy-language-pack",
  "formatVersion": "1.1.0",
  "language": "es-419",
  "kind": "book",
  "books": ["tit"],
  "requires": [{ "key": "unfoldingWord/el-x-koine/ugnt", "stamp": "v0.34#2023-09-27T02_19_31Z" }],
  "createdAt": "2026-10-20T13:35:31.339Z",
  "app": { "name": "resource-pipeline cli" },
  "layers": ["receipt", "sot", "prepared", "quote", "align", "text"],
  "versions": { "sot": { "usjProcessing": "2.3.0-usj" }, "prepared": { "scripturePrepare": 5000230 },
                "quote": { "helpsQuote": 7 }, "align": { "helpsAlign": 10 }, "text": { "helpsText": 1 } },
  "resources": [
    { "key": "es-419_gl/es-419/glt", "role": "language", "stamp": "v42#2026-08-11T12_22_03Z",
      "subject": "Aligned Bible", "title": "Texto Puente Literal", "rows": { "sot": 5, "prepared": 7 },
      "books": ["3jn", "est", "jon", "neh", "rut", "tit"] }
  ]
}
```

- `format` y `formatVersion`: qué formato es. Un lector rechaza un paquete cuya versión mayor es más nueva que la suya
  («Este paquete es de una versión más nueva…», `pack.ts:220-221`).
- `kind`: `language`, `originals`, `base` o `book` (sección 2.4).
- `requires`: los originales contra los que se hallaron las citas, cada uno con su **sello** (`stamp`).
- `versions`: con qué versión del código se hizo cada capa (sección 2.5).
- `resources`: cada recurso con su clave (`{dueño}/{idioma}/{id}`), si es del idioma o un original, su sello, su
  tema de Door43, su título, cuántas filas trae de cada capa y los libros que tiene.

El **sello** de un recurso es `{etiqueta}#{publicado}` de su versión en Door43 (`v42#2026-08-11T12_22_03Z`), con `:`
cambiado por `_` (`bt-synergy/packages/resource-catalog/src/ingestReceipt.ts:25-38`). Es lo que permite decir si una
copia es más nueva que otra.

### 2.3 Las capas

Cada fila pertenece a una capa (`types.ts:39-45`; claves en `keys.ts:1-12` y `cache-data-structure.md`, secciones 3
y 5):

| Capa | Qué guarda | Claves |
|---|---|---|
| `receipt` (recibo) | Que un recurso llegó completo, de qué versión y con qué esquema | `resource:{clave}` |
| `sot` (la fuente) | El texto bíblico en USJ por capítulo, con la alineación (`alignmentMap`); las filas de TN, TQ y TWL por libro; los artículos de TW y TA; los léxicos; MACULA | `scripture-usj:{clave}:{libro}:{cap}`, `tn:{clave}:{libro}`, `{clave}/{artículo}` |
| `prepared` (lo preparado) | Cada capítulo listo para mostrar: liviano (bloques de texto) y completo (cada palabra con su ocurrencia y las palabras del original a que se alinea) | `prepared:{tipo}:{clave}:{libro}:{cap}:{light\|full}` |
| `quote` (citas) | La cita de cada nota y cada enlace de palabra, hallada en el original | `helps-quote:…:{libro}:{cap}` |
| `align` (alineación) | Esa cita en cada texto puente: qué palabras son | `helps-align:…:{texto}@{sello}:{libro}:{cap}` |
| `text` (títulos) | El título de cada artículo de TA y TW | `helps-text:ta-title:…`, `helps-text:tw-title:…` |

Las capas `receipt` y `sot` van siempre (`REQUIRED_LAYERS`); las demás se pueden **reconstruir** desde la fuente con
el código de bt-synergy, y viajan para que el teléfono no tenga que hacerlo.

**Los acompañantes.** Los léxicos y MACULA viajan como recursos más, sin cambiar el formato
(`bt-synergy/packages/resource-pipeline/cli/companions.ts:1-13`):

- Los **léxicos** del idioma (`{dueño}/{idioma}/uhl` para hebreo y arameo, `…/ugl` para griego), un archivo por número
  Strong (`…/content/5485.json`), en la capa `sot`. Viajan en los paquetes `language` y `base`. Servos los lee con
  `src/resources/companions.ts` (`readLexiconEntry`).
- **MACULA** (`Biblica/hbo/macula`, `Biblica/el-x-koine/macula`), un archivo por libro con sus oraciones
  (`…/trees/{LIBRO}`) y sus referentes (`…/referents/{LIBRO}`), sacado de Taller. Viaja en el paquete `originals`.
  Servos lo lee con `readMacula` (mismo archivo).

**Las secciones no viajan.** Dónde empieza cada sección de un capítulo está en la app (`src/resources/sections.ts`,
`sections.json`): los textos puente no las marcan, y dependen solo de la versificación.

### 2.4 Cómo se parte

Un idioma se puede pasar entero o por libros (`types.ts:17-28`, `pack.ts:101-205`):

| Tipo | Qué trae | Ejemplo real (20 de octubre) |
|---|---|---|
| `originals` | El griego (UGNT) y el hebreo (UHB), y MACULA. Sirve para todos los idiomas | `originals.langpack.zip`, 23 MB |
| `language` | Todo un idioma, con recibos, sin los originales | `es-419.langpack.zip`, 10 MB |
| `base` | Las filas del catálogo de todo; TA, TW, léxicos y OBS enteros; de los recursos que van por libro, solo su fila del catálogo y qué libros tienen | `es-419-base.langpack.zip`, 8,5 MB |
| `book` | Las filas de un libro de los recursos que van por libro (textos, TN, TQ, TWL), sin recibos ni títulos | `es-419-tit.langpack.zip`, 314 KB; `es-419-jon`, 329 KB; `es-419-rut`, 518 KB |

Un recurso «va por libro» según su tipo o su tema de Door43 (`keys.ts:163-182`). Con el `base` y los libros que se
traducen, un equipo tiene lo que necesita; los libros sueltos caben en un mensaje.

### 2.5 Las versiones

Hay tres versiones distintas, y conviene no confundirlas:

1. **La del formato** (`formatVersion`, hoy `1.1.0`): cómo está armado el zip.
2. **La de cada recurso** (su sello): qué publicación de Door43 trae.
3. **La del código que hizo cada capa** (`versions`): `usjProcessing`, `scripturePrepare`, `helpsQuote`, `helpsAlign`,
   `helpsText` (`bt-synergy/packages/resource-pipeline/src/language/packVersions.ts`).

Al abrir (`importLanguagePack`, `pack.ts:293-386`), si la versión de `sot` o `receipt` no es la del lector, se rechaza
el paquete entero; si es la de una capa derivada, se salta esa capa (`skippedLayers`), que el lector puede
reconstruir. La versión del código cambia a menudo: entre el paquete de arriba (20 de octubre) y `origin/master` (24 de octubre)
pasaron `helpsQuote` de 7 a 9, `helpsAlign` de 10 a 12 y `scripturePrepare` de 5000230 a 6000230. Cada cambio vuelve viejos
los paquetes ya repartidos (sección 9).

Con estas versiones se arma la **clave de compatibilidad** (`compatKeyOf`, `bt-synergy/packages/language-pack/src/catalog.ts:40-58`),
por ejemplo `f1.1-u2.3.0-p6000230-q8-a11-t1`: una app pide solo paquetes de su clave.

### 2.6 El formato 2.0: partes

**Hecho, solo en staging [origin/master].** El paquete entero no escala: el inglés no cupo en memoria (7,7 GB a un
tercio) y en el servidor de GitHub tardó 47 minutos para un paquete de 155 MB
(`translation-helps-mcp/docs/superpowers/specs/2026-10-21-language-packs-parts-design.md`). Además, un cambio en un
libro obligaba a bajar el idioma otra vez.

El formato 2.0 (`PARTS_FORMAT_VERSION = '2.0.0'`, `bt-synergy/packages/language-pack/src/types.ts:20`) parte el
idioma en **partes** de unos 250 KB, cada una la unidad que se construye, se guarda, se baja y se reemplaza:

- Por libro: el texto, el original, MACULA, las ayudas (TN, TQ, TWL) y sus alineaciones.
- Por grupo: TW en 8 grupos, TA por manual, los títulos, los léxicos por rangos de 1000 números Strong, OBS de diez
  en diez (`packages/language-pack/src/parts/partSlots.ts`).

Cada parte es un `parts/<sha256>.part.gz` (gzip determinista con filas `{layer, key, value}`, sin recibos ni marcas
de tiempo; `parts/partFile.ts`) y la **lista de partes** (`PartsList`, `schema: 2`; `parts/partsList.ts`) nombra
todas, con la **huella** de lo que entró en cada una (los blobs de git de Door43 y la versión del código;
`parts/fingerprint.ts`). Una parte cuya huella no cambió no se vuelve a hacer ni a bajar. Servos todavía no abre
partes; el plan es la entrega 4 de la especificación.

## 3. Cómo se hace

**Hecho.** El mismo código en todos lados: la tubería de tc-study, que corre en Bun sobre una IndexedDB falsa con los
nombres de base de datos de tc-study (`bt-synergy/packages/resource-pipeline/src/language/prepareAndPack.ts:22-24, 63-64`).

1. **Descubrir** (`src/discover/discoverLanguage.ts`): en el catálogo de Door43, lo marcado `tc-ready` y `stage=prod`
   para ese idioma, **de cualquier dueño**, como la página Read de tc-study; las ayudas de OBS; y el UGNT y el UHB.
2. **Bajar** cada recurso entero, con sus recibos (`runDownload`).
3. **Construir** todo lo derivado, sin límite (`buildLanguageArtifacts`, `prepareLanguage.ts:263-276`).
4. **Empacar** (`prepareAndPack.ts:104-160`): los léxicos (si el idioma tiene un texto literal), MACULA y los
   paquetes. Un recurso entra solo si su recibo dice que llegó completo; lo que queda fuera se lista, con el motivo.

Se corre de dos maneras:

- **Con un comando**:
  `bun packages/resource-pipeline/cli/prepare-language.ts --lang es-419 --out ./packs --books all --macula <taller>`
  (cabecera del archivo, líneas 1-21). Así se hicieron los paquetes de `servos-paquetes` y los que traen los
  instaladores de Servos.
- **En GitHub Actions** (`bt-synergy/.github/workflows/language-packs.yml`, a mano o pedido por el MCP): construye y
  sube a Cloudflare R2 (`publishLanguage.ts`). En R2 queda, por clave de compatibilidad, el paquete con su sha256 en el
  nombre y una **entrada del catálogo** por idioma (`catalog/<compat>/<idioma>.json`, `PackCatalogEntry`,
  `catalog.ts:12-32`), escrita al final. No se vuelve a construir si el número de compilación (los sellos de Door43,
  MACULA y los léxicos) no cambió. El 24 y el 26 de octubre publicó es-419 e inglés, en partes, en staging.

**Propuesto** (diseño del 14 de octubre, `DISENO.md` sección 7): hacer paquetes también **dentro de la app** cuando
hay internet. tc-study no tiene todavía ese constructor: su exportación de colecciones no es un paquete de idioma
(`cache-data-structure.md`, sección 6).

## 4. Cómo viaja

| Vía | Estado |
|---|---|
| **Dentro del instalador.** Las apps de Windows y Android traen los paquetes del español y de los originales, y los abren solas la primera vez | **Hecho** en Servos: `vite.config.ts` (`packsInside`) los mete en `paquetes/` con un índice, y `src/app/projects/packsInside.ts` los abre una vez cada uno, los originales primero |
| **Un archivo de mano en mano**: tarjeta SD, USB, Bluetooth, compartir cercano, un mensaje | **Hecho**: «Recibir textos y ayudas» elige un `.zip` (`src/app/screens/ReceivePack.tsx`). Lo que llega por Bluetooth o por mensaje queda en Descargas y se elige igual. Un libro (100-500 KB) cabe en cualquier mensaje; el idioma entero (10 MB) y los originales (23 MB), en una tarjeta |
| **Bajarlo de internet** desde R2, con reanudación y comprobando el sha256 | **Propuesto, diseñado**: rutas `/v2/packs` del MCP (`src/api/routes/packs.ts`), contrato en `translation-helps-mcp/docs/LANGUAGE_PACKS_INFRA.md:177-196`. Las rutas están escritas pero no publicadas; solo existen los buckets |
| **De un aparato a otro**: armar un paquete con lo que este aparato tiene, para pasarlo | **Propuesto**. El código existe (`buildLanguagePack` con `packSourceFrom`, `bt-synergy/packages/language-pack/src/stores.ts`; Servos lo usa en `src/resources/reading.test.ts`), pero ninguna pantalla lo ofrece |

## 5. Cómo lo usa Servos sin internet

**Hecho**, en `src/resources/` y `src/app/`:

- **Dónde se guarda.** En las mismas bases de IndexedDB de tc-study, con sus claves, bajo nombres propios
  (`servos-recursos`, `servos-catalogo`; `src/resources/store.ts`). El paquete se vuelca tal cual: no hay traducción
  entre formatos.
- **Qué trae, antes de abrirlo** (`describePack`, `src/resources/packs.ts`): idioma, libros, cada recurso con su
  sello, y los originales que necesita. Cada recurso contra la copia del aparato: nueva, más nueva, la misma, más
  vieja u otra que no se puede ordenar (`src/resources/freshness.ts`, `packAgainstDevice`). Nunca se vuelve a una
  versión anterior, y un paquete de algunos libros no reemplaza un recurso del que el aparato tiene más libros.
- **Rechaza los paquetes de otra versión del código** (`madeForOtherVersion`, `packs.ts`; `RESOURCE_VERSIONS`,
  `store.ts`): Servos lee los capítulos preparados sin hacerlos, así que su versión tiene que ser la suya, y lo dice
  con palabras de la app antes de intentarlo.
- **Abrir se puede cortar** (`openPack`): se anota qué se está abriendo; si el teléfono se apaga, los recibos (que se
  escriben al final) no están, y abrir el mismo paquete otra vez completa lo que falta.
- **Qué cambió en lo ya traducido** (`src/app/projects/helpsChanges.ts`, `helpsWatch.ts`): antes de reemplazar, se
  leen las notas y textos de los versículos ya escritos; después, se comparan y se marcan en el editor.
- **Qué lee** (`src/resources/reading.ts`): capítulos, palabras con su alineación, notas con su cita en el texto
  puente, preguntas, artículos; léxicos y MACULA (`companions.ts`); y los créditos de cada recurso desde su fila del
  catálogo (`credits.ts`).
- **Con paquetes reales**: `SERVOS_PAQUETES=<carpeta> npx vitest run src/resources/realPacks.test.ts` abre los
  originales, el base y Tito, y lee Tito 1 con sus notas, sin red.

## 6. Cómo lo usa tc-study

tc-study y Servos comparten el código que **hace** los paquetes y el que guarda y lee las filas: son las mismas claves
de caché, el mismo `IndexedDBCacheAdapter` y el mismo `IndexedDBCatalogAdapter`. Pero **la app tc-study todavía no
abre paquetes**: ninguna parte de `apps/tc-study` usa `@bt-synergy/language-pack`. El README del paquete dice qué le
falta («What a pack is not yet enough for»):

- La página Read necesita la red para abrir un idioma.
- Un paquete de libro no trae recibos, así que el monitor de descargas intentaría bajar esos recursos otra vez.
- No hay service worker, así que la app no abre sin internet.
- Las imágenes de OBS son direcciones de la red.

**Propuesto**: que tc-study tenga su propio «Recibir textos y ayudas», con `importLanguagePack` sobre sus bases de
siempre (`tc-study-cache`, `tc-study-catalog`). Al ser las mismas filas, lo abierto desde un paquete y lo bajado de
Door43 no se distinguen. Lo que Servos aprendió (comparar sellos, no volver atrás, abrir de nuevo lo cortado) está en
`src/resources/freshness.ts` y `packs.ts` y se puede llevar.

Nota del 26 de octubre: el sitio publicado de tc-study **no tiene nada de esto**. Ningún despliegue de `master` a
Cloudflare Pages ha salido bien desde febrero: a `unfoldingWord/tc-study` le falta el secreto `CLOUDFLARE_API_TOKEN` (flujo
`deploy-tc-study.yml`, paso «Publish to Cloudflare Pages»).

## 7. Cómo lo usa translation-helps-mcp

### 7.1 Hoy

La v2 corre en dos Workers de Cloudflare: el servidor MCP (`src/worker.ts`, `src/mcp/agent.ts`) y una API REST
(`src/api/worker.ts`) que hace todo el trabajo. Sus 13 herramientas (`src/mcp/toolRegistry.ts`: `get_passage`,
`get_note`, `get_word_article`, `get_academy_article`, `get_questions`, `search_articles`…) llaman a la API, que pide
a Door43 el catálogo (`tc-ready`, `prod`) y los zip de cada repositorio, con varias capas de caché: la del borde, KV,
R2 y memoria (`packages/door43/src/resources/dcsClient.ts`, `ZipResourceFetcher2.ts`).

Ya usa paquetes de dos maneras:

- **Lee «vistas»** (**hecho**, PR #69): archivos JSON por capítulo que bt-synergy saca de un paquete
  (`bt-synergy/packages/resource-pipeline/cli/mcp-views.ts`, `writeMcpViews.ts`): `v1/{idioma}/notes/{LIBRO}/{cap}.json`,
  `word-links/…`, `questions/…`. Notas y enlaces de palabras salen de ahí primero (`src/api/routes/packViews.ts`,
  `notes.ts:56-78`, `wordLinks.ts:56`), con la cita ya hallada en el texto literal y en el simple, cosa que Door43 no
  da. Para es-419, la mediana baja de 13 ms a 2 ms (`docs/pack-views-comparison-es-419.md`). Las preguntas, los
  textos, TW, TA y OBS siguen saliendo de Door43.
- **Reparte paquetes** (**hecho, sin publicar**; PR #70 y #72): `/v2/packs/{compat}/{idioma}` da la entrada del
  catálogo, y `/{compat}/{idioma}/{sha256}` el paquete, con descarga por partes; si falta, pide a GitHub construirlo
  (`src/packs/dispatch.ts`) con límites. No depende de bt-synergy como paquete: comparte con él un tipo copiado
  (`PackCatalogEntry`, `src/packs/freshness.ts:20-37`) y la clave de compatibilidad.

La v2 **no tiene modo local**: no hay servidor por stdio, y sin Door43 no responde. La v1 sí lo tenía (servidor stdio
y caché en disco, `unfoldingword/main:src/functions/caches/fs-cache-provider.ts`), pero no pasó a la v2.

### 7.2 Sin internet, desde un paquete (propuesto)

Para que un asistente en una computadora sin red use las ayudas de un idioma:

1. **Un servidor MCP por stdio** en Node que registre las mismas herramientas (`MCP_TOOLS`). Las herramientas ya
   reciben su fuente por un cliente (`ApiClient`, `src/mcp/apiClient.ts`); basta uno que llame a las rutas en el mismo
   proceso, como ya hace `scripts/compare-pack-views.ts:47-72`, que corre las rutas reales en Node con KV y R2 de
   mentira y una carpeta de vistas.
2. **Una fuente desde el paquete**, de una de dos maneras:
   - **Vistas para todo** (recomendado para empezar): que `mcp-views` escriba también textos, TW, TA y OBS, y que el
     servidor lea una carpeta. Ya existe la interfaz (`PackViews`, `packViews.ts:25-28`: «un bucket de R2 en un
     Worker, una carpeta en un script»), y las vistas son JSON estable, independiente de las versiones internas de
     tc-study.
   - **Leer las filas del paquete** directamente: más completo y sin paso intermedio, pero ata el MCP a las claves de
     caché de tc-study y a sus versiones (sección 9).
3. **Recibir el paquete** igual que Servos: un archivo en una carpeta (`~/.translation-helps/paquetes/`), o bajado
   de `/v2/packs` cuando hay red.

Así un mismo `.langpack.zip` serviría al traductor en Servos y a su asistente de IA, en la misma computadora y sin
internet.

## 8. Qué podrían hacer otras apps

Todo esto es **propuesto**. Cada app toma las capas que le sirven:

| App | Qué capas usa | Qué gana |
|---|---|---|
| **Un lector de la Biblia** | `prepared` liviano de los textos; `text` | Leer el texto puente sin internet, con sus párrafos y títulos, sin procesar USFM |
| **La Biblia en audio** (grabar o escuchar por versículo) | `prepared` liviano, para mostrar el versículo; la navegación (`:nav`) | Saber qué versículos tiene cada capítulo y mostrar lo que se graba |
| **Herramientas de revisión** (como el revisor de palabras y notas de Servos) | `quote` y `align`, TWL, TN | Cada nota y cada palabra ya ubicada en el texto, sin volver a hallar las citas |
| **Asistentes de IA sin internet** (por el MCP de la sección 7.2, o directamente) | Las vistas, o `sot` y `prepared` completo | Responder con el texto, la alineación, las notas y los léxicos de un idioma, sin red |
| **Herramientas de estudio** | Léxicos, MACULA, `prepared` completo de los originales | Lema, Strong y sentido de cada palabra; las oraciones del original |

Para todas, los créditos van en el paquete: cada fila del catálogo trae su licencia y, en los paquetes nuevos, quién
lo hizo y de qué obra viene (`src/resources/credits.ts`).

## 9. Qué le falta para ser un formato compartido

Hoy el paquete es un buen medio de transporte entre dos apps que comparten código. Para que otros lo adopten sin
compartir ese código, le falta:

1. **Un contrato que no dependa del código.** El paquete es un volcado de la caché de tc-study: sus claves y
   envolturas son internas, y cada vez que cambia el código que prepara (cinco cambios en cuatro días; sección 2.5) los
   paquetes ya repartidos quedan viejos y Servos los rechaza. En el campo, sin internet, eso significa que un equipo
   no puede abrir el paquete que le pasó otro equipo con otra versión de la app. **Propuesto**: separar dos niveles.
   - El **nivel estable**: la fuente (`sot`) y unas vistas con esquema publicado, como las del MCP, que cambian rara
     vez y con versión propia.
   - El **nivel de caché**: lo preparado, que una app usa si es de su versión y si no reconstruye desde la fuente.
     Esto ya pasa con las capas derivadas (`skippedLayers`), pero Servos no reconstruye todavía y rechaza el paquete.
2. **Una versión del formato con reglas escritas.** Hoy solo se mira la versión mayor (`pack.ts:220`). Falta decir
   qué puede cambiar en una versión menor (campos nuevos que se ignoran) y qué obliga a una mayor.
3. **Un esquema.** Hoy son tipos de TypeScript (`types.ts`); no hay JSON Schema del manifiesto, del catálogo ni de las
   vistas, así que otra app en otro lenguaje no puede validar un paquete.
4. **Una firma.** Dentro del zip no hay sumas ni firmas; el sha256 está solo en la entrada del catálogo de R2. Un
   paquete que pasa de mano en mano no puede probar quién lo hizo ni que nadie lo cambió. **Propuesto**: un
   `checksums` en el manifiesto (sha256 de cada archivo) y una firma del manifiesto con la llave de quien publica
   (Idiomas Puentes, unfoldingWord), verificable sin internet.
5. **La atribución dentro.** Los créditos están en las filas del catálogo; falta un `ATTRIBUTION` legible, que la
   especificación ya deja para después.
6. **Un documento público.** Hoy la descripción vive en `cache-data-structure.md` (sección 6), el README del paquete y
   este documento. Falta una especificación pública, con el formato, el esquema, las reglas de versión, un paquete de
   ejemplo y un lector mínimo independiente de bt-synergy, y un nombre de archivo y tipo propios
   (`.langpack.zip`, `application/vnd.…+zip`).

## 10. Lo hecho y lo propuesto

| Qué | Estado | Dónde |
|---|---|---|
| Formato 1.1: manifiesto, catálogo, filas por capa | Hecho | `bt-synergy/packages/language-pack/src/{types,pack,keys}.ts` |
| Paquetes `originals`, `language`, `base`, `book` | Hecho | `pack.ts:101-205` |
| Léxicos y MACULA en los paquetes | Hecho | `resource-pipeline/cli/companions.ts` |
| Hacerlos con un comando | Hecho | `resource-pipeline/cli/prepare-language.ts` |
| Hacerlos en GitHub y subirlos a R2 | Hecho, en staging | `.github/workflows/language-packs.yml`, `publishLanguage.ts` |
| Formato 2.0 en partes | Hecho, en staging [origin/master] | `language-pack/src/parts/` |
| Servos: recibir, comparar versiones, abrir, retomar | Hecho | `src/resources/{packs,freshness,store}.ts`, `src/app/screens/ReceivePack.tsx` |
| Servos: paquetes dentro del instalador | Hecho | `vite.config.ts`, `src/app/projects/packsInside.ts` |
| Servos: qué cambió en lo traducido | Hecho | `src/app/projects/helpsChanges.ts` |
| Servos: abrir partes, bajar de internet | Propuesto, diseñado | especificación de partes, sección 5 |
| Servos: pasar recursos a otro aparato | Propuesto | `buildLanguagePack` existe |
| tc-study: abrir paquetes | Propuesto | README de `language-pack` |
| MCP: notas y enlaces desde vistas | Hecho | `translation-helps-mcp/src/api/routes/packViews.ts` |
| MCP: repartir paquetes por `/v2/packs` | Hecho, sin publicar | `src/api/routes/packs.ts` |
| MCP: servir sin internet desde un paquete | Propuesto | sección 7.2 |
| Contrato estable, esquema, firma, documento público | Propuesto | sección 9 |

# Servos al día con bt-synergy (plan 3, parte A)

Fecha: 26 de octubre de 2026. Estado: diseño aprobado por secciones; especificación por revisar.

## Para qué

El plan 3 lleva a Servos a bajar de internet los recursos por partes (formato 2.0) y aplicarlos todos a la vez. Se
parte en tres:

- **A (esta especificación).** Servos al día con bt-synergy, con la versión fijada y comprobada.
- **B.** El importador de partes en bt-synergy: verificar, descomprimir, registro por hueco, aplicar todo junto.
- **C.** Servos en línea: el libro del proyecto, «Bajar todo el idioma», actualizaciones, zona de espera, interfaz.

A va primero porque B y C necesitan el código de partes, que no existe en el bt-synergy que Servos usa hoy.

## Lo que hay hoy

- Servos usa los paquetes de bt-synergy desde sus fuentes, por la ruta fija `../bt-synergy` (`vite.config.ts:17`).
  Esa carpeta la comparten todas las sesiones y worktrees. Está en `c2ea014`, 63 commits detrás de `master`
  (`e36aa839`), y no tiene `packages/language-pack/src/parts/`.
- Nada avisa del desfase: `tsc` no lee bt-synergy (sus tipos se declaran a mano en `src/resources/btSynergy.d.ts`) y
  Servos no tiene CI.
- No hay usuarios reales: solo dispositivos de prueba. No hace falta migrar datos guardados.

## Qué cambia entre `c2ea014` y `e36aa839` para Servos

- Ninguna firma que Servos usa cambió. Los adaptadores de IndexedDB no cambiaron.
- `HELPS_QUOTE_VERSION` pasa de 8 a 9 y `HELPS_ALIGN_VERSION` de 11 a 12: el compat de los paquetes enteros pasa de
  `f1.1-u2.3.0-p6000230-q8-a11-t1` a `f1.1-u2.3.0-p6000230-q9-a12-t1`.
- Las claves de las citas y las alineaciones llevan un sello por libro: `bookContentStamp(fila, libro)` es `g` + diez
  caracteres del blob del libro cuando la fila del catálogo trae `contentMetadata.bookBlobs[libro]` y su
  `bookBlobsRef` es la etiqueta del release; si no, el sello del release, como antes.
- `language-pack` reexporta el código de partes, que importa `pako` 2.1.0: la carpeta de bt-synergy en uso necesita
  `bun install`.
- `importLanguagePack` descarta una a una las citas y alineaciones cuyo original en el dispositivo tiene otro blob de
  ese libro, y las cuenta en `droppedRows`.

## Diseño

### 1. El enganche

- **Ruta.** `vite.config.ts` toma la carpeta de bt-synergy de `SERVOS_BT_SYNERGY` y, si no está, de `../bt-synergy`.
  Vale para todo lo que pasa por Vite: `npm test`, el servidor de desarrollo y las construcciones.
- **Commit fijado.** `bt-synergy.ref` en la raíz: una línea con el commit completo de bt-synergy con el que Servos se
  probó. Empieza en `e36aa83936dc12f05dc99d252382d4393aa9074f`.
- **Comprobación en `npm test`.** Una función pequeña decide, con una forma de preguntar a git que se le pasa:
  - la carpeta contiene el commit (`git merge-base --is-ancestor <ref> HEAD`): pasa, también si va por delante (la
    guarda solo atrapa una carpeta POR DETRÁS de `bt-synergy.ref`; una adelantada pasa, y los cambios incompatibles de
    bt-synergy se ven como pruebas que fallan, no como la guarda);
  - no lo contiene: falla, con un mensaje que dice traer `master` en esa carpeta o apuntar `SERVOS_BT_SYNERGY` a otra;
  - la carpeta no es un repositorio git: avisa y no falla.
- **Documentación.** El «Empezar» de `CLAUDE.md` explica la variable, el archivo y cómo subir el commit fijado.

### 2. Las claves de las alineaciones por libro

- `alignedQuotes` (`src/resources/reading.ts`) busca hoy con `helps-align:{notas}@{sello del release}:`; los paquetes
  nuevos guardan las alineaciones con el sello del libro, así que notas y palabras clave se quedarían sin cita
  alineada.
- Servos calcula los sellos con las funciones de bt-synergy que los escriben, no a mano:
  - prefijo con `bookContentStamp(fila del catálogo de las notas, libro)`;
  - la parte del texto de destino debe ser `{texto}@{targetBookStamp(fila del texto, libro)}`, no solo la clave del
    texto: una alineación hecha sobre otra versión del texto del libro marcaría palabras equivocadas, y es mejor no
    mostrar nada;
  - `alignedPlaces` y `notesOfVerse` pasan la fila y el libro en vez de un sello ya calculado.
- `btSynergy.d.ts` declara `bookContentStamp` (`@bt-synergy/resource-catalog`) y `targetBookStamp`
  (`@bt-synergy/resource-pipeline/helps/helpsAlignCache`).
- No cambian: `helps-text:…@{release}`, `prepared:*`, `scripture-usj:*`, `tn:`/`tq:`/`twl:`, los recibos
  `resource:{clave}`.
- Queda un caso raro, sin tratar: dos paquetes del mismo release con blobs distintos (uno construido sin acceso a
  Door43). El último abierto manda en la fila del catálogo y las alineaciones del otro dejan de encontrarse; se
  arregla volviendo a abrir el paquete.

### 3. La comprobación de versiones de los paquetes

- `madeForOtherVersion` (`src/resources/packs.ts`) compara con `RESOURCE_VERSIONS`, que sigue las constantes de
  bt-synergy: acepta `q9-a12` y rechaza `q8-a11` sin cambios de lógica.
- Pasa a comparar las cinco capas (`sot`, `prepared`, `quote`, `align`, `text`), no tres, para que la interfaz diga
  lo mismo que hace el importador.
- Dispositivos de prueba con datos viejos: las alineaciones guardadas con la versión 11 dejan de leerse y el paquete
  del mismo release figura como «lo mismo». Se arregla volviendo a abrir los paquetes con «abrir igual» o borrando
  los datos de la app; no hay código para esto. «Abrir igual» vuelve a llenar las alineaciones en un dispositivo de
  prueba solo porque los paquetes q9-a12, hechos con acceso a Door43, traen claves nuevas (sellos `g`); un paquete
  hecho sin ese acceso (sellos de release) conservaría las filas viejas y las citas seguirían faltando hasta borrar
  los datos de la app.
- `droppedRows` no se muestra en A: no hay un caso real que lo dispare. Queda para B y C.
- El comentario de `src/resources/freshness.ts` que dice que las citas se guardan «por release» pasa a decir «por
  libro».

### 4. Los paquetes que la app lleva dentro

- Hoy no hay paquetes enteros `q9-a12` en ningún bucket (comprobado el 26 de octubre: `catalog/f1.1-…-q9-a12-t1/`
  no existe en `language-packs-staging` ni en `language-packs`; la publicación de es-419 del 22 de octubre, run
  39791360170, se hizo en `c2ea014` con `q8-a11`).
- Se hacen con el CI, con el sí de Abel: `language-packs.yml` desde `master`, `language: es-419`, `mode: publish`,
  `target: staging`, sin `parts`. Se construye en GitHub con acceso a Door43, así que las filas traen los blobs por
  libro, y publica también el paquete de los originales. Luego se bajan con `npx wrangler r2 object get`,
  comprobando el sha256 de cada uno contra su entrada del catálogo.
- Si el CI no sirviera, se construyen aquí con `prepare-language` de bt-synergy en `e36aa839`, con internet.
- Se guardan en la carpeta de siempre (`paquetes-dentro/`, o `SERVOS_PAQUETES_DENTRO`), fuera del repositorio.
- Esta especificación registra, al terminar, el compat, el run y el sha256 de cada paquete llevado dentro.

### 5. Pruebas y cuándo está hecho

- **Sin red:** la función de la comprobación de `bt-synergy.ref` en sus tres casos, más una prueba con la carpeta
  real; en `reading.test.ts`, un caso con blobs por libro que falla con el código de hoy y pasa con el arreglo, y uno
  que no usa una alineación hecha sobre otra versión del texto; un caso por capa en la comprobación de versiones.
- **Todo junto:** `npm test` y `npm run typecheck` con `SERVOS_BT_SYNERGY` apuntando a un worktree de bt-synergy en
  `e36aa839` con `bun install` hecho.
- **Con paquetes reales:** con `SERVOS_PAQUETES` en la carpeta de la sección 4, pasan `realPacks.test.ts`,
  `screenData.test.ts` y `sources.test.ts`, con citas alineadas y posiciones. `prototype/makeData.test.ts`, que
  reescribe los datos del prototipo, solo se corre a propósito y con su diff revisado.
- **En la app:** servidor de desarrollo (no la app de escritorio), a 375 px: una nota de Tito 1 muestra su cita en el texto
  y marca sus palabras, como antes. No hay pantallas nuevas.
- **Hecho cuando** todo lo anterior pasa, `CLAUDE.md` está al día y esta especificación registra los paquetes.

## Fuera de A

Cada uno con el sí de Abel:

- la publicación entera de es-419 en staging que hace los paquetes de la sección 4;
- mover la carpeta compartida `../bt-synergy` a `master`;
- construir y publicar instaladores nuevos con los paquetes `q9-a12`;
- fusionar el PR.

Y lo que es de B o C: leer partes, el registro por hueco, mostrar `droppedRows`, todo lo que va por internet.

## Paquetes llevados dentro

Compat de los cuatro: `f1.1-u2.3.0-p6000230-q9-a12-t1`, hechos con bt-synergy `e36aa839`. Están en
`C:\Users\LENOVO\Git\Github\wt\paquetes-q9a12` (fuera del repositorio).

| Archivo | De dónde | sha256 |
| --- | --- | --- |
| `originals.langpack.zip` | run 40502309021 (tc-study `master`), `language-packs-staging`, `packs/f1.1-u2.3.0-p6000230-q9-a12-t1/originals/1d328fe6….langpack.zip` | `1d328fe6c65368c8093cb76372c101f753e3e06102c745c5cb7a3f54bd3ddd7e` |
| `es-419.langpack.zip` | run 40502309021 (tc-study `master`), `language-packs-staging`, `packs/f1.1-u2.3.0-p6000230-q9-a12-t1/es-419/c8436d45….langpack.zip` | `c8436d457a7173b32ad8a6fae26bdbdd953a7e5101c66c66f6b3125663201b93` |
| `es-419-base.langpack.zip` | local, `prepare-language --lang es-419 --no-originals --books tit` en `e36aa839` | `ca569864d8351a17679d54fc826eeb7a4384150548237266a448c9d5bcf6a9eb` |
| `es-419-tit.langpack.zip` | local, la misma corrida | `d3ecdff0ee9e329f58ec6652571bbebe6873784aa1c90e943a01e3c5299285c8` |

Los dos del run coinciden con el sha256 de su entrada en `catalog/f1.1-u2.3.0-p6000230-q9-a12-t1/`. Los dos locales
los pide `realPacks.test.ts` (el run hace solo el idioma entero); leen Door43 de producción el 27 de octubre de 2026 y
tienen los mismos sellos que el run en cada recurso de la Biblia y en los léxicos (TPL `v42`, notas `v66`, UGNT
`v0.34`); el base trae además las Historias Bíblicas Abiertas y sus ayudas, que el paquete del run no trae.

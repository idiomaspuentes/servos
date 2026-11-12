# Lo difícil de este libro (Estudio)

Fecha: 11 de noviembre de 2026. Estado: diseño aprobado por partes; especificación por revisar.

## Para qué

Antes de traducir un libro, el equipo debería saber qué será difícil de traducir en él: las figuras y los asuntos de
traducción que más se repiten. Hoy lo descubre versículo a versículo, al tocar una palabra y leer su nota. Este diseño
le da a Estudio:

1. una parada, **«Lo difícil de este libro»**, con los asuntos de Academia que usan las notas del libro, de más usado
   a menos, para estudiarlos antes de traducir;
2. una **hoja por asunto**: el artículo y los versículos de este libro donde aparece, para ir a cada uno;
3. en cada sección, un pliegue **«Asuntos de traducción aquí (n)»**, que hace de la lista del libro un índice.

Es el primero de los usos de las consultas del formato 3 en las mini apps (encargo de la sesión del 11 de noviembre,
después de idiomaspuentes/servos#43). Las demás ideas quedan para después (al final).

Decisiones de Abel (11 de noviembre):

- Empezar por lo difícil de traducir en el libro, no por el mapa del libro (personas, lugares) ni por las palabras
  clave.
- Estudiarlo como un paso **y** encontrarlo donde se usa.
- **Funciona en los dos formatos.** Contar los asuntos y encontrar sus versículos sale de las notas del libro, que el
  formato 2.0 también tiene; el formato 3 añade solo en qué otros libros aparece cada asunto. (El encargo decía «solo
  formato 3»; Abel eligió no esconder a producción lo que ya puede usar.)
- La parada es una lista; cada asunto abre una hoja con su artículo y sus versículos en este libro.
- En la sección, el pliegue va arriba del texto, plegado.
- El alcance es solo esto.

## Lo que hay hoy

- Estudio recorre paradas: la introducción del libro (`BOOK_INTRO = -1`, en el capítulo 1), la del capítulo
  (`CHAPTER_INTRO = 0`) y las secciones (`stopsOf` en `PlacePicker.tsx`). Una parada cuenta como estudiada al pasarla
  después de `READ_SECONDS` (`markStudied`, `work.ts`).
- `loadBook` (`library.ts`) lee **todo el libro** al abrirlo, del formato 3 (`readFromV3`) o de las filas del 2.0
  (`chapterData` por capítulo). La mini app tiene todos sus capítulos: `context.chapters` y `context.chapterData(n)`.
- Cada nota de un versículo trae su artículo de Academia: `PrototypeData.verses[].notes[].academy`
  (`'translate/figs-metaphor'`), en los dos formatos (`screenData.ts`, `v3/helpsV3.ts`).
- `ArticleSheet` abre un artículo en una hoja, con sus enlaces y «‹ Volver a…», y al pie `DondeAparece`: con el
  formato 3 y el mapa (`map` para Academia), en qué libros se usa el artículo, cuáles no están en este aparato y
  «Bajar». Sin formato 3 o sin el mapa, no se muestra.

## Diseño

### 1. La parada «Lo difícil de este libro»

**Dónde.** En el capítulo 1, justo después de la introducción del libro: «Introducción · Lo difícil · Introducción al
capítulo 1 · 1:1-3…». Una parada nueva, `BOOK_ISSUES = -2`, para las mini apps con `intros` que la piden
(`MiniApp.issues: true`; solo Estudio). Existe solo si el libro tiene al menos una nota con artículo. Su nombre corto en
la lista de paradas y en «Siga donde quedó» (`progress.ts`) es «Lo difícil de este libro».

**Qué se ve (375 px):**

```
‹  Rut · Lo difícil              Ana  ⋯
──────────────────────────────────────
Lo difícil de este libro
Las notas de Rut explican estos asuntos.
Léalos antes de traducir; los volverá a
encontrar en cada sección.

Metáfora                          ›
14 notas · en 4 capítulos
Nombres de personas        Leído  ›
9 notas · en 4 capítulos
…
Ver los otros 12 asuntos          ▾
──────────────────────────────────────
[ Rut · Lo difícil de este libro ‹ › ]
        [ Seguir leyendo ]
```

- Las filas van de más notas a menos (a igual cuenta, por título). Se ven las 8 primeras; las demás, plegadas tras «Ver
  los otros n asuntos ▾», para que la pantalla no pase de dos alturas.
- Cada fila es una fila de ancho completo con «›» (principio 12) y abre la hoja del asunto (§2). Al abrirla, la fila
  lleva la etiqueta «Leído» (teñida, sin borde). Lo leído se guarda por proyecto y libro, como lo estudiado.
- El nombre es el título del artículo: de `data.academy[path]` de algún capítulo, o leído del aparato
  (`readArticle`). Si el artículo no está, la fila muestra la última parte de la ruta (`figs-metaphor`).
- **Cuenta como estudiada** como las otras paradas: al pasarla después de `READ_SECONDS`. No obliga a leer los asuntos
  (principio 5).
- **Su nota** es la nota del libro, la misma de la introducción del libro (`introNoteOn(book, BOOK_NOTE_CHAPTER)`):
  su pista ya pregunta qué será difícil de traducir.
- **En la computadora**, desde 900 px, la lista a la izquierda y la nota del libro a la derecha, como en la
  introducción.

### 2. La hoja de un asunto

`ArticleSheet` con una parte nueva, «En Rut», arriba del artículo:

```
Metáfora                                Cerrar
──────────────────────────────────────────────
En Rut: 14 notas                             ▾
  Rut 1:20  «llámenme Mara»          aquí
            Noemí usa su nombre para decir…  ›
  Rut 2:12  «bajo cuyas alas»
            Las alas son una imagen de…      ›
──────────────────────────────────────────────
(el artículo, como hoy)
──────────────────────────────────────────────
Dónde aparece                                ▾   (ya existe; solo con formato 3)
```

- «En Rut: n notas ▾» va plegado, con la cuenta a la vista (principio 11: nada escondido sin que se note). Abierto:
  cada nota del libro con este artículo, en orden: la referencia, la frase citada (`quote`, si la hay) y la primera
  línea de la nota, sin marcas de markdown.
- Abierta desde una sección (§3), la lista pone primero las notas de los versículos de la sección, con la etiqueta
  «aquí», y luego las demás en orden.
- Tocar una fila cierra la hoja y lleva Estudio a la parada que contiene ese versículo (`goTo`). Para volver a la lista,
  la parada «Lo difícil» está en la lista de paradas.
- Un artículo que no está en el aparato: la hoja dice `ayudas.articuloNoEsta` (como hoy) y «En Rut» se ve igual.
- «Dónde aparece» no cambia: con el formato 3 dice en qué otros libros se usa el artículo; con el 2.0 no se muestra.
- Al seguir un enlace a otro artículo dentro de la hoja, «En Rut» es el del artículo que se ve (se calcula para él).

### 3. El pliegue de la sección

Arriba del texto de la sección, una vez (sobre las pestañas de textos en el teléfono, sobre «lado a lado» desde
1280 px), plegado:

```
Asuntos de traducción aquí (2)               ▾
  Metáfora                                   ›
  1:20 · 14 en todo Rut
  Nombres de personas                        ›
  1:20, 1:22 · 9 en todo Rut
```

- Solo si la sección tiene al menos una nota con artículo; si no, nada (principio 6). No aparece en las
  introducciones ni en la parada «Lo difícil».
- Cada fila: el título, los versículos de la sección donde está y cuántas notas lo usan en todo el libro. Tocarla abre
  la hoja (§2) con los versículos de la sección primero.
- Abierto o plegado se recuerda en el aparato (`localStorage`, en `try`, como los otros pliegues).
- Tocar una palabra sigue mostrando su nota; el pliegue es un índice, no reemplaza nada.

### 4. Los datos

Todo sale de lo que la mini app ya tiene en memoria; nada se lee, se espera ni se guarda aparte.

`src/app/projects/bookIssues.ts` (nuevo, puro):

```ts
type IssueNote = { chapter: number; verse: number; covers: number[]; id: string; quote: string; note: string }
type BookIssue = { path: string; title: string; onDevice: boolean; notes: IssueNote[]; chapters: number }

/** The Academy articles the book's notes point to, most used first (then by title). */
function issuesOfBook(chapters: ReadonlyArray<{ chapter: number; data: PrototypeData }>): BookIssue[]

/** The issues with a note on these verses of a chapter, each with the verses it is on, in the book's order. */
function issuesOfSection(issues: BookIssue[], chapter: number, verses: number[]): Array<{ issue: BookIssue; verses: number[] }>
```

- Una nota que cubre varios versículos (1:1-2) está en cada uno de ellos en `data.verses`: se cuenta **una vez**, por
  su `id`, en su primer versículo.
- Las introducciones (que no están en `verses[].notes`) y las notas sin `academy` quedan fuera.
- Estudio lo calcula una vez por libro (`useMemo` sobre `context.chapters`) y lo pasa a la parada, al pliegue y a la
  hoja.

Los títulos: `data.academy[path].title` del primer capítulo que lo tenga; si ninguno, `readArticle` al abrir la hoja.

Lo leído: `work.ts`, `issuesReadIn(book)` y `markIssueRead(book, path)`, con la misma forma de guardar que
`studiedIn`.

### 5. Piezas

| Archivo | Cambio |
|---|---|
| `src/app/projects/bookIssues.ts` | nuevo: `issuesOfBook`, `issuesOfSection` |
| `src/app/miniapps/contract.ts` | `BOOK_ISSUES = -2`; `MiniApp.issues?: boolean` |
| `src/app/frame/PlacePicker.tsx` | `stopsOf` pone la parada tras `BOOK_INTRO` cuando la mini app la pide y el libro tiene asuntos; su nombre |
| `src/app/App.tsx`, `src/app/frame/MiniAppScreen.tsx` | pasar a `stopsOf` si el libro tiene asuntos; abrir el libro en ella cuando toca |
| `src/app/projects/progress.ts` | el nombre de la parada en «Siga donde quedó» |
| `src/app/miniapps/estudio/BookIssues.tsx` | nuevo: la parada |
| `src/app/miniapps/estudio/SectionIssues.tsx` | nuevo: el pliegue de la sección |
| `src/app/miniapps/estudio/estudio.tsx` | la parada, el pliegue, `issues: true`; textos es/pt/en |
| `src/app/frame/ArticleSheet.tsx` | `inBook` opcional: «En Rut», con «aquí» y `goTo` |
| `src/app/projects/work.ts` | `issuesReadIn`, `markIssueRead` |
| `src/app/i18n/*.json` | los textos del marco (nombre de la parada, «En {libro}», «aquí») en es, pt, en |

El formato 3 no necesita código nuevo: «Dónde aparece» ya está en la hoja.

### 6. Errores y casos raros

- Libro sin notas con artículo: no hay parada ni pliegues.
- Artículo que no está en el aparato: nombre corto en la lista; la hoja dice que no está y cómo conseguirlo, nunca como
  si no existiera (principio 8).
- Un libro que no terminó de cargar no tiene parada: las paradas se calculan con el libro listo, como hoy.
- Un paquete nuevo cambia las notas: el cálculo sigue a `context.chapters`, así que se rehace solo. Lo leído se guarda
  por ruta del artículo y sobrevive al cambio.
- Una posición guardada en `BOOK_ISSUES` en un libro que ya no tiene asuntos va a la parada siguiente (como una
  introducción que ya no está).

### 7. Pruebas

- **Unidad** (`bookIssues.test.ts`): orden por cuenta y luego por ruta; una nota de 1:1-2 cuenta una vez; sin
  `academy` fuera; `chapters` bien contado; `issuesOfSection` con versículos de varias notas. `stopsOf` con y sin la
  parada.
- **Componentes:** la parada (lista, pliegue después de 8, «Leído» al abrir); el pliegue de la sección (oculto sin
  asuntos, la cuenta del libro); la hoja («aquí» primero, tocar una fila llama a `goTo` y cierra).
- **En la app:** el libro de ejemplo; un paquete real en 2.0 y otro en 3 (staging, donde «Dónde aparece» se ve); la
  lista de comprobación de `FILOSOFIA_DE_DISENO.md` a 375 px y a 1280 × 800, en es, pt y en; con el modo avión.

## Fuera de este diseño (para después, en este orden sugerido)

1. **Palabras clave de la sección**, con cómo las tradujo el texto puente en toda la Biblia (`renderings`) y dónde
   más aparecen: sigue a esta con el mismo patrón de pliegue por sección.
2. **Glosario:** al crear o revisar un término, cómo se tradujo en los libros del aparato y las ocurrencias en libros
   que no están.
3. **Revisor de palabras:** la traducción del equipo frente a las del texto puente en otros libros.
4. **Quiénes, dónde y qué pasa** en la introducción del libro (`topics({ book })`; los versículos de cada uno piden
   `concept(id)`).
5. **Pasajes relacionados** de una sección (`context`) y buscar dentro del estudio.

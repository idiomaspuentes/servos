# El corazón: diario, mezcla y decisiones

Primera etapa del plan (diseño, sección 12). Sin pantallas: el código está en `src/core` y se prueba con
`npm test` (`src/core/merge.test.ts`).

## Qué hay

- **`src/usfm`**: la mezcla por versículo de Taller, copiada tal cual (`verseMarkup.ts`, `usfmEdit.ts`,
  `usfmVerseMerge.ts`, `usfmTrunkPatch.ts`, de `gateway-tasks/src/domain`). Parte el libro en lugares por cada `\v`,
  compara el texto como se lee y reemplaza solo los versículos que cambian, dejando el resto byte por byte.
- **`src/core/journal.ts`**: el diario. `startBook` empieza un libro desde un archivo; `recordEdits` anota cada
  versículo que una persona cambió, con la huella del texto del que partió. «Hasta dónde se incorporó a cada
  persona» se lee del propio diario (`seenUpTo`).
- **`src/core/merge.ts`**: `mergeInto` trae otra copia del libro; `decide` resuelve un choque pendiente y deja la
  decisión en el diario.

## Las reglas de la mezcla, en orden

Para un lugar que las dos copias tienen con el mismo rango:

1. Mismo texto: nada.
2. La otra copia lo tiene vacío: queda el mío. Mi copia lo tiene vacío: entra el suyo.
3. Ya hay una decisión entre exactamente estas dos versiones: se aplica.
4. Su texto salió de un cambio que mi copia ya había incorporado: el mío es posterior, queda el mío.
5. Mi texto salió de un cambio que la otra copia ya había incorporado: el suyo es posterior, entra el suyo.
6. Uno de los dos cambios partió del texto del otro: entra ese.
7. Si no: **choque**, pendiente para una persona.

Para lugares con rangos distintos (un puente contra versículos sueltos): si una sola copia tiene texto, entra esa;
si uno de los lados viene entero de cambios que el otro ya conocía, gana el más nuevo; si no, **choque de
estructura**, aunque las palabras sean las mismas.

## Lo que prueban los casos

- Dos versículos en la misma línea, uno en cada copia, se juntan; también si una copia solo tiene el 1 y la otra el 2.
- El mismo texto (aunque cambien los espacios), o solo el formato o la alineación distintos, no es choque.
- Vaciar un versículo no borra el que la otra copia tiene escrito.
- Un cambio hecho sobre el texto del otro entra solo; uno ya incorporado no deshace lo que vino después.
- Dos proyectos que empezaron por separado: lo distinto se pregunta una vez; la decisión no vuelve, y viaja a otros
  aparatos con el libro.
- La reunión completa: Ana, Beto y Carla; Carla manda su tarjeta y sigue trabajando; al llevarse la mezcla solo le
  choca el versículo que cambió después y que la reunión había resuelto de otra forma; su tarjeta vieja traída otra
  vez no vuelve a preguntar nada.
- Un puente contra versículos sueltos es un choque de estructura, salvo que uno haya partido el puente del otro.

## Lo que falta

- **Los choques pendientes no viajan.** Las decisiones sí; un choque sin decidir queda en el aparato donde se
  encontró. Por decidir si debe viajar en el paquete.
- **Borrar un versículo a propósito no se propaga**, por la regla 2. Habrá que ver si hace falta una forma explícita
  de borrar.
- **La alineación como capa aparte** (diseño, 6.8) todavía no está. Hoy, cuando entra un versículo, entra escrito con
  su alineación, como en Taller.
- **Las pruebas de Taller para `src/usfm`** (`scripts/verify-usfm-merge.mts`, con sus casos P1–P9) no están
  copiadas todavía.
- **El formato del paquete** que lleva el libro y el diario (diseño, sección 7).
- La huella del texto es FNV-1a de 64 bits: basta para distinguir los versículos de un libro, pero no es una huella
  criptográfica.

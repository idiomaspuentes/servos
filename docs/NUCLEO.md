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

## Conectado a las pantallas

Desde el 16 de octubre de 2026 la app guarda cada libro así (cableado, pasos 1 a 3):

1. **Una sola puerta al texto** (`src/app/projects/bookText.ts`). Nada más lee ni escribe los versículos, sus
   autores, las uniones, las versiones que esperan ni los choques de estructura; una prueba lo vigila.
2. **Detrás de la puerta, el libro:** un USFM con la forma del texto puente (sus párrafos, los renglones de un poema,
   todos los versículos, los unidos como ` 1-2`) y su diario. Quién escribió un versículo se lee del diario. El
   diario toma un cambio cuando la persona deja de escribir un momento, cuando escribe otra persona o al salir de la
   app: un versículo escrito letra por letra es un solo cambio. Cada aparato tiene su id, así que dos personas del
   mismo nombre en dos aparatos son dos personas. Los libros se guardan en IndexedDB (o en localStorage donde no se
   puede).
3. **Lo que ya estaba**, escrito versículo por versículo por el prototipo, entra al libro una sola vez, cada
   versículo como cambio de quien lo escribió.

4. **Compartir y recibir con la mezcla** (`mergeBook`, sobre `mergeInto`). El paquete (versión 2) lleva el USFM y
   el diario de cada libro. Las «dos versiones» de un versículo y los tramos unidos de otra manera son los choques
   pendientes del corazón (`state.pending`), y elegir es `decide`: la decisión queda en el diario y no se vuelve a
   preguntar. Quién escribió un versículo es quien escribió ese texto, no quien eligió entre dos versiones. Un archivo
   de la versión 1, un USFM que se agrega o el trabajo de otra computadora traen versículos sueltos: se vuelven una
   copia del libro (`bookFrom`), cada versículo cambio de su autor, con un origen propio para no confundirlos con los
   mismos nombres de este aparato; el mismo archivo da la misma copia, así que traerlo dos veces no trae nada nuevo.

5. **Cada proyecto, su libro** (`src/app/projects/scope.ts`). Dos proyectos de un aparato pueden traducir el mismo
   libro (Jonás al kichwa y al quechua de Cusco): cada uno guarda su trabajo, el texto y su diario, la alineación,
   las revisiones, las notas, las grabaciones y dónde iba cada persona (`jon~biblia-kichwa`). La app dice el proyecto
   al mostrar una de sus pantallas; lo que trabaja con varios lo dice para cada uno (el progreso del inicio,
   compartir, recibir, agregar un libro). Fuera de un proyecto no se encuentra nada: un lugar que olvide decirlo se
   ve vacío, nunca con el trabajo de otro proyecto. Lo que estaba guardado por el libro solo pasó una vez a cada
   proyecto que tiene el libro, y la copia compartida se borró.
6. **Un libro grande sigue rápido.** El libro se guarda entero, pero en memoria va partido por capítulos: una letra
   escribe y vuelve a leer solo su capítulo, y el diario compara solo los capítulos escritos. Con un libro del tamaño de
   Salmos, una letra cuesta unos 4 ms en una computadora (antes 200 ms); una prueba lo vigila.

## Lo que falta

- **Los choques pendientes no viajan.** Las decisiones sí; un choque sin decidir queda en el aparato donde se
  encontró. Por ahora es lo que hace el paquete (versión 2); habrá que ver si a un equipo le hace falta otra cosa.
- **Dos choques sobre el mismo versículo** pueden quedar pendientes a la vez si llegan dos versiones distintas antes
  de elegir; la pantalla de elegir muestra una y, al decidirla, la otra.
- **Borrar un versículo a propósito no se propaga**, por la regla 2. Habrá que ver si hace falta una forma explícita
  de borrar.
- **La alineación como capa aparte** (diseño, 6.8) todavía no está. Hoy, cuando entra un versículo, entra escrito con
  su alineación, como en Taller.
- **Las pruebas de Taller para `src/usfm`** (`scripts/verify-usfm-merge.mts`, con sus casos P1–P9) no están
  copiadas todavía.
- La huella del texto es FNV-1a de 64 bits: basta para distinguir los versículos de un libro, pero no es una huella
  criptográfica.

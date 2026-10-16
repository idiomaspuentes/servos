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
2. La otra copia lo tiene vacío sin haberlo vaciado: queda el mío. Mi copia lo tiene así: entra el suyo. (Uno
   vaciado a propósito se pesa como cualquier cambio: punto 9 abajo.)
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
   puede). Al irse la página (recargar, cerrar, pasar a otra app), lo que no se terminó de guardar se copia al momento
   en localStorage, porque una escritura en IndexedDB empezada entonces puede no terminar; la próxima vez esa copia
   gana, y se borra cuando IndexedDB ya tiene el libro.
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

7. **La alineación, una capa del libro** (`src/core/alignment.ts`, diseño 6.8). Por versículo y por texto con que se
   alinea, con el texto del versículo sobre el que se hizo y su propio diario (cada alineación, con la que
   reemplazó). Viaja dentro del libro. Al juntar sigue a su texto: gana la hecha sobre el texto que queda; dos del
   mismo texto hechas por separado son la más reciente si las hizo una persona, un choque si las hicieron dos (se
   elige en el alineador, y la elección queda en el diario); una que entra hecha sobre otro texto queda, para
   revisar. El diario toma las alineaciones como el texto: cuando la persona se detiene.
8. **Las pruebas de Taller para la mezcla por versículo** (`src/usfm/verseMerge.test.ts`): sus casos, P1–P9 entre
   ellos, tal como Taller los escribió, sobre la copia de Servos; quedan fuera los de lo que Servos no tiene (git como
   transporte, las ramas de tareas, el comentario de choques, su caché de borradores).
9. **Borrar un versículo a propósito viaja.** Un versículo vacío es uno sin escribir, o uno que alguien vació: entonces
   el diario tiene el cambio que lo vació, con el texto que quitó, y se pesa como cualquier cambio. Si lo vació sobre
   el texto que tengo, entra vacío; si ya tenía el borrado, una copia vieja no lo devuelve; si uno lo borró y otro lo
   cambió por separado, se pregunta («Lo borró: el versículo queda vacío»). Un versículo que nunca se escribió sigue
   sin borrar nada (la regla 2).
10. **Las revisiones siguen a su texto, y la del pasaje viaja.** De dos revisiones de una nota o de una palabra, o de
    dos «sí» a una pregunta de un pasaje, queda la dada sobre el texto que queda aquí, aunque la otra sea más nueva;
    de dos sobre el mismo texto, la más reciente. Lo visto para mejorar en un pasaje se junta, nada se pierde, y lo
    marcado mejorado en un aparato llega mejorado (un archivo viejo no lo vuelve a abrir). Estas capas guardan aún
    solo lo último de cada una, sin diario propio como la alineación: es el paso siguiente si hace falta.
11. **Las dos versiones sin elegir viajan con el libro** (`state.pending`, también los de la alineación). Quien recibe
    el libro las ve donde tiene una de las dos, desde su lado (la suya contra la otra); donde ya escribió otra cosa no
    se le pregunta. Una decisión tomada en cualquier aparato las cierra en los demás al traer su libro, también si al
    decidir se escribió una versión nueva. Y un aparato que tiene la elección abierta ya no cuenta como si hubiera
    elegido: antes, quien recibía su libro tomaba su versión sin preguntar, porque su diario ya traía la otra.
    Donde la elección llegó así, la pantalla dice cada versión por quien la escribió («La que está ahora · Ana», «La de
    Bea»), no «la de este teléfono» y «la que mandó Bea»: ninguna de las dos se escribió aquí ni se mandó desde allá.
12. **Varias versiones de un versículo se juntan de una vez** (diseño 6.10). `versionsAt` da todas las de un
    versículo, la de aquí primero, cada una con quienes la escribieron; `gather` (sobre `decideAll`) deja una o una
    mezcla con una sola decisión que nombra todas, y a nadie se le vuelve a preguntar. Una decisión dice también qué
    decisiones de ese lugar conocía (`after`): la que se tomó sabiendo de otra la reemplaza, y dos tomadas por
    separado que dejan textos distintos se vuelven a elegir (antes ganaba una en silencio, o cada aparato se quedaba
    con la del otro).
13. **La pantalla «Juntar»** (`GatherScreen`, diseño 6.10) reemplaza a la de elegir entre dos. Va por sección
    (`sectionsToGather`, `readingsOf`): la de cada uno se lee de corrido y se deja una para toda la sección con una
    sola acción (`gatherAll`); o versículo por versículo, con todas sus versiones; o una mezcla tocando trozos
    (`mix.ts`). Lo último se puede deshacer (`undoGather`) mientras nada más se escribió en el libro. Al recibir se
    cuentan versículos para juntar, no choques.
14. **Cómo trabaja el equipo, por libro** (`BookEntry.together`, diseño 6.10): «Por partes» o «Todos lo mismo», en
    «Más» del libro; viaja en el paquete con el libro (`SharedBook.together`). Con «Todos lo mismo», lo que llega es
    «la versión de Bea», y el libro cuenta secciones para juntar. Un versículo con versiones esperando no cuenta como
    traducido en ningún modo. Al recibir, un libro sin nombre ya no pierde lo que el proyecto sabe de él (antes se
    reescribía solo con su código y su paso).

## Lo que falta

- **El editor muestra dos versiones a la vez.** Cuando un versículo que se escribe tiene versiones esperando, el
  editor ofrece la primera frente a la de aquí; con varias, una tras otra. Para verlas todas está «Juntar».
- La huella del texto es FNV-1a de 64 bits: basta para distinguir los versículos de un libro, pero no es una huella
  criptográfica.

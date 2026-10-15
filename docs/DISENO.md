# Servos: diseño

Primera versión, 14 de octubre de 2026. Es un documento para conversar: lo que está marcado **Por decidir** todavía
no se decidió, y lo demás puede cambiar si al construirlo aparece algo mejor.

## 1. Para quién y para qué

Servos es la app con la que los traductores de Otras Lenguas traducen un libro de la Biblia usando los recursos que
el equipo produce en Taller: los textos puente (TPL y TPS), las notas, las preguntas, las palabras clave y la
academia.

Quienes la usan están en la selva o en zonas rurales, con poca o ninguna conexión. De ahí salen tres exigencias que
mandan sobre todo lo demás:

1. **Funciona sin internet, siempre.** Internet es un extra para subir a Door43, nunca una condición para trabajar.
2. **Teléfono y computadora por igual.** Android y Windows, y posiblemente iPhone. Una misma base de código.
3. **Los paquetes viajan en la mano.** Tarjeta SD, USB, Bluetooth o compartir cercano: lo que el aparato ya sabe
   hacer con un archivo.

## 2. Principios

- **Un archivo es la unidad de intercambio.** La app importa y exporta archivos; moverlos lo hace el sistema
  (menú de compartir, explorador de archivos). Servos no programa Bluetooth.
- **Nada se pierde.** Cada cambio queda en un diario con quién lo hizo; mezclar nunca borra trabajo en silencio.
- **Solo los choques reales llegan a una persona.** Lo que se puede unir solo, se une solo (sección 6).
- **Una decisión de mezcla se toma una vez.** Queda registrada y no vuelve a preguntarse (sección 6.4).
- **Una sola cosa obvia por pantalla.** Pensada primero para el teléfono, para gente poco habituada a la
  tecnología. La misma regla que Taller. Cómo se diseña cada pantalla: [`FILOSOFIA_DE_DISENO.md`](FILOSOFIA_DE_DISENO.md).
- **Preparada para lo que viene sin construirlo antes de tiempo:** traducción oral (sección 10), más idiomas de
  interfaz, más mini apps.

## 3. Cómo se usa

```
Personas de este aparato → Proyectos → Libro → Catálogo de mini apps → Mini app
```

1. **Elegir quién soy.** Cada instalación tiene varias personas. Cada una entra con su nombre, sin contraseña ni
   internet, y se cambia de persona como de perfil (sección 5).
2. **Elegir el proyecto.** Un proyecto es la traducción de un idioma. Puede ser de una persona o compartido por
   varias en el mismo aparato.
3. **Elegir el libro.**
4. **Elegir qué hacer con ese libro**, de un catálogo de mini apps. El flujo se parece al de `usfm-editor` (en
   `usfm-ast`): proyecto, libro, herramientas. La diferencia es que aquí cada herramienta es una mini app
   independiente que se suma al catálogo.

Las fases del trabajo existen, pero no son las de Taller ni van en el mismo orden. **Por decidir:** si el catálogo
sugiere un orden (por ejemplo estudio → borrador → desafíos → palabras → alineación) o si cada equipo arma el suyo.

## 4. El catálogo de mini apps

Cada mini app recibe el libro, los recursos y la persona, y devuelve cambios al diario. Así se pueden agregar
nuevas sin tocar las demás.

| Mini app | Qué hace | Lo que reusa de Taller o de `usfm-ast` |
|---|---|---|
| **Estudio** | Leer el libro con sus recursos antes de traducir: textos puente, notas, preguntas, palabras, academia | La lectura de ayudas pegadas al versículo de Taller |
| **Editor** | Escribir el borrador, versículo por versículo, con los textos puente al lado | El editor de USFM de `usfm-ast`; las reglas de escritura del USFM de Taller (poesía, notas) |
| **Revisar con las notas** | Comprobar que cada frase difícil (las notas que enlazan a la Academia) quedó traducida como explica su nota y se entiende bien. Tres pasos por nota: leer la nota, marcar en el borrador las palabras que lo dicen, responder (bien, mejorarla ahora en el editor, mejorarla después). Por versículo, o por categoría y figura | La revisión de translationCore 3 y 4 y la Afinación de Taller (texto de referencia cambiable, marcar palabras con el dedo) |
| **Revisar con las palabras** | Comprobar cada uso de una palabra (términos clave, otros términos, nombres) con los mismos tres pasos, y en el tercero cómo se tradujo en los demás lugares del libro: donde significa lo mismo, igual; donde significa otra cosa, según su sentido. Palabra por palabra, o por versículo | «Revisar palabras clave» de Taller; los dos revisores comparten `miniapps/checking` |
| **Alinear la traducción** | Unir cada palabra del borrador con la palabra de la fuente que traduce: el TPL por omisión, o el TPS, o el original (con las palabras del TPL debajo de cada palabra hebrea o griega). Cada fuente guarda su propia alineación, y los enlaces siguen a las palabras cuando el texto cambia | Las cajas y el banco de palabras de Taller, sobre el modelo de cajas de `usfm-ast` (`@usfm-ast/alignment-box-model`) |
| **Publicar** | Preparar una publicación, aunque sea parcial, sin internet | Sección 8 |

En el revisor de desafíos de Taller el propósito es que el TPL o el TPS se mantenga dentro de sus propias reglas.
Aquí el propósito es otro: que la traducción a la lengua del pueblo resolvió bien el desafío. La pantalla es casi
la misma; las preguntas no.

## 5. Personas y sesiones sin internet

- Cada persona se identifica con **su nombre más un identificador del aparato**, que la app crea sola la primera
  vez. Se muestra solo el nombre. Así, dos «Juan» en dos aldeas no se confunden cuando sus libros se juntan.
- No hay contraseña. **Por decidir:** si hace falta un PIN opcional para que otro no trabaje con el nombre de uno en
  un aparato compartido.
- Un proyecto compartido en el mismo aparato tiene un solo libro y un solo diario; cada cambio lleva el nombre de
  quien lo hizo.
- Cuando haya internet, una persona puede vincular su nombre con su cuenta de Door43 para subir su trabajo
  (sección 8).

## 6. Versiones y choques

Esta es la parte central del diseño. Hay que conversarla con ejemplos antes de construirla.

### 6.1 Por qué no basta con git

Sin internet, dos proyectos no parten del mismo punto. Git mezcla por líneas a partir de un ancestro común, y eso
da dos clases de choques falsos:

- **Dos cambios en la misma línea que son versículos distintos.** Un archivo tiene el versículo 1 en la línea 1 y
  el otro tiene el versículo 2 en la línea 1: git los ve como el mismo lugar y choca.
- **Dos proyectos que empezaron por separado** no tienen ancestro común; git ve todo el libro como un choque.

Los sistemas de choques de `usfm-ast` no resuelven bien estos casos. Servos tiene el suyo propio, construido
sobre lo que ya funciona en Taller.

### 6.2 La unidad es el versículo, no la línea

Lo tomamos de Taller (`src/domain/usfmVerseMerge.ts`, `usfmTrunkPatch.ts`, documentado en
`docs/PLAN_RAMAS_Y_COLISIONES.md` de Taller, con sus casos P1–P9 probados en `scripts/verify-usfm-merge.mts`):

- El libro se parte en **lugares**: `(capítulo, desde, hasta)`. Un versículo `\v 3` es `(c, 3, 3)`; un puente
  `\v 3-4` ocupa el 3 y el 4 como una sola unidad. Se parte por cada `\v`, no por línea: dos versículos en una
  línea son dos lugares.
- Lo que se compara es **el texto que se lee**: sin la alineación, con las notas como anclas, con los saltos de
  párrafo y de poesía como espacios. Cambiar solo el formato o solo la alineación no es un choque.
- Lo que no cambió se queda **byte por byte**; solo se reemplazan los versículos que cambiaron.

| Caso | Resultado |
|---|---|
| Versículos distintos, aunque estén en la misma línea | Se unen los dos, en orden |
| Un lado vacío y el otro escrito | Queda el escrito |
| Los dos con el mismo texto (sin contar espacios) | Queda ese, sin choque |
| Solo cambió el formato o la alineación | No es un choque de traducción |
| Solo un lado cambió el versículo desde lo que ya se tenía | Entra ese cambio |
| Los dos cambiaron el mismo versículo, distinto | **Choque real**: decide una persona |
| Un puente contra versículos sueltos, con texto en los dos | **Choque de estructura**: decide una persona |

### 6.3 El diario: qué cambió, quién, desde dónde

Cada proyecto lleva un diario de cambios por versículo, además del libro:

- quién (nombre + aparato), su número de orden, el lugar `(capítulo, desde, hasta)`;
- la **huella del texto del que partió** y el texto nuevo;
- cuándo.

Y cada proyecto recuerda **hasta dónde incorporó a cada persona**: «de Juan@aldea1, hasta su cambio 57». Al traer
el libro de alguien solo se miran sus cambios nuevos.

Con la huella de partida, la regla de la tabla anterior («solo un lado cambió desde lo que ya se tenía») se aplica
versículo por versículo, aunque los dos proyectos no compartan historia.

### 6.4 Las decisiones de mezcla se registran

Cuando hay un choque real y una persona decide («queda la de Juan», «queda la mía», o escribe una tercera versión),
la decisión entra al diario como un cambio más: qué versiones se compararon (sus huellas), cuál quedó y quién lo
decidió.

La próxima vez que se traiga el libro de esa persona:

- sus cambios ya incorporados no se vuelven a mirar (sección 6.3);
- y si llega otra vez el mismo par de versiones, la decisión ya está: no se pregunta de nuevo.

Solo vuelve a haber choque si alguien cambió ese versículo **después** de la decisión.

### 6.5 Dos proyectos que empezaron por separado

La primera vez que se juntan no hay historia común:

1. Se compara el libro versículo por versículo con las reglas de 6.2. Lo igual y lo que solo tiene un lado se une
   solo.
2. Lo distinto se presenta una vez, versículo por versículo, en el solucionador.
3. Cada decisión queda registrada (6.4), y desde ahí los proyectos se siguen juntando: la segunda vez solo se miran
   los cambios nuevos.

**Siguen siendo proyectos distintos que se alimentan entre sí** (decidido el 14 de octubre). Nadie pierde su
proyecto al juntarse: cada persona sigue trabajando en el suyo, y cada mezcla le trae lo de los demás.

### 6.6 Un caso: la reunión

Tres traductores de la misma etnia, Ana, Beto y Carla, trabajan en comunidades distintas, cada uno en su teléfono.
Para verse viajan horas a un lugar donde probablemente tampoco hay internet. Carla no puede viajar, pero manda su
traducción en una tarjeta SD.

1. **En la reunión**, alguien toma el papel de quien mezcla: uno de ellos o una persona de fuera (6.7). Importa los
   paquetes de trabajo de Ana, Beto y Carla.
2. **Se mezcla.** Lo que no choca se une solo. Los choques reales se deciden ahí, entre los presentes, versículo por
   versículo; cada decisión queda en el diario con quién la tomó.
3. **Cada uno se lleva la mezcla**: Ana y Beto la importan en sus teléfonos. A Carla se le devuelve en la misma
   tarjeta, como un paquete de trabajo más.
4. **Mientras tanto Carla siguió trabajando.** Cuando importa la mezcla:
   - lo suyo que ya estaba en la mezcla no se vuelve a mirar;
   - lo que cambió después de mandar la tarjeta entra solo si nadie tocó esos versículos en la reunión;
   - solo choca si cambió un versículo que la reunión resolvió de otra manera. Es un choque verdadero (los dos lados
     cambiaron desde el mismo texto), y lo decide ella, o se deja para la próxima reunión.
5. **La próxima vez** que alguien traiga la tarjeta de Carla, las decisiones de la reunión ya están: no se vuelven a
   preguntar.

Lo que hace falta para que esto funcione es lo de 6.3 y 6.4: cada cambio sabe de qué texto partió, cada proyecto
sabe hasta dónde incorporó a cada persona, y las decisiones viajan dentro de los paquetes.

### 6.7 Quién mezcla y quién decide

- **Cualquiera del proyecto** puede mezclar y decidir un choque.
- En una reunión, uno de ellos o alguien de fuera toma el papel de quien coordina y hace las mezclas. Entre ellos
  deciden también quién publica en Door43.
- Sin internet no hay cómo comprobar permisos, y no hace falta: la app confía en el grupo y **deja constancia**.
  Cada decisión dice quién la tomó y dónde (en qué aparato, en qué mezcla).

### 6.8 La alineación

- Se alinea por defecto con **la versión de referencia principal**: el TPL o su análogo en otro idioma (por
  ejemplo, el ULT en inglés). Se puede alinear también con otras.
- La alineación es una capa aparte, guardada por versículo y por texto de referencia, con la huella del texto del
  versículo al que pertenece. Puede viajar sola o junto con el libro.
- **En una mezcla, la alineación sigue a su texto:** si gana la versión de Ana de un versículo, gana con ella su
  alineación, porque se hizo sobre ese mismo texto. Si el texto que queda no es exactamente aquel sobre el que se
  alineó (porque alguien lo reescribió al decidir), la alineación de ese versículo queda **por revisar**, no se
  borra en silencio. Taller hace lo mismo con su huella de alineación.
- Dos alineaciones distintas del mismo texto con la misma referencia (decidido el 14 de octubre): si las hizo la
  misma persona, queda la más reciente; si las hicieron personas distintas, es un choque de alineación y se decide
  como los de texto.
- **La alineación alimenta el glosario** (idea del 15 de octubre, para la mini app de revisión «Alineación»): al
  alinear un versículo con el original, la palabra con que se tradujo cada palabra del hebreo o del griego se anota
  en el glosario del proyecto (en el archivo de esa palabra, sección 7), con el versículo como ejemplo. Lo que el
  equipo decidió a mano queda como está; lo que sale de alinear se agrega como otra forma usada, para que el revisor
  vea de un vistazo si una palabra se tradujo siempre igual o de varias maneras.

### 6.9 Dónde se guarda

- El libro en USFM, como en Door43, para que sea legible fuera de la app.
- El diario y el registro de lo incorporado, en archivos propios junto al libro.
- **Git (`isomorphic-git`)** como respaldo y como formato para subir a Door43. Git guarda; la mezcla la decide
  Servos.

## 7. Los paquetes

| Paquete | Qué lleva | Quién lo hace |
|---|---|---|
| **Paquete de Recursos de Traducción** | Los textos puente, notas, preguntas, palabras y academia de uno o varios libros, con su versión | Se arma desde lo publicado por Taller en Door43 |
| **Paquete de trabajo** | El libro de un proyecto, su diario y su registro de lo incorporado | Lo exporta una persona desde Servos |
| **Paquete de interfaz** | La traducción de la app a un idioma (sección 9) | Lo exporta quien tradujo la interfaz |
| **La app misma** | El instalador (APK, instalador de Windows) | Para instalar sin internet |

- Cada paquete es **un solo archivo** con un manifiesto que dice qué es, de qué versión y para qué libro.
- **El Paquete de Recursos de Traducción es el «paquete de idioma» de tc-study** (decidido el 14 de octubre). Su
  formato está en `bt-synergy/apps/tc-study/docs/cache-data-structure.md`, sección 6, y lo hace y lo abre el paquete
  `@bt-synergy/language-pack` (rama `feat/language-pack` de `bt-synergy`). Lleva las filas del catálogo, los recibos,
  el texto fuente del idioma y el original griego o hebreo, y además lo ya construido: las vistas preparadas, las
  citas de cada nota resueltas en el original y en cada texto destino, y los títulos de los artículos. Así se abre
  sin internet y ya listo para leer. Servos guarda esas filas con las mismas claves de caché que tc-study.
- **Decidido el 14 de octubre:**
  - Los paquetes se preparan con el mismo código en tres lugares: dentro de la app cuando hay internet, con un
    comando, y en un servidor que guarda la última versión de cada paquete, con la mayor compresión, para bajarla
    desde una página de la web oficial.
  - Un paquete puede ser un idioma entero o un solo libro. Los idiomas originales (griego y hebreo) van en paquetes
    aparte, porque sirven para todos los idiomas.
  - Los recursos de un idioma son los mismos que encuentra la página Read de tc-study: lo marcado `tc-ready` en
    Door43 para ese idioma, de cualquier dueño.
- El plan para sacar de tc-study la tubería que descubre, descarga y construye los recursos está en
  `bt-synergy/docs/LANGUAGE_PACKS_PLAN.md`.
- Falta sacar de la app tc-study a paquetes compartidos el código que construye y muestra las citas y los títulos
  (`apps/tc-study/src/features/helps`), para que Servos pueda reconstruirlos si un paquete viene sin ellos.
- **El léxico viaja en el paquete de idioma** (decidido el 15 de octubre): los léxicos que usa Taller en Door43
  (`es-419_uhl` para hebreo y arameo, `es-419_ugl` para griego; un archivo por número Strong, `content/7121.json`).
  Al tocar una palabra, el léxico es la última ayuda, con el sentido que da para ese versículo primero (la numeración
  hebrea de algunos versículos se convierte como en Taller).
- **El glosario del proyecto es un archivo por palabra** (decidido el 15 de octubre), como los léxicos: en Door43,
  el repositorio `<idioma>_tg` con `content/H7121.json` = `{ "strong", "entries" }`; una expresión vive en el archivo
  de su primera palabra. Cada capítulo lee solo los archivos de sus palabras, y dos traductores que agregan palabras
  distintas no tocan el mismo archivo. Entre computadoras viaja, por defecto, solo lo cambiado desde la última vez.
  Las entradas conservan las columnas del glosario de Taller, y se recibe su TSV; para que las dos apps compartan
  el repositorio, Taller tendría que pasar a este formato.
- **El paquete de trabajo** (decidido el 15 de octubre). En la app se llama **«Compartir»** y **«Recibir»**, sin
  nombre técnico; el archivo termina en `.servos`.
  - **Qué lleva:** un índice (qué proyecto, de quién, cuándo, qué libros) y, por cada libro, el texto (con los
    versículos unidos, como `\v 1-2`), su diario, y lo que va pegado a cada versículo con la huella del texto sobre
    el que se hizo: la alineación con cada fuente, las revisiones con notas y con palabras, las notas de estudio y las
    versiones que esperan una elección. Del proyecto: el glosario, los ajustes y las mini apps de cada paso.
  - **Va todo, sin preguntar** capa por capa. El diario hace que traer lo mismo dos veces no duplique nada.
  - **Compartir:** desde un libro («Más › Compartir este libro») o desde los ajustes del proyecto («Compartir el
    proyecto», con los libros marcados; todos de entrada). Se puede mandar parte de un libro («Jonás 1:1–10»).
  - **Recibir** («Agregar un proyecto › Recibir», o desde el libro), en tres pasos, sin aplicar nada antes del último:
    qué trae (de quién, cuándo, qué libros y el glosario); dónde va (si el proyecto ya está en el aparato, se junta
    con él; si no, se elige: **agregarlo como proyecto nuevo o juntarlo con uno propio del mismo idioma**, el caso de
    6.5); y qué libros, cada uno con lo que cambia aquí («12 versículos nuevos · 40 iguales · 3 escritos distinto,
    para elegir»; «libro nuevo para usted»).
  - **Al juntar, cada capa sigue a su texto** (6.2 y 6.8): lo que solo tiene un lado entra; lo distinto queda como
    dos versiones para elegir; la alineación y las revisiones de un versículo entran si se hicieron sobre el texto
    que queda, y si no quedan por revisar, nunca borradas; el glosario se junta palabra por palabra (una traducción
    distinta queda como otra forma); dos notas de estudio distintas sobre los mismos versículos quedan las dos, cada
    una con su autor.
- Al importar, la app dice qué trae y qué cambia antes de aplicarlo.
- Un paquete de recursos más nuevo puede reemplazar a uno anterior; el trabajo hecho no se toca, pero la app avisa
  qué notas o textos cambiaron en los versículos ya traducidos.

## 8. Publicar

Como en `usfm-editor`:

- **Sin internet** se prepara una publicación, completa o parcial (algunos capítulos o libros), con su número de
  versión.
- **Con internet**, la publicación pendiente se sube a Door43: el libro, su historia y la versión.
- Quien sube necesita su cuenta de Door43; ahí se vincula su nombre de Servos con esa cuenta.

**Por decidir:** a qué organización y repositorio de Door43 va cada proyecto, y quién lo crea la primera vez.

## 9. La interfaz se traduce dentro de la app

- Idiomas iniciales: **español, portugués e inglés**.
- Un **editor de textos de la interfaz** dentro de la app, pensado para traductores, no para programadores: cada
  frase con su contexto (dónde aparece), con los `{marcadores}` protegidos, y sin tener que tocar JSON.
- Lo que se traduce se guarda como un archivo JSON por idioma, que se **comparte** con otros (paquete de interfaz)
  y que el equipo puede **recibir para incluirlo** en una versión nueva de la app.
- Cada frase lleva una huella de su texto original. En una versión nueva la app dice al traductor de la interfaz:
  - qué frases nuevas le faltan;
  - qué frases quedaron **invalidadas** porque el texto original cambió, mostrando el antes y el después.
- La comprobación de claves y marcadores que Taller hace con `verify:config` se repite aquí.

## 10. Preparada para la traducción oral

No es parte de la primera etapa, pero el diseño no debe cerrarle la puerta:

- El diario guarda cambios por lugar (capítulo, versículos); un lugar puede tener, además del texto, una
  grabación.
- Los paquetes pueden llevar archivos de audio.
- La lista de mini apps admite una de grabación.

## 11. Arquitectura

- **Una base de código web** (React + Vite + TypeScript, como Taller) empaquetada como:
  - **Tauri** para computadoras (Windows primero, luego Mac y Linux);
  - **Capacitor** para teléfonos (Android primero, luego iPhone);
  - **PWA** como extra, para quien tenga internet al instalar.
- **Almacenamiento** por la capa de `platform-adapters` de `usfm-ast`, que ya abstrae la web, Tauri y Capacitor.
- **Del lado de `usfm-ast`:** el analizador y el editor de USFM, el alineador y la lectura de formatos. Los
  sistemas de choques de `usfm-ast` no se usan.
- **De Taller:** la mezcla por versículo, el solucionador de choques y la lectura de ayudas. **Por decidir:** si se
  sacan a un paquete compartido que usen las dos apps, o si Servos los copia y los adapta. Compartirlos evita que
  diverjan, pero ata los ritmos de las dos apps.

## 12. Por dónde empezar

Propuesta de etapas, para conversar:

1. **El corazón sin pantalla:** el formato del diario, la mezcla por versículo y el registro de decisiones, con
   pruebas que cubran los casos de 6.2 y los de dos proyectos que empezaron por separado. Es lo más difícil y lo
   que todo lo demás necesita.
2. **Personas, proyectos y paquetes:** entrar sin internet, crear un proyecto, importar un paquete de recursos,
   exportar e importar un paquete de trabajo.
3. **Estudio y Editor**, en teléfono y computadora.
4. **El solucionador de choques**, sobre el corazón de la etapa 1.
5. **Revisor de desafíos y de palabras clave.**
6. **Alineador.**
7. **Publicar y subir a Door43.**
8. **El editor de la interfaz.**
9. **Instaladores** para Android, Windows e iPhone.

## 13. Preguntas abiertas

- El orden de las fases, y si cada equipo arma el suyo (sección 3).
- PIN opcional por persona (sección 5).
- El formato del paquete de trabajo (sección 7).
- A dónde va cada proyecto en Door43 (sección 8).
- Paquete compartido con Taller o copia adaptada (sección 11).
- El nombre de dominio `servos.bible` todavía no está apartado.

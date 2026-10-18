# Filosofía de diseño de Servos

*14 de octubre de 2026.* Servos toma la filosofía de translationCore 4 (tC4), como Taller, y la lleva a un teléfono sin internet. tC4 mete muchas funciones sin quitarle protagonismo al texto, pero es una aplicación de escritorio, con columnas a los lados, ratón y teclado. Quienes usan Servos traducen en su lengua, en zonas con poca o ninguna conexión, muchas veces en un teléfono compartido y sin mucha costumbre de usar tecnología.

Este documento es la regla para diseñar cada pantalla y cada mini app. Lo que se toma de tC4, con el archivo donde se ve, está en Taller: `../gateway-tasks/docs/ESTRUCTURA_TC4.md` (sección 1). La misma filosofía, aplicada a Taller: `../gateway-tasks/docs/FILOSOFIA_DE_DISENO.md`.

**En una frase:** lo que la persona está traduciendo ocupa la pantalla; todo lo demás está a un toque, aparece cuando hace falta y la app nunca le dice algo que no es cierto, tampoco sobre lo que está o no está en el aparato.

## Los principios

### 1. Decide quien traduce

En tC4, ante dos opciones, gana la que sirve a quien traduce (`docs/VISION.md` de tC4). En Servos, el orden es este:

1. que el trabajo no se pierda;
2. que se pueda trabajar sin internet;
3. que lo entienda alguien poco hábil con la tecnología;
4. después, lo demás.

Una función nueva que complica una pantalla de trabajo tiene que ganarse el lugar frente a estos tres primeros.

### 2. El texto en el centro

En el teléfono, el versículo con que se trabaja y la caja donde se escribe llenan la pantalla.

- Al escribir, el texto puente queda pegado a la caja: el versículo abierto muestra su TPL o su TPS, la caja y lo que conviene mirar en ese versículo.
- En el teléfono no queda nada fijo que no haga falta. Con el teclado abierto quedan unos 400 px.
- En la computadora (Tauri), lo que en el teléfono es una hoja o una pestaña puede ser una columna a un lado, como en tC4: los libros a la izquierda, las ayudas a la derecha y el texto en medio.

### 3. Lo demás, cerca y en capas

Cada función secundaria va en la capa más baja donde todavía se encuentra sin buscarla:

| Capa | Para qué | Ejemplo |
|---|---|---|
| En la pantalla, plegado | Lo que se lee una vez | «Antes de empezar» de cada mini app |
| Dentro de lo abierto | Lo que sirve para ese versículo | Las ayudas del versículo, «Unir con el siguiente» |
| Hoja que sube | Una lista o un texto largo | Los versículos del capítulo con su estado; un artículo de la academia |
| Menú «Más» de la mini app | Lo que se usa poco en esa mini app | Cambiar el texto puente que se ve, rehacer |
| Menú de la persona | Lo que no es de una mini app | Cambiar de persona, idioma de la interfaz, recibir o enviar un paquete |

En los menús, cada fila tiene dos líneas: la acción y una frase que dice qué hace, como en el menú de cuenta de tC4.

### 4. Lo que tocas decide lo que ves

Las ayudas (notas, preguntas, palabras clave, academia) se leen pegadas a su versículo, de una en una, nunca como una lista larga. Al abrir un versículo se muestran las de ese versículo. Sin nada abierto, se muestran las del primero que falta.

### 5. Se ofrece, no se impone

tC4 anima a prepararse, pero no obliga. En Servos, el catálogo puede sugerir un orden de mini apps (diseño, sección 3), pero ninguna pantalla cierra el paso a otra. La ayuda está a la vista o a un toque, pero no hay que abrirla para seguir.

### 6. Avisos solo cuando algo falla

Lo normal no se anuncia. Un aviso aparece cuando hay algo que hacer o algo salió mal, y dice qué hacer. Un choque llega a una persona solo si no se pudo unir solo (diseño, sección 6). Un botón que solo sirve en un caso aparece solo en ese caso.

### 7. Una cosa obvia que hacer

- Un solo botón lleno por pantalla; lo demás, con borde o como enlace.
- Al terminar algo, el botón lleno lleva al siguiente versículo o al siguiente paso, en lugar de volver a una lista.
- Dos cosas que significan algo distinto no se parecen.

### 8. Honestidad, también sin internet

- **Lo que está en el aparato no es lo que está en Door43.** «Guardado en este teléfono» y «Subido a Door43» son dos estados distintos, y la app dice cuál es.
- **No está aquí no es lo mismo que no existe.** Un recurso que no vino en el paquete se muestra como «no está en este aparato», con cómo conseguirlo, y no como si no hubiera.
- **Quién hizo cada cambio.** En un aparato compartido, siempre se ve quién está trabajando, y cada cambio lleva su nombre (diseño, sección 5).
- **Un número que baja dice por qué.**

### 9. El trabajo no se pierde

- Cada cambio queda en el diario; mezclar nunca borra trabajo en silencio (diseño, sección 2).
- Nada reescribe en silencio el texto de una persona.
- La app propone y la persona confirma: una sugerencia (de alineación, de mezcla) no se guarda sin que alguien la acepte.

### 10. Un marco para todas las mini apps

Cada mini app pone su centro; el marco es el mismo para todas:

- **la cabecera**, con «‹», el libro y el pasaje en una línea, quién está trabajando, el estado de guardado, un botón principal y «Más»;
- **la línea de posición**, «Rut 1:2 · 2 de 22 ‹ ›»: tocar el número abre la lista con el estado de cada versículo;
- **el panel de ayudas**, pegado al versículo.

Lo que se aprende en una mini app sirve en la siguiente, y una mini app nueva no tiene que inventar su propia forma.

### 11. Pensado para el dedo y para otras lenguas

- **Toques de 44 px** como mínimo. Lo que se arrastra (las palabras al alinear) se prueba aparte, en un teléfono.
- **Ningún icono sin palabra.** En el teléfono no hay texto al pasar el ratón, y una palabra se puede traducir; un icono suelto no dice qué hace.
- **Tocar, no pasar el ratón.** Lo que en tC4 se marca al pasar por encima, aquí se marca al tocar.
- **Tocar antes que escribir.** Si el texto ya existe, se ofrece en trozos para tocar; el teclado es el último recurso.
- **Nada escondido sin que se note.** Una pestaña dice cuánto hay dentro («Notas 3»).
- **Cada pantalla se mide en español, portugués e inglés a 375 px**, y en los idiomas que se agreguen con el editor de la interfaz (diseño, sección 9): las frases cambian de largo.
- **Lugar para la voz.** Donde hoy hay una caja de texto, el diseño deja lugar para una grabación (diseño, sección 10).

### 12. Cada acción tiene su forma

Nada que actúe flota solo como texto de enlace: un enlace suelto en una línea se ve viejo y no dice qué es. Cada
acción toma la forma de su papel:

| Papel | Forma | Ejemplos |
|---|---|---|
| Lo principal | Botón lleno, uno por pantalla | «Continuar», «Sí, se entiende bien» |
| Una alternativa que hace algo | Botón con borde, del ancho del lleno, debajo de él | «Dejar este para después», «Elegir otro archivo» |
| Salir o cancelar, sin hacer nada | El «‹» del encabezado o «Cerrar» de la hoja; sin botón propio | Terminar de recibir, dejar una hoja |
| Abrir algo más | Fila de ancho completo con su flecha: › abre una hoja u otro lugar, ▾ despliega aquí y gira al abrir | «Por capítulo», «Leer el artículo», los pliegues |
| Actuar sobre una cosa | Chip pegado a la cosa: borde, verbo y su signo (✎, +) | «✎ Cambiar», «+ Agregar al glosario», «↶ Deshacer» |
| Lo que la app sugiere una vez | Tarjeta neutra, debajo de lo que sigue, con su acción y «Ahora no» | «¿Cómo se dice «Jonás» en kichwa?» |
| Pasar el libro de paso | Botón con borde al pie del paso, con una línea que dice qué cambia | «Terminar Traducción y pasar a Revisión» |
| Moverse en una lista | Dos cuadrados teñidos de 44 px, de esquinas redondeadas (como las flechas de tC4), sin borde, con la posición en medio. Lo que comparte su barra (el filtro, «Listo») toma las mismas esquinas, sin borde | «‹ 2 de 5 ›» |
| Ver una cosa u otra de un panel | Pestañas con una línea bajo la abierta (como las ayudas de tC4) | Su traducción · TPL · TPS · Hebreo · Ayudas |
| Elegir entre pocas, una a la vez | Píldoras sobre un riel hundido; la elegida, levantada (como el interruptor de modo de tC4) | Glosario · Notas · Preguntas; los pasos del libro |
| Algo que no se deshace | Botón con borde rojo | «Desvincular de este teléfono» |

- **Chip no es etiqueta.** El chip hace algo: tiene borde, un verbo y su signo. La etiqueta dice un estado: va teñida,
  sin borde, con un adjetivo («Acordada», «Pronto»), y no se toca.
- **Presupuesto por pantalla:** un botón lleno y, como mucho, dos con borde; lo demás, filas y chips. Una sola
  sugerencia a la vez.
- **El texto de enlace queda** dentro de una frase (al final, como «…Ver en Door43»), en el musgo de la app. El
  encabezado («‹ Inicio», «Más») va en el color del texto, en su lugar fijo de siempre.
- **Tres tonos, no más** (como tC4): el fondo; encima, tarjetas que se separan por un tono y una sombra suave, no por
  un borde; dentro de una tarjeta, nada en su propia caja, solo líneas finas. Una caja dentro de otra hace competir a
  las dos. En el editor, solo la caja que se escribe se dibuja; las demás son un fondo leve.
- **Papel, tinta y musgo** (18 de octubre de 2026, después de una
  [investigación del sector](INVESTIGACION_MARCA_Y_PALETA.md)): el fondo es el papel
  cálido de una Biblia impresa (#f7f2e8), el texto va en una tinta casi negra (#182125, 14.7:1), lo que lleva adelante
  y la marca en un verde musgo profundo (#3b6f30, 5.4:1), y lo marcado en un oro cálido. «Hecho» va en azul y
  «peligro» en un carmesí, para que los tres se distingan también sin ver el rojo y el verde. El azul tinta de antes
  (#17496a con ocre) se cambió porque era casi la paleta de unfoldingWord y se leía como «texto más oscuro», no como
  marca; en el sector casi todo es azul, rojo o naranja, y el verde profundo no es el color principal de nadie. Las
  sombras toman el café del papel, no el gris. **De noche, la tinta es el fondo y el papel es la luz**: un casi negro
  con un tinte frío (#0c1316, nunca negro puro), el texto en papel suave (nunca blanco), el musgo más claro (#98cf8b),
  la profundidad por un tono más claro y no por sombras ni brillos.
- **Sin vidrio ni degradados** (decidido el 17 de octubre): son la marca más reconocible de un diseño hecho en
  automático, el desenfoque gasta la batería de un teléfono barato y baja la lectura del texto. El carácter viene de
  lo que la app es: el papel, la tinta, la letra de la Escritura, el puente. Un solo campo de musgo en Inicio,
  «Siga donde quedó», que es lo primero que se toca.
- **Las letras de translationCore 4** (17 de octubre; guardadas dentro de la app, con todos sus alfabetos, para que
  estén también sin internet): la interfaz en Mulish, la que tC4 usa en lugar de Avenir, la de unfoldingWord, gruesa
  en lo que nombra y en lo que actúa (títulos 850–900, botones, pestañas y nombres 800); la Escritura en Charis SIL,
  con los números de versículo en tinta, como en una Biblia impresa. Charis es también la letra por defecto de lo que
  escribe el equipo. Se probaron antes Atkinson Hyperlegible (su cero con raya hacía leer «Jonás 1:1Ø»), Figtree y
  Literata. Los títulos se distinguen por tamaño y peso, no por gris, y ninguno deja una palabra sola en un renglón.
- **La marca es el libro que habla** (la idea, del 17 de octubre; el dibujo, rehecho el 18): un libro abierto, la
  página izquierda escrita y la derecha dicha en voz alta. Dice traducir, por escrito y de viva voz, y no solo leer
  (el libro abierto solo, el de antes, decía «leer»). El primer dibujo se veía de aficionado: muchas piezas sueltas,
  renglones grises, barras finas en ocre, todo metido en un cuadrado. Ahora es **una sola forma rellena, de un
  color**, con dos renglones recortados de una página y tres barras de voz recortadas de la otra, todos del mismo
  ancho y con puntas planas, como las de Mulish; se dibujó en negro sobre una retícula de 48 y se eligió mirándolo a
  16 px. En la pantalla va solo, en el musgo, junto a «Servos» (`BrandMark`); el ícono del teléfono no es la marca en
  un cuadrado sino el libro blanco sobre un campo de musgo (`public/`, de `design/logo/render-icons.js`). Se probaron
  un puente (parecía el ícono de wifi, luego una mesa), dos voces (una app de mensajes), la alineación (se leía «XI»),
  una S de dos mitades y ondas en lugar de barras (parecían gusanos). Se evita lo que ya es de otros: la cola de globo
  de diálogo (BibleProject) y los arcos (wifi).
- **Lo que se toca responde**: un botón o una tarjeta cede un poco bajo el dedo, una fila se tiñe, y con ratón se marca
  lo que está debajo. El movimiento es corto (una hoja sube deslizándose) y no hay ninguno si la persona pidió menos
  movimiento.
- **El editor con el teclado abierto se queda como está**: se ve una sola cosa, la caja o la fuente, y el dedo se
  desliza de una a otra (o se toca la pestaña) sin quitarle el foco a la caja, así el teclado no se cierra. Es lo que
  hace posible traducir cómodo en un teléfono; ningún cambio de diseño lo toca (`Panes.tsx`).

## Cómo comprobarlo

Antes de dar por hecha una pantalla, se recorre a 375 px como lo haría alguien poco hábil con la tecnología, y se anotan los números:

- [ ] ¿Qué es lo principal, y se ve sin bajar?
- [ ] ¿Cuántos controles hay a la vista sin tocar nada? (12 o menos)
- [ ] ¿Cuántos miden menos de 44 px?
- [ ] ¿Hay un solo botón lleno?
- [ ] ¿Cuántas alturas de pantalla mide? (dos o menos)
- [ ] ¿Algo queda fijo sin necesidad, o tapa la caja con el teclado abierto?
- [ ] Con el teclado abierto, ¿se desliza entre la caja y la fuente sin que la caja pierda el foco?
- [ ] ¿Hay algún icono sin palabra?
- [ ] ¿Hay alguna acción que sea solo texto de enlace suelto en una línea? (ninguna)
- [ ] ¿Las ayudas que se ven son las del versículo en que se trabaja?
- [ ] ¿Se ve quién está trabajando, y si lo hecho está solo en el aparato o también en Door43?
- [ ] ¿Funciona igual con el modo avión puesto?
- [ ] Al terminar, ¿a dónde lleva la app?
- [ ] ¿Se ve bien en los tres idiomas y en una computadora?

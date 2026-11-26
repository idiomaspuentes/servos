# Un recorrido en el mapa grande

Fecha: 26 de noviembre de 2026. Estado: diseño por aprobar. Sigue a «El mapa de un lugar»
(`2026-11-26-mapa-de-un-lugar-design.md`, idiomaspuentes/servos#54).

## Para qué

Abel (26 de noviembre): en el mapa grande, tocar un lugar y otro para ver el camino entre ellos y cuánto se tarda
caminando, también con paradas en medio.

Ayuda a traducir bien versículos como «se levantó y fue a…» o «al tercer día llegaron». Ayuda también a no escribir
«llegó enseguida» donde el viaje era de semanas.

## Qué se puede hoy y qué no

- **Hoy (bt-synergy `3cb4fc75`):**
  - la distancia en línea recta entre dos lugares (`trip`, `distance`);
  - los días, como un rango: `travelDays` suma a la línea recta entre 15 y 40 % por las vueltas del camino, y divide
    por 30 km al día a pie o 56 a caballo;
  - en barco, solo entre dos puertos del Mediterráneo;
  - `trip` no da días si uno de los lugares es dudoso (`sure` 1), es una región o es agua;
  - `drawMap` dibuja un recorrido como línea punteada recta entre los puntos (`route`).
- **No hay caminos.** Los caminos antiguos (Itiner-e) y la búsqueda del camino más corto se le pidieron al encargado
  del formato 3 el 26 de noviembre. Este diseño funciona con línea recta y queda listo para pasar a los caminos sin
  cambiar cómo se usa.

## Cómo se usa

En la hoja «Mapa: Jope», debajo del mapa, la lista de lugares pasa a ser **la forma de armar el recorrido**:

```
  [ mapa ]

  Recorrido                                   ← título de la sección
  Toque los lugares en el orden del viaje.     ← solo mientras no hay ninguno elegido

  ① Jope · 1:3                    Quitar      ← cada lugar elegido, con su número
  ② Nínive · 1:2                  Quitar

  Jope → Nínive: unos 880 km.
  A pie, de 33 a 42 días. A caballo, de 18 a 22.
  Medido en línea recta, con un margen por las vueltas del camino.

  Borrar el recorrido

  Otros lugares del capítulo
  Tarsis · 1:3 · fuera de este mapa            ← los que no están en el recorrido, para agregarlos
  + Lugares de todo el libro                   ← fila que despliega los demás lugares del libro
```

- **Elegir:**
  - Tocar un lugar de la lista, o su punto en el mapa, lo agrega **al final** del recorrido.
  - El primero es el origen; cada uno que sigue es una parada, y el último es el destino.
  - El lugar tocado en la tarjeta (Jope) **no** empieza elegido: el recorrido arranca vacío y la persona decide.
- **Quitar:** cada lugar elegido tiene «Quitar», y «Borrar el recorrido» vacía todo.
  - No hay arrastrar para reordenar: se quita y se vuelve a tocar.
  - Un mismo lugar puede repetirse (ir y volver), pero no dos veces seguidas.
- **El mapa:**
  - dibuja el recorrido como línea punteada, con el número de cada parada en su punto (`badge` de `MapPoint`);
  - el encuadre pasa a ser el del recorrido y sus lugares, con las mismas esquinas mínimas de 150 km;
  - un lugar del recorrido que queda fuera del mapa base no se dibuja, pero sí cuenta en la lista y en el cálculo.
- **Tocar en el mapa:** se busca el punto más cercano a menos de 22 px del toque (`project` con el `Frame` del
  dibujo), porque los puntos que dibuja `drawMap` miden pocos píxeles. La lista sigue siendo la forma principal y
  accesible.

## El cálculo

- **Por tramo** (`trip(a, b)`):
  - los km, redondeados a 10 si pasan de 100 y a 1 si no (`unos 880 km`, `unos 45 km`);
  - los días a pie y a caballo;
  - en barco, cuando `trip` lo da, se agrega «en barco, de 6 a 9 días».
- **Con dos o más tramos**, primero cada tramo («Jope → Tarsis: …») y después el total: la suma de los km, y la suma
  de los días bajos y la de los altos.
- **Un tramo sin días** (un lugar dudoso, una región o agua):
  - dice los km si los hay, y «No se puede calcular el tiempo: no se sabe con certeza dónde quedaba Tarsis»;
  - si es una región o agua, dice «… porque Galilea es una región» o «… es agua»;
  - el total entonces no da días: «Total: unos 1.200 km; el tiempo falta en un tramo».
- **Menos de un día:** «menos de un día». **Muy cerca** (`near`, menos de 3 km): «Están casi en el mismo lugar».
- **La aclaración se dice siempre, en letra tenue y una sola vez:** «Medido en línea recta, con un margen por las
  vueltas del camino» (principio 8).
  - Cuando lleguen los caminos, los tramos que siguen un camino dirán «Por los caminos de la época romana».
  - Los tramos que no lo siguen seguirán con la aclaración de la línea recta.
- **El barco** se ofrece solo entre puertos. No se pregunta por qué medio viajar: se muestran los que haya, a pie
  primero.

## Los lugares que se pueden elegir

- **Los del capítulo**, como hoy.
- **«+ Lugares de todo el libro»** despliega los demás lugares del libro (`passagePlaces` del primer al último
  versículo del libro), en orden de aparición, con su cita.
- **Un lugar sin punto** (`sure` 0) aparece en la lista, en gris, con «sin punto en el mapa», y no se puede elegir.

## Se recuerda

El recorrido vive mientras la hoja está abierta. Al cerrarla se pierde: no es trabajo del traductor, es una consulta.
Guardarlo, o compartirlo con el equipo, queda para después si hace falta.

## Cómo se ve

- **Todo dentro de la misma hoja**, sin pantalla nueva: el mapa arriba y el recorrido debajo.
- **Filas de 44 px.** «Quitar» es un botón de texto, no una cruz sola (principio 12).
- **Números de parada:** ①②③ en la lista y el mismo número en el punto del mapa. Los colores del recorrido salen
  de `--map-route`.
- **Textos nuevos** en es, pt y en. «Toque los lugares…» tiene su forma `.computadora`: «Haga clic en los
  lugares…».
- **Los números:** «880 km» y «33 a 42 días», con el separador de miles de cada idioma (`Intl.NumberFormat`).
- **Lectores de pantalla:** el `summary` del mapa nombra el recorrido («Recorrido: Jope, Nínive»).

## Fuera de esta etapa

- Seguir los caminos reales: espera al formato 3.
- Elegir lugares de otros libros o buscarlos por nombre.
- Arrastrar el mapa, el zoom, y reordenar paradas arrastrando.
- Guardar o compartir un recorrido.

## Hecho cuando

- **Jonás 1:** tocar Jope y Nínive en la hoja dibuja el recorrido y dice «unos 880 km; a pie, de 33 a 42 días; a
  caballo, de 18 a 22», con la aclaración de la línea recta.
- **Una parada más:** agregar otro lugar del libro muestra cada tramo y el total.
- **Quitar y borrar** funcionan. Tocar un punto en el mapa lo agrega.
- **Un tramo con un lugar dudoso** dice por qué no hay tiempo.
- **Lista de comprobación:** pasa la de `FILOSOFIA_DE_DISENO.md` a 375 px, en es, pt y en, y en los tres temas.
- **Pruebas de:**
  - la suma de tramos;
  - los redondeos;
  - los tramos sin días;
  - el punto más cercano a un toque;
  - el encuadre del recorrido.

## Decisiones de la revisión (26 nov)

Valen sobre lo de arriba.

- **Qué se dibuja:**
  - los lugares del recorrido se dibujan como puntos normales, nunca como `ref`, aunque sean del capítulo;
  - un lugar del recorrido que es región se dibuja con `form: 1`, como el lugar de la tarjeta;
  - si un lugar queda fuera del mapa base, se pierde su punto, pero la línea del recorrido llega hasta el borde y se
    corta ahí.
- **Los números de parada:**
  - en la lista, cada lugar elegido dice «Parada 1», «Parada 2»…, en texto, no con símbolos ①②, para que lo lean bien
    la letra y los lectores de pantalla;
  - en el mapa, el número va en el `badge` del punto; un lugar visitado dos veces lleva «1, 3»;
  - `drawMap` puede dejar sin número un punto cuyo número choca con otro, o que queda dentro de un grupo. La lista
    siempre los tiene, así que se acepta así;
  - quitar una parada del medio renumera las que siguen.
- **Elegir otra vez:**
  - un lugar ya elegido sigue en la lista de lugares, para poder volver a él (ir y volver);
  - tocar el mismo lugar que la última parada no lo agrega, y una línea tenue dice «Ya es la última parada».
- **Con una sola parada** la indicación cambia a «Toque otro lugar para ver el camino» (su forma `.computadora`:
  «Haga clic en otro lugar…»).
- **La lista:**
  - muestra **todos** los lugares del capítulo, también los de más de 1.000 km y los que quedan fuera del mapa base,
    y debajo el pliegue «+ Lugares de todo el libro»;
  - cada fila es un botón de 44 px, salvo los lugares sin punto (`sure` 0), que no se pueden elegir;
  - los vecinos grises del mapa siguen el límite de 1.000 km del diseño anterior.
- **El mapa se queda a la vista:**
  - en la hoja, el mapa queda fijo arriba (`position: sticky`) con 280 px de alto en el teléfono, y la lista corre
    debajo, para ver crecer la línea al tocar;
  - en la computadora, el mapa va al lado de la lista si cabe.
- **El encuadre no salta:**
  - al abrir la hoja, el encuadre es el de los lugares del capítulo que están en el mapa;
  - solo se agranda cuando una parada nueva cae fuera de él; nunca se achica mientras la hoja está abierta.
- **Tocar en el mapa:** el radio de 22 px alrededor del toque da un blanco de 44 px de ancho (principio 11). Un toque
  sobre un grupo o lejos de todo punto no hace nada: la lista es la forma segura.
- **Por qué no hay tiempo** (`trip` no lo dice; Servos lo deduce):
  - `sure` 1: «no se sabe con certeza dónde quedaba X»;
  - `form` 2: «X es una región»;
  - `form` 3: «X es agua»;
  - `near`: «Están casi en el mismo lugar»;
  - `form` 4 (montes) sí se mide.
- **Las cifras de días:**
  - si `low` es 60 o más: «más de dos meses»;
  - si los dos extremos son iguales: «unos 5 días»;
  - `{ low: 0, high: 1 }`: «menos de un día».
- **El barco** se dice solo en su tramo; el total da solo a pie y a caballo.
- **Las pruebas** usan las coordenadas reales del paquete de staging: las cifras de este diseño (880 km, 33 a 42 días)
  son de ejemplo y se comprueban contra el paquete, no contra la memoria.
- **«Borrar el recorrido»** no pide confirmación: rehacerlo cuesta pocos toques y no es trabajo del traductor.

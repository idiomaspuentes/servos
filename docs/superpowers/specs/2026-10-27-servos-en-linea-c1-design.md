# Servos en línea, núcleo (plan 3, parte C1)

Fecha: 27 de octubre de 2026. Estado: diseño aprobado por secciones; especificación por revisar.

## Para qué

Servos baja de internet los textos y las ayudas que un proyecto necesita, por partes, del Worker de translation-helps
(formato 2.0), y los mantiene al día, sin dejar de funcionar sin internet ni interrumpir a quien traduce. Es la parte
C1 del plan 3:

- A (hecha, idiomaspuentes/servos#9): Servos al día con bt-synergy.
- B (unfoldingWord/tc-study#51): el importador de partes en bt-synergy — `planParts`, la zona de espera y
  `applyParts`, una unidad (un libro o lo compartido) por transacción, con su registro de huecos, el catálogo, los
  recibos y la reparación al arrancar.
- **C1 (esta especificación):** el libro del proyecto al elegirlo, las actualizaciones ofrecidas con su tamaño, el
  cliente del Worker, la cola de bajada y el servidor configurable.
- C2 (después): «Bajar todo el idioma», bajadas solas por wifi rápido y detección de la conexión.

Decisiones de Abel: el alcance es todo §5 de la especificación de partes, partido en C1 y C2; el servidor por defecto
es producción, con un ajuste para staging; una actualización bajada se aplica sola en cuanto la persona no está
escribiendo.

## Lo que hay hoy

- Un proyecto guarda su idioma de ayudas (`helpsLanguage`) y sus libros; el libro se elige justo después de crear el
  proyecto (`AddBook`), y si no está en el teléfono la app dice que podrá recibir su paquete al abrirlo.
- Un libro sin recursos muestra un aviso y el botón «Recibir un paquete» (`BookScreen`).
- Los recursos llegan solo por paquetes de archivo: los que trae la app, «Recibir un paquete» y SD/USB. Al reemplazar
  ayudas, `watchHelps` → `openPack` → `refreshLibrary` → `keepHelpsChanges` guardan «qué cambió».
- Internet: `navigator.onLine`, el evento `online`, `whenNotTyping` y la hoja «Ya hay internet» (solo para Door43).
- La CSP de la app de escritorio no deja hablar con el Worker. El Worker de producción todavía no sirve partes
  (responde `parts-off` hasta la tarea 14 de la entrega 3); el de preview de staging sí.

## Diseño

### 1. Piezas

En `src/resources/online/`:

- **`packsClient.ts`**: el cliente del Worker. Pide la lista del idioma con su ETag (`If-None-Match`, 304), la lista de
  originales que nombra y las partes, y comprueba el sha256 de cada parte. Cada respuesta se traduce a un resultado:
  `listo`, `preparando` (202), `actualizarApp` (404 `old-compat`), `noDisponible` (503, y 404 `parts-off`),
  `sinIdioma` (404 sin paquetes), `parteNoEstá` (404 de una parte: se pide la lista otra vez y no se reintenta esa
  parte), `espera` (429, con su `Retry-After`).
- **`downloads.ts`**: la cola. Baja las partes de un plan a la zona de espera de B, 4 a la vez, las de originales
  primero, con la cuenta de bytes. Lo que ya está en la zona de espera no se vuelve a bajar, así que una bajada cortada
  sigue desde ahí. Sin `Range`: una parte pesa unos 250 KB y se repite entera.
- **`onlineResources.ts`**: el flujo y su estado (almacén de módulo con un hook, como `packsInside` y `appUpdate`):
  reparar al arrancar, buscar, bajar cuando la persona lo pide, aplicar.
- **El servidor**: por defecto `https://tc-helps.mcp.servant.bible/v2/packs/`. `?packs=staging` en la dirección lo
  cambia al Worker de preview y lo guarda en `servos.enLinea.servidor`; el ajuste aparece en «Acerca de» del menú de
  la persona solo después de usar `?packs=`, como el servidor de Door43.

### 2. Lo que ve la persona

- **Al elegir el libro** (`AddBook`), con internet y el libro fuera del teléfono: «Al crearlo se bajarán sus textos y
  ayudas (3,4 MB)»; crear el libro empieza la bajada. Sin internet, como hoy.
- **En un libro que falta** (`BookScreen`), con internet: botón lleno «Bajar sus textos y ayudas · 3,4 MB», «Recibir un
  paquete» como segundo botón. Mientras baja, una barra con el porcentaje y «Puede seguir usando la app»; al terminar se
  aplica y el libro se abre. Si no se puede, el aviso lo dice sin botón de reintentar:
  - `preparando`: «Se están preparando los textos de este idioma; se intentará otra vez más tarde»;
  - `actualizarApp`: «Esta versión de Servos ya no puede bajar textos nuevos: actualice la app»;
  - `sinIdioma`: «Este idioma todavía no tiene textos para bajar»;
  - `noDisponible`: «No se pueden bajar ahora; se intentará más tarde»;
  - sin espacio: «No hay espacio en el teléfono para bajarlos».
- **Actualizaciones** (Inicio, el lugar único de sugerencias): «Hay textos y ayudas nuevos para Español (340 KB)», con
  «Bajar» y «Ahora no». «Ahora no» la quita hasta otra versión (se recuerda el `code` de la lista). Mientras baja y se
  aplica, una línea de estado en Inicio: «Bajando textos y ayudas · 45 %».
- **Después de aplicar**: el «qué cambió» de siempre en el editor, y en Inicio una línea que se va sola: «Textos y
  ayudas al día · cambiaron 3 versículos traducidos». Si nada traducido cambió, no hay aviso.
- Los textos van en el grupo `enLinea.*` en es, pt y en; los que dicen «teléfono» tienen su `.computadora`. Cada
  pantalla tocada pasa la lista de comprobación a 375 px.

### 3. Aplicar, y los paquetes de archivo

- Se aplica cuando todas las partes del plan están en la zona de espera y la persona no está escribiendo
  (`whenNotTyping`), con la pantalla encendida en el teléfono (wake lock). Orden: `watchHelps` del idioma para los
  libros que se aplican → `applyParts` → `refreshLibrary` → `keepHelpsChanges` → se recarga el libro abierto. Si la app
  se cierra a medias, el registro de B sabe qué unidades entraron; la reparación al arrancar y la siguiente búsqueda
  terminan el resto.
- Unidades que se planean para un idioma: `shared` y `book <b>` por cada libro de los proyectos que usan ese idioma.
- Originales: compartidos por todos los idiomas; se planean desde la lista de originales más reciente que Servos haya
  traído de cualquiera de sus idiomas, para no ir y venir entre versiones.
- Paquetes de archivo y partes juntos: al abrir un paquete (los de la app, «Recibir un paquete», SD/USB), Servos borra
  del registro los huecos de los recursos y libros que ese paquete trae; la siguiente búsqueda los ve como faltantes y,
  con internet y algo distinto, los vuelve a bajar. Cuesta bytes, pero el dispositivo nunca cree tener lo que ya no
  tiene. La regla «un recurso es de un solo release» (`packAgainstDevice`) sigue para los paquetes de archivo; con
  partes, cada libro va por su lado y lo coordina el registro.
- Espacio: antes de bajar, `navigator.storage.estimate()`; si lo libre no alcanza para el doble de lo que se baja, se
  avisa y no se empieza. Un `quota` de `applyParts` da el mismo aviso.
- El trabajo del equipo nunca se toca.

### 4. Cuándo busca, y las plataformas

- Busca (siempre con `whenNotTyping`, nunca mientras aplica): al arrancar, después de `openLibrary` y de la
  reparación de B; al volver a la app (`visibilitychange`) y al volver la conexión (`online`), si pasaron 3 horas desde
  la última búsqueda (`servos.enLinea.buscado`). Solo pide las listas, con `If-None-Match`. Las respuestas 202, 429 y
  503 dejan la hora de reintento de su `Retry-After`; antes no se vuelve a preguntar.
- Web (PWA): el Worker acepta cualquier origen; el service worker no guarda respuestas de otro origen, y lo bajado vive
  en IndexedDB.
- Escritorio (Tauri): `connect-src` de `src-tauri/tauri.conf.json` añade los orígenes del Worker de producción y de
  preview.
- Teléfono (Capacitor): solo HTTPS. Sin servicio en segundo plano: si la persona sale, Android puede congelar la
  bajada; al volver sigue desde la zona de espera.
- Página única: igual que la web.
- Hasta la tarea 14, producción responde `parts-off` y Servos dice «No se pueden bajar ahora», sin insistir.

### 5. Pruebas y cuándo está hecho

- Depende de B fusionado: la primera tarea sube `bt-synergy.ref` al commit de esa fusión y mueve la carpeta compartida
  `../bt-synergy` (como en A). Hasta la fusión se trabaja contra un worktree de bt-synergy con la rama de tc-study#51.
- Sin red (Vitest, IndexedDB falso): un Worker falso, como `fakeDoor43`, con listas y partes hechas con `writePart`, que
  responde 304, 202, 404 (`old-compat`, sin idioma, una parte), 429, 503 y `parts-off`, o corta la red. Pruebas del
  cliente (cada respuesta, ETag/304, sha256 equivocado), de la cola (4 a la vez, originales primero, un corte sigue
  desde la zona de espera, 404 de una parte → lista otra vez, 429 → espera) y del flujo (libro nuevo → bajada →
  aplicado y `bookIsHere`; actualización ofrecida → aplicada al dejar de escribir con su «qué cambió»; «Ahora no»
  recordado por el `code`; reparación al arrancar; abrir un paquete borra sus huecos del registro; sin espacio → aviso
  sin empezar); el servidor (`?packs=staging` guardado) y la CSP con los dos orígenes.
- Con el Worker real de preview, solo con una variable: un proyecto de es-419 con Tito en almacenes vacíos baja y
  aplica, y las notas de Tito 1 tienen sus citas alineadas.
- En la app: servidor de desarrollo con `?packs=staging` a 375 px — un proyecto nuevo con un libro que no está se baja
  con su tamaño y se abre con notas y citas; después la misma bajada en la app de escritorio (Tauri), para la CSP.
- Hecho cuando todo eso pasa, `DISENO.md` §7 (que hablaba de Door43 `tc-ready`) cuenta cómo bajan los recursos ahora,
  y los textos nuevos están en es, pt y en.

## Fuera de C1

- C2: «Bajar todo el idioma», bajadas solas por wifi rápido, detección de la conexión y velocidad medida.
- La tarea 14 de la entrega 3 (producción sirviendo partes), con el sí de Abel.
- Pasar partes de un dispositivo a otro sin internet.

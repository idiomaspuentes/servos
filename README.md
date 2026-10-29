# Servos

App para que los traductores de Otras Lenguas traduzcan un libro de la Biblia con los recursos que produce el
equipo de Idiomas Puentes en [Taller](https://github.com/idiomaspuentes/taller): textos puente, notas, preguntas,
palabras clave y academia.

Pensada para zonas sin internet:

- **Funciona sin conexión**, en teléfonos y computadoras.
- **Los paquetes viajan en la mano**: tarjeta SD, USB, Bluetooth o compartir cercano.
- **Varias personas en un mismo aparato**, cada una con su nombre, sin contraseña ni internet.
- **Une el trabajo de proyectos que empezaron por separado**, versículo por versículo, y recuerda lo que ya se
  decidió para no volver a preguntarlo.
- **Un catálogo de mini apps** para cada libro: estudio, editor, revisor de desafíos, revisor de palabras clave,
  alineador y publicación.
- **La interfaz se traduce dentro de la app** a cualquier idioma, empezando por español, portugués e inglés.

Estado: en diseño. Ver [`docs/DISENO.md`](docs/DISENO.md).

## Programar

`../bt-synergy` y `../usfm-ast` tienen que estar al lado de este repositorio (ver `vite.config.ts`).

- `npm run dev`: la app web en `http://localhost:5190`.
- `npm test` y `npm run typecheck`.
- `npm run build`: el sitio entero en `dist/`, como se pone en línea: la página que presenta Servos en `/`, la guía
  en `/docs/` (los dos escritos en [`sitio/`](sitio/README.md)) y la app web, con su *service worker*, en `/app/`.
  `npx vite preview` sirve solo la app, en `http://localhost:4173/app/`; `npx wrangler pages dev dist`, todo.

### El sitio en línea

Se publica en Cloudflare Pages, proyecto `servos` (hoy en `servos-9gn.pages.dev`; el dominio será
`servos.idiomaspuentes.org`), solo con el visto bueno de Abel: `npm run build`, luego
`npx wrangler pages deploy dist --project-name servos`. Hasta octubre de 2026 la app estaba en la raíz; quien la
instaló allí no pierde nada al pasar a `/app/` (lo que escribió está en el almacenamiento del sitio, que es el mismo),
y el *service worker* nuevo de la raíz reemplaza al viejo (ver `sitio/sw.template.js`).

### Los paquetes dentro de las apps

Las apps para Windows y para Android llevan dentro los paquetes de textos y ayudas que haya en `paquetes-dentro/`
(o en la carpeta que diga `SERVOS_PAQUETES_DENTRO`), y los abren solas la primera vez que se usan: la persona elige
su idioma, escribe su nombre y empieza un libro sin pasar ningún archivo. Esa carpeta no está en el repositorio; los
paquetes se hacen con `bun scripts/paquetes-dentro.ts --taller <Taller>/public`, que usa el mismo pipeline de
bt-synergy y sella MACULA con su commit, como producción. Con `prepare-language` a secas, MACULA queda sellado con la
fecha del build, y las apps ofrecen bajarlo otra vez apenas hay internet. Sin paquetes, las apps se compilan igual y lo
avisan. Un paquete se abre
una sola vez (se reconoce por lo que contiene); el que trae una versión nueva de la app se abre si es más nuevo.

### La app para Windows (Tauri)

Hace falta [Rust](https://rustup.rs) y, en Windows, las herramientas de compilación de C++ de Visual Studio.

- `npm run escritorio`: la app en su ventana, sobre `npm run dev`.
- `npm run escritorio:compilar`: el instalador, en `src-tauri/target/release/bundle/nsis/`. La app web va dentro del
  programa (`vite build --mode escritorio`, en `dist-escritorio/`, sin *service worker*); el instalador lleva
  WebView2 para instalarse sin internet. No está firmado: Windows avisa «Windows protegió su PC», y se instala con
  «Más información › Ejecutar de todas formas».

### La app para Android (Capacitor)

Hace falta Android Studio (su Java 21 y el SDK de Android 36); `JAVA_HOME` y `ANDROID_HOME` se toman de ahí si no
están puestos.

- `npm run telefono:compilar`: el APK, en `dist-android/Servos-<versión>.apk`, para instalar por cable
  (`adb install -r`) o pasándolo como archivo, sin tienda. La app web va dentro (`vite build --mode telefono`, en
  `dist-telefono/`, sin *service worker*).
- `npm run telefono:abrir`: el proyecto `android/` en Android Studio, para probar en el emulador o en un teléfono.
- **La firma:** el APK se firma con la llave propia de Servos, que no está en el repositorio: la busca en
  `~/.servos/android-firma.properties` (o donde diga `SERVOS_FIRMA`). Android instala una versión nueva encima, sin
  perder el trabajo del teléfono, solo si la firma es la misma: hay que guardar copia de esa carpeta. Sin llave, la
  compilación se detiene antes de dar un APK sin firmar.

Dominio: `servos.idiomaspuentes.org` (decidido el 18 de octubre).

## Créditos

Servos es de Idiomas Puentes, con licencia MIT. Su forma de revisar con notas y palabras, y de alinear, viene de
[translationCore](https://github.com/unfoldingWord/translationCore4), de unfoldingWord (GPL), y lee los recursos con
los paquetes de [tc-study](https://github.com/unfoldingWord/tc-study) (bt-synergy). No lleva código de translationCore.
Los textos y las ayudas no van en este repositorio: llegan en paquetes, cada uno con su autor y su licencia (la mayoría
CC BY-SA 4.0), y la app los nombra en «Acerca de Servos», en el menú de la persona. Las letras son Charis SIL, de SIL
International, y Onest, las dos con licencia OFL.

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
- `npm run build`: la app web, con su *service worker*, en `dist/`.

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

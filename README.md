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

Dominio: `servos.idiomaspuentes.org` (decidido el 18 de octubre).

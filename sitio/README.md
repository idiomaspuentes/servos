# El sitio de Servos

Lo que se ve en `servos.idiomaspuentes.org` alrededor de la app: la página que presenta Servos (`/`) y la guía
(`/docs/`). La app está en `/app/`. `npm run build` arma todo en `dist/` (`scripts/sitio.mjs`), sin bibliotecas.

- `descargas.json`: la versión y dónde están los archivos para bajar (el APK, el instalador de Windows y los
  paquetes). Se cambia en cada versión nueva.
- `<idioma>/sitio.json`: los textos de la página de inicio, de la barra y del pie.
- `<idioma>/docs/N-nombre.md`: un capítulo de la guía por archivo, en orden por su número; `nombre` es su dirección
  (`/docs/nombre/`). Arriba, entre `---`, su `titulo` y su `resumen`. Se escribe en una parte pequeña de Markdown:
  `##` y `###`, párrafos, listas con `-` o `1.`, `**negrita**`, `*cursiva*`, `[enlaces](/docs/otro/)`, avisos con
  `>`, y capturas solas en su párrafo: `![lo que muestra](nombre.webp "el pie")`, una al lado de la otra si son
  varias seguidas. Una captura que empieza con `computadora-` se muestra ancha.
- `<idioma>/capturas/`: las capturas de la app, tomadas con `scripts/capturas-guia.mjs` (dice cómo correrlo).
- `estilo.css`: el papel, la tinta y el musgo de la app (`src/app/styles.css`), con sus letras.
- `sw.template.js`: el *service worker* de la raíz, que guarda el sitio para leerlo sin internet.

## Otro idioma

El español está en la raíz; otro idioma va en `/<idioma>/` en cuanto existe su carpeta (hoy `en/` y `pt/`) con su
`sitio.json` y sus capítulos con los mismos nombres de archivo, y el pie ofrece cambiar de idioma. Para agregar uno:

1. Copiar `es/sitio.json` a `<idioma>/sitio.json` y traducir sus valores, sin cambiar las claves ni lo que va entre
   llaves (`{version}`). Además de las del español lleva `tambienEnSuIdioma` («This page is also in English»: se
   ofrece en las páginas en español a quien tiene el navegador en ese idioma) y `guia.capturasDeOtroIdioma` (dice,
   encima de las capturas, que todavía muestran la app en español).
2. Traducir cada capítulo de `es/docs/` con el mismo nombre de archivo, que es su dirección. Los enlaces se dejan como
   en español (`/docs/juntar/`): llevan al capítulo del mismo idioma. Los nombres de los botones van como los dice la
   app en ese idioma (`src/app/i18n/<idioma>.json`).
3. Las capturas: mientras ese idioma no tiene `capturas/`, se muestran las del español, y cada capítulo lo dice.
   Tomarlas en cada idioma se deja para cuando la app cambie menos (decidido con Abel el 28 de octubre de 2026):
   `node scripts/capturas-guia.mjs pt`, después de poner en `SAYS` las palabras de la app en ese idioma que el
   recorrido busca. Una captura que ese idioma ya tiene se usa; la que falta sigue viniendo del español.

## Al escribir

- Se habla de «usted», en frases cortas, con los nombres de los botones tal como están en la app, en negrita.
- Los títulos de las páginas (la pestaña y el historial) no dicen «Biblia»: ver `docs/PROPUESTA_NO_EXPONER.md`.

# Servos (repositorio `servos`)

App offline-first de Idiomas Puentes para que los traductores de Otras Lenguas traduzcan un libro de la Biblia con
los recursos producidos en Taller (`../gateway-tasks`, GitHub `idiomaspuentes/taller`). Teléfonos y computadoras,
sin internet; los paquetes se pasan por SD, USB o Bluetooth. Estado: diseño. Lee [`docs/DISENO.md`](docs/DISENO.md)
antes de proponer o construir nada.

## Convenciones

- Interfaz y documentación del producto en español; comentarios y commits en inglés, con título corto y un cuerpo
  que explique el porqué.
- La interfaz se traduce desde la app (es, pt, en desde el inicio): ningún texto de interfaz suelto en un
  componente.
- Móvil primero; una sola cosa obvia por pantalla. Cada pantalla y cada mini app siguen
  [`docs/FILOSOFIA_DE_DISENO.md`](docs/FILOSOFIA_DE_DISENO.md): el texto en el centro, lo demás en capas, un mismo
  marco para todas las mini apps, y su lista de comprobación a 375 px antes de darla por hecha.
- Los choques de texto se resuelven versículo por versículo con el sistema propio de Servos (diseño, sección 6),
  basado en la mezcla de Taller (`src/domain/usfmVerseMerge.ts`, `usfmTrunkPatch.ts`). No se usan los sistemas de
  choques de `usfm-ast`.

## Límites

- Nada se publica sin confirmar: ni GitHub, ni Door43, ni tiendas de apps.
- Producción de Door43 no se toca para pruebas.
- Sin secretos en el repositorio.

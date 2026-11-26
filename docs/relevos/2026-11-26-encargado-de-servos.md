# Relevo: el encargado de Servos (26 nov 2026)

Este archivo deja todo lo que una sesión nueva necesita para ser **la encargada de Servos**. Reemplaza a la sesión
`local_6d53d87b-a4d5-4ba8-8323-c7c686a25917`, que coordinó Servos y el formato 3 desde octubre y que se va a archivar.
Lo que solo quedó en sus conversaciones, y en las de las sesiones que abrió, está escrito aquí o en un issue.

## Qué es el encargado

- Es la única sesión que toca el repositorio `idiomaspuentes/servos`. Planea, escribe el código, lo prueba, lo revisa y
  lleva los issues y los PRs. Servos es de Idiomas Puentes, así que Claude lo hace todo, sin Cursor.
- Cuando un trabajo de Servos necesita un cambio en otro proyecto, no lo hace: se lo pide al encargado de ese proyecto
  (tabla de abajo) con un mensaje que diga qué necesita, por qué y para cuándo. Espera su respuesta y luego sube
  `bt-synergy.ref` u otra referencia del lado de Servos.
- Para piezas de su propio trabajo usa subagentes. Abre otras sesiones solo con el OK de Abel, y como mucho tres
  trabajando a la vez.
- Al cerrar una etapa o hacia los 300 mensajes, escribe su propio relevo en `docs/relevos/` y avisa a Abel que se
  puede archivar. Ninguna sesión sigue viva días enteros.

### Los demás encargados

| Proyecto | Encargado hoy | Dónde está su relevo |
|---|---|---|
| Servos (`idiomaspuentes/servos`) | la sesión que lea este archivo | este archivo |
| BT Servant y Mini, formato 3 de los paquetes, tc-study (bt-synergy), translation-helps-mcp, sitio tc-language-packs | el coordinador de Mini (el 24 nov, `coord-mini-24nov`) | `bt-servant-workspace/handoff/relevo-coordinador-2026-11-23.md` y `relevo-coordinador-formato3-2026-11-24.md` |
| Taller, translog, obs-study y otros de Idiomas Puentes | ninguno todavía: Abel lo abre cuando haga falta | |

**Cómo escribirle a otro encargado:** busca su sesión con `list_sessions` (por el título) y mándale el mensaje con
`SendMessage`, usando el id `local_…` de su sesión. Si no la encuentras o no contesta, díselo a Abel. Los relevos de
uW están en `C:/Users/LENOVO/Git/Github/bt-servant-workspace/handoff/`.

Todo lo de uW (bt-synergy, translation-helps-mcp, tc-language-packs) sigue la regla de uW de `~/.claude/CLAUDE.md`,
salvo la excepción del formato 3, donde Claude escribe. Eso lo decide su encargado, no el de Servos.

## Estado del repositorio

- `origin/main` está en `0977c05` (PR #44). Mira siempre `origin/main` después de un `git fetch`: la rama `main` local
  de la carpeta principal está muy atrasada. No hay PRs abiertos.
- Todas las ramas de las sesiones de octubre y noviembre ya están en `origin/main`. Lo comprobó un inventario de git
  el 26 de noviembre. Las únicas dos excepciones entraron con el PR de este relevo (rama `claude/relevo-encargado`):
  - `docs/INVESTIGACION_MAPAS_E_IMAGENES.md`: la investigación de mapas e imágenes, con las decisiones de Abel del 2 de
    noviembre. Antes solo existía en un commit local de otra carpeta.
  - `docs/investigacion/logo-y-paleta/`: las notas de la investigación del logo y la paleta. Son las fuentes de
    `docs/INVESTIGACION_MARCA_Y_PALETA.md`, y antes no tenían commit.
- `bt-synergy.ref` es `50d4eabf`. El formato 3 (C3) solo está activo contra staging, con `VITE_SERVOS_PACKS`. Las
  versiones de prueba están en `servos-pruebas/c3` (ver la memoria `servos-c3-test-builds`).
- `AGENTS.md`, sin commit en la raíz de casi todas las carpetas, es una copia local de `CLAUDE.md` para otros agentes.
  No se sube.
- Las carpetas `.claude/worktrees/*` de las sesiones viejas solo tienen `AGENTS.md` y `.claude/` sin commit, que son
  copias o configuración local. Se pueden borrar al archivar esas sesiones.

## El plan

El diseño está en `docs/DISENO.md` y la filosofía en `docs/FILOSOFIA_DE_DISENO.md`. Lo que falta construir está en
los issues abiertos: del #20 al #42, y los que se abrieron con este relevo. `#42 Decidir lo que el diseño deja abierto`
reúne las preguntas para Abel.

Issues abiertos con este relevo, con lo que solo quedó en las conversaciones:

| Issue | Qué |
|---|---|
| #45 | Saltar los catálogos `zxx-*` en las listas de idiomas |
| #46 | Mostrar los mapas e imágenes de los paquetes |
| #47 | Usar el formato 3 en producción cuando esté publicado |
| #48 | Probar en aparatos reales: elegir entre dos versiones y subir a Door43 |
| #49 | Detalles de interfaz pendientes de octubre |

## Decisiones que solo estaban en conversaciones

- **Mapas e imágenes** (2 nov): se aprobaron las cinco recomendaciones. Las detalla la última sección de
  `INVESTIGACION_MAPAS_E_IMAGENES.md`: el orden, lo que queda fuera, el mapa base propio, 360 px y 600 px, y las clases
  `images` y `basemap` en los paquetes. Los paquetes ya traen los mapas (tc-study #106) y los complementos
  (#107 a #109). Falta que Servos los muestre.
- **Nada de «bridge Bible» en inglés.** Para gente de fuera se dice «Bible» o «Bible for translators», y los paquetes
  se describen sin compararlos con formatos anteriores (memoria `no-bridge-bible-in-english`).
- **Choques de texto:** dos respuestas a una revisión, o dos tomas elegidas por separado, se eligen en la app y nunca
  por la fecha (DISENO §7). Un libro con versiones de Door43 sin juntar no se sube (DISENO §6.11).
- **Textos de la computadora:** con ratón se dice «haga clic» y «esta computadora». Las frases tienen su forma
  `{clave}.computadora`.

## Lo que viene del formato 3 y toca a Servos

- **Los catálogos `zxx-*` no son idiomas.** Toda lista de idiomas armada con los catálogos de formato 3 debe saltarse
  `zxx-*`, porque si no «zxx-obsimg» aparece como idioma. Servos no los filtra hoy (#45).
- **Formato 3 en producción:** cuando el encargado del formato 3 publique los paquetes en producción, Servos deja de
  usar staging para el formato 3 (#47).

## Para empezar

1. Lee `CLAUDE.md`, `docs/DISENO.md` y la lista de issues (`gh issue list --repo idiomaspuentes/servos`).
2. Revisa la memoria del proyecto (`~/.claude/projects/C--Users-LENOVO-Git-Github-servos/memory/MEMORY.md`): ahí
   están las recetas para Windows, Android, el Door43 falso y las versiones de prueba.
3. Pregúntale a Abel qué issue va primero. No empieces ninguno sin su prioridad. No hay nada urgente: el 26 de
   noviembre no quedó ningún trabajo de Servos a medias.

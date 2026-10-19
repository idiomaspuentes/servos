# Quién puede ver el trabajo

*Propuesta, 18 de octubre de 2026. Para conversar con Abel; nada de esto está construido.*

Servos tiene que dejar claro, y dejar elegir, quién puede ver el trabajo de un equipo: quien toma su teléfono o su
computadora, o quien encuentra un archivo que se pasaron.

**Lo decidido por Abel** (18 de octubre), que esta propuesta da por hecho:

- **Es un modo de cada proyecto**, no algo siempre puesto. Lo pregunta la app al crear el proyecto, lo contesta quien
  coordina, y viaja con el proyecto al compartirlo. Al recibir en un proyecto que ya está en el aparato, queda el modo
  más cerrado de los dos.
- **Dos modos.** **«Solo el equipo»**, el elegido de entrada: las copias siempre con contraseña, Compartir cerrado y con
  un nombre que no dice nada, y se ofrecen el bloqueo de la app y un nombre e ícono discretos. **«Cualquiera que tenga
  el archivo»**: como hoy.
- **Subir la protección es un toque; bajarla pide confirmar** y dice qué deja de estar protegido.
- **Las palabras:** la app habla solo de quién puede ver el trabajo («Solo el equipo puede ver…»). Nunca «riesgo»,
  «peligro», ni nada que asuste a los equipos que no viven esa situación, ni dónde está prohibida la Biblia.
- El modo mismo (`Project.privacy`, la pregunta al crear el proyecto, Ajustes, y las copias en la tarjeta que lo siguen)
  se construye en la rama `claude/copia-en-tarjeta`. El principio 9, **«El trabajo no se pierde ni se expone»**, ya
  está aprobado.

Esta propuesta trata lo que falta bajo «Solo el equipo»: **Compartir, el bloqueo de la app, las capturas, el nombre y
el ícono, y las copias que deja la hoja de compartir**, más lo que conviene para todos.

**En pocas palabras:** hoy cualquiera que tome el teléfono desbloqueado abre Servos y lee todo, y cada archivo que se
comparte lleva en el nombre el proyecto, el libro y quién lo mandó («Biblia en kichwa — Tito — Ana — 2026-10-19.servos»)
y, dentro, abierto, el texto, los nombres de todo el equipo y sus voces. **Primer paso recomendado** (sección 5): que
Compartir siga el modo del proyecto (nombre que no dice nada y contraseña con «Solo el equipo»), más tres arreglos
pequeños para todos. Después, el bloqueo, y al final el nombre e ícono discretos.

## 1. Lo que hoy queda a la vista

Revisado en `main` (020b587) y en la rama de Android (`claude/determined-kilby-0f561f`, PR #3).

| # | Qué | Dónde se ve hoy | Quién lo ve |
|---|---|---|---|
| 1 | **Abrir la app** | No hay bloqueo: se abre en Inicio, con la persona elegida y su proyecto («Siga donde quedó») | Cualquiera con el aparato desbloqueado |
| 2 | **El nombre y el ícono** | «Servos» y el libro abierto en el lanzador de Android (`strings.xml`, `mipmap-*`), en el menú Inicio y la barra de tareas de Windows (`tauri.conf.json`), en el ícono de la PWA (`public/`) | Quien mira la pantalla del teléfono |
| 3 | **Los textos del sistema** | «Para traducir la Biblia en su idioma, en equipo…» en el manifiesto de la PWA (al instalarla) y en el instalador de Windows; «Trabajo compartido de Servos» como tipo de archivo; «Idiomas Puentes» como editor en Aplicaciones de Windows | Quien instala, quien revisa las propiedades de un archivo o la lista de programas |
| 4 | **El nombre de los archivos** | Compartir: `{proyecto} — {libro} — {quién} — {fecha}.servos` (`shareFileName`, `src/app/projects/share.ts:421`). USFM: `JON.usfm`. Glosario: `{idioma}_tg.json`. Interfaz: `servos-interfaz-{idioma}.json` | Quien abre Descargas, WhatsApp, la tarjeta SD, la carpeta Bluetooth |
| 5 | **Lo que hay dentro de un `.servos`** | JSON sin cifrar: el USFM, el glosario, el diario con **el nombre de cada persona y el identificador de su aparato**, y las **grabaciones con sus voces** | Cualquiera que abra el archivo con un editor de texto |
| 6 | **La hoja de compartir** | El título de la hoja y la vista previa muestran el nombre del archivo (`FilesPlugin.share`, `EXTRA_TITLE` y `createChooser(send, name)`) | Quien mira por encima del hombro |
| 7 | **Copias que quedan** | Cada archivo compartido queda en `cache/compartir` de la app y nunca se borra; lo recibido queda en Descargas, en la carpeta de WhatsApp o de Bluetooth; WhatsApp lo guarda también en su copia en la nube | Quien revisa el teléfono a fondo; WhatsApp |
| 8 | **Apps recientes** | Android guarda una foto de la última pantalla (el texto traducido) en la vista de apps recientes; Windows, en Alt+Tab y en la barra de tareas | Quien abre la vista de recientes |
| 9 | **Notificaciones** | Ninguna hoy (bien). «Ya hay internet» es una hoja dentro de la app | — |
| 10 | **El teclado** | Gboard o el teclado de Samsung aprenden las palabras que se escriben y luego las sugieren en otras apps («Jesús», nombres bíblicos en la lengua) | Quien escribe en ese teléfono en cualquier app |
| 11 | **Door43** | El repositorio publicado `{idioma}_reg` es **público** (`door43.ts:299`), con el nombre de la organización y de la cuenta de quien sube; el del trabajo del equipo (`{repo}-servos`) es privado. La llave de Door43 se guarda sin cifrar en el almacenamiento de la app | Cualquiera en internet; quien revisa el teléfono a fondo |
| 12 | **La PWA en el navegador** | El nombre del sitio en el historial y en las pestañas (con `servos.idiomaspuentes.org`, decidido, no dice *bible*) | Quien abre el historial; la red |
| 13 | **Lo guardado en el aparato** | localStorage e IndexedDB sin cifrar (en Windows, en `%LOCALAPPDATA%\org.idiomaspuentes.servos`). Android no lo copia a la nube (`allowBackup="false"`, bien) | Herramientas forenses; en Windows, quien abre esa carpeta |
| 14 | **Los instaladores** | `Servos-0.1.0-rc.1.apk` y el instalador de Windows quedan en Descargas después de instalar | Quien abre Descargas |
| 15 | **El permiso de micrófono** | Android muestra el punto verde y lista «Servos» en los permisos de micrófono | Poco; se nombra para no olvidarlo |

Lo que ya está bien: no hay notificaciones, Android no copia el trabajo a la nube, el repositorio del trabajo del equipo
es privado, y la contraseña de Door43 no se guarda. El nombre «Servos» por sí solo no dice «Biblia».

## 2. Para todos los proyectos

Lo que no cambia nada para quien trabaja y deja menos a la vista. No depende del modo.

| # | Qué | Tamaño | Lo que no evita |
|---|---|---|---|
| A | **Textos del sistema sin «Biblia»**: «Para traducir en equipo, con o sin internet» en el manifiesto de la PWA, el instalador de Windows y el tipo de archivo `.servos` | Muy chico | Lo que se ve al abrir la app |
| B | **Borrar lo que quedó de compartir**: vaciar `cache/compartir` al abrir la app (la app que recibió el archivo ya lo leyó) | Muy chico | La copia que guardó WhatsApp, Bluetooth o la carpeta elegida |
| C | **Apps recientes sin foto** en Android 13 o más (`setRecentsScreenshotEnabled(false)`): la vista de recientes muestra un cuadro vacío; las capturas siguen funcionando | Muy chico | Android 12 o menos |
| D | **Antes de publicar en Door43**, una línea al pie del paso: «Lo que publiques en Door43 lo puede ver cualquiera en internet, con el nombre de tu cuenta» | Muy chico | Que la red vea que el teléfono habla con Door43 |

## 3. Con «Solo el equipo»

| # | Qué | Cómo sigue el modo | Tamaño | Lo que no evita |
|---|---|---|---|---|
| E | **Compartir cerrado**: el `.servos` va con contraseña, con **el mismo cifrado de las copias** (AES-GCM, rama `claude/copia-en-tarjeta`). La contraseña se acuerda en persona; Recibir la pide y puede recordarla para ese proyecto | Siempre con contraseña, sin preguntar. Con «Cualquiera…», como hoy | Mediano (el cifrado ya está; falta Recibir) | Quien sabe la contraseña; una contraseña olvidada deja ese archivo sin abrir (el trabajo sigue en el teléfono que lo mandó) |
| F | **Nombre que no dice nada**: «copia-18-10.servos» en lugar del proyecto, el libro y la persona; es también lo que muestra la hoja de compartir. Quien recibe ve de quién es al abrirlo en Recibir, después de la contraseña. El modo viaja **dentro** del archivo cerrado | Siempre. Con «Cualquiera…», el nombre de hoy | Chico | Que alguien sepa que es un archivo de Servos (la extensión) |
| G | **Bloqueo de la app con el del propio teléfono**: al abrir Servos y al volver a él (cuándo, en la sección 6), pide la huella, la cara o el PIN del teléfono (Android `BiometricPrompt` con credencial del aparato; Windows Hello). Nada nuevo que recordar ni que perder. En la PWA, donde no hay eso, un PIN de la app | Se ofrece una vez (sección 4); se enciende o apaga en Ajustes. Es del aparato, no del proyecto: basta que un proyecto sea «Solo el equipo» para ofrecerlo | Mediano | El teléfono que se entrega con Servos ya abierto; quien obliga a abrirlo; el teléfono sin bloqueo propio (la app lo dice y no lo ofrece); herramientas forenses (lo guardado no se cifra) |
| H | **Sin capturas** (`FLAG_SECURE` en Android, `contentProtected` en la ventana de Tauri): la pantalla de Servos sale negra en capturas, en grabaciones, al compartir la pantalla y en apps recientes, también en Android 12 o menos | **Lo decide cada quien para sí**, en Ajustes de la app, en «Al abrir Servos», junto al bloqueo (Abel, 18 de octubre). Apagado de entrada; la tarjeta del bloqueo lo ofrece en una fila más. Vale para todo Servos en ese aparato, no por proyecto | Chico | Una foto de la pantalla con otro teléfono |
| I | **Nombre e ícono discretos**: «Cuaderno» o «Notas», con un ícono neutro (Android `activity-alias`, uno por nombre). La primera pantalla tampoco dice Servos hasta pasar el bloqueo | Se ofrece una vez, junto con el bloqueo; se cambia en Ajustes. Es del aparato | Mediano en Android; en Windows, renombrar el acceso del menú Inicio; en la PWA no se puede | El nombre del paquete (`org.idiomaspuentes.servos`) en Ajustes › Apps; cambiarlo haría perder el trabajo. Algunos lanzadores quitan el acceso de la pantalla de inicio |
| J | **Después de recibir**: «El archivo sigue en Descargas. ¿Lo borro?» cuando Android da permiso; si no, dice dónde está | Solo en un proyecto «Solo el equipo» | Chico a mediano | Copias en WhatsApp o en su nube |
| K | **Al publicar en Door43**: el repositorio se crea privado, y hacerlo público es una decisión aparte, con su confirmación | Con «Solo el equipo». Con «Cualquiera…», público como hoy | Chico | Lo que ya se hizo público |

**Lo que se deja para después:** cifrar todo lo guardado en el aparato (muy grande; Android ya cifra el teléfono
apagado, y con el teléfono abierto la app tiene que poder leer) y «Quitar Servos de este teléfono» (choca con «el
trabajo no se pierde»; solo con una copia comprobada).

Lo que ningún modo evita, y la app debe decirlo en palabras simples, sin asustar: alguien que tiene el teléfono abierto
en Servos; alguien que obliga a desbloquearlo; herramientas forenses con tiempo; las copias que otras apps guardaron
por su cuenta; lo que se ve en la red al hablar con Door43.

## 4. Cómo lo dice la app

Siguiendo los principios 6 (avisos solo cuando algo falla), 8 (honestidad), 9 (la app lo explica en el momento de
elegir, no en una ayuda aparte) y 12 (cada acción tiene su forma). Todas las frases hablan de **quién puede ver**, nunca
de amenazas.

- **Al compartir, una línea bajo el nombre del archivo** (no una tarjeta ni un aviso):
  - «Solo el equipo»: «Solo quien sepa la contraseña del equipo puede abrir este archivo».
  - «Cualquiera…»: «Cualquiera que tenga este archivo puede abrirlo y ver lo escrito».
- **El bloqueo y el nombre discreto se ofrecen una vez**, en una tarjeta neutra con su acción y «Ahora no»
  (principio 12), la primera vez que se abre un proyecto «Solo el equipo» en ese aparato: «Solo el equipo puede ver
  este proyecto. ¿Quieres que Servos pida la huella o el PIN de este teléfono al abrirse?» › «Pedir al abrir». Debajo,
  en la misma tarjeta, dos filas: «Mostrar Servos con otro nombre en el teléfono ›» y «Que no se puedan hacer
  capturas de Servos ›». Si el teléfono no tiene bloqueo:
  «Este teléfono se abre sin PIN. Para que Servos lo pida, primero ponle un PIN al teléfono».
- **Al subir el modo**, en Ajustes del proyecto: un toque, y la línea que dice lo que cambia: «Desde ahora, los archivos
  que compartas y las copias llevan contraseña».
- **Al bajarlo**, un cuadro que confirma y dice qué deja de estar protegido, sin asustar: «Con “Cualquiera que tenga
  el archivo”, lo que compartas desde ahora irá sin contraseña y con el nombre del proyecto. Lo ya compartido sigue
  como está». Botones: «Cambiar» (con borde) y cerrar.
- **Al recibir un archivo cerrado**: «Este archivo es solo para el equipo. Escribe la contraseña que acordaron». Si se
  equivoca: «Esa no es la contraseña. Pídela a quien te lo mandó». Nunca «acceso denegado» ni nada parecido.
- **Al recibir en un proyecto con un modo más abierto**: el proyecto pasa a «Solo el equipo», y la pantalla final de
  Recibir lo dice en una línea: «Este proyecto ahora es solo para el equipo, como el que llegó».
- **En Ajustes de la app**, una fila de dos líneas, **«Al abrir Servos»** — «Pedir la huella o el PIN, otro nombre en
  el teléfono, capturas», donde cada quien enciende y apaga para sí el bloqueo (y cuándo vuelve a pedirse), el
  nombre discreto y las capturas: «Si lo enciendes, nadie puede hacer capturas ni grabar la pantalla de Servos en
  este teléfono, tampoco tú». Es donde se
  cambian, no una ayuda que haya que leer antes.
- **Nunca más de lo cierto.** La app no dice «seguro» ni «protegido» a secas. Dice qué evita y, en otra frase, qué no:
  «Con esto, quien tome el teléfono no puede abrir Servos sin tu huella o tu PIN. No sirve si Servos ya está abierto».
- **Para quien reparte la app**: una hoja de una página, en los tres idiomas, junto al APK y al instalador, con los dos
  modos y lo que conviene al instalar (borrar el instalador de Descargas, que el teléfono tenga PIN, usar apodos).

## 5. Primer paso recomendado

**Compartir sigue el modo del proyecto, y tres arreglos para todos**, en un solo cambio:

1. Compartir con «Solo el equipo»: contraseña con el cifrado de las copias, nombre que no dice nada, y Recibir que pide
   la contraseña (E, F), con las líneas de la sección 4.
2. Textos del sistema sin «Biblia» (A), borrar lo que quedó de compartir (B) y apps recientes sin foto (C).

Es lo que más deja a la vista hoy (el archivo que se encuentra en Descargas o en una tarjeta), usa lo que ya está hecho
para las copias, y no cambia nada en los proyectos «Cualquiera que tenga el archivo».

**Después**, en este orden: el **bloqueo** (G) con su tarjeta y la opción **sin capturas** (H), porque cubren el
teléfono que alguien toma; el repositorio privado al publicar (K) y la línea de Door43 (D); y al final el **nombre e ícono
discretos** (I) y lo de después de recibir (J).

## 6. Decidido con Abel (18 de octubre)

1. **Cuándo vuelve a pedirse el bloqueo: por lo que pasa, no solo por minutos.** Lo que Abel pidió investigar. Las
   apps que hacen lo mismo no dan un número único: WhatsApp ofrece «al instante», «después de 1 minuto» y «después de
   30 minutos» ([XDA](https://www.xda-developers.com/whatsapp-for-android-now-supports-fingerprint-unlock/),
   [Android Central](https://www.androidcentral.com/whatsapp-finally-adds-fingerprint-lock-its-android-app)); Signal
   deja elegir el tiempo y además cerrar a mano ([Signal](https://support.signal.org/hc/articles/360007059572)). OWASP
   no fija un número: pide volver a pedirlo al pasar la app al fondo o tras un rato sin uso, y deja el intervalo a cada
   app ([MASWE-0024](https://mas.owasp.org/MASWE/MASVS-AUTH/MASWE-0024/)). Lo que importa es en qué momento el teléfono
   puede cambiar de manos, y eso son tres cosas:
   - **Al apagarse la pantalla, siempre**, sin espera: es cuando el teléfono se deja sobre la mesa o se guarda.
   - **Al salir de Servos a otra app, después de un margen**, para que mirar el diccionario, contestar un mensaje o una
     llamada no obligue a poner la huella cada vez. De entrada, **1 minuto**; en Ajustes se elige entre «Al salir»,
     «Después de 1 minuto» y «Después de 5 minutos». Tres opciones y no un selector libre, para que se entienda sin
     pensar.
   - **En la computadora, también con Servos delante**: tras **5 minutos** sin teclado ni ratón, y al bloquearse
     Windows. Una computadora se deja abierta en una mesa más que un teléfono, que apaga solo su pantalla.

   Y una fila en el menú de la persona, **«Cerrar Servos ahora»**, que lo bloquea de un toque, como el cierre a mano de
   Signal.
2. **Sin capturas lo decide cada quien para sí** (Abel), en Ajustes de la app, no el modo del proyecto (H).
3. **Recibir recuerda la contraseña del proyecto** en ese aparato (recomendación aceptada). Escribirla cada vez lleva a
   contraseñas cortas o anotadas en papel junto al teléfono, que dejan más a la vista que guardarla dentro de Servos,
   detrás del bloqueo. Se guarda por proyecto, la misma para Compartir y para las copias; una fila en Ajustes del
   proyecto, «Olvidar la contraseña en este teléfono», la quita.
4. **Nombres e íconos discretos neutros y verdaderos** («Cuaderno», «Notas»), sin disfrazarse de otra app
   (recomendación aceptada).
5. **El dominio es `servos.idiomaspuentes.org`** (Abel): no dice *bible* en el historial ni en las pestañas, y es de
   la organización. Anotado también en el diseño (sección 13) y en el README.

## 7. El principio 9, aplicado

El principio 9 ya aprobado, «El trabajo no se pierde ni se expone», habla de lo que la app deja fuera de sí misma.
Esta propuesta lo aplica tal como está: Compartir se trata como una copia, y la explicación va en el momento de elegir.
Lo único que no cubre todavía es lo que se ve **dentro** del aparato. Si Abel quiere que quede escrito, bastaría una
línea más en su lista, sin cambiar lo aprobado:

> - En un proyecto «Solo el equipo», también lo que se ve en el aparato se elige: Servos puede pedir la huella o el PIN
>   del teléfono al abrirse, mostrarse con otro nombre y no dejarse capturar, y no deja atrás copias de lo que pasó a
>   otra app.

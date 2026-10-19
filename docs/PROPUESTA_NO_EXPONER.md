# Que el trabajo no exponga a quien traduce

*Propuesta, 18 de octubre de 2026. Para conversar con Abel; nada de esto está construido ni decidido.*

Algunos equipos traducen donde la Biblia y la fe cristiana están prohibidas, y que les encuentren una traducción
puede costarles la cárcel o la vida. Esta propuesta mira qué deja ver Servos hoy a quien toma el teléfono o la
computadora de un equipo, o a quien encuentra un archivo que se pasaron, y qué se puede hacer sin estorbar a los
equipos que no corren ese riesgo.

Se apoya en el principio 9, ya aprobado, **«El trabajo no se pierde ni se expone»** (`FILOSOFIA_DE_DISENO.md`, rama
`claude/copia-en-tarjeta`). Las copias en la tarjeta SD ya están cubiertas en esa rama: cifradas con contraseña
(AES-GCM), con nombres que no dicen nada (`copias/…dat`), una elección clara antes de guardar y «Borrar las copias».
Esta propuesta trata lo demás: el bloqueo, las capturas, el nombre de los archivos de Compartir, el nombre y el ícono
de la app y las copias que deja la hoja de compartir.

**En pocas palabras:** hoy cualquiera que tome el teléfono desbloqueado abre Servos y lee todo, y cada archivo que se
comparte lleva en el nombre el proyecto, el libro y quién lo mandó («Biblia en kichwa — Tito — Ana — 2026-10-19.servos»)
y, dentro, sin cifrar, el texto, los nombres de todo el equipo y sus voces. **Primer paso recomendado** (sección 4): lo
barato que no estorba a nadie, y que Compartir haga lo que el principio 9 ya pide a las copias: un nombre que no dice
nada y la explicación en el momento de elegir. Después, el bloqueo del propio teléfono y el «modo discreto».

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
| 12 | **La PWA en el navegador** | El nombre del sitio en el historial y en las pestañas (si se usa `servos.bible`, la palabra *bible* va en cada visita) | Quien abre el historial; la red |
| 13 | **Lo guardado en el aparato** | localStorage e IndexedDB sin cifrar (en Windows, en `%LOCALAPPDATA%\org.idiomaspuentes.servos`). Android no lo copia a la nube (`allowBackup="false"`, bien) | Herramientas forenses; en Windows, quien abre esa carpeta |
| 14 | **Los instaladores** | `Servos-0.1.0-rc.1.apk` y el instalador de Windows quedan en Descargas después de instalar | Quien abre Descargas |
| 15 | **El permiso de micrófono** | Android muestra el punto verde y lista «Servos» en los permisos de micrófono | Poco; se nombra para no olvidarlo |

Lo que ya está bien: no hay notificaciones, Android no copia el trabajo a la nube, el repositorio del trabajo del equipo
es privado, y la contraseña de Door43 no se guarda. El nombre «Servos» por sí solo no dice «Biblia».

## 2. Qué se puede hacer, de lo más chico a lo más grande

Dos clases de cambios:

- **Lo que no estorba a nadie** viene puesto para todos.
- **Lo que sale de la app** (un archivo de Compartir) se decide en el momento de compartir, con lo más seguro como
  recomendado, como ya hacen las copias en la tarjeta (principio 9).
- **Lo que cambia cómo se usa la app** (otro nombre, sin capturas, un bloqueo) se elige en un solo lugar, el
  **«modo discreto»**, en el menú de la persona. Un equipo sin riesgo no lo ve nunca si no lo busca.

| # | Propuesta | Para todos o discreto | Tamaño | Lo que no protege |
|---|---|---|---|---|
| A | **Textos del sistema sin «Biblia»**: «Para traducir en equipo, con o sin internet» en el manifiesto, el instalador y el tipo de archivo | Para todos | Muy chico | Lo que se ve al abrir la app |
| B | **Borrar las copias de compartir**: vaciar `cache/compartir` al abrir la app (la app que recibió el archivo ya lo leyó) | Para todos | Muy chico | La copia que guardó WhatsApp, Bluetooth o la carpeta elegida |
| C | **Recientes sin foto** en Android 13 o más (`setRecentsScreenshotEnabled(false)`): la vista de recientes muestra un cuadro vacío, pero las capturas de pantalla siguen funcionando | Para todos | Muy chico | Android 12 o menos; una captura que la persona haga |
| D | **Compartir elige el nombre, como las copias**: lo recomendado es un nombre que no dice nada («copia-18-10.servos»); quien lo quiera con el libro, el proyecto y su nombre lo elige ahí mismo, sabiendo lo que implica (principio 9). La hoja de compartir muestra el nombre elegido. Quien recibe ve de quién es al abrirlo en Recibir | Para todos: es una elección en Compartir, con lo seguro como recomendado | Chico | Lo que hay dentro del archivo, si no va con contraseña (H) |
| E | **Sin capturas** (`FLAG_SECURE` en Android, `contentProtected` en la ventana de Tauri): la pantalla sale negra en capturas, en grabaciones y al compartir la pantalla, también en Android 12 o menos | Discreto: estorba a quien manda capturas para pedir ayuda | Chico | Una foto de la pantalla con otro teléfono |
| F | **Bloqueo del propio teléfono**: al abrir Servos, y al volver a él después de un rato, pide la huella, la cara o el PIN del teléfono (Android `BiometricPrompt` con credencial del aparato; Windows Hello). Sin nada que recordar ni que perder. En la PWA, donde no hay eso, un PIN de la app | Discreto | Mediano | Un teléfono que alguien entrega abierto o es obligado a abrir; el teléfono sin bloqueo propio (la app lo dice y no ofrece el bloqueo); herramientas forenses, porque lo guardado no se cifra |
| G | **Nombre e ícono discretos** elegidos en el modo discreto: «Cuaderno» o «Notas», con un ícono neutro (Android `activity-alias`, uno por nombre). Dentro de la app, la primera pantalla tampoco dice Servos hasta pasar el bloqueo | Discreto | Mediano en Android; en Windows, renombrar el acceso del menú Inicio; en la PWA no se puede | El nombre del paquete (`org.idiomaspuentes.servos`) en Ajustes › Apps y para cualquier herramienta; cambiarlo haría perder el trabajo. Algunos lanzadores quitan el acceso de la pantalla y hay que ponerlo otra vez |
| H | **Compartir con contraseña**: el `.servos` va cifrado con **el mismo cifrado de las copias en la tarjeta** (AES-GCM con contraseña, ya en `claude/copia-en-tarjeta`); la contraseña se acuerda en persona y Recibir la pide. Recomendado en Compartir, como en las copias; sin ella, la app dice antes qué puede ver quien encuentre el archivo. La diferencia con las copias: aquí la contraseña la tiene que saber otra persona, así que la app no puede guardarla por el equipo | Para todos: la elección en Compartir | Mediano (el cifrado ya está; falta Recibir y la elección) | Quien conoce la contraseña; una contraseña débil; una contraseña olvidada deja el archivo sin abrir (el trabajo sigue en el teléfono que lo mandó) |
| I | **Después de recibir**: «El archivo sigue en Descargas. ¿Lo borro?» cuando Android da permiso; si no, la app dice dónde está para borrarlo a mano | Discreto | Chico a mediano | Copias en WhatsApp o en su nube |
| J | **Antes de publicar**: una línea en «Publicar en Door43» que diga que lo publicado lo ve cualquiera en internet, con el nombre de la cuenta y de la organización; y la opción de dejarlo **privado** hasta que el equipo decida | Para todos (la línea); la opción, en Publicar | Chico | Que alguien en la red vea que el teléfono habla con Door43 (eso solo lo cubre una VPN) |
| K | **Lo que la app no controla, dicho**: el teclado aprende palabras (cómo apagarlo en Gboard y Samsung), WhatsApp guarda copias, los instaladores quedan en Descargas, usar un apodo en lugar del nombre | Para todos, en la página que explica | Solo texto | — |
| L | **Cifrar todo lo guardado en el aparato** | — | Muy grande | No lo recomiendo ahora: Android ya cifra el teléfono apagado o recién encendido, y con el teléfono desbloqueado la app tiene que poder leer. Ayudaría solo contra herramientas forenses en un teléfono ya abierto una vez |
| M | **«Quitar Servos de este teléfono»**: borra todo, después de comprobar que hay una copia en tarjeta o en otro teléfono | Discreto | Mediano | Choca con «el trabajo no se pierde»: solo con copia comprobada. Para más adelante |

Lo que ninguna de estas opciones protege, y la app debe decirlo sin rodeos: alguien que tiene el teléfono abierto en la
mano mientras Servos está abierto; alguien que obliga a la persona a desbloquearlo; herramientas forenses con tiempo y
el teléfono; las copias que otras apps guardaron por su cuenta; y lo que se ve en la red al hablar con Door43.

## 3. Cómo y cuándo lo explica la app

Siguiendo los principios 6 (avisos solo cuando algo falla), 9 (el trabajo no se pierde ni se expone: la app lo
explica en el momento de elegir, no en una ayuda aparte) y 12 (cada acción tiene su forma):

- **La explicación va donde se elige.** En Compartir, junto al nombre y la contraseña; al encender el bloqueo, junto al
  interruptor; al publicar, al pie del paso. Siempre en dos frases: qué hace y qué no hace.
- **Los ajustes, en un solo lugar.** En el menú de la persona, una fila de dos líneas: **«Quién puede ver tu
  trabajo»** — «Bloqueo, nombre de la app y capturas». Ahí están el interruptor del modo discreto y las opciones que
  enciende, cada una con su propio interruptor y sus dos frases. Es donde se cambian, no una ayuda que haya que leer
  antes.
- **Nunca más de lo cierto** (principio 8). La app no dice «protegido» ni «seguro». Dice, por ejemplo: «Con el
  bloqueo, quien tome el teléfono no puede abrir Servos sin tu huella o tu PIN. No sirve si el teléfono ya está abierto
  en Servos, ni contra quien te obligue a abrirlo».
- **Ningún aviso a quien no lo necesita** (principio 6). Ni la primera vez que se abre la app, ni con un cartel en
  Inicio. La primera vez sigue preguntando solo el idioma y el nombre (diseño, sección 5).
- **En el momento en que el riesgo aparece, una línea, una vez.** Lo que la app sugiere una vez va en una tarjeta
  neutra, con su acción y «Ahora no» (principio 12):
  - **Al compartir** (cada vez, no solo la primera, porque es una elección como la de las copias): el nombre que no
    dice nada y la contraseña vienen recomendados; si se elige el otro nombre o sin contraseña, una línea dice antes
    qué verá quien encuentre el archivo («el proyecto, el libro y tu nombre»; «todo lo escrito y las voces»).
  - **La primera vez que se publica en Door43**: «Lo que publiques lo puede ver cualquiera en internet, con el nombre
    de tu cuenta». No es una tarjeta que se descarta: es la línea que dice qué cambia, al pie del paso.
  - **Al vincular la cuenta de Door43**: una frase sobre elegir un nombre de cuenta que no diga quién eres.
- **Lo que se deshace no pide confirmación; lo que no se deshace, sí.** Encender el modo discreto es inmediato; si se
  elige otro nombre de app, la app dice antes que el ícono cambia de lugar en la pantalla del teléfono y cómo
  encontrarlo.
- **Para quien reparte la app**, que es quien más decide: una hoja de una página (en español, portugués e inglés) que
  va junto al APK y al instalador, con lo mismo que la página de la app, más lo que conviene antes de instalar (borrar
  el instalador de Descargas, usar apodos, el bloqueo del teléfono).

## 4. Primer paso recomendado

**Lo barato que no estorba a nadie, y Compartir como las copias**, en un solo cambio:

1. Textos del sistema sin «Biblia» (A).
2. Borrar las copias de `cache/compartir` al abrir la app (B).
3. Recientes sin foto en Android 13 o más (C).
4. En Compartir, el nombre que no dice nada como recomendado, con la explicación al elegir (D).
5. La línea antes de publicar en Door43 (J, sin la opción de privado todavía).

Es poco código, no cambia nada para un equipo sin riesgo salvo el nombre que se propone al compartir, y aplica a
Compartir lo que el principio 9 ya pide a las copias.

**Después**, en este orden: **Compartir con contraseña** (H), que ya tiene el cifrado hecho en la rama de las copias;
el **bloqueo** del propio teléfono (F), porque cubre el caso más común, el teléfono que alguien toma; y el **modo
discreto**, con la fila «Quién puede ver tu trabajo», sin capturas (E) y nombre e ícono (G).

## 5. Para decidir

1. **El nombre recomendado al compartir: ¿con el libro o sin nada?** El principio 9 pide que lo recomendado sea un
   nombre que no dice nada. «Tito 18-10.servos» se reconoce mejor en Descargas, pero dice el libro. Recomiendo
   «copia-18-10.servos», con el libro como otra opción en la misma elección.
2. **El bloqueo: ¿uno por aparato o uno por persona?** El diseño (sección 5) pregunta por un PIN por persona, para que
   otro no trabaje con su nombre. Es otra cosa. Para no exponer, basta el bloqueo del teléfono, uno por aparato.
   Propongo resolverlos por separado.
3. **¿Qué nombres y qué íconos ofrece el modo discreto?** Propongo nombres neutros y verdaderos («Cuaderno», «Notas»),
   no disfrazarse de calculadora: si alguien descubre el disfraz, se ve peor.
4. **¿Publicar en privado primero?** Hoy publicar crea un repositorio público. ¿Se ofrece dejarlo privado hasta que el
   equipo decida?
5. **¿Qué dominio para la PWA?** `servos.bible` todavía no está apartado; *bible* en el historial del navegador es lo
   primero que alguien ve.

## 6. El principio 9, aplicado a lo demás

El principio 9 ya aprobado, «El trabajo no se pierde ni se expone», habla de lo que la app deja fuera de sí misma.
Esta propuesta lo aplica tal como está: Compartir se trata como una copia (D, H), y la explicación va en el momento de
elegir. Lo único que el principio no cubre todavía es lo que se ve **dentro** del aparato: la app abierta, las
capturas, el nombre en el lanzador, lo que queda en la caché. Si Abel quiere que quede escrito, bastaría una línea
más en su lista, sin cambiar lo aprobado:

> - Lo que se ve en el aparato también se elige: quien corre riesgo puede cerrar la app con el bloqueo del teléfono,
>   quitarle su nombre y evitar las capturas, y la app no deja atrás copias de lo que pasó a otra app.

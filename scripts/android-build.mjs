// Builds the app for phones (`android/`) into an APK to install by cable or as a file, with no store, signed with
// Servos's own key (android/app/build.gradle). Run by `npm run telefono:compilar`, after the web app is built and copied
// in. Capacitor needs Java 21: Android Studio's own (its `jbr`) is used when JAVA_HOME is not set, so the Java on PATH
// is left as it is. Writes `dist-android/Servos-<version>.apk` (not in dist-telefono, which is copied into the app).
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const windows = process.platform === 'win32'
const studioJava = windows ? 'C:/Program Files/Android/Android Studio/jbr' : '/Applications/Android Studio.app/Contents/jbr/Contents/Home'
const env = { ...process.env }
if (!env.JAVA_HOME && existsSync(studioJava)) env.JAVA_HOME = studioJava
if (!env.ANDROID_HOME && windows && env.LOCALAPPDATA) env.ANDROID_HOME = join(env.LOCALAPPDATA, 'Android', 'Sdk')

const android = join(root, 'android')
execFileSync(join(android, windows ? 'gradlew.bat' : 'gradlew'), ['assembleRelease'], { cwd: android, env, stdio: ['ignore', 'inherit', 'inherit'], shell: windows })

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const built = join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
if (!existsSync(built)) {
  console.error('No signed APK: is the key in %USERPROFILE%\.servos (android/app/build.gradle)?')
  process.exit(1)
}
mkdirSync(join(root, 'dist-android'), { recursive: true })
const apk = join(root, 'dist-android', `Servos-${version}.apk`)
copyFileSync(built, apk)
console.log(`\n${apk}`)

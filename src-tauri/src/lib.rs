//! Servos on a computer (design, section 11): the web app in a window of its own, kept whole inside the program so it
//! opens without internet from the first time. Here is only what a browser cannot do: a `.servos` file opened from the
//! computer (a double click on it, Servos open or not) is read and handed to the app, which opens «Receive» with it;
//! and a file the app made is saved where the person chooses, in the system's save dialog; a link to a page on the
//! internet (Door43) opens in the computer's browser. The window remembers its size and place.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Emitter, LogicalSize, Manager, State, Url, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

/// A file opened from the computer, as the app reads it: its name and its text.
#[derive(Clone, serde::Serialize)]
struct Opened {
    name: String,
    text: String,
}

/// Files opened that the app has not taken yet: the one Servos was started with waits here until the page is ready.
#[derive(Default)]
struct Waiting(Mutex<Vec<Opened>>);

/// Tells the page that files were opened; it takes them with `opened_files`.
const OPENED: &str = "archivos-abiertos";

/// The work shared from Servos among what the program was started with (its own path comes first, and is not one).
/// A file that cannot be read still goes, empty: the app says it is not a file it can receive, rather than nothing
/// happening after a double click.
fn shared_files(args: &[String], cwd: &Path) -> Vec<Opened> {
    args.iter()
        .skip(1)
        .filter(|arg| arg.to_lowercase().ends_with(".servos"))
        .map(|arg| {
            let path = cwd.join(arg);
            let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            let text = std::fs::read(&path).map(|bytes| String::from_utf8_lossy(&bytes).into_owned()).unwrap_or_default();
            Opened { name, text }
        })
        .collect()
}

/// The files opened that the app has not taken yet; each is given once.
#[tauri::command]
fn opened_files(waiting: State<'_, Waiting>) -> Vec<Opened> {
    std::mem::take(&mut *waiting.0.lock().unwrap())
}

/// Saves a file the app made where the person chooses, in the system's save dialog, under the name the app gave it.
/// Gives back the name it got, or nothing when the person closed the dialog.
#[tauri::command]
async fn save_file(app: AppHandle, name: String, text: String) -> Result<Option<String>, String> {
    let mut dialog = app.dialog().file().set_file_name(&name);
    if let Some(ext) = Path::new(&name).extension().and_then(|e| e.to_str()) {
        // The kind of file, as the dialog's list shows it: «Servos (*.servos)», «USFM (*.usfm)», «JSON (*.json)».
        let kind = if ext.eq_ignore_ascii_case("servos") { "Servos".to_string() } else { ext.to_uppercase() };
        dialog = dialog.add_filter(kind, &[ext]);
    }
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path: PathBuf = chosen.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    Ok(path.file_name().map(|n| n.to_string_lossy().into_owned()))
}

/// Whether a page the app asks to open in a new window («Ver en Door43») goes to the computer's browser: a page on the
/// internet does. Nothing opens inside Servos, which shows only itself.
fn opens_in_browser(url: &Url) -> bool {
    matches!(url.scheme(), "http" | "https")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args_os().map(|a| a.to_string_lossy().into_owned()).collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    tauri::Builder::default()
        // First: a second Servos (a file opened while it is open) only hands its files to the one open, and ends.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let files = shared_files(&args, Path::new(&cwd));
            if !files.is_empty() {
                app.state::<Waiting>().0.lock().unwrap().extend(files);
                let _ = app.emit(OPENED, ());
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(Waiting(Mutex::new(shared_files(&args, &cwd))))
        .invoke_handler(tauri::generate_handler![opened_files, save_file])
        // The window is made here, not from the configuration alone, to say where its links to the internet go.
        .setup(|app| {
            let config = app.config().app.windows.first().cloned().ok_or("no window in tauri.conf.json")?;
            let window = WebviewWindowBuilder::from_config(app.handle(), &config)?
                .on_new_window(|url, _| {
                    if opens_in_browser(&url) {
                        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
                    }
                    NewWindowResponse::Deny
                })
                .build()?;
            // The size it had last time comes back with it, even one smaller than its least (saved by an earlier
            // Servos, or on a screen with another scaling): below that the app lays itself out for a phone.
            let least = LogicalSize::new(config.min_width.unwrap_or(0.0), config.min_height.unwrap_or(0.0));
            let now = window.inner_size()?.to_logical::<f64>(window.scale_factor()?);
            if now.width < least.width || now.height < least.height {
                window.set_size(LogicalSize::new(now.width.max(least.width), now.height.max(least.height)))?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Servos could not start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_shared_work_and_says_an_unreadable_one() {
        let dir = std::env::temp_dir().join("servos-shared-files-test");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Jonás.servos"), "{\"format\":\"servos-compartir\"}").unwrap();
        let args = ["Servos.exe", "Jonás.servos", "JON.usfm", "falta.SERVOS"].map(String::from);
        let files = shared_files(&args, &dir);
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].name, "Jonás.servos");
        assert_eq!(files[0].text, "{\"format\":\"servos-compartir\"}");
        assert_eq!(files[1].name, "falta.SERVOS");
        assert_eq!(files[1].text, "");
    }

    #[test]
    fn only_pages_on_the_internet_go_to_the_browser() {
        let opens = |u: &str| opens_in_browser(&Url::parse(u).unwrap());
        assert!(opens("https://qa.door43.org/testingOrg/qu_reg"));
        assert!(opens("http://localhost:8787/org/repo"));
        assert!(!opens("file:///C:/Windows/System32/calc.exe"));
        assert!(!opens("javascript:alert(1)"));
        assert!(!opens("ms-settings:privacy"));
    }
}

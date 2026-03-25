// isoTrainer — Tauri shell
// MediaPipe runs entirely in the WebView (TypeScript/WASM).
// No sidecar process needed.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

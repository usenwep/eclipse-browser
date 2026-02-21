use serde::Serialize;

#[derive(Serialize)]
struct NwepHeader {
    name: String,
    value: String,
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[derive(Serialize)]
struct LogStep {
    name: String,
    ok: bool,
    detail: Option<String>,
}

#[derive(Serialize)]
struct ConnectionInfo {
    client_node_id: String,
    server_node_id: String,
    server_pubkey: String,
}

#[derive(Serialize)]
struct NwepResult {
    ok: bool,
    error: Option<String>,
    status: Option<String>,
    status_details: Option<String>,
    body: Option<String>,
    headers: Vec<NwepHeader>,
    connection: Option<ConnectionInfo>,
    log: Vec<LogStep>,
}

fn extract_path(url: &str) -> String {
    let without_scheme = url.strip_prefix("web://").unwrap_or(url);
    if let Some(slash_pos) = without_scheme.find('/') {
        without_scheme[slash_pos..].to_string()
    } else {
        "/".to_string()
    }
}

#[tauri::command]
async fn nwep_fetch(url: String) -> Result<NwepResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut log: Vec<LogStep> = Vec::new();

        let keypair = match nwep::Keypair::generate() {
            Ok(kp) => {
                log.push(LogStep { name: "generated ephemeral keypair".into(), ok: true, detail: None });
                kp
            }
            Err(e) => {
                log.push(LogStep { name: "generated ephemeral keypair".into(), ok: false, detail: Some(format!("{e}")) });
                return Ok(NwepResult {
                    ok: false, error: Some(format!("{e}")),
                    status: None, status_details: None, body: None,
                    headers: vec![], connection: None, log,
                });
            }
        };

        let path = extract_path(&url);

        let client = match nwep::ClientBuilder::new().connect(keypair, &url) {
            Ok(c) => {
                log.push(LogStep { name: "client established connection".into(), ok: true, detail: None });
                c
            }
            Err(e) => {
                log.push(LogStep { name: "client established connection".into(), ok: false, detail: Some(format!("{e}")) });
                return Ok(NwepResult {
                    ok: false, error: Some(format!("{e}")),
                    status: None, status_details: None, body: None,
                    headers: vec![], connection: None, log,
                });
            }
        };

        let peer = client.peer_identity();
        let connection = ConnectionInfo {
            client_node_id: client.node_id().to_string(),
            server_node_id: client.peer_node_id().to_string(),
            server_pubkey: to_hex(&peer.pubkey),
        };

        let resp = match client.get(&path) {
            Ok(r) => {
                let detail = if r.status_details.is_empty() {
                    r.status.clone()
                } else {
                    format!("{} {}", r.status, r.status_details)
                };
                log.push(LogStep { name: "fetched resource".into(), ok: true, detail: Some(detail) });
                r
            }
            Err(e) => {
                log.push(LogStep { name: "fetched resource".into(), ok: false, detail: Some(format!("{e}")) });
                return Ok(NwepResult {
                    ok: false, error: Some(format!("{e}")),
                    status: None, status_details: None, body: None,
                    headers: vec![], connection: Some(connection), log,
                });
            }
        };

        Ok(NwepResult {
            ok: true,
            error: None,
            status: Some(resp.status),
            status_details: Some(resp.status_details),
            body: Some(String::from_utf8_lossy(&resp.body).to_string()),
            headers: resp
                .headers
                .into_iter()
                .map(|h| NwepHeader { name: h.name, value: h.value })
                .collect(),
            connection: Some(connection),
            log,
        })
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    nwep::init().expect("failed to initialize nwep");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    #[cfg(not(target_os = "android"))]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![nwep_fetch, get_app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

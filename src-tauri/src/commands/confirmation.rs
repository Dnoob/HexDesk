use crate::state::AppState;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmationRequest {
    pub id: String,
    pub action_type: String,
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// Request user confirmation for an action.
/// Emits a `confirmation:request` event to the frontend and waits for the response.
/// Returns `true` if approved, `false` if rejected.
pub async fn request_confirmation(
    app: &AppHandle,
    action_type: &str,
    title: &str,
    description: &str,
    details: Option<&str>,
) -> Result<bool, String> {
    let id = uuid_v4();
    let request = ConfirmationRequest {
        id: id.clone(),
        action_type: action_type.to_string(),
        title: title.to_string(),
        description: description.to_string(),
        details: details.map(|s| s.to_string()),
    };

    let (tx, rx) = oneshot::channel::<bool>();

    {
        let state = app.state::<AppState>();
        let mut pending = state
            .pending_confirmations
            .lock()
            .map_err(|e| format!("Failed to lock pending confirmations: {e}"))?;
        pending.insert(id, tx);
    }

    app.emit("confirmation:request", request)
        .map_err(|e| format!("Failed to emit confirmation request: {e}"))?;

    rx.await.map_err(|_| "Confirmation channel closed".to_string())
}

#[tauri::command]
pub async fn respond_confirmation(
    id: String,
    approved: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sender = {
        let mut pending = state
            .pending_confirmations
            .lock()
            .map_err(|e| format!("Failed to lock pending confirmations: {e}"))?;
        pending
            .remove(&id)
            .ok_or_else(|| format!("No pending confirmation with id: {id}"))?
    };

    // oneshot send can fail if the receiver was dropped, which is acceptable
    let _ = sender.send(approved);
    Ok(())
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (now.as_secs() & 0xFFFF_FFFF) as u32,
        (now.subsec_nanos() >> 16) & 0xFFFF,
        now.subsec_nanos() & 0x0FFF,
        0x8000 | (now.as_nanos() as u16 & 0x3FFF),
        now.as_nanos() as u64 & 0xFFFF_FFFF_FFFF,
    )
}

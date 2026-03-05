use cron::Schedule;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTask {
    pub id: String,
    pub name: String,
    pub cron_expression: String,
    pub prompt: String,
    pub enabled: bool,
    pub last_run: Option<i64>,
    pub next_run: Option<i64>,
    pub created_at: i64,
}

#[tauri::command]
pub fn parse_cron_next_run(cron_expression: String) -> Result<Option<i64>, String> {
    let schedule = Schedule::from_str(&cron_expression)
        .map_err(|e| format!("Invalid cron expression: {e}"))?;
    let next = schedule.upcoming(chrono::Utc).next();
    Ok(next.map(|dt| dt.timestamp_millis()))
}

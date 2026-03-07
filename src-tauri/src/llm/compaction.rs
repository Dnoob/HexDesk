use serde::Serialize;
use serde_json::Value;

use super::provider::ChatMessage;
use crate::state::Settings;

const COMPACTION_THRESHOLD: f64 = 0.7;
const KEEP_RECENT: usize = 6;
const TOKENS_PER_CHAR: f64 = 0.4;
const SUMMARY_MAX_TOKENS: u32 = 800;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactedPayload {
    pub summary_tokens: usize,
}

pub struct CompactionResult {
    pub messages: Vec<ChatMessage>,
    pub compressed: bool,
}

pub fn get_context_limit(model: &str) -> usize {
    match model {
        m if m.contains("gpt-4o") => 128_000,
        m if m.contains("gpt-4") => 8_192,
        m if m.contains("gpt-3.5") => 16_385,
        m if m.contains("deepseek") => 64_000,
        m if m.contains("MiniMax") => 128_000,
        m if m.contains("claude") => 200_000,
        _ => 32_000,
    }
}

pub fn estimate_tokens(messages: &[ChatMessage]) -> usize {
    messages
        .iter()
        .map(|m| {
            let content_len = match &m.content {
                Value::String(s) => s.len(),
                Value::Array(parts) => parts
                    .iter()
                    .map(|p| {
                        p.get("text")
                            .and_then(|t| t.as_str())
                            .map(|s| s.len())
                            .unwrap_or(512)
                    })
                    .sum(),
                _ => 0,
            };
            let overhead = 4;
            (content_len as f64 * TOKENS_PER_CHAR) as usize + overhead
        })
        .sum()
}

pub fn needs_compaction(messages: &[ChatMessage], context_limit: usize) -> bool {
    let tokens = estimate_tokens(messages);
    let threshold = (context_limit as f64 * COMPACTION_THRESHOLD) as usize;
    tokens >= threshold && messages.len() > KEEP_RECENT + 1
}

fn format_messages_for_summary(messages: &[ChatMessage]) -> String {
    messages
        .iter()
        .map(|m| {
            let content = match &m.content {
                Value::String(s) => s.clone(),
                Value::Null => "[tool call]".to_string(),
                Value::Array(parts) => parts
                    .iter()
                    .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join(" "),
                _ => String::new(),
            };
            format!("{}: {}", m.role, content)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

async fn generate_summary(formatted: &str, settings: &Settings) -> Result<String, String> {
    let prompt = format!(
        "请将以下对话历史压缩为简洁的摘要。保留：\n\
        - 用户的主要需求和意图\n\
        - AI 执行的关键操作和结果\n\
        - 重要的文件路径、命令、决策\n\
        - 尚未完成的任务状态\n\n\
        用中文输出，使用要点列表格式，控制在 500 字以内。\n\n\
        对话历史：\n{}",
        formatted
    );

    let summary_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: Value::String(prompt),
        tool_calls: None,
        tool_call_id: None,
    }];

    // Use a minimal settings clone for summary generation
    let summary_settings = Settings {
        max_tokens: SUMMARY_MAX_TOKENS,
        temperature: 0.3,
        ..settings.clone()
    };

    let mut result = String::new();
    crate::llm::openai_compatible::stream_chat(
        &summary_settings,
        &summary_messages,
        None,
        |chunk| result.push_str(&chunk),
    )
    .await?;

    Ok(result)
}

pub async fn compact_messages(
    messages: &[ChatMessage],
    settings: &Settings,
) -> Result<CompactionResult, String> {
    // Split: system prompt (first msg) + compressible + recent
    if messages.is_empty() {
        return Ok(CompactionResult {
            messages: messages.to_vec(),
            compressed: false,
        });
    }

    let system_msg = messages[0].clone();
    let rest = &messages[1..];

    if rest.len() <= KEEP_RECENT {
        return Ok(CompactionResult {
            messages: messages.to_vec(),
            compressed: false,
        });
    }

    let split_point = rest.len() - KEEP_RECENT;
    let to_compress = &rest[..split_point];
    let recent = &rest[split_point..];

    if to_compress.is_empty() {
        return Ok(CompactionResult {
            messages: messages.to_vec(),
            compressed: false,
        });
    }

    let formatted = format_messages_for_summary(to_compress);

    // Try LLM summary; fallback to simple truncation
    let summary = match generate_summary(&formatted, settings).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Compaction summary failed, falling back to truncation: {}", e);
            // Simple truncation fallback
            format!(
                "（之前有 {} 条对话消息，因上下文限制已省略）",
                to_compress.len()
            )
        }
    };

    let mut result = vec![system_msg];
    result.push(ChatMessage {
        role: "system".to_string(),
        content: Value::String(format!(
            "[以下是之前对话的摘要]\n{}\n[摘要结束，以下是最近的对话]",
            summary
        )),
        tool_calls: None,
        tool_call_id: None,
    });
    result.extend_from_slice(recent);

    Ok(CompactionResult {
        messages: result,
        compressed: true,
    })
}

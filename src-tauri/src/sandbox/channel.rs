use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

use super::{ExecRequest, ExecResult, VmMessage};

/// virtio-serial 通信通道
pub struct SandboxChannel {
    stream: TcpStream,
}

impl SandboxChannel {
    /// 连接到 virtio-serial socket
    /// Windows: TCP 127.0.0.1:13500
    /// Linux/macOS: 也通过 TCP 连接（QEMU chardev socket 模式）
    pub async fn connect(addr: &str) -> Result<Self, String> {
        let stream = TcpStream::connect(addr)
            .await
            .map_err(|e| format!("Failed to connect to sandbox channel {}: {}", addr, e))?;

        Ok(Self { stream })
    }

    /// 发送长度前缀的 JSON 消息
    async fn send(&mut self, data: &[u8]) -> Result<(), String> {
        let len = data.len() as u32;
        self.stream
            .write_all(&len.to_be_bytes())
            .await
            .map_err(|e| format!("Send length error: {}", e))?;

        self.stream
            .write_all(data)
            .await
            .map_err(|e| format!("Send data error: {}", e))?;

        self.stream
            .flush()
            .await
            .map_err(|e| format!("Flush error: {}", e))?;

        Ok(())
    }

    /// 接收长度前缀的 JSON 消息
    async fn recv(&mut self) -> Result<VmMessage, String> {
        let mut len_buf = [0u8; 4];
        self.stream
            .read_exact(&mut len_buf)
            .await
            .map_err(|e| format!("Recv length error: {}", e))?;

        let len = u32::from_be_bytes(len_buf) as usize;
        if len > 10 * 1024 * 1024 {
            return Err(format!("Message too large: {} bytes", len));
        }

        let mut data = vec![0u8; len];
        self.stream
            .read_exact(&mut data)
            .await
            .map_err(|e| format!("Recv data error: {}", e))?;

        serde_json::from_slice(&data)
            .map_err(|e| format!("Parse message error: {}", e))
    }

    /// 等待 agent ready 信号
    pub async fn wait_ready(&mut self, wait_timeout: Duration) -> Result<super::AgentInfo, String> {
        let result = timeout(wait_timeout, async {
            loop {
                match self.recv().await {
                    Ok(VmMessage::Ready {
                        version,
                        python,
                        node,
                    }) => {
                        return Ok(super::AgentInfo {
                            info_type: "ready".to_string(),
                            version,
                            python,
                            node,
                        });
                    }
                    Ok(_) => {
                        // 忽略非 ready 消息
                        continue;
                    }
                    Err(e) => {
                        return Err(e);
                    }
                }
            }
        })
        .await;

        match result {
            Ok(inner) => inner,
            Err(_) => Err("Timeout waiting for agent ready signal".to_string()),
        }
    }

    /// 发送命令并等待最终结果
    pub async fn exec(&mut self, request: ExecRequest) -> Result<ExecResult, String> {
        let data = serde_json::to_vec(&request)
            .map_err(|e| format!("Serialize request error: {}", e))?;

        self.send(&data).await?;

        let exec_timeout = Duration::from_secs(request.timeout as u64 + 10);

        let result = timeout(exec_timeout, async {
            loop {
                match self.recv().await? {
                    VmMessage::Result {
                        id,
                        exit_code,
                        stdout,
                        stderr,
                        duration_ms,
                    } if id == request.id => {
                        return Ok(ExecResult {
                            id,
                            res_type: "result".to_string(),
                            exit_code,
                            stdout,
                            stderr,
                            duration_ms,
                        });
                    }
                    VmMessage::Stream { .. } => {
                        // 流式输出，暂时跳过（由 exec_stream 处理）
                        continue;
                    }
                    _ => continue,
                }
            }
        })
        .await;

        match result {
            Ok(inner) => inner,
            Err(_) => Err(format!(
                "Timeout waiting for command result ({}s)",
                request.timeout
            )),
        }
    }

    /// 发送命令并流式接收输出
    pub async fn exec_stream<F>(
        &mut self,
        request: ExecRequest,
        on_output: F,
    ) -> Result<ExecResult, String>
    where
        F: Fn(super::StreamOutput),
    {
        let data = serde_json::to_vec(&request)
            .map_err(|e| format!("Serialize request error: {}", e))?;

        self.send(&data).await?;

        let exec_timeout = Duration::from_secs(request.timeout as u64 + 10);

        let result = timeout(exec_timeout, async {
            loop {
                match self.recv().await? {
                    VmMessage::Result {
                        id,
                        exit_code,
                        stdout,
                        stderr,
                        duration_ms,
                    } if id == request.id => {
                        return Ok(ExecResult {
                            id,
                            res_type: "result".to_string(),
                            exit_code,
                            stdout,
                            stderr,
                            duration_ms,
                        });
                    }
                    VmMessage::Stream { id, channel, data } if id == request.id => {
                        on_output(super::StreamOutput {
                            id,
                            output_type: "stream".to_string(),
                            channel,
                            data,
                        });
                        continue;
                    }
                    _ => continue,
                }
            }
        })
        .await;

        match result {
            Ok(inner) => inner,
            Err(_) => Err(format!(
                "Timeout waiting for command result ({}s)",
                request.timeout
            )),
        }
    }
}

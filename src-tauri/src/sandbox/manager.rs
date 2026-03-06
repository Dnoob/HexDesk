use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter};
use tokio::sync::{Mutex, Notify};
use uuid::Uuid;

use super::channel::SandboxChannel;
use super::download::ImageDownloader;
use super::nfs::NfsServer;
use super::qemu::QemuProcess;
use super::{AgentInfo, ExecRequest, ExecResult, SandboxConfig, SandboxState};

/// 沙盒生命周期管理器
pub struct SandboxManager {
    state: Arc<Mutex<SandboxState>>,
    config: Arc<Mutex<SandboxConfig>>,
    qemu: Arc<Mutex<Option<QemuProcess>>>,
    channel: Arc<Mutex<Option<SandboxChannel>>>,
    nfs: Arc<Mutex<Option<NfsServer>>>,
    agent_info: Arc<Mutex<Option<AgentInfo>>>,
    ready_notify: Arc<Notify>,
}

impl SandboxManager {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(SandboxState::NotInstalled)),
            config: Arc::new(Mutex::new(SandboxConfig::default())),
            qemu: Arc::new(Mutex::new(None)),
            channel: Arc::new(Mutex::new(None)),
            nfs: Arc::new(Mutex::new(None)),
            agent_info: Arc::new(Mutex::new(None)),
            ready_notify: Arc::new(Notify::new()),
        }
    }

    /// 设置状态并通知前端
    async fn set_state(&self, app: &AppHandle, new_state: SandboxState) {
        let mut state = self.state.lock().await;
        *state = new_state.clone();
        let _ = app.emit("sandbox:state-changed", &new_state);
    }

    /// App 启动时调用，自动检测并安装/启动沙盒
    pub async fn auto_start(&self, app: &AppHandle) -> Result<(), String> {
        let config = self.config.lock().await.clone();

        if !config.enabled {
            self.set_state(app, SandboxState::Disabled).await;
            return Ok(());
        }

        // 检查镜像是否已安装
        if !ImageDownloader::is_installed(&config) {
            // 需要下载
            self.set_state(
                app,
                SandboxState::Downloading { progress: 0.0 },
            )
            .await;

            if let Err(e) = ImageDownloader::download(app, &config).await {
                self.set_state(
                    app,
                    SandboxState::Error {
                        message: format!("Download failed: {}", e),
                    },
                )
                .await;
                return Err(e);
            }
        }

        // 启动沙盒
        self.start_sandbox(app, &config).await
    }

    /// 启动 QEMU + NFS + 等待 agent ready
    async fn start_sandbox(&self, app: &AppHandle, config: &SandboxConfig) -> Result<(), String> {
        self.set_state(app, SandboxState::Starting).await;

        // 启动 QEMU
        let mut qemu = QemuProcess::start(config)
            .map_err(|e| {
                let msg = format!("QEMU start failed: {}", e);
                msg
            })?;

        // 后台读取启动日志
        qemu.spawn_log_reader(app.clone());

        *self.qemu.lock().await = Some(qemu);

        // 等待 agent ready（连接 virtio-serial）
        let addr = config.serial_addr();
        let app_clone = app.clone();
        let channel_arc = self.channel.clone();
        let agent_info_arc = self.agent_info.clone();
        let state_arc = self.state.clone();
        let ready_notify = self.ready_notify.clone();

        // 在后台尝试连接并等待 ready
        tokio::spawn(async move {
            // 等待 QEMU 启动，给 socket 一些时间
            tokio::time::sleep(Duration::from_secs(3)).await;

            // 重试连接（QEMU 启动需要时间）
            let mut channel = None;
            for attempt in 0..20 {
                match SandboxChannel::connect(&addr).await {
                    Ok(ch) => {
                        channel = Some(ch);
                        break;
                    }
                    Err(_) => {
                        if attempt < 19 {
                            tokio::time::sleep(Duration::from_secs(2)).await;
                        }
                    }
                }
            }

            let Some(mut ch) = channel else {
                let mut state = state_arc.lock().await;
                *state = SandboxState::Error {
                    message: "Failed to connect to sandbox agent".to_string(),
                };
                let _ = app_clone.emit("sandbox:state-changed", &*state);
                return;
            };

            // 等待 agent ready 信号
            match ch.wait_ready(Duration::from_secs(120)).await {
                Ok(info) => {
                    let _ = app_clone.emit("sandbox:agent-ready", &info);
                    *agent_info_arc.lock().await = Some(info);
                    *channel_arc.lock().await = Some(ch);

                    let mut state = state_arc.lock().await;
                    *state = SandboxState::Ready;
                    let _ = app_clone.emit("sandbox:state-changed", &*state);

                    // 通知所有等待就绪的 exec 调用
                    ready_notify.notify_waiters();
                }
                Err(e) => {
                    let mut state = state_arc.lock().await;
                    *state = SandboxState::Error {
                        message: format!("Agent ready timeout: {}", e),
                    };
                    let _ = app_clone.emit("sandbox:state-changed", &*state);
                }
            }
        });

        Ok(())
    }

    /// 停止沙盒
    pub async fn stop(&self, app: &AppHandle) -> Result<(), String> {
        // 停止 NFS
        if let Some(ref mut nfs) = *self.nfs.lock().await {
            nfs.stop().await?;
        }
        *self.nfs.lock().await = None;

        // 断开通道
        *self.channel.lock().await = None;

        // 停止 QEMU
        if let Some(ref mut qemu) = *self.qemu.lock().await {
            qemu.shutdown().await?;
        }
        *self.qemu.lock().await = None;
        *self.agent_info.lock().await = None;

        self.set_state(app, SandboxState::Disabled).await;
        Ok(())
    }

    /// 重启沙盒
    pub async fn restart(&self, app: &AppHandle) -> Result<(), String> {
        self.stop(app).await?;
        self.config.lock().await.enabled = true;
        self.auto_start(app).await
    }

    /// 在沙盒中执行命令
    /// 如果沙盒处于 Starting 状态，会等待就绪后再执行（最多 60s）
    pub async fn exec(
        &self,
        command: &str,
        cwd: &str,
        timeout_secs: u32,
    ) -> Result<ExecResult, String> {
        // 检查状态，如果是 Starting 则等待
        {
            let state = self.state.lock().await;
            match &*state {
                SandboxState::Ready => {}
                SandboxState::Starting => {
                    drop(state);
                    // 等待就绪通知，最多 60s
                    let wait_result = tokio::time::timeout(
                        Duration::from_secs(60),
                        self.ready_notify.notified(),
                    )
                    .await;

                    if wait_result.is_err() {
                        return Err("Timeout waiting for sandbox to be ready".to_string());
                    }
                }
                SandboxState::Downloading { .. } | SandboxState::Installing => {
                    return Err(
                        "沙盒正在安装中，请稍后再试。安装完成后命令将自动可用。".to_string(),
                    );
                }
                SandboxState::Error { message } => {
                    return Err(format!("沙盒出错：{}。请在设置中重启沙盒。", message));
                }
                SandboxState::Disabled => {
                    return Err("沙盒已禁用。请在设置中启用沙盒后再试。".to_string());
                }
                SandboxState::NotInstalled => {
                    return Err("沙盒未安装。请重启应用以触发自动安装。".to_string());
                }
            }
        }

        // 获取通道并执行
        let mut channel_guard = self.channel.lock().await;
        let channel = channel_guard
            .as_mut()
            .ok_or_else(|| "Sandbox channel not connected".to_string())?;

        let request = ExecRequest {
            id: Uuid::new_v4().to_string(),
            req_type: "exec".to_string(),
            command: command.to_string(),
            cwd: cwd.to_string(),
            timeout: timeout_secs,
        };

        channel.exec(request).await
    }

    /// 获取当前状态
    pub async fn state(&self) -> SandboxState {
        self.state.lock().await.clone()
    }

    /// 获取 agent 信息
    pub async fn agent_info(&self) -> Option<AgentInfo> {
        self.agent_info.lock().await.clone()
    }

    /// 切换工作目录挂载
    pub async fn mount_workspace(
        &self,
        host_path: &str,
        _app: &AppHandle,
    ) -> Result<(), String> {
        let config = self.config.lock().await.clone();

        // 1. NFS 服务器切换导出目录
        let mut nfs_guard = self.nfs.lock().await;
        if let Some(ref mut nfs) = *nfs_guard {
            nfs.switch_export(host_path, &config).await?;
        } else {
            // 首次挂载，启动 NFS
            let nfs = NfsServer::start(host_path, &config).await?;
            *nfs_guard = Some(nfs);
        }
        drop(nfs_guard);

        // 2. 通知 VM 重新挂载
        let mut channel_guard = self.channel.lock().await;
        if let Some(ref mut channel) = *channel_guard {
            let request = ExecRequest {
                id: Uuid::new_v4().to_string(),
                req_type: "mount_workspace".to_string(),
                command: String::new(),
                cwd: String::new(),
                timeout: 30,
            };
            channel.exec(request).await?;
        }

        Ok(())
    }

    /// 清理 workspace（在 VM 内执行 rm -rf /workspace/*）
    pub async fn clean_workspace(&self) -> Result<(), String> {
        self.exec("rm -rf /workspace/*", "/", 30).await?;
        Ok(())
    }

    /// 启用/禁用沙盒
    pub async fn set_enabled(&self, enabled: bool, app: &AppHandle) -> Result<(), String> {
        if enabled {
            let mut config = self.config.lock().await;
            config.enabled = true;
            drop(config);
            self.auto_start(app).await
        } else {
            let mut config = self.config.lock().await;
            config.enabled = false;
            drop(config);
            self.stop(app).await
        }
    }
}

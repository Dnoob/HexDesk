use std::process::Stdio;

use tokio::process::{Child, Command};

/// NFS 服务器管理
pub struct NfsServer {
    process: Option<Child>,
    current_export: String,
}

impl NfsServer {
    /// 启动 NFS 服务器，导出指定工作目录
    pub async fn start(workspace_path: &str, config: &super::SandboxConfig) -> Result<Self, String> {
        let process = Self::start_nfs_process(workspace_path, config).await?;

        Ok(Self {
            process: Some(process),
            current_export: workspace_path.to_string(),
        })
    }

    /// 启动 NFS 服务器进程
    async fn start_nfs_process(
        workspace_path: &str,
        config: &super::SandboxConfig,
    ) -> Result<Child, String> {
        if cfg!(target_os = "windows") {
            Self::start_winnfsd(workspace_path, config).await
        } else {
            Self::start_nfsd_linux(workspace_path).await
        }
    }

    /// Windows: 启动内嵌的 WinNFSd
    async fn start_winnfsd(
        workspace_path: &str,
        config: &super::SandboxConfig,
    ) -> Result<Child, String> {
        let winnfsd = config.winnfsd_path();

        Command::new(&winnfsd)
            .arg("-addr")
            .arg("127.0.0.1")
            .arg("-port")
            .arg("2049")
            .arg(workspace_path)
            .arg("/workspace")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start WinNFSd: {}", e))
    }

    /// Linux/macOS: 使用 unfsd 或配置系统 NFS
    async fn start_nfsd_linux(workspace_path: &str) -> Result<Child, String> {
        // 使用 unfsd (user-space NFS server) 避免需要 root 权限
        // 如果 unfsd 不可用，回退到配置 /etc/exports
        let unfsd = which_unfsd().await;

        if let Some(unfsd_path) = unfsd {
            Command::new(unfsd_path)
                .arg("-d")               // 不 daemonize
                .arg("-e")               // 导出文件
                .arg(format!("/tmp/hexdesk-exports"))
                .arg("-n")               // NFS 端口
                .arg("2049")
                .arg("-m")               // mountd 端口
                .arg("2050")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start unfsd: {}", e))
        } else {
            // 回退：使用 nfs-kernel-server + exportfs
            // 写入 exports 文件
            let exports_line = format!(
                "{} 127.0.0.1(rw,sync,no_subtree_check,no_root_squash)\n",
                workspace_path
            );
            tokio::fs::write("/tmp/hexdesk-exports", &exports_line)
                .await
                .map_err(|e| format!("Failed to write exports: {}", e))?;

            // 尝试 exportfs -ra
            let output = Command::new("sudo")
                .args(["exportfs", "-ra"])
                .output()
                .await
                .map_err(|e| format!("Failed to run exportfs: {}", e))?;

            if !output.status.success() {
                return Err("Failed to configure NFS exports. Install unfsd or configure nfs-kernel-server.".to_string());
            }

            // 返回一个占位进程（nfsd 由 systemd 管理）
            Command::new("sleep")
                .arg("infinity")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start placeholder: {}", e))
        }
    }

    /// 切换导出目录（重启 NFS 服务器）
    pub async fn switch_export(
        &mut self,
        new_path: &str,
        config: &super::SandboxConfig,
    ) -> Result<(), String> {
        self.stop().await?;
        let process = Self::start_nfs_process(new_path, config).await?;
        self.process = Some(process);
        self.current_export = new_path.to_string();
        Ok(())
    }

    /// 停止 NFS 服务器
    pub async fn stop(&mut self) -> Result<(), String> {
        if let Some(ref mut process) = self.process {
            let _ = process.kill().await;
            let _ = process.wait().await;
        }
        self.process = None;
        Ok(())
    }

    /// 检查是否存活
    pub fn is_alive(&mut self) -> bool {
        if let Some(ref mut process) = self.process {
            match process.try_wait() {
                Ok(None) => true,
                _ => false,
            }
        } else {
            false
        }
    }

    /// 获取当前导出目录
    pub fn current_export(&self) -> &str {
        &self.current_export
    }
}

/// 查找 unfsd 二进制
async fn which_unfsd() -> Option<String> {
    let output = Command::new("which")
        .arg("unfsd")
        .output()
        .await
        .ok()?;

    if output.status.success() {
        Some(
            String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string(),
        )
    } else {
        None
    }
}

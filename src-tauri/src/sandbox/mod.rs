pub mod channel;
pub mod download;
pub mod manager;
pub mod nfs;
pub mod qemu;

use serde::{Deserialize, Serialize};

/// 沙盒状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum SandboxState {
    /// 未安装（首次使用）
    NotInstalled,
    /// 下载中
    Downloading { progress: f64 },
    /// 安装中
    Installing,
    /// QEMU 启动中
    Starting,
    /// 就绪，可执行命令
    Ready,
    /// 出错
    Error { message: String },
    /// 用户手动禁用
    Disabled,
}

/// 沙盒配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    /// 是否启用沙盒
    pub enabled: bool,
    /// VM 内存 (MB)
    pub memory_mb: u32,
    /// VM CPU 核数
    pub cpu_cores: u32,
    /// 镜像存储目录 (~/.hexdesk/vm/)
    pub vm_dir: String,
    /// 镜像下载 URL
    pub download_url: String,
}

impl Default for SandboxConfig {
    fn default() -> Self {
        let home = dirs::home_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        Self {
            enabled: true,
            memory_mb: 512,
            cpu_cores: 2,
            vm_dir: format!("{}/.hexdesk/vm", home),
            download_url: String::new(),
        }
    }
}

impl SandboxConfig {
    /// 镜像路径
    pub fn image_path(&self) -> String {
        format!("{}/ubuntu.img", self.vm_dir)
    }

    /// 内核路径
    pub fn kernel_path(&self) -> String {
        format!("{}/vmlinuz", self.vm_dir)
    }

    /// initrd 路径
    pub fn initrd_path(&self) -> String {
        format!("{}/initrd", self.vm_dir)
    }

    /// QEMU 二进制路径
    pub fn qemu_binary(&self) -> String {
        if cfg!(target_os = "windows") {
            format!("{}/qemu/qemu-system-x86_64.exe", self.vm_dir)
        } else {
            "qemu-system-x86_64".to_string()
        }
    }

    /// WinNFSd 路径 (仅 Windows)
    pub fn winnfsd_path(&self) -> String {
        format!("{}/winnfsd/WinNFSd.exe", self.vm_dir)
    }

    /// virtio-serial socket 地址
    pub fn serial_addr(&self) -> String {
        if cfg!(target_os = "windows") {
            "127.0.0.1:13500".to_string()
        } else {
            format!("{}/hexdesk-serial.sock", self.vm_dir)
        }
    }

    /// SHA256 校验文件路径
    pub fn checksum_path(&self) -> String {
        format!("{}/ubuntu.img.sha256", self.vm_dir)
    }
}

/// 命令执行请求 (Host → VM)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecRequest {
    pub id: String,
    #[serde(rename = "type")]
    pub req_type: String,
    pub command: String,
    pub cwd: String,
    pub timeout: u32,
}

/// 命令执行结果 (VM → Host)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub id: String,
    #[serde(rename = "type")]
    pub res_type: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

/// 流式输出 (VM → Host)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamOutput {
    pub id: String,
    #[serde(rename = "type")]
    pub output_type: String,
    pub channel: String,
    pub data: String,
}

/// Agent 就绪信号 (VM → Host)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    #[serde(rename = "type")]
    pub info_type: String,
    pub version: String,
    pub python: String,
    pub node: String,
}

/// 下载进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub speed: u64,
    pub phase: String,
}

/// VM 消息（统一解析入口）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum VmMessage {
    Ready {
        version: String,
        python: String,
        node: String,
    },
    Result {
        id: String,
        exit_code: i32,
        stdout: String,
        stderr: String,
        duration_ms: u64,
    },
    Stream {
        id: String,
        channel: String,
        data: String,
    },
}

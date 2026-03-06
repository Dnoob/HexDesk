use std::process::Stdio;

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use super::SandboxConfig;

/// QEMU 进程管理
pub struct QemuProcess {
    child: Child,
}

impl QemuProcess {
    /// 启动 QEMU（外部内核引导）
    pub fn start(config: &SandboxConfig) -> Result<Self, String> {
        let mut cmd = Command::new(&config.qemu_binary());

        // 基础参数
        cmd.arg("-m")
            .arg(format!("{}M", config.memory_mb))
            .arg("-smp")
            .arg(config.cpu_cores.to_string())
            .arg("-nographic");

        // 外部内核引导
        cmd.arg("-kernel")
            .arg(&config.kernel_path())
            .arg("-initrd")
            .arg(&config.initrd_path())
            .arg("-append")
            .arg("root=/dev/vda console=ttyS0");

        // virtio 磁盘
        cmd.arg("-drive")
            .arg(format!(
                "file={},format=qcow2,if=virtio",
                config.image_path()
            ));

        // 串口输出到 stdout
        cmd.arg("-serial").arg("stdio");

        // virtio-serial 命令通道
        cmd.arg("-device").arg("virtio-serial-pci");

        if cfg!(target_os = "windows") {
            // Windows: 使用 TCP socket
            cmd.arg("-chardev")
                .arg("socket,host=127.0.0.1,port=13500,server=on,wait=off,id=hexch");
        } else {
            // Linux/macOS: 使用 Unix socket
            let sock_path = config.serial_addr();
            cmd.arg("-chardev")
                .arg(format!(
                    "socket,path={},server=on,wait=off,id=hexch",
                    sock_path
                ));
        }

        cmd.arg("-device")
            .arg("virtserialport,chardev=hexch,name=hexdesk.0");

        // NAT 网络（NFS 通信用）
        cmd.arg("-netdev").arg("user,id=net0");
        cmd.arg("-device").arg("e1000,netdev=net0");

        // 写时复制，不修改原始镜像
        cmd.arg("-snapshot");

        // 配置 stdio
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.stdin(Stdio::null());

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to start QEMU: {}", e))?;

        Ok(Self { child })
    }

    /// 后台读取启动日志并 emit 到前端
    pub fn spawn_log_reader(&mut self, app: AppHandle) {
        if let Some(stdout) = self.child.stdout.take() {
            let reader = BufReader::new(stdout);
            tokio::spawn(async move {
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app.emit("sandbox:boot-log", &line);
                }
            });
        }
    }

    /// 关闭 QEMU
    pub async fn shutdown(&mut self) -> Result<(), String> {
        // 先尝试优雅关闭
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;
        Ok(())
    }

    /// 检查进程是否存活
    pub fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(None) => true,  // 仍在运行
            _ => false,        // 已退出或错误
        }
    }
}

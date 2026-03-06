# HexDesk 虚拟机沙盒 — 技术方案

## 1. 概述

为 HexDesk 集成 QEMU 虚拟机沙盒，提供完整的 Linux 执行环境（Python、Node、Shell 等），让 AI 的代码执行在隔离环境中运行，用户无需自行安装任何开发工具。

### 设计决策总结

| 项目 | 决策 | 备注 |
|------|------|------|
| 虚拟化 | QEMU（软件模拟，无需 KVM） | |
| Guest OS | Ubuntu 24.04 minimal | |
| 内核引导 | 外部 vmlinuz + initrd | 参考 QoderWork，启动更快更灵活 |
| 命令通信 | virtio-serial（直接内存通道） | |
| 文件共享 | NFS 挂载用户工作目录 | Windows 用内嵌 WinNFSd，仅挂载工作目录 |
| 启动日志 | -serial stdio（串口输出） | |
| 生命周期 | 常驻后台，默认启用 | |
| 镜像分发 | 首次启动自动后台下载（~500MB） | |
| 镜像格式 | qcow2 | 比 raw 省空间 |
| 启动策略 | 每次冷启动，不做快照恢复 | 简单可靠，~25s，app 启动后立即后台拉起 |
| 沙盒未就绪 | 阻塞等待，不降级到本地 | 命令排队等沙盒就绪后自动执行 |
| 用户体验 | 可见可管理（状态、日志、清理、重启） | |

## 2. 架构

```
+----------------------------------------------------------+
|  HexDesk (Tauri)                                         |
|                                                          |
|  +-----------------+    +-----------------------------+  |
|  |  前端 (React)    |    |  Rust 后端                   |  |
|  |                 |    |                             |  |
|  |  SandboxPanel   |<-> |  sandbox/                   |  |
|  |  - 安装进度      |    |  ├── manager.rs  (生命周期)  |  |
|  |  - 连接状态      |    |  ├── qemu.rs     (QEMU进程)  |  |
|  |  - 启动日志      |    |  ├── channel.rs  (通信)      |  |
|  |  - 清理/重启     |    |  ├── nfs.rs      (NFS管理)   |  |
|  |                 |    |  └── download.rs (镜像下载)   |  |
|  +-----------------+    +-----------------------------+  |
|                                |                         |
|                                | virtio-serial (命令)    |
|                                | -serial stdio (日志)    |
|                                |                         |
|  +----------------------------------------------------+  |
|  |  QEMU 进程                                          |  |
|  |  Ubuntu 24.04 minimal (外部内核引导)                 |  |
|  |                                                     |  |
|  |  hexdesk-agent (监听 /dev/vport0p1)                  |  |
|  |  ├── 接收命令 JSON                                    |  |
|  |  ├── 执行 shell/python/node                          |  |
|  |  ├── 返回结果 JSON                                    |  |
|  |  └── /workspace (NFS 挂载 → 宿主机工作目录)           |  |
|  |                                                     |  |
|  |  WinNFSd.exe / nfsd (宿主机)                         |  |
|  |    └── 仅导出用户选择的工作目录                        |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

### 文件共享方案：NFS 挂载工作目录

```
宿主机                                VM
WinNFSd.exe / nfsd
  ↓ 仅导出用户选择的工作目录
  ↓ 例如 D:\Projects\MyApp
  ↓ 监听 127.0.0.1
                                  hexdesk-nfs-mount.service
                                    ↓ 挂载到 /workspace
                                    ↓ AI 在此读写文件，宿主机实时可见
```

- **不是同步，是挂载** — VM 里的 `/workspace` 直接映射到宿主机工作目录，读写同一份文件
- **零拷贝、零延迟、零冲突** — 所有工具看到同一套文件
- **安全隔离** — 只暴露用户明确选择的工作目录，不像 QoderWork 共享整个磁盘
- **切换工作目录** — 用户切换时，卸载旧挂载，挂载新目录

为什么不用 SFTP：
- AI 通过 `write_file` 在宿主机写了 `process.py`，`execute_shell` 在 VM 里执行时找不到
- NFS 挂载后，所有文件工具和 shell 命令看到同一套文件，无需同步

为什么不共享整个磁盘（QoderWork 做法）：
- 共享整个磁盘破坏了沙盒的隔离意义 — VM 里的代码可以读写宿主机任意文件
- 只挂载工作目录 = 安全 + 方便的平衡

## 3. 首次启动流程（默认启用）

用户第一次打开 HexDesk 时，沙盒自动在后台安装和启动。

```
App 启动
  │
  ├── 立即后台拉起沙盒启动流程（用户看欢迎页时就在启动）
  │
  ├── 检查 ~/.hexdesk/vm/ubuntu.img 是否存在
  │
  ├── [不存在] ──→ 开始下载镜像
  │                  │
  │                  ├── 前端显示: "正在安装执行环境..."
  │                  ├── 显示下载进度条 (已下载/总大小)
  │                  ├── 下载完成 → 校验 SHA256
  │                  └── 校验通过 → 启动 QEMU
  │
  ├── [已存在] ──→ 直接启动 QEMU
  │
  ├── QEMU 启动中（~25 秒冷启动）
  │     ├── 前端显示: "正在启动沙盒..."
  │     ├── 实时显示启动日志（串口输出）
  │     └── 等待 agent 就绪信号
  │
  └── Agent 就绪
        ├── 前端显示: "沙盒已就绪" (绿色状态点)
        └── 挂载用户工作目录到 /workspace
```

### 启动等待时间

| 场景 | 等待时间 |
|------|----------|
| 首次打开 app | 下载镜像（几分钟）+ QEMU 启动（~25秒） |
| 之后每次打开 app | 仅 QEMU 启动（~25秒） |
| app 使用期间 | 0，常驻后台 |

App 启动后立刻后台拉起 QEMU，用户打字、看欢迎页的时候沙盒就在启动，大部分情况用户还没发第一条消息沙盒就好了。

### 沙盒未就绪时的命令处理

**策略：阻塞等待，不降级到本地执行。**

```
用户发消息 → AI 生成 shell 命令 → 检测沙盒状态
  │
  ├── [Ready] → 直接执行
  │
  ├── [Starting] → 等待就绪后自动执行（最多 60s）
  │                 ToolCallCard 显示: "沙盒启动中，命令将在就绪后自动执行..."
  │
  ├── [Downloading] → 提示: "沙盒正在安装，请稍后再试"
  │
  └── [Error] → 提示错误信息，建议重启沙盒
```

为什么不允许降级到本地：
- 用户以为有沙盒保护，实际跑在裸机上 — 安全预期被打破
- 本机没 Python 等环境，报错信息让人困惑（"装了沙盒为什么还报找不到 python？"）
- 沙盒崩溃时静默降级，用户完全不知道

**宁可让用户等 30 秒，不要让用户困惑。**

### 前端安装提示 UI

首次安装时，在聊天区域顶部或欢迎页显示一个非阻塞的横幅：

```
┌─────────────────────────────────────────────────┐
│  正在安装执行环境（首次使用需要下载约 500MB）       │
│  ████████████░░░░░░░░  58%  291MB / 500MB        │
│                                                   │
│  安装完成后，AI 将可以执行 Python、Node 等代码      │
│  当前仍可正常对话，代码执行功能安装后自动可用        │
└─────────────────────────────────────────────────┘
```

安装完成后变为：

```
┌─────────────────────────────────────────────────┐
│  ● 执行环境已就绪                                 │
└─────────────────────────────────────────────────┘
```

3 秒后自动消失。

## 4. 目录结构

```
~/.hexdesk/
├── vm/
│   ├── ubuntu.img          # 系统镜像（qcow2 格式，~500MB）
│   ├── vmlinuz             # 外部 Linux 内核
│   ├── initrd              # 外部 initramfs
│   ├── ubuntu.img.sha256   # 校验文件
│   ├── qemu/               # 内嵌的 QEMU 二进制（Windows: qemu-system-x86_64.exe）
│   └── winnfsd/            # 内嵌的 WinNFSd（仅 Windows）
│       └── WinNFSd.exe
├── workspace/              # Workspace 管理
│   └── {conversation_id}/  # 每个对话一个目录
│       ├── uploads/        # 用户上传的文件（非工作目录内的文件）
│       └── outputs/        # AI 产出的独立文件
├── config.json             # 沙盒配置（启用状态、内存分配等）
└── logs/
    └── sandbox.log         # 沙盒运行日志
```

## 5. QEMU 启动参数

```bash
qemu-system-x86_64 \
  -m 512M \                                    # 内存 512MB
  -smp 2 \                                     # 2 核 CPU
  -nographic \                                  # 无图形界面
  -kernel vmlinuz \                             # 外部 Linux 内核
  -initrd initrd \                              # 外部 initramfs
  -append "root=/dev/vda console=ttyS0" \       # 内核参数
  -drive file=ubuntu.img,format=qcow2,if=virtio \  # virtio 磁盘
  -serial stdio \                               # 串口输出到 stdout（启动日志）
  -device virtio-serial-pci \                   # virtio-serial 总线
  -chardev socket,path=/tmp/hexdesk-serial.sock,server=on,wait=off,id=hexch \
  -device virtserialport,chardev=hexch,name=hexdesk.0 \  # 命令通道
  -netdev user,id=net0 \                        # NAT 网络（NFS 通信用）
  -device e1000,netdev=net0 \                   # 网卡
  -snapshot                                     # 写时复制，不修改原始镜像
```

### 外部内核引导（参考 QoderWork）

不从 disk.img 内部引导，而是使用外部 `-kernel` + `-initrd`：
- 启动更快（跳过 bootloader）
- 可通过 `-append` 传递宿主机信息给 VM（工作目录路径等）
- 内核和镜像独立更新

### Windows 上的 QEMU

- 内嵌 `qemu-system-x86_64.exe` 到 `~/.hexdesk/vm/qemu/`
- 首次下载镜像时一并下载 QEMU 二进制（约 30MB）
- Windows 上 `-chardev` 用 `tcp` 替代 `unix socket`：
  `-chardev socket,host=127.0.0.1,port=13500,server=on,wait=off,id=hexch`

## 6. 通信协议（virtio-serial）

### 6.1 消息格式

```
[4 bytes: payload length (u32 big-endian)] [payload: JSON]
```

### 6.2 请求（Host → VM）

```json
{
  "id": "uuid-v4",
  "type": "exec",
  "command": "python3 -c \"print('hello')\"",
  "cwd": "/workspace",
  "timeout": 30
}
```

### 6.3 响应（VM → Host）

```json
{
  "id": "uuid-v4",
  "type": "result",
  "exit_code": 0,
  "stdout": "hello\n",
  "stderr": "",
  "duration_ms": 120
}
```

### 6.4 流式输出（VM → Host）

长时间运行的命令，实时推送输出：

```json
{
  "id": "uuid-v4",
  "type": "stream",
  "channel": "stdout",
  "data": "Processing item 3/100...\n"
}
```

### 6.5 Agent 就绪信号

VM 启动完成后，agent 发送：

```json
{
  "type": "ready",
  "version": "0.1.0",
  "python": "3.12.3",
  "node": "20.14.0"
}
```

Host 收到后标记沙盒为"已就绪"。

## 7. NFS 文件共享

### 7.1 Windows（内嵌 WinNFSd）

```
HexDesk 启动 → 启动 WinNFSd.exe
  ↓ 导出用户选择的工作目录
  ↓ WinNFSd.exe -addr 127.0.0.1 -port 2049 "D:\Projects\MyApp" /workspace
  ↓ 仅监听 localhost，外部不可访问
```

- WinNFSd 是轻量开源 Windows NFS 服务器（~1MB）
- 内嵌到 `~/.hexdesk/vm/winnfsd/`，随镜像一起下载
- 生命周期跟随 HexDesk 进程

### 7.2 Linux / macOS

使用系统自带的 NFS 服务或 user-space NFS server。

### 7.3 VM 内挂载

```ini
# /etc/systemd/system/hexdesk-nfs-mount.service
[Unit]
Description=HexDesk NFS Workspace Mount
After=network-online.target hexdesk-agent.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/mount -t nfs -o nolock,vers=3 10.0.2.2:/workspace /workspace
ExecStop=/bin/umount /workspace

[Install]
WantedBy=multi-user.target
```

`10.0.2.2` 是 QEMU NAT 模式下宿主机的默认地址。

### 7.4 工作目录切换

用户在输入框切换工作目录时：

1. Host 端：WinNFSd 重新导出新目录（或重启 WinNFSd 进程）
2. VM 端：通过 virtio-serial 发送 `mount_workspace` 命令
3. Agent 执行 `umount /workspace && mount -t nfs ...`
4. 完成后返回确认

## 8. VM 内 Agent 服务

### hexdesk-agent

一个轻量 Python 脚本，作为 systemd 服务运行：

```ini
# /etc/systemd/system/hexdesk-agent.service
[Unit]
Description=HexDesk Agent
After=multi-user.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hexdesk-agent
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Agent 职责：
1. 监听 `/dev/virtio-ports/hexdesk.0`
2. 解析 JSON 命令
3. 用 subprocess 执行命令（cwd 默认 `/workspace`）
4. 实时推送 stdout/stderr（流式）
5. 返回最终结果
6. 处理 `mount_workspace` 命令（切换工作目录挂载）

## 9. Rust 后端模块设计

### 9.1 `src-tauri/src/sandbox/mod.rs`

```rust
pub mod manager;
pub mod qemu;
pub mod channel;
pub mod nfs;
pub mod download;

/// 沙盒状态
pub enum SandboxState {
    NotInstalled,       // 未安装（首次使用）
    Downloading(f64),   // 下载中（进度 0.0-1.0）
    Installing,         // 安装中
    Starting,           // QEMU 启动中
    Ready,              // 就绪，可执行命令
    Error(String),      // 出错
    Disabled,           // 用户手动禁用
}
```

### 9.2 `sandbox/manager.rs` — 生命周期管理

```rust
pub struct SandboxManager {
    state: Arc<Mutex<SandboxState>>,
    qemu_process: Option<Child>,
    channel: Option<SandboxChannel>,
    nfs_server: Option<NfsServer>,
}

impl SandboxManager {
    /// App 启动时调用，自动检测并安装/启动沙盒
    pub async fn auto_start(app: &AppHandle) -> Result<(), String>;

    /// 停止沙盒（同时停止 NFS 服务器）
    pub async fn stop(&mut self) -> Result<(), String>;

    /// 重启沙盒
    pub async fn restart(&mut self, app: &AppHandle) -> Result<(), String>;

    /// 执行命令（核心接口）
    /// 如果沙盒处于 Starting 状态，会等待就绪后再执行（最多 60s）
    pub async fn exec(&self, command: &str, cwd: &str, timeout: u32)
        -> Result<ExecResult, String>;

    /// 获取当前状态
    pub fn state(&self) -> SandboxState;

    /// 切换工作目录挂载
    pub async fn mount_workspace(&self, host_path: &str) -> Result<(), String>;

    /// 清理 workspace 目录
    pub async fn clean_workspace(&self) -> Result<(), String>;
}
```

### 9.3 `sandbox/qemu.rs` — QEMU 进程管理

```rust
pub struct QemuProcess {
    child: Child,
    serial_rx: BufReader<ChildStdout>,  // 串口日志
}

impl QemuProcess {
    /// 启动 QEMU（外部内核引导），返回进程句柄
    pub fn start(config: &SandboxConfig) -> Result<Self, String>;

    /// 读取串口日志（启动过程）
    pub fn read_boot_log(&mut self) -> Option<String>;

    /// 关闭 QEMU
    pub fn shutdown(&mut self) -> Result<(), String>;

    /// 检查进程是否存活
    pub fn is_alive(&self) -> bool;
}
```

### 9.4 `sandbox/channel.rs` — virtio-serial 通信

```rust
pub struct SandboxChannel {
    stream: TcpStream,  // Windows: TCP socket; Linux: Unix socket
}

impl SandboxChannel {
    /// 连接到 virtio-serial 端口
    pub async fn connect(addr: &str) -> Result<Self, String>;

    /// 发送命令并等待结果
    pub async fn exec(&self, request: ExecRequest) -> Result<ExecResult, String>;

    /// 发送命令，流式接收输出
    pub async fn exec_stream(&self, request: ExecRequest,
        on_output: impl Fn(StreamOutput)) -> Result<ExecResult, String>;

    /// 等待 agent ready 信号
    pub async fn wait_ready(&self, timeout: Duration) -> Result<AgentInfo, String>;
}
```

### 9.5 `sandbox/nfs.rs` — NFS 服务器管理

```rust
pub struct NfsServer {
    process: Child,           // WinNFSd / nfsd 进程
    current_export: String,   // 当前导出的宿主机目录
}

impl NfsServer {
    /// 启动 NFS 服务器，导出指定工作目录
    pub fn start(workspace_path: &str) -> Result<Self, String>;

    /// 切换导出目录（重启 NFS 服务器）
    pub fn switch_export(&mut self, new_path: &str) -> Result<(), String>;

    /// 停止 NFS 服务器
    pub fn stop(&mut self) -> Result<(), String>;

    /// 检查是否存活
    pub fn is_alive(&self) -> bool;
}
```

### 9.6 `sandbox/download.rs` — 镜像下载

```rust
pub struct ImageDownloader;

impl ImageDownloader {
    /// 检查镜像是否已安装
    pub fn is_installed() -> bool;

    /// 下载镜像 + 内核 + QEMU 二进制 + WinNFSd，通过回调报告进度
    pub async fn download(
        on_progress: impl Fn(DownloadProgress),
    ) -> Result<(), String>;

    /// 校验镜像完整性
    pub fn verify_image(path: &str) -> Result<bool, String>;

    /// 获取镜像下载 URL（从 GitHub Release）
    pub fn get_download_url() -> String;
}

pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: u64,
    pub speed: u64,       // bytes/sec
    pub phase: String,    // "downloading_image" | "downloading_kernel" | "downloading_qemu" | "downloading_winnfsd" | "verifying"
}
```

## 10. IPC 命令（Tauri Commands）

```rust
// 获取沙盒状态
#[tauri::command]
async fn sandbox_get_state() -> SandboxState;

// 手动启动/停止
#[tauri::command]
async fn sandbox_start() -> Result<(), String>;

#[tauri::command]
async fn sandbox_stop() -> Result<(), String>;

// 重启
#[tauri::command]
async fn sandbox_restart() -> Result<(), String>;

// 在沙盒中执行命令（自动等待就绪）
#[tauri::command]
async fn sandbox_exec(command: String, cwd: String) -> Result<ExecResult, String>;

// 切换工作目录挂载
#[tauri::command]
async fn sandbox_mount_workspace(path: String) -> Result<(), String>;

// 清理工作空间
#[tauri::command]
async fn sandbox_clean_workspace() -> Result<(), String>;

// 禁用/启用沙盒
#[tauri::command]
async fn sandbox_set_enabled(enabled: bool) -> Result<(), String>;
```

### 前端监听事件

```typescript
// 沙盒状态变化
listen<SandboxState>("sandbox:state-changed", (event) => { ... })

// 下载进度
listen<DownloadProgress>("sandbox:download-progress", (event) => { ... })

// 启动日志
listen<string>("sandbox:boot-log", (event) => { ... })

// 命令流式输出
listen<StreamOutput>("sandbox:stream-output", (event) => { ... })
```

## 11. 前端模块设计

### 11.1 Store: `src/stores/sandbox.ts`

```typescript
interface SandboxState {
  status: "not_installed" | "downloading" | "installing" | "starting" | "ready" | "error" | "disabled"
  progress: { downloaded: number; total: number; speed: number } | null
  bootLog: string[]
  error: string | null
  agentInfo: { version: string; python: string; node: string } | null
}
```

### 11.2 组件

- **`SandboxBanner.tsx`** — 聊天区域顶部横幅，显示安装进度/就绪状态
- **`SandboxPanel.tsx`** — 设置页中的沙盒管理面板
  - 启用/禁用开关
  - 连接状态（IP、agent 版本、预装环境版本）
  - 启动日志查看器
  - 清理工作空间按钮
  - 重启沙盒按钮

## 12. executor.rs 改造

现有的 `execute_shell` 分支需要判断沙盒状态：

```rust
"execute_shell" => {
    let command = get_str(&arguments, "command")?;

    // 确认机制保持不变
    let approved = confirmation::request_confirmation(...).await?;
    if !approved {
        return Ok("用户拒绝了命令执行".to_string());
    }

    // 沙盒执行（阻塞等待就绪）
    let sandbox = app.state::<SandboxManager>();
    match sandbox.state() {
        SandboxState::Ready => {
            // 沙盒已就绪 → 在 VM 中执行
            let result = sandbox.exec(&command, "/workspace", 30).await?;
            Ok(format!(
                "exit code: {}\nstdout:\n{}\nstderr:\n{}",
                result.exit_code, result.stdout, result.stderr
            ))
        }
        SandboxState::Starting => {
            // 沙盒启动中 → 等待就绪后执行（最多 60s）
            // ToolCallCard 显示 "沙盒启动中，命令将在就绪后自动执行..."
            let result = sandbox.exec(&command, "/workspace", 30).await?;
            Ok(format!(
                "exit code: {}\nstdout:\n{}\nstderr:\n{}",
                result.exit_code, result.stdout, result.stderr
            ))
        }
        SandboxState::Downloading(_) | SandboxState::Installing => {
            Ok("沙盒正在安装中，请稍后再试。安装完成后命令将自动可用。".to_string())
        }
        SandboxState::Error(e) => {
            Ok(format!("沙盒出错：{}。请在设置中重启沙盒。", e))
        }
        SandboxState::Disabled => {
            Ok("沙盒已禁用。请在设置中启用沙盒后再试。".to_string())
        }
        SandboxState::NotInstalled => {
            Ok("沙盒未安装。请重启应用以触发自动安装。".to_string())
        }
    }
}
```

**注意：不再有本地降级执行路径。** 所有 shell 命令必须通过沙盒执行。

## 13. 镜像构建

### 预装内容

- Python 3.12 + pip
- Node.js 20 LTS + npm
- 常用 Python 包：numpy, pandas, requests, pillow, matplotlib
- 常用工具：git, curl, wget, jq, unzip
- hexdesk-agent 服务
- NFS client（nfs-common）

### 构建脚本（后续提供）

使用 `debootstrap` + `chroot` 或 Packer 构建最小化 Ubuntu 镜像：

1. debootstrap 安装 Ubuntu minimal
2. chroot 进去 apt install 需要的包 + nfs-common
3. 安装 hexdesk-agent 服务
4. 配置 hexdesk-nfs-mount 服务
5. 提取 vmlinuz 和 initrd 到外部
6. 清理缓存，压缩镜像
7. 转为 qcow2 格式

## 14. 安全设计

- VM 网络为 NAT 模式，外部无法直接访问 VM
- NFS 仅导出用户选择的工作目录，不暴露整台电脑
- NFS 服务器仅监听 127.0.0.1，不接受外部连接
- VM 内 agent 以普通用户运行，非 root
- `-snapshot` 参数：VM 的写操作不持久化到原始镜像，重启后恢复原始状态
- 不允许降级到本地执行 — 确保用户的安全预期不被打破

## 15. 实施计划

### 阶段一：基础设施（Rust 后端）
1. `sandbox/download.rs` — 镜像 + 内核 + QEMU + WinNFSd 下载 + 校验
2. `sandbox/qemu.rs` — QEMU 进程启动/停止/日志（外部内核引导）
3. `sandbox/channel.rs` — virtio-serial 通信
4. `sandbox/nfs.rs` — NFS 服务器管理（WinNFSd 启动/切换/停止）
5. `sandbox/manager.rs` — 生命周期管理 + 状态机 + 阻塞等待逻辑
6. IPC commands 注册

### 阶段二：VM 镜像
1. 构建 Ubuntu minimal 镜像（外部内核引导）
2. 编写 hexdesk-agent（Python 脚本）
3. 配置 systemd 服务（agent + NFS mount）
4. 测试通信链路 + NFS 挂载
5. 镜像压缩 + 上传到 GitHub Release

### 阶段三：前端 UI
1. `stores/sandbox.ts` — 状态管理
2. `SandboxBanner.tsx` — 安装进度横幅
3. `SandboxPanel.tsx` — 设置页管理面板
4. `executor.rs` 改造 — 阻塞等待沙盒就绪，无本地降级

### 阶段四：集成测试
1. Windows 端到端测试（WinNFSd + QEMU + NFS 挂载）
2. macOS 端到端测试
3. 网络异常处理（下载中断恢复等）
4. VM 异常恢复（崩溃自动重启）
5. 工作目录切换测试（NFS 重挂载）

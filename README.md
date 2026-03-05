# HexDesk

桌面级通用 AI 助手，支持自然语言驱动的文件操作、Shell 执行、文档生成，具备 Agent 自主执行能力。

基于 Tauri 2 + React 19 构建，本地优先，轻量安全。

## 功能

- 自然语言对话（流式输出、Markdown 渲染）
- 文件操作（读/写/搜索/列目录）
- Shell 命令执行
- 图片识别（多模态）
- 文档生成（Word / Excel / PDF）
- Agent 多步规划与自主执行
- Skills / 插件系统
- MCP 协议集成
- 定时任务
- 多 LLM Provider（MiniMax / OpenAI / DeepSeek）
- 操作确认机制，安全可控

## 下载

前往 [Releases](https://github.com/Dnoob/HexDesk/releases) 下载最新版本：

| 平台 | 格式 |
|------|------|
| Windows (x64) | `.msi` / `.exe` |
| macOS (Apple Silicon) | `.dmg` |

## 从源码构建

### 前置要求

- [Node.js](https://nodejs.org/) >= 22
- [pnpm](https://pnpm.io/) >= 10
- [Rust](https://rustup.rs/) (stable)
- Tauri 2 系统依赖：参考 [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)

### 构建步骤

```bash
git clone https://github.com/Dnoob/HexDesk.git
cd HexDesk
pnpm install
pnpm tauri dev    # 开发模式
pnpm tauri build  # 生产构建
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 后端 | Rust |
| 前端 | React 19 + TypeScript |
| UI | shadcn/ui + Tailwind CSS 4 |
| 状态管理 | Zustand |
| 数据存储 | SQLite |
| 构建工具 | Vite |

## 安全模型

- AI 只能操作用户授权的目录
- 危险命令（`rm -rf`、`format` 等）直接拦截
- 所有文件写入和 Shell 执行需用户确认

## License

MIT

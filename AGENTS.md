# HexDesk

桌面级通用 AI 助手，支持自然语言驱动的文件操作、Shell 执行、文档生成，具备 Agent 自主执行能力。

- Repo: https://github.com/Dnoob/HexDesk
- 文件引用使用仓库根目录相对路径（如 `src/main.ts:80`），禁止绝对路径。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 后端语言 | Rust |
| 前端框架 | React 19 |
| 前端语言 | TypeScript |
| UI 组件库 | shadcn/ui |
| 状态管理 | Zustand |
| 数据存储 | SQLite (tauri-plugin-sql) |
| 构建工具 | Vite |
| 包管理 | pnpm |
| LLM | MiniMax / OpenAI / DeepSeek（多 Provider） |

## 项目结构

```
HexDesk/
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── AGENTS.md
├── CLAUDE.md                → AGENTS.md（软链接）
│
├── src-tauri/                # Rust 后端（Cargo 管理）
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/         # Tauri 权限配置
│   └── src/
│       ├── main.rs           # 入口
│       ├── lib.rs            # Tauri setup + commands 注册
│       ├── state.rs          # 全局状态管理
│       ├── commands/          # IPC 命令（按功能分模块）
│       │   ├── mod.rs
│       │   ├── chat.rs       # 对话（含 Function Calling 循环）
│       │   ├── files.rs      # 文件操作
│       │   ├── shell.rs      # Shell 执行
│       │   ├── settings.rs   # 设置
│       │   ├── confirmation.rs # 操作确认（oneshot channel）
│       │   ├── documents.rs  # 文档生成（Word/Excel/PDF）
│       │   ├── mcp.rs        # MCP 服务器管理
│       │   └── scheduler.rs  # 定时任务
│       ├── llm/              # LLM 调用
│       │   ├── mod.rs
│       │   ├── provider.rs   # Provider trait + ChatMessage
│       │   └── openai_compatible.rs  # OpenAI 兼容 API（统一所有 Provider）
│       ├── tools/            # Agent 工具定义与执行
│       │   ├── mod.rs        # 工具定义（5 个内置工具）
│       │   └── executor.rs   # 工具执行器（含确认机制 + 工作目录限制）
│       ├── mcp/              # MCP 客户端
│       │   ├── mod.rs
│       │   ├── client.rs     # stdio JSON-RPC 通信
│       │   └── types.rs      # MCP 类型定义
│       └── db/               # 数据库
│           ├── mod.rs
│           └── migrations/   # SQL 迁移文件
│
├── src/                      # 前端（Vite + React）
│   ├── main.tsx              # 入口
│   ├── App.tsx
│   ├── app/                  # 全局配置
│   │   └── providers.tsx     # Provider 包装
│   ├── components/           # UI 组件
│   │   ├── chat/             # 对话组件
│   │   │   ├── ChatArea.tsx  # 对话区域 + 欢迎页
│   │   │   ├── ChatInput.tsx # 输入框（图片/Skills/Agent 模式/工作目录选择）
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem.tsx # 消息渲染（Markdown + think 过滤）
│   │   │   ├── ToolCallCard.tsx # 工具调用状态卡片
│   │   │   ├── AgentPlanCard.tsx # Agent 执行计划卡片
│   │   │   ├── ConfirmationCard.tsx # 操作确认弹窗
│   │   │   └── SkillsPanel.tsx # Skills 面板
│   │   ├── sidebar/          # 侧边栏（按日期分组）
│   │   ├── settings/         # 设置页（Tabs: 通用 + 定时任务）
│   │   └── ui/               # shadcn/ui 基础组件
│   ├── stores/               # Zustand stores
│   │   ├── chat.ts           # 对话 + SQLite 持久化
│   │   ├── settings.ts       # 设置（persist）
│   │   ├── ui.ts             # UI 状态
│   │   ├── confirmation.ts   # 操作确认
│   │   ├── skills.ts         # Skills 插件
│   │   ├── mcp.ts            # MCP 服务器
│   │   ├── scheduler.ts      # 定时任务
│   │   └── agent.ts          # Agent 模式
│   ├── hooks/                # 通用 hooks
│   ├── lib/                  # 工具函数
│   │   ├── utils.ts
│   │   └── tauri.ts          # IPC invoke 统一封装
│   └── types/                # TypeScript 类型定义
│
└── public/                   # 静态资源
```

## 架构

```
前端 (React + shadcn/ui)
    ↕ Tauri IPC (invoke / listen)
Rust 后端 (Tauri)
    ├── LLM 调用（MiniMax）
    ├── 工具执行（文件读写、搜索、Shell）
    ├── 数据库（SQLite）
    └── 安全控制（路径白名单、操作确认）
```

## 开发命令

```bash
pnpm install    # 安装前端依赖
pnpm tauri dev  # 开发模式（热更新）
pnpm tauri build # 生产构建
```

## 开发环境

- 开发目录：`/home/d/workspace/HexDesk`（WSL2）
- Windows 打包：`D:\Projects\HexDesk`
- WSLg 自动将 Tauri 窗口显示到 Windows 桌面

## 编码规范

- 语言：TypeScript (前端) + Rust (后端)，严格类型，禁止 `any` 和 `unwrap()`（除非有充分理由）。
- 前端格式化：Prettier + ESLint。
- Rust 格式化：`cargo fmt` + `cargo clippy`。
- 文件保持简洁，单文件不超过 500 行，超过则拆分。
- 非显而易见的逻辑加注释，不要过度注释。
- 组件命名 PascalCase，函数/变量 camelCase，Rust 遵循标准命名。
- 共享类型定义在 `src/types/` 中，Rust 和前端各维护一份但保持一致。

## 提交规范

- 使用 Conventional Commits：`feat:`, `fix:`, `refactor:`, `docs:`, `chore:` 等。
- 一个 commit 只做一件事，不混合无关改动。
- 提交消息简洁，描述"为什么"而非"做了什么"。

## 安全模型

### v1：权限确认 + 工作目录限制
- 用户在输入框选择工作目录，AI 只能操作该目录内的文件。
- 文件路径校验：相对路径自动解析到工作目录，绝对路径校验是否在范围内。
- Shell 命令默认 cwd 为工作目录。
- 危险命令（rm -rf、format 等）直接拦截。
- 所有文件写入和 Shell 执行需用户确认。

### v2（后续）：虚拟机沙盒
- 内嵌 QEMU + 预制 Linux 镜像，AI 在隔离 VM 中执行。
- 通过 SSH 通信，共享目录挂载用户授权的文件夹。
- 常驻运行，手动重置。

## 功能路线

### v1 — 核心体验 ✅
- ✅ 对话界面（流式输出）
- ✅ 文件操作（读/写/搜索/列目录）
- ✅ Shell 命令执行
- ✅ 操作确认机制
- ✅ 图片识别（多模态）
- ✅ 会话管理（创建/切换/删除）
- ✅ 设置页面（API Key、模型选择）

### v2 — 进阶功能 ✅
- ✅ 文档生成（Word/Excel/PDF）
- ✅ 定时任务
- ✅ Skills/插件系统
- ✅ MCP 集成
- ✅ 多 LLM Provider 支持

### v3 — 高级功能（进行中）
- ✅ Agent 多步规划与自主执行（prompt 驱动 plan-then-execute）
- ✅ 工作目录选择与限制（参考 QoderWork 设计）
- 🔲 虚拟机沙盒（QEMU 方案已确定，待实施）

## CI/CD

- GitHub Actions：`.github/workflows/build.yml`
- 触发方式：推送 `v*` tag 或手动 `workflow_dispatch`
- 构建平台：Windows (x86_64) + macOS (aarch64)
- 使用 `tauri-apps/tauri-action` 自动构建并创建 GitHub Release（Draft）

## 多 Agent 协作规则

本项目使用 Claude Code + Codex 协同开发：

- 不要创建/删除 git stash，其他 agent 可能在工作。
- 不要切换分支，除非明确要求。
- commit 只包含自己的改动，看到陌生文件不要管。
- push 前先 `git pull --rebase`，不要丢弃别人的工作。
- Codex 创建的分支使用 `codex/` 前缀命名。
- 遇到冲突时解决冲突，不要强制覆盖。

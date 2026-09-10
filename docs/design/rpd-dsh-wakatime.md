# RPD：DSH WakaTime 编码时间追踪插件

---

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| **产品代号** | dsh-wakatime |
| **目标版本** | v1.0.0 |
| **作者** | 待定 |
| **状态** | 草案 |
| **最后更新** | 2026-08-20 |

---

## 2. 背景与目标

### 2.1 问题描述

DSH 中的 AI 辅助编程活动无法被任何时间追踪工具记录。WakaTime 作为开发者最广泛使用的时间追踪服务，已有 VS Code、JetBrains、Vim 等数十种编辑器插件，但 DSH 作为新兴 AI 编程平台，目前没有任何对接方案。

| 现有方案 | 平台 | 追踪 DSH 活动 |
|---|---|---|
| WakaTime 编辑器插件 | VS Code / Vim / JetBrains 等 | ❌ 只监听编辑器事件 |
| dsh-codetime | DSH | ✅ 但对接的是 CodeTime（竞品） |
| dsh-timesheet | DSH | ❌ 仅本地报表，无外部同步 |
| dsh-worktime-board | DSH | ❌ 仅本地统计，无外部同步 |

**核心空白**：DSH 用户无法把 AI 辅助编程时间同步到 WakaTime 仪表盘。

### 2.2 产品目标

> 为 DSH 实现 WakaTime 心跳上报，让 AI 辅助编程活动像普通编码一样出现在 WakaTime 仪表盘中。

### 2.3 核心用户场景

| 场景 | 说明 |
|---|---|
| **场景 1：日常编码统计** | 用户在 DSH 中与 agent 协作编程，时间自动同步到 WakaTime |
| **场景 2：项目时间分配** | 用户查看 WakaTime 仪表盘，了解在各项目上花了多少时间（含 AI 协作） |
| **场景 3：团队时间汇总** | 团队管理者通过 WakaTime 团队视图，了解成员在 DSH 中的活跃时间 |
| **场景 4：AI 编码占比** | 用户区分"纯手写编码"和"AI 辅助编码"的时间比例 |

### 2.4 成功指标

| 指标 | 目标 |
|---|---|
| 安装量 | 上线 30 天内 200+ 安装 |
| 心跳成功率 | > 98%（网络正常时） |
| 用户配置成本 | < 2 分钟（拿到 API Key → 配置 → 看到数据） |
| 数据延迟 | < 5 分钟（从活动发生到 WakaTime 仪表盘可见） |

---

## 3. 功能需求

### 3.1 核心功能

#### 3.1.1 自动心跳上报

| 项目 | 说明 |
|---|---|
| **触发条件** | agent 处于 running 状态（即用户正在与 DSH 交互） |
| **心跳间隔 | 每 120 秒（WakaTime 推荐值，可在 60–300 秒间配置） |
| **API 端点** | `POST https://wakatime.com/api/v1/users/current/heartbeats` |
| **认证方式** | HTTP Basic Auth（API Key 作为用户名，密码留空） |

#### 3.1.2 心跳载荷

```json
{
  "entity": "/home/wujue/workspace/my-project/src/main.ts",
  "type": "file",
  "category": "ai coding",
  "time": 1724150400.000,
  "project": "my-project",
  "branch": "main",
  "language": "TypeScript",
  "is_write": false,
  "plugin": "dsh/0.1.0 dsh-wakatime/1.0.0"
}
```

| 字段 | 值 | 来源 |
|---|---|---|
| `entity` | 文件路径或 session ID | 最近操作的文件，无文件时用 session ID |
| `type` | `file` | 固定 |
| `category` | `ai coding` | WakaTime 新增的 AI 编码分类 |
| `time` | Unix 时间戳（毫秒精度） | 当前时间 |
| `project` | 项目名 | 从 `.git` 目录或 `package.json` 推断 |
| `branch` | 分支名 | `git branch --show-current` |
| `language` | 编程语言 | 从文件扩展名推断 |
| `is_write` | `false` | 心跳只表示活跃，不表示写入 |
| `plugin` | 插件标识 | `dsh/{version} dsh-wakatime/{version}` |

#### 3.1.3 项目名推断逻辑

```
1. 检查当前工作区是否有 .git 目录
   ├── 有 → 读取 git remote URL 中的项目名
   │         └── 无 remote → 使用 .git 所在目录名
   └── 无 → 检查 package.json 中的 name 字段
             ├── 有 → 使用 package name
             └── 无 → 使用当前工作区目录名
```

#### 3.1.4 状态机

```
┌─────────────────────────────────────────────────────────┐
│                    插件状态机                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────┐    agent/status=running    ┌──────────┐   │
│   │  IDLE   │ ─────────────────────────→ │ ACTIVE   │   │
│   │ (空闲)  │                             │ (活跃)   │   │
│   └─────────┘                             └──────────┘   │
│        ↑                                       │        │
│        │          agent/status=idle             │        │
│        └───────────────────────────────────────┘        │
│                                                         │
│   IDLE 状态：不发送心跳                                   │
│   ACTIVE 状态：每 120 秒发送一次心跳                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 配置项

| 配置键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `api_key` | string | `""` | WakaTime API Key（必填） |
| `api_url` | string | `https://wakatime.com` | API 基地址（用于自托管 WakaTime） |
| `heartbeat_interval_ms` | number | `120000` | 心跳间隔（毫秒，60000–300000） |
| `project_name` | string | `""` | 手动覆盖项目名（空则自动推断） |
| `language` | string | `""` | 手动覆盖语言（空则自动推断） |
| `include_tool_calls` | boolean | `true` | 是否追踪工具调用（bash、read、write 等） |
| `debug` | boolean | `false` | 是否输出调试日志 |

### 3.3 配置来源优先级

```
1. cordis.patch.yml 中的 config 块（最高优先级）
2. 环境变量（WAKATIME_API_KEY）
3. ~/.wakatime.cfg 中的 api_key（WakaTime 标准配置）
4. 插件 schema 默认值（最低优先级）
```

---

## 4. 非功能需求

### 4.1 性能

| 指标 | 要求 |
|---|---|
| 心跳发送延迟 | < 100ms（本地 HTTP 请求） |
| 内存占用 | < 10MB（每 session） |
| CPU 占用 | 可忽略（仅在状态变更和定时器触发时工作） |
| 网络流量 | < 1KB/分钟（心跳载荷约 200 字节，每 2 分钟一次） |

### 4.2 可靠性

| 场景 | 行为 |
|---|---|
| 网络中断 | 心跳发送失败时静默丢弃，下次成功时补发（不堆积） |
| API 限流（429） | 自动退避，30 秒后重试 |
| API 认证失败（401） | 停止发送，日志警告，每 5 分钟重试一次 |
| 进程退出 | 发送最后一个心跳（graceful shutdown） |
| 多 session | 每个 session 独立计时，互不干扰 |

### 4.3 安全

| 项目 | 要求 |
|---|---|
| API Key 存储 | 不落盘，仅存在于进程内存和 cordis 配置 |
| 网络传输 | HTTPS only |
| 日志脱敏 | API Key 在日志中显示为 `waka_****最后4位` |
| 本地数据 | 不落本地文件，纯透传 |

### 4.4 兼容性

| 项目 | 要求 |
|---|---|
| DSH 版本 | 兼容当前 mainline（peer dependency 锁定） |
| WakaTime API | v1（稳定版） |
| 自托管 WakaTime | 支持（通过 `api_url` 配置） |
| 与其他插件 | 与 dsh-codetime 互斥（都是 telemetry backend） |

---

## 5. 技术架构

### 5.1 包结构

```
dsh-wakatime/
├── src/
│   ├── index.ts              # 插件入口：注册 + 监听事件
│   ├── wakatime.ts           # WakaTime HTTP 客户端
│   ├── project.ts            # 项目名推断逻辑
│   ├── settings.ts           # 配置 schema 与注册
│   └── types.ts              # 类型定义
├── lib/                      # 编译产物
│   ├── index.js
│   ├── wakatime.js
│   ├── project.js
│   ├── settings.js
│   └── types.d.ts
├── cordis.patch.yml          # bundle patch
├── package.json
├── tsconfig.json
└── README.md
```

### 5.2 依赖关系

```
dsh-wakatime
    │
    ├── @deepseek-ai/cordis (peer)          ← Cordis 插件框架
    ├── @deepseek-ai/dsh-session (peer)     ← 会话事件类型
    ├── @deepseek-ai/dsh-agent (peer)       ← agent 状态事件
    └── @deepseek-ai/schemastery (peer)     ← 配置 schema
```

### 5.3 核心实现

#### 5.3.1 插件入口（index.ts）

```typescript
import type { Context } from '@deepseek-ai/cordis';
import type { Session } from '@deepseek-ai/dsh-session';
import Schema from '@deepseek-ai/schemastery';
import { WakaTimeClient } from './wakatime.js';
import { resolveProject } from './project.js';
import { registerWakaTimeSettings, WAKATIME_NAMESPACE } from './settings.js';

export const name = 'dsh-wakatime';
export const inject = ['sessions'];

export const Config = Schema.object({
  api_key: Schema.string().required(),
  api_url: Schema.string().default('https://wakatime.com'),
  heartbeat_interval_ms: Schema.natural().min(60000).max(300000).default(120000),
  project_name: Schema.string().default(''),
  language: Schema.string().default(''),
  include_tool_calls: Schema.boolean().default(true),
  debug: Schema.boolean().default(false),
});

interface SessionState {
  lastHeartbeat: number;
  project: string | null;
  language: string | null;
  timer: NodeJS.Timeout | null;
}

export function apply(ctx: Context, config: typeof Config.infer): void {
  const client = new WakaTimeClient(config);
  const states = new WeakMap<Session, SessionState>();

  // 注册 settings 命名空间（可选，用于 WebUI 配置）
  ctx.inject(['settings'], (settingsCtx) => {
    registerWakaTimeSettings(settingsCtx, config);
  });

  const getOrCreateState = (session: Session): SessionState => {
    let state = states.get(session);
    if (!state) {
      state = { lastHeartbeat: 0, project: null, language: null, timer: null };
      states.set(session, state);
    }
    return state;
  };

  const sendHeartbeat = async (session: Session): Promise<void> => {
    const state = getOrCreateState(session);
    const now = Date.now();

    // 推断项目名和语言（缓存，每 session 只推断一次）
    if (!state.project) {
      state.project = config.project_name || await resolveProject(session.cwd);
    }
    if (!state.language) {
      state.language = config.language || resolveLanguage(session);
    }

    try {
      await client.sendHeartbeat({
        time: now / 1000,
        project: state.project || undefined,
        language: state.language || undefined,
        entity: `dsh-session-${session.id}`,
        type: 'file',
        category: 'ai coding',
        is_write: false,
      });
      state.lastHeartbeat = now;
    } catch (error) {
      if (config.debug) {
        ctx.logger.warn(`dsh-wakatime: heartbeat failed: ${error}`);
      }
    }
  };

  const startHeartbeatTimer = (session: Session): void => {
    const state = getOrCreateState(session);
    if (state.timer) return;
    state.timer = setInterval(() => {
      void sendHeartbeat(session);
    }, config.heartbeat_interval_ms);
  };

  const stopHeartbeatTimer = (session: Session): void => {
    const state = states.get(session);
    if (state?.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  };

  // 监听 agent 状态变更
  ctx.on('agent/status', ({ session, status }) => {
    if (status === 'running') {
      startHeartbeatTimer(session);
    } else {
      stopHeartbeatTimer(session);
      // agent idle 时发送最后一个心跳
      void sendHeartbeat(session);
    }
  });

  // 清理
  ctx.effect(() => () => {
    for (const [session] of states.entries()) {
      stopHeartbeatTimer(session);
    }
  });
}
```

#### 5.3.2 WakaTime HTTP 客户端（wakatime.ts）

```typescript
interface HeartbeatPayload {
  entity: string;
  type: 'file' | 'domain' | 'app';
  category: 'coding' | 'ai coding' | 'building' | 'debugging' | 'browsing';
  time: number;
  project?: string;
  branch?: string;
  language?: string;
  is_write: boolean;
}

export class WakaTimeClient {
  private apiKey: string;
  private baseUrl: string;
  private userAgent: string;

  constructor(config: { api_key: string; api_url: string }) {
    this.apiKey = config.api_key;
    this.baseUrl = `${config.api_url}/api/v1`;
    this.userAgent = `dsh/${DSH_VERSION} dsh-wakatime/${PLUGIN_VERSION}`;
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<void> {
    const response = await fetch(`${this.baseUrl}/users/current/heartbeats`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(this.apiKey + ':')}`,
        'Content-Type': 'application/json',
        'User-Agent': this.userAgent,
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 401) {
      throw new Error('WakaTime API Key 无效，请检查配置');
    }
    if (response.status === 429) {
      throw new Error('WakaTime API 限流，稍后重试');
    }
    if (!response.ok) {
      throw new Error(`WakaTime API 错误: ${response.status}`);
    }
  }
}
```

#### 5.3.3 项目推断（project.ts）

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

export async function resolveProject(cwd: string): Promise<string> {
  // 1. 尝试从 git remote 获取
  if (existsSync(join(cwd, '.git'))) {
    try {
      const remote = execSync('git remote get-url --push origin', {
        cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      const match = remote.match(/\/([^\/]+?)(?:\.git)?$/);
      if (match) return match[1];
    } catch { /* ignore */ }

    // 2. 尝试从 git 目录名获取
    try {
      const root = execSync('git rev-parse --show-toplevel', {
        cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
      return root.split('/').pop() || 'unknown';
    } catch { /* ignore */ }
  }

  // 3. 尝试从 package.json 获取
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch { /* ignore */ }
  }

  // 4. 使用目录名
  return cwd.split('/').pop() || 'unknown';
}
```

### 5.4 Cordis Patch

```yaml
# dsh-wakatime bundle patch
- insert:
    - id: dsh-wakatime
      name: 'dsh-wakatime'
      config:
        api_key: !!js process.env.WAKATIME_API_KEY || ''
        api_url: !!js process.env.WAKATIME_API_URL || 'https://wakatime.com'
        heartbeat_interval_ms: 120000
        project_name: ''
        language: ''
        include_tool_calls: true
        debug: false
```

---

## 6. 与现有插件对比

| 维度 | dsh-codetime | dsh-timesheet | dsh-worktime-board | **dsh-wakatime** |
|---|---|---|---|---|
| **外部同步** | ✅ codetime.dev | ❌ 仅本地 | ❌ 仅本地 | ✅ wakatime.com |
| **仪表盘** | ✅ CodeTime | ❌ 终端报表 | ✅ Web UI | ✅ WakaTime |
| **AI 编码分类** | ✅ | ❌ | ❌ | ✅ `ai coding` |
| **项目推断** | ✅ | ✅ | ✅ | ✅ |
| **团队视图** | ✅ | ❌ | ❌ | ✅ |
| **配置复杂度** | 低 | 低 | 中 | 低 |
| **依赖 WakaTime 账户** | ❌ | ❌ | ❌ | ✅ |

---

## 7. 版本规划

### v1.0.0（MVP）

| 功能 | 优先级 |
|---|---|
| 基础心跳上报（agent running 时每 2 分钟发送） | P0 |
| 项目名自动推断（git / package.json / 目录名） | P0 |
| API Key 配置（环境变量 + cordis.patch.yml） | P0 |
| 状态机（idle ↔ active 切换） | P0 |
| 错误处理（401/429/网络中断） | P0 |
| 调试日志模式 | P1 |

### v1.1.0（增强）

| 功能 | 优先级 |
|---|---|
| WebUI 配置面板（Settings → WakaTime） | P1 |
| 语言自动推断（从文件扩展名） | P1 |
| 分支名追踪 | P1 |
| 自托管 WakaTime 支持 | P2 |
| 心跳批量发送（减少请求数） | P2 |

### v2.0.0（高级）

| 功能 | 优先级 |
|---|---|
| 工具调用追踪（区分 read/write/bash） | P2 |
| 文件级追踪（心跳 entity 改为具体文件路径） | P2 |
| 会话标签（在 WakaTime 中区分不同 DSH 会话） | P3 |
| 心跳本地缓存（网络恢复后补发） | P3 |

---

## 8. 验收标准

### 8.1 功能验收

| 编号 | 场景 | 预期 |
|---|---|---|
| AC-01 | 配置有效 API Key，启动 DSH | 插件加载成功，日志显示 "dsh-wakatime: loaded" |
| AC-02 | 与 agent 对话（agent running） | 每 2 分钟发送一次心跳，WakaTime 仪表盘可见 |
| AC-03 | agent 进入 idle | 停止发送心跳，发送最后一个心跳 |
| AC-04 | 无 API Key 或 Key 无效 | 插件加载但不上报，日志警告 |
| AC-05 | 网络中断 | 心跳发送失败时静默丢弃，不崩溃 |
| AC-06 | 多 session 同时活跃 | 每个 session 独立计时，互不干扰 |
| AC-07 | 项目名推断 | 正确识别 git 项目名 / package name / 目录名 |
| AC-08 | 进程退出 | 发送最后一个心跳（graceful shutdown） |

### 8.2 性能验收

| 编号 | 场景 | 预期 |
|---|---|---|
| AC-10 | 连续使用 1 小时 | 内存增长 < 5MB，CPU 占用 < 0.1% |
| AC-11 | 网络延迟 200ms | 心跳发送不阻塞主进程 |
| AC-12 | 100 个 session 同时活跃 | 每个 session 独立运行，无串扰 |

### 8.3 兼容性验收

| 编号 | 场景 | 预期 |
|---|---|---|
| AC-20 | 与 dsh-codetime 同时安装 | 互斥提示，用户需二选一 |
| AC-21 | 与 dsh-suggest-ghost 同时安装 | 正常工作，互不干扰 |
| AC-22 | 自托管 WakaTime | 通过 api_url 配置正常工作 |

---

## 9. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|---|---|---|---|
| WakaTime API 变更 | 低 | 高 | 锁定 API v1，peer dependency 范围 |
| API Key 泄露 | 低 | 高 | 不落盘、日志脱敏、仅内存存储 |
| 心跳过于频繁被限流 | 中 | 中 | 默认 2 分钟间隔，429 自动退避 |
| 项目推断错误 | 中 | 低 | 允许手动覆盖 project_name |
| 与 dsh-codetime 冲突 | 高 | 中 | 文档说明互斥，安装时检测并提示 |

---

## 10. 术语表

| 术语 | 定义 |
|---|---|
| `heartbeat` | WakaTime 心跳，一次编码活动记录 |
| `entity` | 心跳关联的实体（文件、域名或应用） |
| `category` | 活动分类（coding / ai coding / building 等） |
| `project` | 项目名，用于在 WakaTime 中分组 |
| `session` | DSH 会话，一个持续的对话上下文 |
| `agent status` | agent 运行状态（running / idle） |

---

## 附录：WakaTime API 参考

### 心跳 API

```
POST /api/v1/users/current/heartbeats
Authorization: Basic base64(api_key:)
Content-Type: application/json

{
  "entity": "/path/to/file",
  "type": "file",
  "category": "ai coding",
  "time": 1724150400.000,
  "project": "my-project",
  "language": "TypeScript",
  "is_write": false
}
```

### 响应码

| 状态码 | 含义 |
|---|---|
| 201 | 心跳创建成功 |
| 202 | 心跳已接受，异步处理 |
| 401 | API Key 无效 |
| 429 | 请求过于频繁 |
| 500 | 服务器错误 |

### 认证方式

WakaTime 支持两种认证：
1. **HTTP Basic Auth**：用户名 = API Key，密码留空
2. **Query String**：`?api_key=YOUR_API_KEY`（不推荐，安全性低）

本插件使用 HTTP Basic Auth。

# README 素材采集工具

重新生成 `docs/` 里的 README 截图与 GIF（在**线上 DSH web 实例**里真实操作插件 UI 采集，非 mock）。

## 素材清单

| 文件 | 内容 | 采集方式 |
|---|---|---|
| `docs/media/screenshot-panel.png` | 定时面板（快捷时段 / 自定义时间 / 已设定列表） | 元素截图（2x） |
| `docs/media/screenshot-dock.png` | 待发送 dock + 输入框（倒计时中段，进度条可见） | 固定区域裁剪（2x） |
| `docs/media/screenshot-fired.png` | 到期「⏰ 定时提醒」消息块 | 真实触发后全页裁剪 |
| `docs/media/docs-scheduler-create.gif` | 输入 → 面板 → 加入 → dock | 7 帧分镜 + ffmpeg palette |
| `docs/media/docs-scheduler-fired.gif` | 倒计时跳动 → 注入行 + toast → 定时提醒消息 | 1fps 连续采帧 + 变速合成 |

中英 README 共用同一组素材（`README.md` / `README.en.md`）。

## 使用

前提：

- dsh web 运行于 `127.0.0.1:3080`，本插件已装入 web profile；
- `ffmpeg`、ImageMagick `convert`；
- playwright 库（脚本默认复用全局 `@playwright/mcp` 内置的，路径见 `capture-all.cjs` 顶部 `PW` 常量）；
- 会在 scheduler-plugin 工作区新建演示会话并发送一条「你好」建立对话布局（其余操作不触发模型；到期触发会唤醒模型做一次短回复）。

```sh
cd scripts/capture

# 1) 采集（约 6-8 分钟，含等待 4 分钟定时到期）
node capture-all.cjs --out /tmp/ss-out

# 2) 合成（第三个参数 = 采集日志里的注入帧号 INJ；第四步裁剪区看采集日志提示）
./assemble.sh /tmp/ss-out 87 850,1058,1500,142
```

完成后把 `/tmp/ss-out/` 里的产物覆盖到 `docs/`，并核对两份 README 的说明文字是否与当前 UI 文案一致。

## 采过的坑（改脚本前先读）

- **dock 行内三个按钮的语义**：编辑 ✎ / 删除 🗑 / **插话发送 ↑**。清理任务只能点 `[aria-label="删除提醒"]`；点错「插话发送」会把提醒立刻 steer 进 agent 并唤醒模型（`aria-label`：`编辑提醒` / `删除提醒` / `插话发送`）。
- **contenteditable 输入框**不能用 `fill('')` 清空（受控组件会回填旧值导致文字翻倍），用 Ctrl/Cmd+A + Backspace 并校验 `innerText` 长度。
- **到期检测**：注入行文案是「上下文注入 · 定时提醒 · HH:MM · 内容」，用户可见消息由模型随后呈现为「⏰ 定时提醒」+ 引用块——不要拿旧文案「定时提醒到点」做检测。
- **面板时间输入**默认带分段选中态（蓝色高亮），截图前点一下 `.ss-panel-title` 失焦。
- **进度条**：dock 底部有倒计时进度条，任务刚创建时≈0（视觉上像残影），在倒计时中段（T-100s 左右）截 dock 最好看。
- **共享 Playwright MCP 浏览器**别用——其它 DSH 会话可能同时在操控它（语言/页面会被切走）；本目录脚本每次自起独立 headless 实例。
- 鉴权 cookie 用 `mint-cookie.cjs` 从 `~/.dsh/.credentials.yaml` 的 `client-connection/browser-session` secret 现铸（2 小时有效），secret 不要提交进仓库。

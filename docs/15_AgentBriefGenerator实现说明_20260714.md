# Agent Brief Generator 实现说明（2026-07-14）

## 目标

Agent Brief Generator 是 Agent 工作流工具箱的第二个 P0 工具。它不做普通 Prompt 优化，而是把用户的任务目标整理成 Agent 可执行的任务资产：brief、规则片段、Issue 草稿、验收标准和验证命令。

## 用户问题

2026 年的 Agent 使用痛点不再是“不会写一句 prompt”，而是：

- 任务边界不清，Agent 容易扩大范围；
- 验收标准缺失，Agent 声称完成但无法验证；
- 不知道如何写 Codex / Claude Code / Cursor / Cline 可执行的任务说明；
- 缺少“不要做什么”的约束；
- 缺少测试命令和最终报告要求。

## 当前 MVP

页面：`/agent-brief.html`

已实现：

- 输入任务标题、项目类型、目标 Agent、任务目标、上下文；
- 输入约束、交付物、验收标准、验证命令、不做事项；
- 生成：
  - Agent Brief；
  - Agent Rules Snippet；
  - Issue 草稿；
  - 完整任务包；
- 支持复制和下载 Markdown；
- 全程浏览器本地运行，不调用 API。

## 架构

```text
src/agent-brief.html
  |
  |-- 表单与输出区域
  v
src/agent-brief.js
  |
  |-- DOM 编排
  |-- 收集输入
  |-- 切换输出视图
  |-- 复制 / 下载
  v
src/core/agent-brief.js
  |
  |-- normalizeInput
  |-- buildAgentBrief
  |-- 项目类型 preset
  |-- brief / rules / issue 生成
```

## 项目类型 preset

当前支持：

- `code`：通用代码库；
- `web`：Web / 前端；
- `worker`：Cloudflare Worker；
- `docs`：文档 / PRD。

每个 preset 提供默认验证命令和风险约束。

## 隐私与安全边界

- 不上传任务内容；
- 不调用模型；
- 不需要 API Key；
- 不存储到服务器；
- 用户自行决定是否把输出发给 Agent。

## 与 Prompt 库的区别

普通 Prompt 库输出的是一段可复制文本。Agent Brief Generator 输出的是更完整的任务资产：

- 目标；
- 上下文；
- 约束；
- 交付物；
- 执行步骤；
- 验收标准；
- 验证命令；
- 不做事项；
- Issue 草稿。

这更适合 Codex、Claude Code、Cursor、Cline 等 Agent 工作流。

## 测试

新增 `test-agent-brief.js`，覆盖：

- brief 标题生成；
- preset label；
- 自定义约束；
- 验证命令；
- rules snippet；
- issue draft；
- combined 输出；
- 未知项目类型 fallback。

## 后续优化

低成本高价值后续项：

1. 增加 Agent 专用导出：`AGENTS.md`、`CLAUDE.md`、Cursor Rules；
2. 与 Context Pack Builder 联动，允许把上下文摘要粘贴进 brief；
3. 增加“PRD / Issue / Test Spec”三种输出模板；
4. 增加本地历史记录和收藏，但必须只用 localStorage。

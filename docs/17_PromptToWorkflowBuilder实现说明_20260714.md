# Prompt-to-Workflow Builder 实现说明（2026-07-14）

## 目标定位

Prompt-to-Workflow Builder 是 Agent Workflow Toolbox 的 P1 工具，用来解决“用户只有一段自然语言需求，但缺少可复用执行流程”的问题。

它不是普通 prompt 润色器，也不是 Prompt 卡片库。它把一次性需求抽象为可复用资产：触发条件、输入、约束、执行步骤、输出物、质量门禁、Checklist 和 Skill 草稿。

## 核心价值

- **从文本到流程**：把单次需求转为可反复执行的 Agent workflow。
- **减少跑偏**：强制输出触发条件、边界、约束和质量门禁。
- **支持复用**：生成 Workflow、Checklist、Skill Draft 三种视图。
- **本地隐私边界**：所有需求和上下文只在浏览器本地处理，不上传、不调用模型、不要求 API Key。
- **面向 2026 Agent 生态**：避免停留在 prompt 美化，转向 skill / agent / workflow 资产化。

## 文件结构

```text
src/workflow.html                 工具页面
src/workflow.js                   页面交互、复制、下载
src/tools/workflow.css            页面样式
src/core/workflow-builder.js      纯函数工作流生成内核
test-workflow-builder.js          Node 回归测试
```

## 运行机制

```text
输入原始需求 / 任务类型 / 约束 / 输出物 / 质量门禁
  |
  v
src/workflow.js
  |-- 收集表单输入
  |-- 调用 WorkflowBuilder.buildWorkflow
  |-- 切换 combined / workflow / checklist / skillDraft 视图
  v
src/core/workflow-builder.js
  |-- normalizeInput
  |-- inferTrigger
  |-- inferInputs
  |-- inferSteps
  |-- inferOutputs
  |-- inferGates
  v
复制 / 下载 Markdown
```

## 任务类型 preset

当前内置四类低成本 preset：

- `code`：代码 / 工程任务；
- `docs`：文档 / PRD 任务；
- `ops`：部署 / 运维任务；
- `research`：调研 / 选型任务。

每类 preset 只提供默认质量门禁和输出物，不做复杂编排，避免工具过重。

## 设计取舍

### 为什么不做 prompt 改写

普通 prompt 改写在 2026 年已经高度同质化，且容易被 skill、agent、workflow 平台替代。本工具聚焦“流程资产化”，输出可以直接进入团队 SOP、Issue、Agent Skill 草稿或交接文档。

### 为什么不联网拉取 GitHub 模板

当前项目坚持 local-first 和 `connect-src 'none'`。自动拉取外部模板会引入供应链、隐私和可用性问题。后续如需引入开源模板，应优先以人工审核后的静态模板内置，而不是运行时联网抓取。

### 为什么不生成完整 Skill 目录

不同 Agent 平台的 skill / workflow 目录结构差异较大，当前 MVP 只输出可复制的 Skill Draft Markdown，保持低成本、低耦合、可维护。

## 中文注释原则

已在 `src/core/workflow-builder.js` 中注释：

- 本地处理和不外发敏感上下文的隐私边界；
- 为什么输出必须包含质量门禁，避免退化为 prompt 美化。

## 验证覆盖

`test-workflow-builder.js` 覆盖：

- workflow 标题生成；
- 任务类型 preset 生效；
- 自定义约束和质量门禁保留；
- 运维类步骤包含预检 / 回滚语义；
- checklist、skill draft、combined 输出可用；
- 未知任务类型回退到 `code`。

## 后续可选增强

暂不实现但可后续评估：

- 用户自定义 preset 本地导入 / 导出；
- 从 Agent Brief 一键带入上下文；
- 输出 `.codex/skills`、Claude Skill 或 GitHub Issue 模板的多平台变体；
- 静态内置少量高质量 workflow 模板库。

这些增强必须继续保持本地处理，不应默认放宽 `connect-src 'none'`。

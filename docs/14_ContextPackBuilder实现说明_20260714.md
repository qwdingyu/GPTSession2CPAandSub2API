# Context Pack Builder 实现说明（2026-07-14）

## 目标

Context Pack Builder 是 2026 视角下 Agent 工作流工具箱的第一个 P0 增量工具。它解决的问题是：用户想让 Codex、Claude Code、Cursor、Cline 等 Agent 理解一个本地项目，但不知道该给哪些文件、如何过滤无关内容、如何组织成可读上下文。

## 功能范围

当前 MVP 已实现：

- 选择本地文件夹；
- 浏览器本地读取文本文件；
- 跳过 `.git`、`node_modules`、构建目录、lock 文件、图片、压缩包、二进制等；
- 输出目录树；
- 合并文本内容为 Markdown；
- 估算文本大小和粗略 token 数；
- 预览前 8000 字；
- 复制 Markdown；
- 下载 `ai-context-pack.md`。

## 架构

```text
src/context-pack.html
  |
  |-- 页面结构 / 文件夹选择 / 预览区域
  v
src/context-pack.js
  |
  |-- DOM 编排
  |-- File API 读取本地文件
  |-- 调用 ContextPack.buildContextMarkdown
  v
src/core/context-pack.js
  |
  |-- 纯函数核心
  |-- 过滤规则
  |-- 目录树生成
  |-- Markdown 拼装
  |-- token 粗估
  v
复制 / 下载 Markdown
```

## 隐私边界

- 不上传文件；
- 不调用任何 API；
- 不读取用户未选择的文件；
- 不默认保存文件内容到服务器；
- 用户复制或下载后自行决定是否发给第三方 AI。

## 过滤策略

默认跳过：

- 目录：`.git`、`node_modules`、`dist`、`build`、`.next`、`.nuxt`、`.cache`、`coverage`、虚拟环境、Python cache；
- 文件：常见 lock 文件、`.DS_Store`；
- 二进制扩展：图片、视频、音频、字体、压缩包、数据库、wasm 等；
- 未知扩展：默认跳过，避免误读二进制；
- 单文件超过 200KB：跳过；
- 总文本超过约 1.2MB：停止继续加入。

## 测试

新增 `test-context-pack.js`，覆盖：

- 文件过滤；
- 跳过统计；
- 目录树生成；
- Markdown 标题、目录、内容、跳过文件区；
- token 粗估。

`package.json` 的 `npm test` 已改为：

```bash
node test-converter.js && node test-context-pack.js
```

## 暂缓项

- 在线 GitHub 仓库抓取：会引入联网和跨域问题；
- AI 自动摘要：需要 API Key 或后端模型；
- 精确 token 计数：需要 tokenizer 依赖；
- ZIP 输入解析：当前不是 Context Pack 主路径。

## 后续优化

低成本高价值后续项：

1. 增加用户可编辑过滤规则；
2. 增加“只包含 README / docs / src / config”的快捷 preset；
3. 增加输出分段，适配不同模型上下文长度；
4. 增加 Agent Brief 生成器，把 context pack 与任务说明组合成完整任务包。

# ChatGPT Session to CPA / sub2api / Cockpit / 9router

纯前端单页面工具，用来把 ChatGPT Web 登录 session JSON 转换成 CPA、sub2api、Cockpit Tools 或 9router 可导入 JSON。

## 在线使用

### [**Cloudflare Pages 试点地址**](https://gptsession2cpaandsub2api.mailforwdy.workers.dev/)

### [**》》 点我直接使用 《《**](https://json.chatai.codes/)

## 使用提示

Plus 号可以用此方式导入中转站使用；Free 号的 access token 不能用于调用接口。

本工具可用来解决 Codex OAuth 登录需要绑定手机的问题。Plus 账号通过 Web 登录后的 session 就能生成可导入中转站的账号 JSON 数据；这类数据没有 `refresh_token`，但 `access_token` 有效期通常足够长。

解释一下： plus激活前（free状态）或激活后（plus状态）获取的session在使用上没有区别（free时拿到的session, 激活plus后就可以调模型了），只是账号级别标识有点区别（标识为free or plus），不影响调模型。 换句话讲，不管你啥时候拿到的session, 用本项目转换导入中转站，只要账号当前激活了plus, 就能正常调模型接口。

本工具新增 `Codex auth.json` 输出后，Free 账号也可以生成 Codex CLI 可识别的登录配置；但 Free 账号能否调用具体模型仍取决于账号当前权益。CPA、sub2api、Cockpit 和 9router 导入后是否可用，也同样取决于账号是否具备对应模型权限。


## 支持输入

支持粘贴或拖入 ChatGPT Web session JSON，例如包含：

- `user.email`
- `accessToken`
- `sessionToken`
- `expires`
- `account.id`
- `account.planType`

也支持粘贴或拖入 9router Codex OAuth JSON，例如包含 `accessToken`、`refreshToken`、`expiresAt`、`providerSpecificData.chatgptAccountId` 和 `providerSpecificData.chatgptPlanType`。

页面也会尝试从 `accessToken` 的 JWT payload 中补充邮箱、账号 ID、用户 ID、计划类型和过期时间。

## 输出格式

- `CPA`：生成 Codex CPA auth JSON，包含 `type: "codex"`、`access_token`、`session_token`、`id_token`、`email`、`account_id`、套餐和过期时间等字段；缺少真实 `id_token` 时会根据 session 与 access token claims 构造 CPA 可解析的占位 claims。
- `sub2api`：生成参考 `CPA2sub2API` 项目的 `exported_at/proxies/accounts` 结构，账号平台为 `openai`，类型为 `oauth`。
- `Cockpit`：生成 Cockpit Tools Codex JSON 导入可识别的扁平 token 格式，包含 `id_token`、`access_token`、`refresh_token`、`account_id`、`email`、`expired` 等字段。
- `9router`：生成 9router Codex OAuth JSON，包含 `accessToken`、`refreshToken`、`expiresAt`、`providerSpecificData`、`provider`、`authType`、`priority`、`isActive`、`createdAt` 和 `updatedAt` 等字段。
- `Codex auth.json`：参考 Codex Auth Bridge 的本地转换逻辑，从 ChatGPT Web session 生成 Codex CLI 可识别的 `~/.codex/auth.json` 内容，不按 Free/Plus 做转换门槛。
ChatGPT Web session 通常不包含 CPA OAuth 文件里常见的 `refresh_token`，因此 access token 过期后不能自动刷新。

## 本地使用

直接打开：

```text
src/index.html
```

所有解析和转换都在浏览器本地完成，不上传 token，不写入本地存储。

## 浏览器验证

若需在本地浏览器中逐项验收转换功能，可参考：

```text
docs/BROWSER_TESTING.md
```

该指南包含单文件/批量转换、边界情况和控制台无错误的检查步骤。

## Cloudflare Pages 部署

本项目现支持直接部署到 Cloudflare Pages：

```text
Project: GPTSession2CPAandSub2API
Framework preset: None / Static assets
Build command: 留空
Build output directory: src
```

仓库内 `wrangler.jsonc` 已改为 Pages 资产托管配置，`src/_headers` 已提供基础安全头。后续推荐在 Cloudflare Dashboard 中进入 Pages 项目的 `Settings -> Builds`，连接 GitHub 仓库，让 `main` 分支每次 push 自动触发 Pages 构建。

## Cloudflare Workers 部署（历史/替代方案）

本项目当前线上地址运行在 Cloudflare Workers：

```text
https://gptsession2cpaandsub2api.mailforwdy.workers.dev/
```

若仍需通过 Workers 部署，需单独保留一份 Worker 部署配置；仓库内当前的 `wrangler.jsonc` 已改为 Pages 资产托管配置，**不再适用于 Workers**。

Worker 部署参考配置：

```text
Worker name: gptsession2cpaandsub2api
Git repository: qwdingyu/GPTSession2CPAandSub2API
Branch: main
Build command: 留空
Deploy command: npx wrangler deploy
Static assets directory: src
```

`src/_headers` 已添加基础安全头，重点是通过 CSP 禁止页面发起网络请求，强化“不上传 token”的上线约束。后续推荐在 Cloudflare Dashboard 中进入该 Worker 的 `Settings -> Builds`，连接 GitHub 仓库，让 `main` 分支每次 push 自动触发 Workers Builds。

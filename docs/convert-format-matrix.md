# /convert 格式兼容矩阵

## 设计原则

- 所有样本均为手工构造的脱敏 fixture，不包含真实 token。
- 兼容矩阵只描述本地 JSON 结构转换，不做联网验活，不刷新 token。
- 新格式优先进入统一内核 `FlowPilotConverter.parseSessionPayload` / `normalizeSessionRecord`，避免 Worker 与 UI 分叉。
- 缺失字段只做结构提示或占位，不伪造真实刷新能力。

## 格式矩阵

| 格式 | 输入识别条件 | 必需字段 | 可选字段 | 可推断字段 | 不可恢复字段 | 输出映射 | Fixture |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ChatGPT Web Session | 根对象或嵌套对象包含 `accessToken`/`access_token`，并带 `user`/`email`/JWT claims 等身份信息 | `accessToken` | `refreshToken`, `sessionToken`, `expires`, `user.email` | `accountId`, `userId`, `planType`, `expiresAt` 可从 JWT claims 推断 | 真实 `refresh_token`、真实 `id_token` 若源数据没有则不可恢复 | sub2api, CPA, Cockpit, 9router, Codex, AxonHub, Codex-Manager | `docs/fixtures/convert/chatgpt-session.json` |
| Codex auth.json | 包含 `tokens.access_token`，通常有 `tokens.refresh_token`、`tokens.id_token`、`tokens.account_id` | `tokens.access_token` | `tokens.refresh_token`, `tokens.id_token`, `last_refresh` | `email`, `accountId`, `planType`, `expiresAt` 可从 JWT claims 推断 | 若缺 `id_token` 只能生成合成 claims | 同上 | `docs/fixtures/convert/codex-auth.json` |
| sub2api accounts | 数组或 `{ accounts: [] }` 中对象包含 `credentials.access_token` | `credentials.access_token` | `credentials.refresh_token`, `credentials.expires_at`, `credentials.chatgpt_account_id`, `extra.email` | `sourceType`, `emailKey`, `expiresIn` | 源缺失的真实 `session_token` | 同上 | `docs/fixtures/convert/sub2api-accounts.json` |
| CPA | 根对象或 `{ accounts: [] }` 中对象 `type: codex` 或含 `access_token` | `access_token` | `refresh_token`, `id_token`, `session_token`, `account_id`, `email`, `expired` | `sub2api.credentials`, `Codex tokens` | sub2api 特有调度字段无法完整恢复 | 同上 | `docs/fixtures/convert/cpa.json` |
| Cockpit | 对象含 `type: codex`、`access_token`、`account_note` 等轻量账号字段 | `access_token` | `id_token`, `refresh_token`, `account_id`, `account_note` | 可转为统一账号记录 | 缺失的 sub2api 调度字段 | 同上 | `docs/fixtures/convert/cockpit.json` |
| 9router | 对象含 `provider: codex` + `authType: oauth`，或 `providerSpecificData.chatgptAccountId`，或 OAuth credentials | `credentials.access_token` 或 `access_token` | `credentials.id_token`, `providerSpecificData`, `isActive`, `createdAt`, `updatedAt` | `sourceType=9router`, `accountId`, `planType` | 真实 refresh/id token 若缺失不可恢复 | 同上 | `docs/fixtures/convert/9router.json` |
| AxonHub | `auth_mode` + `tokens.access_token` | `tokens.access_token` | `tokens.refresh_token`, `tokens.id_token`, `tokens.account_id`, `last_refresh` | 可归一化为统一账号记录 | `__missing_refresh_token__` 是占位，不代表真实 refresh token | 同上 | `docs/fixtures/convert/axonhub.json` |
| Codex-Manager | `{ tokens, meta }` 或 `{ accounts: [{ tokens, meta }] }`，其中 `tokens.access_token` 存在 | `tokens.access_token` | `tokens.refresh_token`, `tokens.id_token`, `meta.email`, `meta.chatgpt_account_id` | `name`, `accountId`, `planType` | 缺失的真实 refresh/id token | 同上 | `docs/fixtures/convert/codex-manager.json` |
| 混合嵌套 JSON | 任意层级包含上述账号对象 | 至少一个可识别账号对象 | 任意来源元数据 | 每条记录的 `sourcePath` | 源数据本身没有的 token 不可恢复 | 同上 | `docs/fixtures/convert/mixed-nested.json` |

## 低成本实施优先级

1. **P0：统一识别入口** — `detectFormat` 与 `findSessionCandidates` 都应识别 Codex/AxonHub/Codex-Manager/9router/sub2api/CPA 的常见结构。
2. **P0：fixture 回归测试** — 所有矩阵 fixture 必须至少能被检测或被 `parseSessionPayload` 转换。
3. **P1：UI 预览限量** — 大批量账号只渲染前 200 条表格行，完整 JSON 仍可复制/下载。
4. **P1：ZIP 打包下载** — 已实现浏览器本地 store 模式 ZIP 生成，用于多账号拆分下载；ZIP 输入解析仍暂缓。

# GitHub Actions 与 Cloudflare 部署最佳实践

> 评估日期：2026-07-09  
> 适用项目：AI Forge / ChatGPT Session Converter  
> 真实生产域名：`https://ai.eforge.xyz/`

---

## 1. 本次报错结论

GitHub Actions 日志显示：

```text
Node 20 is being deprecated. This workflow is running with Node 24 by default.
Run cloudflare/wrangler-action@v3
Installing Wrangler
/opt/hostedtoolcache/node/20.20.2/x64/bin/npx --no-install wrangler --version
4.86.0
Error: The process '/opt/hostedtoolcache/node/20.20.2/x64/bin/npx' failed with exit code 1
```

当前仓库原 workflow 仍显式使用：

```yaml
node-version: 20
uses: cloudflare/wrangler-action@v3
```

这与 GitHub Actions Runner 默认切换到 Node 24、Node 20 进入弃用期的方向冲突。最佳实践不是设置 `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` 继续依赖 Node 20，而是直接迁移到 Node 24，并用 Wrangler CLI 明确执行部署命令。

中文注释：`ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true` 只能作为临时逃生开关，不应成为长期方案。这个项目是纯静态 Cloudflare Workers Static Assets 部署，部署链路越简单、越显式越可靠。

---

## 2. 结合 cf-shop 模板沉淀出的原则

参考 `/Users/dingyuwang/0-X/github_workflow/templates/cf-shop/scripts` 与 `docs` 中的部署经验，本项目应采用更轻量但同样分层的链路：

```text
配置校验 -> 本地测试/安全门禁 -> Wrangler 部署 -> 真实域名验证
```

### 2.1 不要混用旧参数和旧运行时

cf-shop 的部署手册记录过 Wrangler 4.x 参数变化，例如旧 `--custom-domain` 已变更为 `--domains`。本项目当前不需要在 CI 中绑定域名，应该避免在 workflow 中加入多余域名参数。

中文注释：域名绑定属于 Cloudflare 侧一次性配置或专门脚本职责，日常 CI 只负责部署当前 Worker 并验证 `https://ai.eforge.xyz/` 可访问。

### 2.2 部署后必须验证真实域名

cf-shop 模板中的 `07-verify-domain.mjs` 强调：部署成功不等于生产域名可访问。当前项目也应在 deploy 后检查：

```text
HEAD https://ai.eforge.xyz/
```

成功条件：HTTP 状态码在可接受范围内，并且 HTTPS 握手成功。

中文注释：不能只相信 Wrangler deploy 成功。Cloudflare Worker 已部署、DNS 绑定、证书、边缘路由是不同环节，必须验证最终用户访问的真实域名。

### 2.3 Secrets 要做 preflight

本项目当前只需要 `CLOUDFLARE_API_TOKEN`。workflow 中应在部署前明确检查：

```bash
test -n "${CLOUDFLARE_API_TOKEN}"
```

中文注释：如果 token 缺失，应在 preflight 失败，而不是等 Wrangler Action 内部报一个不清楚的 exit code。

### 2.4 纯前端敏感工具必须保留安全门禁

本项目承诺“不上传 token”。因此 CI 中应检查：

- `src/_headers` 保留 `connect-src 'none'`。
- `src/_headers` 保留 `script-src 'self'`。
- `src/` 中不重新引入 `fonts.googleapis` 或 `fonts.gstatic`。

中文注释：这类静态检查很便宜，但能防止未来改 UI 时悄悄引入第三方请求，破坏产品可信度。

---

## 3. 已采用的 workflow 策略

当前已将 `.github/workflows/deploy.yml` 调整为：

1. 使用 `actions/setup-node@v4` + `node-version: 24`。
2. 不再使用 `cloudflare/wrangler-action@v3`。
3. 使用 `npm ci` 安装锁定依赖，Wrangler 固定在 `package-lock.json` 中。
4. 使用 `npm run deploy:ci` 作为唯一 CI 主入口。
5. `deploy:ci` 串联：`npm test -> npm run check:static -> npm run deploy -> npm run verify:domain`。
6. 部署后验证真实域名：`https://ai.eforge.xyz/`。
7. 使用 `concurrency` 防止同一分支多次部署互相覆盖。

中文注释：这符合 cf-shop 模板中的“构建/测试/部署/线上验证”分层原则，但没有引入 cf-shop 中数据库、admin、Turnstile、邮件等不属于本项目的复杂门禁。后续不应再通过临时本地命令作为常规发布方式；本地部署只允许用于应急或排障。

---

## 3.1 一次成功的 CI 契约

只要满足以下条件，下一次 push 到 `main` 应自动完成部署并验证通过：

1. GitHub Secret `CLOUDFLARE_API_TOKEN` 存在且具备目标 Worker 部署权限。
2. `package-lock.json` 与 `package.json` 同步，`npm ci` 可安装 Wrangler。
3. `test-converter.js` 全部通过。
4. `scripts/check-static-site.js` 全部通过。
5. Cloudflare 上 `ai.eforge.xyz` 已绑定到 Worker `gptsession2cpaandsub2api`。
6. 部署后 `scripts/verify-domain.js` 能从公网访问 `https://ai.eforge.xyz/` 与 `/convert`。

中文注释：这里没有要求开发者每次手动填表、手动复制命令、手动绑定域名。域名绑定是一次性基础设施状态；日常发布只靠 GitHub Actions。

---

## 4. GitHub Secrets 要求

当前仓库必须配置：

```text
CLOUDFLARE_API_TOKEN
```

Token 权限建议最小化：

- 能部署目标 Worker。
- 能读取账号信息完成 Wrangler deploy。
- 如果域名绑定已经在 Cloudflare 控制台完成，日常 deploy token 不需要额外 DNS 管理权限。

中文注释：不要把 Global API Key 放进 GitHub Secrets 作为日常部署凭证。除非使用专门的域名绑定脚本且确有需要，否则应优先使用范围受限的 API Token。

---

## 5. 真实域名与 Worker 的关系

本项目真实对外域名是：

```text
https://ai.eforge.xyz/
```

workflow 只验证这个域名，不再使用模板中的 `shop.eforge.xyz`、`cf-shop`、`eshop` 等名称。

中文注释：这些名字来自参考模板，不属于当前项目。当前项目文档和 workflow 中必须只出现当前真实生产域名，避免运维人员误查错站点。

---

## 6. 不建议采用的临时方案

### 6.1 不建议长期设置 Node 20 逃生变量

不建议：

```yaml
env:
  ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true
```

原因：

- 这是绕过弃用警告，不是修复。
- 后续 GitHub Runner 或 Action 仍可能彻底移除 Node 20 支持。
- 本项目没有 Node 20 专属依赖，迁移 Node 24 风险更低。

### 6.2 不建议继续依赖 action 内部隐式命令

不建议让 `cloudflare/wrangler-action@v3` 自动决定安装和执行路径。当前项目已改为锁定依赖后显式执行：

```bash
npm run deploy
```

中文注释：显式命令更容易复现，失败日志也更清楚；本地和 CI 可以使用同一套 npm scripts 排查。

---

## 7. 后续可选增强

如果后续继续提升部署质量，可增加：

1. `wrangler deploy --dry-run`：重大变更前先做 dry-run。
2. `curl -fsS https://ai.eforge.xyz/` 后检查页面中是否包含 `AI Forge`。
3. 检查安全响应头是否在线生效：`curl -fsSI https://ai.eforge.xyz/ | grep -i content-security-policy`。
4. 如果 Cloudflare 支持更细的部署环境保护，可对 `main` 部署 job 加 GitHub Environment protection。

中文注释：当前已加入 `package.json` 和 `package-lock.json`，Wrangler 版本由锁文件固定。后续不要回退到浮动 `npx --yes wrangler@4 deploy` 作为 CI 主路径。

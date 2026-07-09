# 浏览器端验证指南

本指南用于在真实浏览器中验证 `src/index.html` 的转换功能。所有解析和转换都在浏览器本地完成，不上传 token。

## 前置条件

- 现代浏览器：Chrome / Edge / Firefox / Safari
- 本地静态服务器或直接打开 `src/index.html`

## 快速验证

1. 打开 `src/index.html`
2. 打开浏览器开发者工具的 Console（控制台）和 Network（网络）面板
3. 在 Network 面板确认：
   - `converter.js` 已成功加载，状态为 200
   - 无 `converter.js` 相关的报错
4. 在页面底部找到「文件互转」区域

## 单文件转换验证

### CPA → SUB

1. 拖入或选择 `docs/sample-cpa.json`
2. 确认状态栏显示“已转换 1 个文件。”
3. 确认预览区显示：
   - 已选文件：1 个
   - 转换成功：1 条
   - 跳过：0 条
4. 点击下载按钮，保存 `sample-cpa_sub.json`
5. 打开下载文件，确认：
   - `platform` 为 `openai`
   - `type` 为 `oauth`
   - `credentials.access_token` 与输入一致
   - `credentials.refresh_token` 与输入一致
   - `credentials.expires_at` 为字符串 `3600`
   - `organization_id` 映射正确
   - `name` 使用 `email`
   - `generatedAt` / `sourceName` 存在

### SUB → CPA

1. 拖入或选择 `docs/sample-sub.json`
2. 确认状态栏显示“已转换 1 个文件。”
3. 确认预览区显示：
   - 已选文件：1 个
   - 转换成功：1 条
   - 跳过：0 条
4. 点击下载按钮，保存 `sample-sub_cpa.json`
5. 打开下载文件，确认：
   - 使用 snake_case 键名
   - `access_token` / `refresh_token` 映射正确
   - `expires_at` 为字符串 ISO 时间
   - `organization_id` 映射正确
   - `generatedAt` / `sourceName` 存在
   - 单文件输入时输出为扁平对象，不是数组

## 批量转换验证

1. 同时选择 `docs/sample-cpa.json` 和 `docs/sample-sub.json`
2. 确认状态栏显示“已转换 2 个文件。”
3. 确认预览区显示 2 条成功记录
4. 点击下载按钮，应生成两个文件：
   - `sample-cpa_sub.json`
   - `sample-sub_cpa.json`

## 边界情况验证

- **非 JSON 文件**：选择 `.txt` 或 `.csv`，应提示“没有选择 JSON 文件。”
- **格式无法识别**：构造一个不包含 CPA / SUB 特征的 JSON，应显示“未识别的格式（仅支持 CPA / sub2api）”
- **非法 JSON**：选择损坏的 JSON 文件，应显示 JSON 解析错误

## 控制台无错误标准

在以下操作期间，Console 不应出现 `ReferenceError`、`TypeError`、`SyntaxError`：

- 页面初始加载
- 选择文件
- 点击下载
- 清空结果

若出现错误，优先检查 `converter.js` 是否正常加载，以及 `_headers` 中的 CSP 是否允许页面资源。

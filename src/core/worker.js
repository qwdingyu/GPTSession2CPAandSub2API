self.addEventListener('message', (e) => {
  const { type, payload } = e.data;
  try {
    if (type === 'parse-sessions') handleParse(payload);
    else self.postMessage({ type: 'error', error: `Unknown type: ${type}` });
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
});

function postProgress(pct, status) {
  self.postMessage({ type: 'progress', pct, status });
}

function handleParse({ text, sourceName }) {
  postProgress(0, '解析 JSON...');
  const parsed = JSON.parse(text);
  postProgress(20, '搜索 session 对象...');

  const found = [];
  const visited = new WeakSet();

  function visit(item, path) {
    if (!item || typeof item !== 'object') return;
    if (visited.has(item)) return;
    visited.add(item);
    if (Array.isArray(item)) { item.forEach((child, i) => visit(child, `${path}[${i}]`)); return; }

    const token = firstNonEmpty(item.accessToken, item.access_token, item.token?.accessToken, item.token?.access_token, item.credentials?.accessToken, item.credentials?.access_token);
    const hasIdentity = isPlainObject(item.user) || firstNonEmpty(item.email, item.name, item.providerSpecificData?.chatgptAccountId, item.providerSpecificData?.chatgpt_account_id, item.id);
    if (token && hasIdentity) { found.push({ value: item, sourceName, path }); return; }

    for (const [key, child] of Object.entries(item)) {
      if (key === 'accessToken' || key === 'access_token' || key === 'sessionToken') continue;
      visit(child, `${path}.${key}`);
    }
  }
  visit(parsed, '$');

  postProgress(40, `转换 ${found.length} 个 session...`);
  const converted = [];
  const skipped = [];

  for (let i = 0; i < found.length; i++) {
    const item = found[i];
    if (i % 50 === 0) postProgress(40 + Math.round((i / found.length) * 50), `转换中 ${i}/${found.length}...`);
    try { converted.push(convertSession(item.value, { now: new Date(), sourceName: item.sourceName, sourcePath: item.path })); }
    catch (err) { skipped.push({ sourceName: item.sourceName, path: item.path, reason: err.message || '无法转换' }); }
  }

  postProgress(95, '生成输出...');
  self.postMessage({ type: 'result-parse', payload: { converted, skipped, found } });
}

function isPlainObject(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
function firstNonEmpty(...values) { for (const v of values) { if (typeof v === 'string' && v.trim() !== '') return v.trim(); } return undefined; }
function normalizeTimestamp(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === 'number' && Number.isFinite(v)) { const d = new Date(v > 1e11 ? v : v * 1000); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); }
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const d = new Date(v); return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function timestampFromUnixSeconds(v) { const n = Number(v); if (!Number.isFinite(n)) return undefined; const d = new Date(n * 1000); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); }
function epochSecondsFromValue(v) {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v); if (Number.isFinite(n)) return Math.trunc(n > 1e11 ? n / 1000 : n);
  const p = Date.parse(String(v)); return Number.isFinite(p) ? Math.trunc(p / 1000) : 0;
}
function decodeBase64Url(v) {
  const n = v.replace(/-/g, '+').replace(/_/g, '/');
  const padded = n.padEnd(Math.ceil(n.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
function encodeBase64UrlJson(v) {
  let b = ''; const bytes = new TextEncoder().encode(JSON.stringify(v));
  for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function parseJwtPayload(token) {
  if (typeof token !== 'string' || !token.trim()) return undefined;
  const segs = token.split('.'); if (segs.length < 2) return undefined;
  try { return JSON.parse(new TextDecoder().decode(decodeBase64Url(segs[1]))); } catch { return undefined; }
}
function getOpenAIAuthSection(p) { if (!isPlainObject(p)) return {}; const a = p['https://api.openai.com/auth']; return isPlainObject(a) ? a : {}; }
function getOpenAIProfileSection(p) { if (!isPlainObject(p)) return {}; const a = p['https://api.openai.com/profile']; return isPlainObject(a) ? a : {}; }

function convertSession(record, opts = {}) {
  if (!isPlainObject(record)) throw new Error('session 不是 JSON 对象');
  const accessToken = firstNonEmpty(record.accessToken, record.access_token, record.token?.accessToken, record.token?.access_token, record.credentials?.accessToken, record.credentials?.access_token);
  if (!accessToken) throw new Error('缺少 accessToken');
  const sessionToken = firstNonEmpty(record.sessionToken, record.session_token, record.token?.sessionToken, record.token?.session_token, record.credentials?.session_token);
  const refreshToken = firstNonEmpty(record.refreshToken, record.refresh_token, record.token?.refreshToken, record.token?.refresh_token, record.credentials?.refresh_token);
  const inputIdToken = firstNonEmpty(record.idToken, record.id_token, record.token?.idToken, record.token?.id_token, record.credentials?.id_token);
  const payload = parseJwtPayload(accessToken);
  const idPayload = parseJwtPayload(inputIdToken);
  const auth = getOpenAIAuthSection(payload);
  const idAuth = getOpenAIAuthSection(idPayload);
  const profile = getOpenAIProfileSection(payload);
  const expiresAt = firstNonEmpty(payload ? timestampFromUnixSeconds(payload.exp) : undefined, normalizeTimestamp(record.expires), normalizeTimestamp(record.expiresAt), normalizeTimestamp(record.expired), normalizeTimestamp(record.expires_at));
  const email = firstNonEmpty(record.user?.email, record.email, record.credentials?.email, record.providerSpecificData?.email, profile.email, idPayload?.email, payload?.email);
  const accountId = firstNonEmpty(record.account?.id, record.account_id, record.chatgptAccountId, record.providerSpecificData?.chatgptAccountId, record.providerSpecificData?.chatgpt_account_id, record.credentials?.chatgpt_account_id, auth.chatgpt_account_id, idAuth.chatgpt_account_id, record.provider === 'codex' ? record.id : undefined);
  const userId = firstNonEmpty(record.user?.id, record.user_id, record.chatgptUserId, record.providerSpecificData?.chatgptUserId, record.providerSpecificData?.chatgpt_user_id, auth.chatgpt_user_id, auth.user_id, idAuth.chatgpt_user_id, idAuth.user_id);
  const planType = firstNonEmpty(record.account?.planType, record.account?.plan_type, record.planType, record.plan_type, record.providerSpecificData?.chatgptPlanType, record.providerSpecificData?.chatgpt_plan_type, record.credentials?.plan_type, auth.chatgpt_plan_type, idAuth.chatgpt_plan_type);
  const exportedAt = normalizeTimestamp(opts.now || new Date());
  const expiresIn = getExpiresIn(expiresAt, opts.now || new Date());
  const sourceName = firstNonEmpty(opts.sourceName, 'pasted-json');
  const sourceType = record.provider === 'codex' && record.authType === 'oauth' ? '9router' : 'chatgpt_web_session';
  const name = firstNonEmpty(email, sourceName, 'ChatGPT Account');
  const syntheticIdToken = !inputIdToken ? buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt) : undefined;
  const idToken = firstNonEmpty(inputIdToken, syntheticIdToken);
  const cpa = Object.fromEntries(Object.entries({ type: 'codex', account_id: accountId, chatgpt_account_id: accountId, email, name, plan_type: planType, chatgpt_plan_type: planType, id_token: idToken, id_token_synthetic: Boolean(syntheticIdToken) || undefined, access_token: accessToken, refresh_token: refreshToken || '', session_token: sessionToken, last_refresh: exportedAt, expired: expiresAt, disabled: Boolean(record.disabled) || undefined }).filter(([,v]) => v !== undefined && v !== null));
  const cockpit = { type: 'codex', id_token: idToken, access_token: accessToken, refresh_token: refreshToken || '', account_id: accountId, last_refresh: exportedAt, email, expired: expiresAt, account_note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark) };
  const codexTokens = Object.fromEntries(Object.entries({ id_token: accessToken, access_token: accessToken, refresh_token: refreshToken || '', account_id: accountId }).filter(([,v]) => v !== undefined && v !== null && v !== ''));
  const codexAuth = { OPENAI_API_KEY: null, tokens: codexTokens, last_refresh: exportedAt };
  const sub2apiAccount = stripUnavailable({ name: firstNonEmpty(name, email, sourceName, 'ChatGPT Account'), platform: 'openai', type: 'oauth', concurrency: 10, priority: 1, credentials: { access_token: accessToken, chatgpt_account_id: accountId, chatgpt_user_id: userId, email, expires_at: expiresAt, expires_in: expiresIn, plan_type: planType }, extra: { email, email_key: toEmailKey(email), name, auth_provider: firstNonEmpty(record.authProvider, record.auth_provider), source: sourceType, last_refresh: exportedAt } });
  const priority = Number.isFinite(Number(record.priority)) ? Number(record.priority) : 9;
  const isActive = typeof record.isActive === 'boolean' ? record.isActive : !Boolean(record.disabled);
  const createdAt = normalizeTimestamp(record.createdAt) || exportedAt;
  const updatedAt = normalizeTimestamp(record.updatedAt) || exportedAt;
  const nineRouterAccount = stripUnavailable({ name: firstNonEmpty(name, email, sourceName, 'ChatGPT Account'), platform: 'openai', type: 'oauth', priority, isActive, credentials: { client_id: 'codex', access_token: accessToken, refresh_token: refreshToken || '', id_token: idToken, expires_at: expiresAt }, extra: { email, email_key: toEmailKey(email), name, auth_provider: 'openai', source: sourceType, last_refresh: exportedAt, created_at: createdAt, updated_at: updatedAt } });
  return { name, email, expiresAt, planType, accountId, userId, sourceName, sourceType, accessToken, sessionToken, refreshToken, idToken, syntheticIdToken: Boolean(syntheticIdToken), cpa, cockpit, codexAuth, sub2apiAccount, nineRouterAccount };
}

function buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt) {
  if (!accountId) return undefined;
  const now = Math.trunc(Date.now() / 1000);
  const authInfo = { chatgpt_account_id: accountId };
  const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;
  if (planType) authInfo.chatgpt_plan_type = planType;
  if (userId) { authInfo.chatgpt_user_id = userId; authInfo.user_id = userId; }
  const payload = { iat: now, exp: expires, 'https://api.openai.com/auth': authInfo };
  if (email) payload.email = email;
  return `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.`;
}
function getExpiresIn(expiresAt, now) {
  if (!expiresAt) return undefined;
  const exp = Date.parse(expiresAt); if (Number.isNaN(exp)) return undefined;
  const diff = Math.round((exp - now.getTime()) / 1000); return diff > 0 ? diff : 0;
}
function toEmailKey(email) { if (!email) return undefined; return email.replace(/[.+]/g, '_').toLowerCase(); }
function stripUnavailable(obj) {
  if (!isPlainObject(obj)) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (isPlainObject(v)) { const s = stripUnavailable(v); if (Object.keys(s).length) result[k] = s; }
    else if (Array.isArray(v)) { const f = v.filter(x => x !== undefined && x !== null).map(x => isPlainObject(x) ? stripUnavailable(x) : x); if (f.length) result[k] = f; }
    else result[k] = v;
  }
  return result;
}

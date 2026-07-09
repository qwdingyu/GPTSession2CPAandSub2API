var FlowPilotConverter;
(function (FlowPilotConverter) {
    function isPlainObject(value) {
        if (!Object.prototype.toString.call(value).startsWith('[object Object')) return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }
    function deepClone(value) {
        if (Array.isArray(value)) return value.map(item => deepClone(item));
        if (isPlainObject(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepClone(item)]));
        return value;
    }
    function asString(value) { return value === undefined || value === null ? '' : String(value); }
    function hasOwn(target, key) { return Object.prototype.hasOwnProperty.call(target, key); }
    function firstNonEmpty(...values) {
        for (const value of values) {
            const normalized = asString(value);
            if (normalized) return normalized;
        }
        return '';
    }
    function pickUnknownKeys(source, knownKeys) {
        if (!isPlainObject(source) || !Array.isArray(knownKeys)) return undefined;
        const unknown = {};
        for (const key of Object.keys(source)) { if (!knownKeys.includes(key)) unknown[key] = deepClone(source[key]); }
        return Object.keys(unknown).length === 0 ? undefined : unknown;
    }
    function applyUnknownFields(target, source) {
        if (!isPlainObject(target) || !isPlainObject(source)) return target;
        const result = deepClone(target);
        for (const key of Object.keys(source)) { if (!hasOwn(result, key)) result[key] = deepClone(source[key]); }
        return result;
    }
    function formatJson(value) { return JSON.stringify(value, null, 2); }
    function formatSize(bytes) {
        const size = Number(bytes);
        if (!Number.isFinite(size) || size < 0) return '0 B';
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
        return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    function buildTimestampTag(isoString) {
        const normalized = normalizeIsoString(asString(isoString));
        if (!normalized) return '';
        return `_${normalized.replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    }
    function nowIso() { return new Date().toISOString(); }
    function normalizeTimestamp(value) {
        const parsed = Date.parse(asString(value));
        return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
    }
    function normalizeIsoString(value) {
        const normalized = normalizeTimestamp(value);
        if (!normalized) return '';
        return normalized;
    }
    function isoToEpochSeconds(isoString) {
        const normalized = normalizeIsoString(isoString);
        if (!normalized) return undefined;
        return Math.floor(Date.parse(normalized) / 1000);
    }
    function epochishToIso(value) {
        if (!value && value !== 0) return '';
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return normalizeIsoString(asString(value));
        const seconds = Math.abs(numeric) > 9999999999 ? numeric / 1000 : numeric;
        const normalized = new Date(Number.isInteger(seconds) ? seconds * 1000 : seconds).toISOString();
        return Number.isNaN(Date.parse(normalized)) ? '' : normalized;
    }
    function timestampFromUnixSeconds(value) { return epochishToIso(value); }
    function epochSecondsFromValue(value) {
        if (!value && value !== 0) return undefined;
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return undefined;
        if (numeric > 9999999999) return Math.floor(numeric / 1000);
        return Math.floor(numeric);
    }
    function decodeBase64Url(value) {
        const normalized = asString(value).replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
        return bytes;
    }
    function bytesToBase64Url(bytes) {
        const binary = Array.from(bytes).map((byte) => String.fromCharCode(byte)).join('');
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }
    function decodeJwtClaims(jwt) {
        const normalized = asString(jwt);
        if (!normalized) return undefined;
        const segments = normalized.split('.');
        if (segments.length < 2) return undefined;
        try {
            const decoded = decodeBase64Url(segments[1]);
            return JSON.parse(new TextDecoder().decode(decoded));
        } catch { return undefined; }
    }
    function encodeBase64UrlJson(value) {
        return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
    }
    function parseJwtPayload(token) { return decodeJwtClaims(token); }
    function getOpenAIAuthSection(payload) {
        if (!isPlainObject(payload)) return {};
        const auth = payload['https://api.openai.com/auth'];
        return isPlainObject(auth) ? auth : {};
    }
    function getOpenAIProfileSection(payload) {
        if (!isPlainObject(payload)) return {};
        const profile = payload['https://api.openai.com/profile'];
        return isPlainObject(profile) ? profile : {};
    }
    function pickOrganizationIdFromAuth(payload) {
        const auth = getOpenAIAuthSection(payload);
        return firstNonEmpty(auth.chatgpt_organization_id, auth.org_id, auth.organization_id);
    }
    function extractOpenAIInfo(payload) {
        if (!isPlainObject(payload)) return undefined;
        const auth = getOpenAIAuthSection(payload);
        const profile = getOpenAIProfileSection(payload);
        const result = {};
        const email = firstNonEmpty(profile.email, payload.email, auth.email);
        if (email) result.email = email;
        const accountId = firstNonEmpty(auth.chatgpt_account_id, profile.chatgpt_account_id, auth.account_id);
        if (accountId) result.chatgpt_account_id = accountId;
        const userId = firstNonEmpty(auth.chatgpt_user_id, profile.chatgpt_user_id, auth.user_id);
        if (userId) result.chatgpt_user_id = userId;
        const planType = firstNonEmpty(auth.chatgpt_plan_type, profile.chatgpt_plan_type, auth.plan_type);
        if (planType) result.chatgpt_plan_type = planType;
        const orgId = pickOrganizationIdFromAuth(payload);
        if (orgId) result.chatgpt_organization_id = orgId;
        return Object.keys(result).length > 0 ? result : undefined;
    }
    function safeNameSegment(value) { return asString(value).replace(/[^a-zA-Z0-9_.\-@]/g, '_').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 80); }
    function buildCodexFilename(email, accountId, planType, timestamp) {
        const tag = buildTimestampTag(timestamp);
        const segments = [safeNameSegment(email) || 'unknown', safeNameSegment(accountId) || 'unknown', safeNameSegment(planType) || 'unknown', tag].filter(Boolean);
        return segments.join('_') + '.json';
    }
    function applyDownloadFormat(payload, format) {
        if (!isPlainObject(payload)) return payload;
        switch (format) {
            case 'sub2api': return payload.accounts && Array.isArray(payload.accounts) ? payload.accounts : (payload.credentials ? [payload] : payload);
            case 'cpa': {
                if (payload.type === 'codex') return payload;
                const accounts = Array.isArray(payload) ? payload : (payload.accounts || []);
                return { accounts, generatedAt: new Date().toISOString() };
            }
            default: return payload;
        }
    }
    function downloadTextFile(text, fileName) {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    function downloadSequentially(items, index = 0) {
        if (index >= items.length) return;
        const item = items[index];
        downloadTextFile(item.text, item.fileName);
        setTimeout(() => downloadSequentially(items, index + 1), 300);
    }
    function getModeValue(value) { return value === 'compact' ? 'compact' : 'lossless'; }
    function getModeLabel(value) { return value === 'compact' ? '紧凑' : '无损'; }
    let workspaceValue = 'cpa';
    function getWorkspaceValue() { return workspaceValue; }
    function setWorkspaceValue(value) { workspaceValue = value; }
    function getSessionOutputFormatValue() { return getWorkspaceValue(); }
    function getSessionOutputLabel(value) { return value === 'cpa' ? 'CPA' : value === 'cockpit' ? 'Cockpit' : value === 'sub2api' ? 'sub2api' : value === 'codexAuth' ? 'Codex auth.json' : value; }
    function getIdleState() { return { idle: true, timestamp: Date.now() }; }
    function buildModeSummary(mode) {
        return { mode: mode || 'lossless', timestamp: new Date().toISOString(), label: getModeLabel(mode) };
    }
    function isCpaLike(value) {
        if (!isPlainObject(value)) return false;
        if (value.type === 'codex') return true;
        if (Array.isArray(value.accounts)) return value.accounts.some(acc => isPlainObject(acc) && acc.type === 'codex');
        return false;
    }
    function isWrappedCpaLike(value) {
        if (!isPlainObject(value)) return false;
        if (value.type === 'codex') return false;
        if (Array.isArray(value.accounts)) return value.accounts.length > 0 && !value.accounts.some(acc => isPlainObject(acc) && acc.type === 'codex');
        return false;
    }
    function detectFormat(value) {
        if (Array.isArray(value)) {
            if (value.length === 0) return 'unknown';
            if (value.some(acc => isPlainObject(acc) && acc.credentials && acc.credentials.access_token)) return 'sub';
            if (value.some(acc => isPlainObject(acc) && acc.type === 'codex')) return 'cpa';
            return 'sub';
        }
        if (!isPlainObject(value)) return 'unknown';
        if (value.type === 'codex') return 'cpa';
        if (value.access_token || value.refresh_token || value.session_token) return 'cpa';
        if (Array.isArray(value.accounts)) {
            if (value.accounts.some(acc => isPlainObject(acc) && acc.type === 'codex')) return 'cpa';
            return 'sub';
        }
        if (isPlainObject(value.credentials) && value.credentials.access_token) return 'sub';
        return 'unknown';
    }
    function renderSelectedFiles(files) { return files.map(f => f.name).join(', '); }
    function renderLocalSelectedFiles(files) { return files.map(f => f.name).join(', '); }
    function renderBadges(count) { return `<span class="badge">${count}</span>`; }
    function renderWarnings(warnings) { return warnings.map(w => `<div class="warning">${w}</div>`).join(''); }
    function setDetailsState(element, state) { if (element) element.open = state; }
    function setBusy(element, busy) { if (element) element.disabled = busy; }
    function unwrapCpaRecord(value) { return isPlainObject(value) && value.type === 'codex' ? value : undefined; }
    function normalizeCpaRecord(value) {
        if (!isPlainObject(value)) return undefined;
        if (value.type === 'codex') return value;
        return undefined;
    }
    function toNonNegativeInt(value, fallback) {
        const num = Number(value);
        return Number.isInteger(num) && num >= 0 ? num : (fallback !== undefined ? fallback : 0);
    }
    function toNonNegativeNumber(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : (fallback !== undefined ? fallback : 0);
    }
    function buildSubAccountFromCpa(record) {
        return normalizeSubAccountToSub(record);
    }
    function normalizeSubAccountToCpa(account) {
        if (!isPlainObject(account)) return {};
        const creds = account.credentials || {};
        const extra = account.extra || {};
        return {
            type: 'codex',
            account_id: firstNonEmpty(creds.chatgpt_account_id, extra.chatgpt_account_id),
            chatgpt_account_id: firstNonEmpty(creds.chatgpt_account_id, extra.chatgpt_account_id),
            name: firstNonEmpty(account.name, extra.name, creds.email, extra.email),
            email: firstNonEmpty(creds.email, extra.email),
            plan_type: firstNonEmpty(creds.plan_type, extra.plan_type),
            chatgpt_plan_type: firstNonEmpty(creds.plan_type, extra.plan_type),
            id_token: firstNonEmpty(creds.id_token, extra.id_token),
            access_token: firstNonEmpty(creds.access_token, extra.access_token),
            refresh_token: firstNonEmpty(creds.refresh_token, extra.refresh_token),
            session_token: firstNonEmpty(creds.session_token, extra.session_token),
            last_refresh: firstNonEmpty(creds.last_refresh, extra.last_refresh),
            expires_at: firstNonEmpty(creds.expires_at, creds.expired, extra.expires_at, extra.expired),
            expired: firstNonEmpty(creds.expires_at, creds.expired, extra.expires_at, extra.expired),
            organization_id: firstNonEmpty(account.organization_id, creds.organization_id, extra.organization_id),
        };
    }
    function normalizeSubAccountToSub(account) {
        if (!isPlainObject(account)) return {};
        const creds = account.credentials || {};
        const extra = account.extra || {};
        const knownTopLevelKeys = ['name', 'platform', 'type', 'concurrency', 'priority', 'credentials', 'extra', 'email', 'access_token', 'refresh_token', 'session_token', 'id_token', 'chatgpt_account_id', 'account_id', 'chatgpt_user_id', 'expired', 'expires_at', 'expires_in', 'plan_type', 'organization_id', 'created_at', 'updated_at'];
        const extraFields = pickUnknownKeys(account, knownTopLevelKeys) || {};
        const credentials = {
            access_token: firstNonEmpty(creds.access_token, account.access_token, extra.access_token),
            refresh_token: firstNonEmpty(creds.refresh_token, account.refresh_token, extra.refresh_token),
            session_token: firstNonEmpty(creds.session_token, account.session_token, extra.session_token),
            id_token: firstNonEmpty(creds.id_token, account.id_token, extra.id_token),
            chatgpt_account_id: firstNonEmpty(creds.chatgpt_account_id, account.chatgpt_account_id, extra.chatgpt_account_id, account.account_id, creds.account_id),
            chatgpt_user_id: firstNonEmpty(creds.chatgpt_user_id, account.chatgpt_user_id, extra.chatgpt_user_id, creds.user_id),
            email: firstNonEmpty(creds.email, account.email, extra.email),
            expires_at: firstNonEmpty(creds.expires_at, creds.expired, account.expired, account.expires_at, extra.expires_at, extra.expired, account.expires_in),
            expires_in: toNonNegativeNumber(creds.expires_in, Number.isFinite(Number(account.expires_in)) ? Number(account.expires_in) : undefined),
            plan_type: firstNonEmpty(creds.plan_type, account.plan_type, extra.plan_type),
        };
        for (const [key, value] of Object.entries(creds)) {
            if (!hasOwn(credentials, key)) credentials[key] = deepClone(value);
        }
        return {
            name: firstNonEmpty(account.name, extra.name, creds.email, extra.email, account.email),
            platform: 'openai',
            type: 'oauth',
            concurrency: toNonNegativeInt(account.concurrency, 10),
            priority: toNonNegativeInt(account.priority, 1),
            credentials,
            organization_id: firstNonEmpty(account.organization_id, creds.organization_id, extra.organization_id),
            created_at: firstNonEmpty(account.created_at, extra.created_at),
            updated_at: firstNonEmpty(account.updated_at, extra.updated_at),
            extra: { ...extraFields, email: firstNonEmpty(creds.email, account.email, extra.email), name: firstNonEmpty(account.name, extra.name, creds.email, extra.email) },
        };
    }
    function convertCpaPayload(payload, options) {
        const mode = options?.mode || 'lossless';
        const now = options?.now ? new Date(options.now) : new Date();
        const sourceName = asString(options?.sourceName || 'payload');
        const accounts = Array.isArray(payload) ? payload : (isPlainObject(payload) && Array.isArray(payload.accounts) ? payload.accounts : (isPlainObject(payload) && (payload.type === 'codex' || payload.access_token || payload.refresh_token || payload.session_token) ? [payload] : []));
        const records = accounts.map(account => normalizeSubAccountToSub(account)).filter(record => Object.keys(record).length > 0);
        const result = records.length === 1 ? records[0] : records;
        const baseRecord = { generatedAt: now.toISOString(), sourceName, mode };
        if (mode === 'lossless') baseRecord['original'] = deepClone(payload);
        return { ...(isPlainObject(result) ? result : { payload: result }), ...baseRecord };
    }
    function convertSubPayload(payload, options) {
        const mode = options?.mode || 'lossless';
        const now = options?.now ? new Date(options.now) : new Date();
        const sourceName = asString(options?.sourceName || 'payload');
        const outputFormat = options?.outputFormat || 'cpa';
        const accounts = Array.isArray(payload) ? payload : (isPlainObject(payload) && Array.isArray(payload['accounts']) ? payload['accounts'] : []);
        const normalizer = outputFormat === 'sub' ? normalizeSubAccountToSub : normalizeSubAccountToCpa;
        const records = accounts.map(account => normalizer(account)).filter(record => Object.keys(record).length > 0);
        const result = records.length === 1 ? records[0] : records;
        return { ...(isPlainObject(result) ? result : { payload: result }), generatedAt: now.toISOString(), sourceName, mode, format: outputFormat };
    }
    function countAccountsInResult(result) {
        /* Count how many account objects are in a convertCpaPayload/convertSubPayload result */
        if (!isPlainObject(result)) return 0;
        /* Single account: { name, platform, ... } */
        if (result.name && result.credentials) return 1;
        /* Single account: { type: 'codex', ... } */
        if (result.type === 'codex' && result.access_token) return 1;
        /* Array wrapper: { payload: [...] } or spread */
        if (result.payload && Array.isArray(result.payload)) return result.payload.length;
        /* result itself is spread from an array — check root for multiple names */
        return 0;
    }
    function escapeHtml(value) {
        return asString(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    FlowPilotConverter.isPlainObject = isPlainObject;
    FlowPilotConverter.deepClone = deepClone;
    FlowPilotConverter.asString = asString;
    FlowPilotConverter.hasOwn = hasOwn;
    FlowPilotConverter.firstNonEmpty = firstNonEmpty;
    FlowPilotConverter.pickUnknownKeys = pickUnknownKeys;
    FlowPilotConverter.applyUnknownFields = applyUnknownFields;
    FlowPilotConverter.formatJson = formatJson;
    FlowPilotConverter.formatSize = formatSize;
    FlowPilotConverter.buildTimestampTag = buildTimestampTag;
    FlowPilotConverter.nowIso = nowIso;
    FlowPilotConverter.normalizeTimestamp = normalizeTimestamp;
    FlowPilotConverter.normalizeIsoString = normalizeIsoString;
    FlowPilotConverter.isoToEpochSeconds = isoToEpochSeconds;
    FlowPilotConverter.epochishToIso = epochishToIso;
    FlowPilotConverter.timestampFromUnixSeconds = timestampFromUnixSeconds;
    FlowPilotConverter.epochSecondsFromValue = epochSecondsFromValue;
    FlowPilotConverter.decodeBase64Url = decodeBase64Url;
    FlowPilotConverter.bytesToBase64Url = bytesToBase64Url;
    FlowPilotConverter.decodeJwtClaims = decodeJwtClaims;
    FlowPilotConverter.encodeBase64UrlJson = encodeBase64UrlJson;
    FlowPilotConverter.parseJwtPayload = parseJwtPayload;
    FlowPilotConverter.getOpenAIAuthSection = getOpenAIAuthSection;
    FlowPilotConverter.getOpenAIProfileSection = getOpenAIProfileSection;
    FlowPilotConverter.pickOrganizationIdFromAuth = pickOrganizationIdFromAuth;
    FlowPilotConverter.extractOpenAIInfo = extractOpenAIInfo;
    FlowPilotConverter.safeNameSegment = safeNameSegment;
    FlowPilotConverter.buildCodexFilename = buildCodexFilename;
    FlowPilotConverter.applyDownloadFormat = applyDownloadFormat;
    FlowPilotConverter.downloadTextFile = downloadTextFile;
    FlowPilotConverter.downloadSequentially = downloadSequentially;
    FlowPilotConverter.getModeValue = getModeValue;
    FlowPilotConverter.getModeLabel = getModeLabel;
    FlowPilotConverter.getWorkspaceValue = getWorkspaceValue;
    FlowPilotConverter.setWorkspaceValue = setWorkspaceValue;
    FlowPilotConverter.getSessionOutputFormatValue = getSessionOutputFormatValue;
    FlowPilotConverter.getSessionOutputLabel = getSessionOutputLabel;
    FlowPilotConverter.getIdleState = getIdleState;
    FlowPilotConverter.buildModeSummary = buildModeSummary;
    FlowPilotConverter.isCpaLike = isCpaLike;
    FlowPilotConverter.isWrappedCpaLike = isWrappedCpaLike;
    FlowPilotConverter.detectFormat = detectFormat;
    FlowPilotConverter.renderSelectedFiles = renderSelectedFiles;
    FlowPilotConverter.renderLocalSelectedFiles = renderLocalSelectedFiles;
    FlowPilotConverter.renderBadges = renderBadges;
    FlowPilotConverter.renderWarnings = renderWarnings;
    FlowPilotConverter.setDetailsState = setDetailsState;
    FlowPilotConverter.setBusy = setBusy;
    FlowPilotConverter.unwrapCpaRecord = unwrapCpaRecord;
    FlowPilotConverter.normalizeCpaRecord = normalizeCpaRecord;
    FlowPilotConverter.toNonNegativeInt = toNonNegativeInt;
    FlowPilotConverter.toNonNegativeNumber = toNonNegativeNumber;
    FlowPilotConverter.buildSubAccountFromCpa = buildSubAccountFromCpa;
    FlowPilotConverter.normalizeSubAccountToCpa = normalizeSubAccountToCpa;
    FlowPilotConverter.normalizeSubAccountToSub = normalizeSubAccountToSub;
    FlowPilotConverter.convertCpaPayload = convertCpaPayload;
    FlowPilotConverter.convertSubPayload = convertSubPayload;
    FlowPilotConverter.countAccountsInResult = countAccountsInResult;
    FlowPilotConverter.escapeHtml = escapeHtml;
})(FlowPilotConverter || (FlowPilotConverter = {}));

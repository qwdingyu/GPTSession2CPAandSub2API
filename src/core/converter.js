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
    function crc32(bytes) {
        let crc = 0xffffffff;
        for (let index = 0; index < bytes.length; index++) {
            crc ^= bytes[index];
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    function dosDateTime(value) {
        const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
        const year = Math.max(1980, date.getFullYear());
        return {
            time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
            date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
        };
    }
    function writeUint16(target, offset, value) {
        target[offset] = value & 0xff;
        target[offset + 1] = (value >>> 8) & 0xff;
    }
    function writeUint32(target, offset, value) {
        target[offset] = value & 0xff;
        target[offset + 1] = (value >>> 8) & 0xff;
        target[offset + 2] = (value >>> 16) & 0xff;
        target[offset + 3] = (value >>> 24) & 0xff;
    }
    function concatBytes(parts, totalLength) {
        const output = new Uint8Array(totalLength);
        let offset = 0;
        for (const part of parts) {
            output.set(part, offset);
            offset += part.length;
        }
        return output;
    }
    function normalizeZipEntryName(name, fallback) {
        const normalized = asString(name || fallback || 'file.json').replace(/\\/g, '/').split('/').filter(Boolean).join('/');
        return normalized && !normalized.startsWith('.') ? normalized : fallback || 'file.json';
    }
    function buildZipArchive(entries, options = {}) {
        const encoder = new TextEncoder();
        const now = options.now ? new Date(options.now) : new Date();
        const stamp = dosDateTime(now);
        const localParts = [];
        const centralParts = [];
        let offset = 0;

        /* 中文注释：这里实现 ZIP 的 store 模式（不压缩），避免新增依赖；JSON 文本可被系统原生解压，足以解决批量下载弹窗问题。 */
        entries.forEach((entry, index) => {
            const nameBytes = encoder.encode(normalizeZipEntryName(entry.name, `account_${index + 1}.json`));
            const dataBytes = entry.data instanceof Uint8Array ? entry.data : encoder.encode(asString(entry.data));
            const crc = crc32(dataBytes);
            const local = new Uint8Array(30 + nameBytes.length);
            writeUint32(local, 0, 0x04034b50);
            writeUint16(local, 4, 20);
            writeUint16(local, 6, 0x0800);
            writeUint16(local, 8, 0);
            writeUint16(local, 10, stamp.time);
            writeUint16(local, 12, stamp.date);
            writeUint32(local, 14, crc);
            writeUint32(local, 18, dataBytes.length);
            writeUint32(local, 22, dataBytes.length);
            writeUint16(local, 26, nameBytes.length);
            writeUint16(local, 28, 0);
            local.set(nameBytes, 30);
            localParts.push(local, dataBytes);

            const central = new Uint8Array(46 + nameBytes.length);
            writeUint32(central, 0, 0x02014b50);
            writeUint16(central, 4, 20);
            writeUint16(central, 6, 20);
            writeUint16(central, 8, 0x0800);
            writeUint16(central, 10, 0);
            writeUint16(central, 12, stamp.time);
            writeUint16(central, 14, stamp.date);
            writeUint32(central, 16, crc);
            writeUint32(central, 20, dataBytes.length);
            writeUint32(central, 24, dataBytes.length);
            writeUint16(central, 28, nameBytes.length);
            writeUint16(central, 30, 0);
            writeUint16(central, 32, 0);
            writeUint16(central, 34, 0);
            writeUint16(central, 36, 0);
            writeUint32(central, 38, 0);
            writeUint32(central, 42, offset);
            central.set(nameBytes, 46);
            centralParts.push(central);
            offset += local.length + dataBytes.length;
        });

        const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
        const end = new Uint8Array(22);
        writeUint32(end, 0, 0x06054b50);
        writeUint16(end, 8, entries.length);
        writeUint16(end, 10, entries.length);
        writeUint32(end, 12, centralSize);
        writeUint32(end, 16, offset);
        writeUint16(end, 20, 0);
        return concatBytes([...localParts, ...centralParts, end], offset + centralSize + end.length);
    }
    function downloadZipFile(entries, fileName) {
        const bytes = buildZipArchive(entries);
        const blob = new Blob([bytes], { type: 'application/zip' });
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
            if (value.some(acc => isPlainObject(acc) && acc.tokens && acc.meta && acc.tokens.access_token)) return 'codex-manager';
            if (value.some(acc => isPlainObject(acc) && acc.credentials && acc.credentials.access_token)) return 'sub';
            if (value.some(acc => isPlainObject(acc) && acc.type === 'codex')) return 'cpa';
            return 'sub';
        }
        if (!isPlainObject(value)) return 'unknown';
        if (isPlainObject(value.tokens) && value.tokens.access_token && value.auth_mode) return 'axonhub';
        if (isPlainObject(value.tokens) && value.tokens.access_token && (value.OPENAI_API_KEY !== undefined || value.last_refresh)) return 'codex-auth';
        if (isPlainObject(value.tokens) && isPlainObject(value.meta) && value.tokens.access_token) return 'codex-manager';
        if (value.type === 'codex') return 'cpa';
        if (value.access_token || value.refresh_token || value.session_token) return 'cpa';
        if (Array.isArray(value.accounts)) {
            if (value.accounts.some(acc => isPlainObject(acc) && acc.tokens && acc.meta && acc.tokens.access_token)) return 'codex-manager';
            if (value.accounts.some(acc => isPlainObject(acc) && acc.type === 'codex')) return 'cpa';
            return 'sub';
        }
        if (value.provider === 'codex' && value.authType === 'oauth') return '9router';
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
    function firstTokenCandidate(record, keys) {
        for (const key of keys) {
            const direct = firstNonEmpty(record[key]);
            if (direct) return direct;
        }
        const containers = ['token', 'tokens', 'credentials', 'credential', 'auth', 'oauth'];
        for (const container of containers) {
            const nested = record[container];
            if (!isPlainObject(nested)) continue;
            for (const key of keys) {
                const value = firstNonEmpty(nested[key]);
                if (value) return value;
            }
        }
        return '';
    }
    function hasSessionIdentity(record) {
        if (!isPlainObject(record)) return false;
        if (isPlainObject(record.user)) return true;
        if (firstNonEmpty(record.email, record.name, record.id, record.account_id, record.chatgpt_account_id)) return true;
        if (firstNonEmpty(record.providerSpecificData?.chatgptAccountId, record.providerSpecificData?.chatgpt_account_id)) return true;
        if (firstNonEmpty(record.tokens?.account_id, record.meta?.email, record.meta?.chatgpt_account_id, record.meta?.label)) return true;
        if (firstNonEmpty(record.credentials?.email, record.credentials?.chatgpt_account_id, record.extra?.email, record.extra?.chatgpt_account_id)) return true;
        const accessPayload = parseJwtPayload(firstTokenCandidate(record, ['accessToken', 'access_token', 'idToken', 'id_token']));
        return Boolean(extractOpenAIInfo(accessPayload));
    }
    function isConvertibleSessionRecord(record) {
        if (!isPlainObject(record)) return false;
        return Boolean(firstTokenCandidate(record, ['accessToken', 'access_token'])) && hasSessionIdentity(record);
    }
    function findSessionCandidates(input, options) {
        const sourceName = firstNonEmpty(options?.sourceName, 'pasted-json');
        const candidates = [];
        const visited = new WeakSet();
        let scanned = 0;
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : undefined;

        /* 中文注释：这里使用 WeakSet 防止循环引用导致无限递归；虽然 JSON.parse 本身不会产生循环，
           但该函数也会被测试或未来代码直接传入对象，所以保留防御性设计。 */
        function visit(item, path) {
            if (!item || typeof item !== 'object') return;
            if (visited.has(item)) return;
            visited.add(item);
            scanned += 1;
            if (onProgress && scanned % 5000 === 0) onProgress(20, `搜索中...已扫描 ${scanned} 个节点`);
            if (Array.isArray(item)) {
                item.forEach((child, index) => visit(child, `${path}[${index}]`));
                return;
            }
            if (isConvertibleSessionRecord(item)) {
                candidates.push({ value: item, sourceName, path });
                return;
            }
            for (const [key, child] of Object.entries(item)) {
                /* 中文注释：令牌字符串体积可能很大且不可再递归，跳过它们可以明显降低大文件扫描成本。 */
                if (key === 'accessToken' || key === 'access_token' || key === 'sessionToken' || key === 'session_token') continue;
                visit(child, `${path}.${key}`);
            }
        }

        visit(input, '$');
        return candidates;
    }
    function getExpiresInSeconds(expiresAt, now) {
        if (!expiresAt) return undefined;
        const expires = Date.parse(expiresAt);
        if (!Number.isFinite(expires)) return undefined;
        return Math.max(0, Math.round((expires - now.getTime()) / 1000));
    }
    function emailKey(email) {
        return email ? email.replace(/[.+]/g, '_').toLowerCase() : undefined;
    }
    function detectSessionSourceType(record) {
        if (!isPlainObject(record)) return 'chatgpt_web_session';
        if (record.provider === 'codex' && record.authType === 'oauth') return '9router';
        if (record.auth_mode && isPlainObject(record.tokens)) return 'axonhub';
        if (isPlainObject(record.tokens) && isPlainObject(record.meta)) return 'codex_manager';
        if (isPlainObject(record.tokens) && (record.OPENAI_API_KEY !== undefined || record.last_refresh)) return 'codex_auth';
        if (isPlainObject(record.credentials) && (record.platform || record.extra)) return 'sub2api';
        if (record.type === 'codex') return record.account_note ? 'cockpit' : 'cpa';
        return 'chatgpt_web_session';
    }
    function pruneEmpty(value) {
        if (Array.isArray(value)) {
            return value.map(item => pruneEmpty(item)).filter(item => item !== undefined && item !== null);
        }
        if (!isPlainObject(value)) return value;
        const result = {};
        for (const [key, item] of Object.entries(value)) {
            if (item === undefined || item === null) continue;
            const cleaned = pruneEmpty(item);
            if (isPlainObject(cleaned) && Object.keys(cleaned).length === 0) continue;
            if (Array.isArray(cleaned) && cleaned.length === 0) continue;
            result[key] = cleaned;
        }
        return result;
    }
    function buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt) {
        if (!accountId) return '';
        const now = Math.trunc(Date.now() / 1000);
        const authInfo = { chatgpt_account_id: accountId };
        const expires = epochSecondsFromValue(expiresAt) || now + 90 * 24 * 60 * 60;
        if (planType) authInfo.chatgpt_plan_type = planType;
        if (userId) {
            authInfo.chatgpt_user_id = userId;
            authInfo.user_id = userId;
        }
        const payload = { iat: now, exp: expires, 'https://api.openai.com/auth': authInfo };
        if (email) payload.email = email;
        return `${encodeBase64UrlJson({ alg: 'none', typ: 'JWT', cpa_synthetic: true })}.${encodeBase64UrlJson(payload)}.`;
    }
    function normalizeSessionRecord(record, options) {
        if (!isPlainObject(record)) throw new Error('session 不是 JSON 对象');
        const now = options?.now ? new Date(options.now) : new Date();
        const sourceName = firstNonEmpty(options?.sourceName, 'pasted-json');
        const accessToken = firstTokenCandidate(record, ['accessToken', 'access_token']);
        if (!accessToken) throw new Error('缺少 accessToken');
        const sessionToken = firstTokenCandidate(record, ['sessionToken', 'session_token']);
        const refreshToken = firstTokenCandidate(record, ['refreshToken', 'refresh_token']);
        const inputIdToken = firstTokenCandidate(record, ['idToken', 'id_token']);
        const accessPayload = parseJwtPayload(accessToken);
        const idPayload = parseJwtPayload(inputIdToken);
        const auth = getOpenAIAuthSection(accessPayload);
        const idAuth = getOpenAIAuthSection(idPayload);
        const profile = getOpenAIProfileSection(accessPayload);
        const idProfile = getOpenAIProfileSection(idPayload);
        const user = isPlainObject(record.user) ? record.user : {};
        const providerData = isPlainObject(record.providerSpecificData) ? record.providerSpecificData : {};
        const credentials = isPlainObject(record.credentials) ? record.credentials : {};
        const tokens = isPlainObject(record.tokens) ? record.tokens : {};
        const meta = isPlainObject(record.meta) ? record.meta : {};
        const extra = isPlainObject(record.extra) ? record.extra : {};
        const expiresAt = firstNonEmpty(
            accessPayload ? timestampFromUnixSeconds(accessPayload.exp) : undefined,
            idPayload ? timestampFromUnixSeconds(idPayload.exp) : undefined,
            normalizeTimestamp(record.expires), normalizeTimestamp(record.expiresAt), normalizeTimestamp(record.expired), normalizeTimestamp(record.expires_at),
            normalizeTimestamp(credentials.expires_at), normalizeTimestamp(tokens.expires_at), normalizeTimestamp(extra.expires_at)
        );
        const email = firstNonEmpty(record.email, user.email, credentials.email, tokens.email, meta.email, extra.email, profile.email, idProfile.email, accessPayload?.email, idPayload?.email);
        const accountId = firstNonEmpty(record.accountId, record.account_id, record.chatgpt_account_id, credentials.chatgpt_account_id, tokens.account_id, meta.chatgpt_account_id, meta.workspace_id, extra.chatgpt_account_id, providerData.chatgptAccountId, providerData.chatgpt_account_id, auth.chatgpt_account_id, idAuth.chatgpt_account_id, auth.account_id, record.id);
        const userId = firstNonEmpty(record.userId, record.user_id, record.chatgpt_user_id, user.id, credentials.chatgpt_user_id, meta.chatgpt_user_id, extra.chatgpt_user_id, providerData.chatgptUserId, providerData.chatgpt_user_id, auth.chatgpt_user_id, idAuth.chatgpt_user_id, auth.user_id);
        const planType = firstNonEmpty(record.planType, record.plan_type, record.chatgpt_plan_type, credentials.plan_type, meta.plan_type, extra.plan_type, providerData.chatgptPlanType, providerData.chatgpt_plan_type, auth.chatgpt_plan_type, idAuth.chatgpt_plan_type);
        const exportedAt = normalizeTimestamp(now);
        const sourceType = detectSessionSourceType(record);
        const name = firstNonEmpty(record.name, user.name, meta.label, extra.name, email, sourceName, 'ChatGPT Account');
        const syntheticIdToken = inputIdToken ? '' : buildSyntheticCodexIdToken(email, accountId, planType, userId, expiresAt);
        const idToken = firstNonEmpty(inputIdToken, syntheticIdToken);
        const expiresIn = getExpiresInSeconds(expiresAt, now);
        const priority = Number.isFinite(Number(record.priority)) ? Number(record.priority) : 9;
        const isActive = typeof record.isActive === 'boolean' ? record.isActive : !Boolean(record.disabled);
        const createdAt = normalizeTimestamp(record.createdAt) || normalizeTimestamp(record.created_at) || exportedAt;
        const updatedAt = normalizeTimestamp(record.updatedAt) || normalizeTimestamp(record.updated_at) || exportedAt;

        /* 中文注释：内部统一记录同时携带各目标格式，UI 只负责选择输出，不再复制业务转换逻辑。 */
        const cpa = pruneEmpty({
            type: 'codex',
            account_id: accountId,
            chatgpt_account_id: accountId,
            email,
            name,
            plan_type: planType,
            chatgpt_plan_type: planType,
            id_token: idToken,
            id_token_synthetic: Boolean(syntheticIdToken) || undefined,
            access_token: accessToken,
            refresh_token: refreshToken || '',
            session_token: sessionToken,
            last_refresh: exportedAt,
            expired: expiresAt,
            disabled: Boolean(record.disabled) || undefined,
        });
        const cockpit = pruneEmpty({
            type: 'codex',
            id_token: idToken,
            access_token: accessToken,
            refresh_token: refreshToken || '',
            account_id: accountId,
            last_refresh: exportedAt,
            email,
            expired: expiresAt,
            account_note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark),
        });
        const codexTokens = pruneEmpty({
            id_token: accessToken,
            access_token: accessToken,
            refresh_token: refreshToken || '',
            account_id: accountId,
        });
        const codexAuth = { OPENAI_API_KEY: null, tokens: codexTokens, last_refresh: exportedAt };
        const axonHubAuth = {
            auth_mode: 'chatgpt',
            last_refresh: exportedAt,
            tokens: pruneEmpty({
                access_token: accessToken,
                refresh_token: refreshToken || '__missing_refresh_token__',
                id_token: idToken,
                account_id: accountId,
            }),
        };
        const codexManagerAccount = pruneEmpty({
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken || '',
                id_token: idToken,
                account_id: accountId,
            },
            meta: {
                label: firstNonEmpty(name, email, accountId, sourceName),
                workspace_id: accountId,
                chatgpt_account_id: accountId,
                chatgpt_user_id: userId,
                email,
                plan_type: planType,
                note: firstNonEmpty(record.account_note, record.accountInfo, record.account_info, record.note, record.notes, record.remark),
                source: sourceType,
                last_refresh: exportedAt,
            },
        });
        const sub2apiAccount = pruneEmpty({
            name,
            platform: 'openai',
            type: 'oauth',
            concurrency: 10,
            priority: 1,
            credentials: {
                access_token: accessToken,
                refresh_token: refreshToken || undefined,
                chatgpt_account_id: accountId,
                chatgpt_user_id: userId,
                email,
                expires_at: expiresAt,
                expires_in: expiresIn,
                plan_type: planType,
            },
            extra: {
                email,
                email_key: emailKey(email),
                name,
                auth_provider: firstNonEmpty(record.authProvider, record.auth_provider),
                source: sourceType,
                last_refresh: exportedAt,
            },
        });
        const nineRouterAccount = pruneEmpty({
            name,
            platform: 'openai',
            type: 'oauth',
            priority,
            isActive,
            credentials: {
                client_id: 'codex',
                access_token: accessToken,
                refresh_token: refreshToken || '',
                id_token: idToken,
                expires_at: expiresAt,
            },
            extra: {
                email,
                email_key: emailKey(email),
                name,
                auth_provider: 'openai',
                source: sourceType,
                last_refresh: exportedAt,
                created_at: createdAt,
                updated_at: updatedAt,
            },
        });
        return { name, email, expiresAt, planType, accountId, userId, sourceName, sourcePath: options?.sourcePath, sourceType, accessToken, sessionToken, refreshToken, idToken, syntheticIdToken: Boolean(syntheticIdToken), cpa, cockpit, codexAuth, axonHubAuth, codexManagerAccount, sub2apiAccount, nineRouterAccount };
    }
    function buildSessionCompatibilityReport(converted, skipped) {
        const items = Array.isArray(converted) ? converted : [];
        const sourceTypes = {};
        let missingRefreshToken = 0;
        let syntheticIdToken = 0;
        let missingExpiresAt = 0;
        let missingAccountId = 0;
        for (const item of items) {
            sourceTypes[item.sourceType || 'unknown'] = (sourceTypes[item.sourceType || 'unknown'] || 0) + 1;
            if (!item.refreshToken) missingRefreshToken += 1;
            if (item.syntheticIdToken) syntheticIdToken += 1;
            if (!item.expiresAt) missingExpiresAt += 1;
            if (!item.accountId) missingAccountId += 1;
        }
        const attentionItems = [
            { key: 'missingRefreshToken', label: '缺少 refresh_token', count: missingRefreshToken, severity: 'warn', action: '可导出，但无法用于需要刷新 token 的长期账号池；建议重新获取完整登录态。' },
            { key: 'syntheticIdToken', label: '合成 id_token', count: syntheticIdToken, severity: 'info', action: '可导出，CPA/Cockpit/AxonHub/Codex-Manager 会使用占位 claims；若目标系统强校验真实 id_token，需重新获取。' },
            { key: 'missingExpiresAt', label: '缺少过期时间', count: missingExpiresAt, severity: 'info', action: '可导出，但无法提前判断失效时间；导入后应优先人工确认。' },
            { key: 'missingAccountId', label: '缺少 accountId', count: missingAccountId, severity: 'warn', action: '可导出，但账号去重和分组可能不稳定；建议补充或使用带账号 claims 的 token。' },
        ].filter(item => item.count > 0);
        const ready = Math.max(0, items.length - Math.max(missingRefreshToken, missingAccountId));
        const needsReview = items.length - ready;
        return {
            total: items.length,
            skipped: Array.isArray(skipped) ? skipped.length : 0,
            sourceTypes,
            missingRefreshToken,
            syntheticIdToken,
            missingExpiresAt,
            missingAccountId,
            ready,
            needsReview,
            attentionItems,
            quality: needsReview === 0 && (!Array.isArray(skipped) || skipped.length === 0) ? 'ready' : 'review',
        };
    }
    function parseSessionPayload(textOrPayload, options) {
        const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : undefined;
        const sourceName = firstNonEmpty(options?.sourceName, 'pasted-json');
        if (onProgress) onProgress(0, '解析 JSON...');
        const parsed = typeof textOrPayload === 'string' ? JSON.parse(textOrPayload) : textOrPayload;
        if (onProgress) onProgress(20, '搜索 session 对象...');
        const found = findSessionCandidates(parsed, { sourceName, onProgress });
        if (onProgress) onProgress(40, `转换 ${found.length} 个 session...`);
        const converted = [];
        const skipped = [];
        const now = options?.now ? new Date(options.now) : new Date();
        for (let index = 0; index < found.length; index++) {
            if (onProgress && index % 50 === 0) {
                const pct = found.length ? 40 + Math.round((index / found.length) * 50) : 90;
                onProgress(pct, `转换中 ${index}/${found.length}...`);
            }
            try {
                converted.push(normalizeSessionRecord(found[index].value, { now, sourceName: found[index].sourceName, sourcePath: found[index].path }));
            } catch (error) {
                skipped.push({ sourceName: found[index].sourceName, path: found[index].path, reason: error.message || '无法转换' });
            }
        }
        if (onProgress) onProgress(95, '生成输出...');
        return { converted, skipped, found, report: buildSessionCompatibilityReport(converted, skipped) };
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
    FlowPilotConverter.buildZipArchive = buildZipArchive;
    FlowPilotConverter.downloadZipFile = downloadZipFile;
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
    FlowPilotConverter.findSessionCandidates = findSessionCandidates;
    FlowPilotConverter.normalizeSessionRecord = normalizeSessionRecord;
    FlowPilotConverter.buildSessionCompatibilityReport = buildSessionCompatibilityReport;
    FlowPilotConverter.parseSessionPayload = parseSessionPayload;
    FlowPilotConverter.countAccountsInResult = countAccountsInResult;
    FlowPilotConverter.escapeHtml = escapeHtml;
})(FlowPilotConverter || (FlowPilotConverter = {}));

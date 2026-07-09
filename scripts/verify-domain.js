const https = require('node:https');

const baseUrl = process.env.PRODUCTION_URL || 'https://ai.eforge.xyz/';
const attempts = Number.parseInt(process.env.VERIFY_ATTEMPTS || '6', 10);
const intervalMs = Number.parseInt(process.env.VERIFY_INTERVAL_MS || '10000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(path = '/', method = 'GET') {
  const url = new URL(path, baseUrl);
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method,
        headers: { host: url.hostname },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, headers: res.headers, body }));
      },
    );
    req.on('error', (error) => resolve({ error: error.message, statusCode: 0, headers: {}, body: '' }));
    req.end();
  });
}

function assertHeader(headers, name, expected) {
  const value = String(headers[name] || '');
  if (!value.includes(expected)) throw new Error(`Missing ${name}: ${expected}. Actual: ${value}`);
}

async function verifyOnce() {
  const head = await request('/', 'HEAD');
  if (head.error) throw new Error(head.error);
  if (head.statusCode < 200 || head.statusCode >= 400) throw new Error(`Unexpected HEAD status: ${head.statusCode}`);
  assertHeader(head.headers, 'content-security-policy', "connect-src 'none'");
  assertHeader(head.headers, 'content-security-policy', "script-src 'self'");
  assertHeader(head.headers, 'x-frame-options', 'DENY');

  const home = await request('/?verify=ci');
  if (!home.body.includes('AI Forge')) throw new Error('Home page missing AI Forge marker');
  if (!home.body.includes('https://ai.eforge.xyz/')) throw new Error('Home page missing production domain metadata');

  const convert = await request('/convert');
  if (!convert.body.includes('ChatGPT Session Converter')) throw new Error('Convert page missing title marker');
  if (!convert.body.includes('转换结果包含可用凭证')) throw new Error('Convert page missing sensitive output warning');
}

(async () => {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`Verify ${baseUrl} attempt ${attempt}/${attempts}`);
      await verifyOnce();
      console.log(`domain verify passed: ${baseUrl}`);
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      console.log(`Verify failed: ${error.message}`);
      await sleep(intervalMs);
    }
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

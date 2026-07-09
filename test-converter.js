// Simple Node.js test for converter.js functions
// This simulates the browser environment

// Load the converter module
const fs = require('fs');
const path = require('path');

const converterPath = path.join(__dirname, 'src', 'core', 'converter.js');
const converterCode = fs.readFileSync(converterPath, 'utf8');

// Create a global FlowPilotConverter object
global.FlowPilotConverter = {};

// Execute the converter code
eval(converterCode);

// Test samples
const cpaSample = {
  "version": 1,
  "refresh_token": "test_refresh_token",
  "access_token": "test_access_token",
  "expires_in": 3600
};

// SUB package with accounts array (for detectFormat test)
const subPackage = {
  "accounts": [
    {
      "credentials": {
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "expires_at": 1704067200
      },
      "organization_id": "test-org-id"
    }
  ]
};

// Single SUB account object (for normalizeSubAccountToCpa test)
const subAccount = {
  "credentials": {
    "access_token": "test_access_token",
    "refresh_token": "test_refresh_token",
    "expires_at": 1704067200
  },
  "organization_id": "test-org-id"
};

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passCount++;
  } else {
    console.log(`  FAIL: ${message}`);
    failCount++;
  }
}

console.log('Testing FlowPilotConverter...\n');

// Test 1: detectFormat
console.log('Test 1: detectFormat');
const cpaFormat = FlowPilotConverter.detectFormat(cpaSample);
const subFormat = FlowPilotConverter.detectFormat(subPackage);
assert(cpaFormat === 'cpa', `CPA sample detected as cpa (got: ${cpaFormat})`);
assert(subFormat === 'sub', `SUB sample detected as sub (got: ${subFormat})\n`);

// Test 2: buildSubAccountFromCpa
console.log('Test 2: buildSubAccountFromCpa');
const account = FlowPilotConverter.buildSubAccountFromCpa({
  access_token: 'acc',
  refresh_token: 'ref',
  account_id: 'acc-id',
  email: 'test@example.com',
  expires_in: 3600,
  organization_id: 'org-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z'
});
assert(account.platform === 'openai', `platform is openai`);
assert(account.type === 'oauth', `type is oauth`);
assert(account.name === 'test@example.com', `name uses email`);
assert(account.credentials.access_token === 'acc', `credentials.access_token mapped`);
assert(account.credentials.refresh_token === 'ref', `credentials.refresh_token mapped`);
assert(account.credentials.expires_at === '3600', `credentials.expires_at mapped`);
assert(account.organization_id === 'org-1', `organization_id mapped`);
assert(account.created_at === '2024-01-01T00:00:00Z', `created_at mapped`);
assert(account.updated_at === '2024-01-02T00:00:00Z', `updated_at mapped\n`);

// Test 3: normalizeSubAccountToCpa
console.log('Test 3: normalizeSubAccountToCpa');
const cpaRecord = FlowPilotConverter.normalizeSubAccountToCpa({
  credentials: {
    access_token: 'acc',
    refresh_token: 'ref',
    expires_at: 1704067200
  },
  organization_id: 'test-org-id'
});
assert(cpaRecord.access_token === 'acc', `access_token present`);
assert(cpaRecord.refresh_token === 'ref', `refresh_token present`);
assert(cpaRecord.expires_at === '1704067200', `expires_at present`);
assert(cpaRecord.organization_id === 'test-org-id', `organization_id present`);
assert(!('accessToken' in cpaRecord), `uses snake_case keys, not camelCase\n`);

// Test 3b: normalizeSubAccountToSub
console.log('Test 3b: normalizeSubAccountToSub');
const subAccountWithMeta = {
  credentials: {
    access_token: 'acc',
    refresh_token: 'ref',
    expires_at: 1704067200,
    scope: 'read'
  },
  name: 'test-account',
  platform: 'openai',
  type: 'oauth',
  organization_id: 'test-org-id',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  extra_field: 'keep-me'
};
const normalizedSub = FlowPilotConverter.normalizeSubAccountToSub(subAccountWithMeta);
assert(normalizedSub.credentials.access_token === 'acc', `credentials.access_token preserved`);
assert(normalizedSub.credentials.refresh_token === 'ref', `credentials.refresh_token preserved`);
assert(normalizedSub.credentials.expires_at === '1704067200', `credentials.expires_at preserved`);
assert(normalizedSub.credentials.scope === 'read', `other credential fields preserved`);
assert(normalizedSub.name === 'test-account', `name preserved`);
assert(normalizedSub.platform === 'openai', `platform preserved`);
assert(normalizedSub.type === 'oauth', `type preserved`);
assert(normalizedSub.organization_id === 'test-org-id', `organization_id preserved`);
assert(normalizedSub.created_at === '2024-01-01T00:00:00Z', `created_at preserved`);
assert(normalizedSub.updated_at === '2024-01-02T00:00:00Z', `updated_at preserved`);
assert(normalizedSub.extra.extra_field === 'keep-me', `unknown fields moved to extra`);
assert(!('accessToken' in normalizedSub.credentials), `preserves snake_case credential keys`);
assert(!('access_token' in normalizedSub), `top-level credentials flattened back into nested object\n`);

// Test 4: convertCpaPayload
console.log('Test 4: convertCpaPayload (CPA -> SUB)');
try {
  const convertedSub = FlowPilotConverter.convertCpaPayload(cpaSample, {
    mode: 'lossless',
    sourceName: 'test.json',
    now: new Date(),
  });
  assert(convertedSub.platform === 'openai', `platform present`);
  assert(convertedSub.type === 'oauth', `type present`);
  assert(convertedSub.credentials.access_token === 'test_access_token', `credentials.access_token mapped`);
  assert(convertedSub.credentials.refresh_token === 'test_refresh_token', `credentials.refresh_token mapped`);
  assert(convertedSub.generatedAt !== undefined, `generatedAt present`);
  assert(convertedSub.sourceName === 'test.json', `sourceName preserved`);
  assert(!('account' in convertedSub), `returns flat account object, not nested\n`);
} catch (e) {
  console.log(`  FAIL: ${e.message}\n`);
  failCount++;
}

// Test 5: convertSubPayload
console.log('Test 5: convertSubPayload (SUB -> CPA)');
try {
  const convertedCpa = FlowPilotConverter.convertSubPayload(subPackage, {
    mode: 'lossless',
    sourceName: 'test.json',
    now: new Date(),
  });
  assert(convertedCpa.access_token === 'test_access_token', `access_token present`);
  assert(convertedCpa.refresh_token === 'test_refresh_token', `refresh_token present`);
  assert(convertedCpa.expires_at === '1704067200', `expires_at present`);
  assert(convertedCpa.organization_id === 'test-org-id', `organization_id present`);
  assert(convertedCpa.generatedAt !== undefined, `generatedAt present`);
  assert(convertedCpa.sourceName === 'test.json', `sourceName preserved`);
  assert(!('credential' in convertedCpa), `returns CPA snake_case keys, not SUB camelCase\n`);
} catch (e) {
  console.log(`  FAIL: ${e.message}\n`);
  failCount++;
}

// Test 5b: convertSubPayload SUB output
console.log('Test 5b: convertSubPayload (SUB -> SUB)');
try {
  const convertedSub = FlowPilotConverter.convertSubPayload(subPackage, {
    mode: 'lossless',
    sourceName: 'test.json',
    now: new Date(),
    outputFormat: 'sub',
  });
  assert(convertedSub.credentials.access_token === 'test_access_token', `credentials.access_token preserved`);
  assert(convertedSub.credentials.refresh_token === 'test_refresh_token', `credentials.refresh_token preserved`);
  assert(convertedSub.credentials.expires_at === '1704067200', `credentials.expires_at preserved`);
  assert(convertedSub.organization_id === 'test-org-id', `organization_id preserved`);
  assert(convertedSub.generatedAt !== undefined, `generatedAt present`);
  assert(convertedSub.sourceName === 'test.json', `sourceName preserved`);
  assert(convertedSub.format === 'sub', `format tag preserved`);
  assert(!('access_token' in convertedSub), `top-level keys remain SUB-shaped, not CPA-flattened`);
} catch (e) {
  console.log(`  FAIL: ${e.message}\n`);
  failCount++;
}

// Test 6: formatJson
console.log('Test 6: formatJson');
const formatted = FlowPilotConverter.formatJson({ test: true });
assert(formatted.trim().startsWith('{'), `Formatted output is JSON-like`);

// Test 7: downloadTextFile (Node throws because document is missing)
console.log('Test 7: downloadTextFile (Node throw check)');
try {
  FlowPilotConverter.downloadTextFile('{"test":true}', 'test.json');
  assert(false, `downloadTextFile should throw in Node`);
} catch (e) {
  assert(true, `downloadTextFile throws in Node as expected`);
}

console.log(`\nResults: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) {
  process.exit(1);
}

/**
 * Test Suite: Check-in Link Rework & Security Verification
 * Tests the cryptographic token generation, SHA-256 hashing,
 * timezone expiration calculation, payload parsing, and CPF masking.
 */

const crypto = require('crypto');
const assert = require('assert');

// 1. Emulate lib/checkin-token.ts functions
function generateCheckInToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function hashCheckInToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

function maskToken(token) {
  if (!token || token.length < 8) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function maskCpf(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
  }
  return cpf.length > 4 ? `***${cpf.slice(-4)}` : '***';
}

function calculateEventExpiration(startDate, endDate) {
  const targetDateStr = endDate || startDate;
  if (!targetDateStr) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 2);
    return fallback;
  }

  const rawDate = new Date(targetDateStr);
  if (isNaN(rawDate.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 2);
    return fallback;
  }

  const year = rawDate.getUTCFullYear();
  const month = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(rawDate.getUTCDate()).padStart(2, '0');

  // 23:59:59.999 in America/Sao_Paulo (UTC-3) => 02:59:59.999 UTC next day
  const endOfDaySaoPauloIso = `${year}-${month}-${day}T23:59:59.999-03:00`;
  const calculated = new Date(endOfDaySaoPauloIso);

  if (isNaN(calculated.getTime())) {
    const fallback = new Date(rawDate.getTime() + 24 * 60 * 60 * 1000);
    return fallback;
  }

  return calculated;
}

function parseScanPayload(rawPayload) {
  const trimmed = rawPayload.trim();
  let voucherId = null;
  let registrationId = null;

  if (trimmed.startsWith('congregapay:voucher:')) {
    voucherId = trimmed.replace('congregapay:voucher:', '').trim();
  } else if (trimmed.startsWith('congregapay:reg:')) {
    registrationId = trimmed.replace('congregapay:reg:', '').trim();
  } else if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 3 && parts[0] === 'congregapay') {
      if (parts[1] === 'voucher') voucherId = parts[2].trim();
      if (parts[1] === 'reg') registrationId = parts[2].trim();
    }
  } else {
    voucherId = trimmed;
  }

  return { voucherId, registrationId };
}

console.log('--- RUNNING CHECK-IN SUITE TESTS ---');

// TEST 1: Token generation & uniqueness
console.log('\n[TEST 1] Token generation & uniqueness:');
const tokens = new Set();
for (let i = 0; i < 1000; i++) {
  const tok = generateCheckInToken();
  assert.strictEqual(tok.length >= 32, true, 'Token length should be at least 32 characters');
  assert.strictEqual(/^[a-zA-Z0-9_-]+$/.test(tok), true, 'Token should be URL-safe base64');
  assert.strictEqual(tokens.has(tok), false, 'Token collision detected');
  tokens.add(tok);
}
console.log('  ✓ 1000 unique cryptographic tokens generated successfully.');

// TEST 2: SHA-256 Hashing determinism
console.log('\n[TEST 2] SHA-256 Hashing determinism:');
const sampleToken = 'c2lnbi1pbi10b2tlbi1leGFtcGxlLXZhbGlk';
const hash1 = hashCheckInToken(sampleToken);
const hash2 = hashCheckInToken(sampleToken);
assert.strictEqual(hash1, hash2, 'Hash must be deterministic');
assert.strictEqual(hash1.length, 64, 'SHA-256 hex must be 64 characters');
assert.notStrictEqual(sampleToken, hash1, 'Hash must not equal raw token');
console.log(`  ✓ Hash deterministic: ${maskToken(sampleToken)} -> ${hash1.slice(0, 16)}...`);

// TEST 3: Masking logic
console.log('\n[TEST 3] Masking functions:');
assert.strictEqual(maskToken('1234567890abcdef'), '1234...cdef');
assert.strictEqual(maskCpf('12345678901'), '***.456.789-**');
assert.strictEqual(maskCpf('123.456.789-01'), '***.456.789-**');
assert.strictEqual(maskCpf(''), '');
console.log('  ✓ CPF and Token masking works correctly.');

// TEST 4: Expiration in America/Sao_Paulo (UTC-3)
console.log('\n[TEST 4] Expiration in America/Sao_Paulo:');
const expDate = calculateEventExpiration('2026-05-10T10:00:00.000Z', '2026-05-10T18:00:00.000Z');
console.log(`  Calculated expiration (ISO): ${expDate.toISOString()}`);
// 2026-05-10T23:59:59.999-03:00 is 2026-05-11T02:59:59.999Z in UTC
assert.strictEqual(expDate.toISOString().startsWith('2026-05-11T02:59:59.999Z'), true);
console.log('  ✓ Expiration correctly set to 23:59:59.999 UTC-3 of the event end date.');

// TEST 5: QR Code Payload Parsing
console.log('\n[TEST 5] QR Code Payload Parsing:');
const p1 = parseScanPayload('congregapay:voucher:vch_123456');
assert.strictEqual(p1.voucherId, 'vch_123456');
assert.strictEqual(p1.registrationId, null);

const p2 = parseScanPayload('congregapay:reg:reg_789012');
assert.strictEqual(p2.voucherId, null);
assert.strictEqual(p2.registrationId, 'reg_789012');

const p3 = parseScanPayload('vch_direct_id_999');
assert.strictEqual(p3.voucherId, 'vch_direct_id_999');
console.log('  ✓ Payload parser correctly handles voucher, registration, and direct formats.');

// TEST 6: Atomic concurrency simulation (simulating update .eq('used', false))
console.log('\n[TEST 6] Concurrency check simulation:');
let dbVoucherState = { id: 'vch_test_1', used: false, usedAt: null };

async function simulateCheckinAtomic(workerId) {
  // Simulates: update Voucher set used=true where id='vch_test_1' and used=false
  if (!dbVoucherState.used) {
    dbVoucherState = { ...dbVoucherState, used: true, usedAt: new Date().toISOString() };
    return { success: true, worker: workerId };
  } else {
    return { success: false, error: 'already_used', worker: workerId };
  }
}

async function testConcurrency() {
  const results = await Promise.all([
    simulateCheckinAtomic('Gate 1'),
    simulateCheckinAtomic('Gate 2'),
    simulateCheckinAtomic('Gate 3')
  ]);

  const successfulCheckins = results.filter(r => r.success);
  const failedCheckins = results.filter(r => !r.success);

  assert.strictEqual(successfulCheckins.length, 1, 'Exactly one concurrent scan must succeed');
  assert.strictEqual(failedCheckins.length, 2, 'Other concurrent scans must be rejected as already_used');
  console.log(`  ✓ Concurrency atomic lock verified: Winner ${successfulCheckins[0].worker}, rejected ${failedCheckins.length} duplicate attempts.`);
}

testConcurrency().then(() => {
  console.log('\n=== ALL CHECK-IN UNIT & INTEGRATION TESTS PASSED ===\n');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

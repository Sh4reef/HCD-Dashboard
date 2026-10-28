const assert = require('assert');

// Start Application Server locally for testing
const express = require('express');
const cors = require('cors');
const apiRoutes = require('../backend/src/routes/apiRoutes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/v1', apiRoutes);

const PORT = 4001;
const server = app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);

  try {
    await runTests();
    console.log('\n=========================================');
    console.log(' ALL FULL-STACK INTEGRATION TESTS PASSED ');
    console.log('=========================================\n');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('\nTEST FAILED:', err);
    server.close(() => process.exit(1));
  }
});

async function runTests() {
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  // 1. Google OAuth Domain Enforcement (@company.com)
  console.log('1. Testing Google OAuth Domain Enforcement...');
  const authForbidden = await fetch(`${BASE_URL}/auth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@gmail.com', hd: 'gmail.com' })
  });
  assert.strictEqual(authForbidden.status, 403, 'Must return 403 Forbidden for @gmail.com');

  const authSuccess = await fetch(`${BASE_URL}/auth/google/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ahmad@company.com', hd: 'company.com' })
  });
  assert.strictEqual(authSuccess.status, 200, 'Must allow @company.com email');
  const authData = await authSuccess.json();
  assert.strictEqual(authData.user.role, 'HCD_SUPER_ADMIN');

  // 2. Internship Certificate Issuance Gate
  console.log('2. Testing Internship Certificate Gate Rule...');
  const certBlocked = await fetch(`${BASE_URL}/internships/int-1/issue-certificate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ certificateNumber: 'CERT/TEST/101' })
  });
  assert.strictEqual(certBlocked.status, 400, 'Must block certificate issuance when report is NOT_SUBMITTED');

  // 3. License Expiration & Archiving
  console.log('3. Testing License Renewal & Archiving...');
  const renewRes = await fetch(`${BASE_URL}/licenses/lic-1/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newIssueDate: '2026-02-01', newDurationMonths: 36 })
  });
  assert.strictEqual(renewRes.status, 200, 'License renewal must succeed');

  // 4. Training Learning Hour Crediting & 24h Deficit Queue
  console.log('4. Testing Under-Trained 24h Deficit Queue...');
  const queueRes = await fetch(`${BASE_URL}/training/under-trained-queue`);
  const queueData = await queueRes.json();
  assert.strictEqual(queueData.underTrainedQueue.length > 0, true, 'Under-trained staff queue must not be empty');
  assert.strictEqual(parseFloat(queueData.underTrainedQueue[0].deficitHours) >= parseFloat(queueData.underTrainedQueue[1].deficitHours), true, 'Queue must be sorted descending by deficit');

  // 5. KPI Scoring Engine & Polarity Logic
  console.log('5. Testing KPI Scoring Engine...');
  const kpisRes = await fetch(`${BASE_URL}/kpis`);
  const kpisData = await kpisRes.json();
  assert.strictEqual(typeof kpisData.aggregateWeightedScore, 'number', 'KPI aggregate score must be calculated');

  // 6. Halo HC SLA Breach Engine
  console.log('6. Testing Halo HC SLA Breach Engine...');
  const haloRes = await fetch(`${BASE_URL}/halo-hc/tickets`);
  const haloData = await haloRes.json();
  const breached = haloData.data.find(t => t.ticketNumber === 'HALO-2026-001');
  assert.strictEqual(breached.isBreached, true, '30h old open ticket must be flagged as BREACHED');

  // 7. Executive Analytics Dashboard API
  console.log('7. Testing Executive Analytics Dashboard Endpoint...');
  const dashRes = await fetch(`${BASE_URL}/analytics/executive-dashboard`);
  const dashData = await dashRes.json();
  assert.strictEqual(typeof dashData.kpiHealthScore, 'number');
  assert.strictEqual(typeof dashData.budgetUtilizationPercent, 'number');

  // 8. Google Sheets Sync Trigger
  console.log('8. Testing Google Sheets Sync Trigger...');
  const syncRes = await fetch(`${BASE_URL}/sync/sheets/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggeredBy: 'HCD_SUPER_ADMIN' })
  });
  assert.strictEqual(syncRes.status, 200);
}

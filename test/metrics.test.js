'use strict';

// End-to-end: real server + real (temporary) database. Checks that the numbers the aggregate dashboard
// reads from /api/metrics are exactly the ones the admin "統計分析" tab shows.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TOKEN = 'test-only-token';
const json = { 'Content-Type': 'application/json' };

function freePort() {
  return new Promise(function (resolve, reject) {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', function () { const p = srv.address().port; srv.close(function () { resolve(p); }); });
    srv.on('error', reject);
  });
}

async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'survey-metrics-'));
  const env = Object.assign({}, process.env, {
    PORT: String(await freePort()), DB_PATH: path.join(dir, 'survey.db'), ADMIN_USER: 'admin', ADMIN_PASSWORD: 'test-only-password',
    SESSION_SECRET: 'test-only-secret', METRICS_TOKEN: TOKEN,
  });
  delete env.RESEND_API_KEY;
  execFileSync(process.execPath, ['seed.js'], { cwd: ROOT, env, stdio: 'ignore' });
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', function (d) { log += d; });
  child.stderr.on('data', function (d) { log += d; });
  const base = 'http://127.0.0.1:' + env.PORT;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(base + '/api/questions'); if (r.ok) return { base, child }; } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 100); });
  }
  child.kill();
  throw new Error('server did not start:\n' + log);
}
const stop = (srv) => new Promise(function (resolve) { srv.child.once('exit', resolve); srv.child.kill(); });

// answers for one response; every five-level question gets option number `likertIndex` (0 = 非常滿意)
function answersFor(questions, likertIndex) {
  return questions.map(function (q) {
    let value;
    if (q.type === 'likert5') value = q.options[likertIndex];
    else if (q.type === 'choice' || q.type === 'multichoice') value = q.options[0];
    else if (q.type === 'date') value = '2026-11-25';
    else if (/E-?MAIL/i.test(q.question_text)) value = 'a@b.co';
    else value = 'x';
    return { question_id: q.id, answer_value: value, suggestion_text: null };
  });
}

// The same formulas as public/admin.js renderLikertAnalytics (what the person sees in the admin tab).
function adminTabKpi(likert) {
  const scored = likert.filter((q) => q.average !== null);
  const totalResp = Math.max(...scored.map((q) => q.response_count));
  const overallAvg = (scored.reduce((s, q) => s + parseFloat(q.average), 0) / scored.length).toFixed(1);
  let vsCount = 0, vsTotal = 0;
  scored.forEach((q) => {
    const entries = Object.entries(q.distribution);
    if (entries.length > 0) vsCount += entries[0][1];
    vsTotal += Object.values(q.distribution).reduce((a, b) => a + b, 0);
  });
  return { overall_avg: Number(overallAvg), very_satisfied_pct: vsTotal > 0 ? Math.round(vsCount / vsTotal * 100) : 0, likert_response_count: totalResp };
}

test('/api/metrics: protected, empty survey, new responses show up at once, and matches the admin analytics tab', async () => {
  const srv = await startServer();
  try {
    const metrics = (headers) => fetch(srv.base + '/api/metrics', { headers: headers || { Authorization: 'Bearer ' + TOKEN } });

    assert.equal((await fetch(srv.base + '/api/metrics')).status, 401);
    assert.equal((await metrics({ Authorization: 'Bearer wrong' })).status, 401);

    // nothing submitted yet: no averages, zero counts
    let m = await (await metrics()).json();
    assert.equal(m.total_responses, 0);
    assert.equal(m.latest_id, 0);
    assert.equal(m.overall_avg, null);
    assert.equal(m.very_satisfied_pct, null);
    assert.equal(m.likert_response_count, 0);

    // three responses: all best, all second best, all best  ->  per question (5 + 4 + 5) / 3 = 4.67
    const questions = await (await fetch(srv.base + '/api/questions')).json();
    for (const idx of [0, 1, 0]) {
      const r = await fetch(srv.base + '/api/responses', { method: 'POST', headers: json, body: JSON.stringify({ answers: answersFor(questions, idx), lang: 'zh' }) });
      assert.equal(r.status, 201);
    }
    m = await (await metrics()).json();            // no waiting: a new response must refresh the numbers immediately
    assert.equal(m.total_responses, 3);
    assert.equal(m.today_responses, 3);
    assert.equal(m.latest_id, 3);
    assert.equal(m.overall_avg, 4.7);
    assert.equal(m.very_satisfied_pct, 67);        // 2 of 3 answers are the first option
    assert.equal(m.likert_response_count, 3);
    assert.equal(m.survey_state, 'open');
    assert.deepEqual(Object.keys(m).sort(), ['latest_at', 'latest_id', 'likert_response_count', 'now', 'overall_avg', 'survey_state', 'system', 'today_responses', 'total_responses', 'very_satisfied_pct']);

    // parity with what the admin tab computes from /api/admin/analytics
    const login = await fetch(srv.base + '/api/login', { method: 'POST', headers: json, body: JSON.stringify({ username: 'admin', password: 'test-only-password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const analytics = await (await fetch(srv.base + '/api/admin/analytics', { headers: { Cookie: cookie } })).json();
    const expected = adminTabKpi(analytics.likert);
    assert.equal(m.overall_avg, expected.overall_avg);
    assert.equal(m.very_satisfied_pct, expected.very_satisfied_pct);
    assert.equal(m.likert_response_count, expected.likert_response_count);

    // a 4th (worst) response changes the numbers right away and still matches the admin tab
    await fetch(srv.base + '/api/responses', { method: 'POST', headers: json, body: JSON.stringify({ answers: answersFor(questions, 4), lang: 'zh' }) });
    m = await (await metrics()).json();
    const analytics2 = await (await fetch(srv.base + '/api/admin/analytics', { headers: { Cookie: cookie } })).json();
    const expected2 = adminTabKpi(analytics2.likert);
    assert.equal(m.total_responses, 4);
    assert.equal(m.overall_avg, expected2.overall_avg);
    assert.equal(m.very_satisfied_pct, expected2.very_satisfied_pct);
    assert.equal(m.very_satisfied_pct, 50);        // 2 of 4
    assert.notEqual(m.overall_avg, 4.7);
  } finally {
    await stop(srv);
  }
});

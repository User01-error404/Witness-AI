const API = window.location.hostname === 'localhost' ? 'http://localhost:3001' : '';
let receipts = [], active = null;

// ── LOADING BAR ──
const loadingBar = document.getElementById('loading-bar');
function startLoad() { loadingBar.style.width = '60%'; loadingBar.classList.remove('done'); }
function endLoad() { loadingBar.style.width = '100%'; setTimeout(() => loadingBar.classList.add('done'), 300); }

// ── PARTICLE CANVAS ──
(function initCanvas() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#00ff88','#00d4ff','#a855f7','#3b82f6'];
  for (let i = 0; i < 70; i++) {
    pts.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
      r: Math.random() * 1.5 + .3,
      a: Math.random() * .6 + .15,
      c: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = p.a;
      ctx.fill();

      for (let j = i + 1; j < pts.length; j++) {
        const q = pts[j];
        const dx = p.x - q.x, dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 130) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = p.c;
          ctx.globalAlpha = 0.06 * (1 - dist / 130);
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ── COUNTER ANIMATION ──
function animCount(el, to, prefix = '', suffix = '') {
  const from = parseInt(el.textContent) || 0;
  if (from === to) return;
  let start = null;
  const dur = 600;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const val = Math.round(from + (to - from) * (p < .5 ? 2*p*p : -1+(4-2*p)*p));
    el.textContent = prefix + val + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── LOAD DATA ──
async function load() {
  startLoad();
  try {
    const r = await fetch(`${API}/api/receipts`);
    receipts = await r.json();
    document.getElementById('stat-status').textContent = '●';
    document.getElementById('stat-status').style.background = 'linear-gradient(135deg,#00ff88,#00d4ff)';
  } catch {
    receipts = [];
    document.getElementById('stat-status').textContent = '✕';
    document.getElementById('stat-status').style.background = 'linear-gradient(135deg,#ff2255,#ffb700)';
  }
  endLoad();
  render();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; }

// ── RENDER LIST ──
function render() {
  const list = document.getElementById('receipt-list');
  const badge = document.getElementById('count-badge');
  const statR = document.getElementById('stat-receipts');
  animCount(statR, receipts.length);
  badge.textContent = receipts.length;

  if (!receipts.length) {
    list.innerHTML = `<div class="empty">🔐<br><br>No receipts yet.<br><code>node agent/run-agent.js</code><br>then refresh.</div>`;
    return;
  }

  const latest = receipts.reduce((m, r) => Math.max(m, r.blockNumber || 0), 0);
  if (latest) {
    const el = document.getElementById('stat-block');
    animCount(el, latest, '#');
  }

  list.innerHTML = receipts.map((r, i) => `
    <div class="receipt-card" data-i="${i}" id="card-${i}">
      <div class="card-meta">RECEIPT #${r.receiptId} &nbsp;·&nbsp; ${new Date(r.timestamp).toLocaleTimeString()}</div>
      <div class="card-decision">${esc(r.decision)}</div>
      <div class="card-task">${esc(r.task)}</div>
      <div class="card-block">⛓ Block ${(r.blockNumber || 0).toLocaleString()}</div>
    </div>
  `).join('');

  list.querySelectorAll('.receipt-card').forEach(el =>
    el.addEventListener('click', () => select(parseInt(el.dataset.i)))
  );
}

// ── SELECT RECEIPT ──
function select(i) {
  active = JSON.parse(JSON.stringify(receipts[i]));
  document.querySelectorAll('.receipt-card').forEach(c => c.classList.remove('active'));
  document.getElementById('card-' + i)?.classList.add('active');
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('detail-body').style.display = 'block';
  document.getElementById('verify-result').className = 'verify-result';

  document.getElementById('f-agent').value = active.agent_id;
  document.getElementById('f-task').value = active.task;
  document.getElementById('f-input').value = active.input_seen;
  document.getElementById('f-reasoning').value = active.reasoning_summary;
  document.getElementById('f-decision').value = active.decision;
  document.getElementById('f-hash').textContent = active.contentHash;

  const txEl = document.getElementById('f-tx');
  txEl.innerHTML = active.txHash
    ? `<a class="chain-link" href="https://testnet.monadexplorer.com/tx/${active.txHash}" target="_blank">⛓ View on Monad Explorer ↗</a>`
    : '';
}

// ── VERIFY ──
async function verify() {
  if (!active) return;
  const btn = document.getElementById('btn-verify');
  btn.disabled = true;
  btn.innerHTML = '⏳ Querying Chain';
  btn.classList.add('btn-spin');

  const data = {
    agent_id: document.getElementById('f-agent').value,
    task: document.getElementById('f-task').value,
    input_seen: document.getElementById('f-input').value,
    reasoning_summary: document.getElementById('f-reasoning').value,
    decision: document.getElementById('f-decision').value,
    timestamp: active.timestamp
  };

  try {
    const r = await fetch(`${API}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiptId: active.receiptId, receiptData: data })
    });
    const result = await r.json();
    showResult(result.verified, result.message, result.recomputedHash);
  } catch (e) {
    showResult(false, 'Server unreachable. Is node server/index.js running?', null);
  }

  btn.disabled = false;
  btn.innerHTML = '⛓ Verify Against Chain';
  btn.classList.remove('btn-spin');
}

// ── SHOW RESULT ──
function showResult(ok, msg, hash) {
  const box = document.getElementById('verify-result');
  box.className = 'verify-result show ' + (ok ? 'ok' : 'fail');
  document.getElementById('res-icon').textContent = ok ? '✅' : '❌';
  document.getElementById('res-title').textContent = ok ? 'SEAL INTACT' : 'SEAL BROKEN';
  document.getElementById('res-msg').textContent = msg;
  document.getElementById('res-hash').textContent = hash ? 'Recomputed hash: ' + hash : '';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function reset() {
  if (!active) return;
  const i = receipts.findIndex(r => r.receiptId === active.receiptId);
  if (i >= 0) select(i);
}

document.getElementById('btn-verify').addEventListener('click', verify);
document.getElementById('btn-reset').addEventListener('click', reset);

load();
setInterval(load, 15000);

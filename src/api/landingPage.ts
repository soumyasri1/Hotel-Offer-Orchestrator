/**
 * Interactive landing page served at `GET /` to browsers.
 *
 * Everyone can search, compare suppliers, browse both catalogues and watch
 * health. After an admin login the page also offers adding/removing supplier
 * hotels and simulating outages — the server enforces this with a bearer
 * token, the page only decides what to show.
 *
 * Kept as a string module rather than a static file so `tsc` ships it in
 * `dist/` with no extra build or Dockerfile step. The client script avoids
 * backticks and `${` so it can live inside this template literal untouched.
 */
export const LANDING_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hotel Offer Orchestrator</title>
<style>
  :root {
    --bg: #f5f6f8; --surface: #ffffff; --surface-2: #f0f2f5; --text: #16181d; --muted: #5d6470;
    --border: #e1e4e9; --accent: #2f5bd3; --accent-text: #ffffff;
    --ok: #1d8049; --ok-weak: #e2f3e9; --warn: #9a5c00; --warn-weak: #fbefd9;
    --bad: #c0392b; --bad-weak: #fbe5e2; --a: #2f5bd3; --a-weak: #e7edfb; --b: #8340c9; --b-weak: #f1e8fa;
    --win: #e2f3e9; --win-border: #1d8049; --shadow: 0 10px 30px rgba(15, 20, 30, 0.18);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #111317; --surface: #1a1d23; --surface-2: #22262d; --text: #e8eaee; --muted: #9aa1ad;
      --border: #2d323a; --accent: #6b8ff0; --accent-text: #0d1220;
      --ok: #5cc98a; --ok-weak: #173325; --warn: #f0b252; --warn-weak: #3a2c12;
      --bad: #f07a6c; --bad-weak: #3d1d1a; --a: #7d9cf3; --a-weak: #1d2740; --b: #b78cf0; --b-weak: #2c2140;
      --win: #173325; --win-border: #5cc98a; --shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
  }
  :root[data-theme="dark"] {
    --bg: #111317; --surface: #1a1d23; --surface-2: #22262d; --text: #e8eaee; --muted: #9aa1ad;
    --border: #2d323a; --accent: #6b8ff0; --accent-text: #0d1220;
    --ok: #5cc98a; --ok-weak: #173325; --warn: #f0b252; --warn-weak: #3a2c12;
    --bad: #f07a6c; --bad-weak: #3d1d1a; --a: #7d9cf3; --a-weak: #1d2740; --b: #b78cf0; --b-weak: #2c2140;
    --win: #173325; --win-border: #5cc98a; --shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  code, .mono { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; }
  a { color: var(--accent); }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px; }
  header.top { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; margin-bottom: 20px; }
  .top-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 16px; margin: 0 0 12px; }
  .sub { margin: 0; color: var(--muted); max-width: 640px; }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
  @media (max-width: 900px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  .col { display: grid; gap: 16px; min-width: 0; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 18px; min-width: 0; }
  .card-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .card-head h2 { margin: 0; }
  .hint { color: var(--muted); font-size: 13px; margin: -4px 0 12px; }

  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; background: var(--surface-2); color: var(--muted); white-space: nowrap; }
  .pill.ok { background: var(--ok-weak); color: var(--ok); }
  .pill.warn { background: var(--warn-weak); color: var(--warn); }
  .pill.bad { background: var(--bad-weak); color: var(--bad); }
  .pill.admin { background: var(--b-weak); color: var(--b); }
  .pill.big { font-size: 14px; padding: 6px 14px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }

  .fields { display: grid; gap: 10px; align-items: end; }
  form.search { grid-template-columns: 1.4fr 1fr 1fr auto; }
  form.add { grid-template-columns: 0.8fr 1.4fr 1fr 0.9fr 0.8fr auto; padding: 14px; background: var(--surface-2); border-radius: 8px; margin-bottom: 12px; }
  @media (max-width: 700px) {
    form.search, form.add { grid-template-columns: 1fr 1fr; }
    form.search label:first-child, form.fields button[type="submit"] { grid-column: 1 / -1; }
  }
  label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); font-weight: 600; }
  input, select {
    font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 10px; width: 100%; min-width: 0;
  }
  input:focus, select:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  button {
    font: inherit; font-size: 14px; cursor: pointer; border-radius: 8px; padding: 8px 14px;
    border: 1px solid var(--border); background: var(--surface); color: var(--text);
  }
  button:hover { background: var(--surface-2); }
  button:disabled { opacity: 0.6; cursor: progress; }
  button.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); font-weight: 600; }
  button.primary:hover { filter: brightness(1.08); }
  button.small { padding: 4px 10px; font-size: 13px; }
  button.danger { color: var(--bad); }
  button.danger:hover { background: var(--bad-weak); }
  button.active { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); font-weight: 600; }
  .form-msg { margin: 8px 0 0; font-size: 13px; }
  .form-msg.ok { color: var(--ok); }
  .form-msg.bad { color: var(--bad); }

  .presets { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; }
  .presets span { font-size: 13px; color: var(--muted); align-self: center; margin-right: 2px; }
  .presets button { padding: 3px 10px; font-size: 13px; border-radius: 999px; }

  .request { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin: 16px 0 10px; padding: 8px 10px; background: var(--surface-2); border-radius: 8px; }
  .request code { overflow-wrap: anywhere; }
  .meta { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--muted); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); font-weight: 600; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.win { background: var(--win); box-shadow: inset 3px 0 0 var(--win-border); font-weight: 600; }
  td.muted, .muted { color: var(--muted); }
  td.act { text-align: right; width: 1%; }
  .sup { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 13px; font-weight: 600; }
  .sup-a { background: var(--a-weak); color: var(--a); }
  .sup-b { background: var(--b-weak); color: var(--b); }
  .cap { text-transform: capitalize; }

  .empty { color: var(--muted); padding: 18px; text-align: center; background: var(--surface-2); border-radius: 8px; margin: 0; }
  .error { border: 1px solid var(--bad); background: var(--bad-weak); border-radius: 8px; padding: 12px 14px; }
  .error b { color: var(--bad); }
  .error ul { margin: 6px 0 0; padding-left: 18px; }
  .loading { color: var(--muted); padding: 18px; text-align: center; }

  .deps { display: grid; gap: 8px; }
  .dep { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: center; padding: 10px 12px; background: var(--surface-2); border-radius: 8px; }
  .dep .dot { width: 10px; height: 10px; }
  .dep.up .dot { color: var(--ok); }
  .dep.down .dot { color: var(--bad); }
  .dep .name { font-weight: 600; }
  .dep .lat { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .dep .detail { grid-column: 2 / -1; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
  .dep.down .detail { color: var(--bad); }
  .foot { font-size: 12px; color: var(--muted); margin-top: 10px; }

  .ctl { padding: 12px; background: var(--surface-2); border-radius: 8px; display: grid; gap: 10px; }
  .ctl + .ctl { margin-top: 8px; }
  .ctl-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .btns { display: flex; gap: 6px; flex-wrap: wrap; }

  ul.links { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
  ul.links a { display: flex; justify-content: space-between; gap: 8px; padding: 7px 8px; border-radius: 6px; text-decoration: none; color: var(--text); }
  ul.links a:hover { background: var(--surface-2); }
  ul.links .m { font-size: 12px; font-weight: 700; color: var(--ok); }
  ol.flow { margin: 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; }
  ol.flow li::marker { color: var(--muted); }

  dialog {
    border: 1px solid var(--border); border-radius: 12px; padding: 22px; background: var(--surface); color: var(--text);
    width: min(400px, calc(100vw - 32px)); box-shadow: var(--shadow);
  }
  dialog::backdrop { background: rgba(10, 12, 16, 0.45); }
  dialog form { display: grid; gap: 12px; }
  dialog h2 { margin: 0; }
  dialog .hint { margin: 0; }
  .row-end { display: flex; justify-content: flex-end; gap: 8px; }

  .toast {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); max-width: calc(100vw - 32px);
    background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 8px; font-size: 14px;
    box-shadow: var(--shadow); opacity: 0; pointer-events: none; transition: opacity 0.2s;
  }
  .toast.show { opacity: 1; }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <h1>Hotel Offer Orchestrator</h1>
      <p class="sub">Calls two suppliers in parallel, keeps the best offer per hotel, and filters by price inside Redis. Every search runs a Temporal workflow.</p>
    </div>
    <div class="top-right">
      <span class="pill big" id="overall"><span class="dot"></span><span id="overallText">Checking health...</span></span>
      <span class="pill big" id="role">Viewer</span>
      <button type="button" id="loginBtn">Admin login</button>
      <button type="button" id="logoutBtn" hidden>Log out</button>
    </div>
  </header>

  <div class="grid">
    <div class="col">
      <section class="card">
        <h2>Search hotels</h2>
        <form class="fields search" id="searchForm" autocomplete="off">
          <label>City
            <input id="city" list="cities" value="delhi">
          </label>
          <label>Min price<input id="min" inputmode="numeric" placeholder="any"></label>
          <label>Max price<input id="max" inputmode="numeric" placeholder="any"></label>
          <button type="submit" class="primary" id="searchBtn">Search</button>
        </form>
        <datalist id="cities"></datalist>
        <div class="presets" id="presets">
          <span>Try:</span>
          <button type="button" data-city="delhi" data-min="" data-max="">Delhi</button>
          <button type="button" data-city="delhi" data-min="5000" data-max="9000">Delhi 5000-9000</button>
          <button type="button" data-city="mumbai" data-min="" data-max="">Mumbai</button>
          <button type="button" data-city="bengaluru" data-min="" data-max="">Bengaluru</button>
          <button type="button" data-city="jaipur" data-min="" data-max="">Jaipur (no hotels)</button>
          <button type="button" data-city="delhi" data-min="90000" data-max="99000">No match</button>
          <button type="button" data-city="" data-min="" data-max="">Missing city (400)</button>
          <button type="button" data-city="delhi" data-min="abc" data-max="">Bad price (400)</button>
          <button type="button" data-city="delhi" data-min="9000" data-max="1000">Min &gt; max (400)</button>
        </div>
        <div class="request">
          <code id="reqUrl">GET /api/hotels</code>
          <span class="meta" id="reqMeta"></span>
        </div>
        <div id="results"></div>
      </section>

      <section class="card">
        <h2>How each winner was picked</h2>
        <p class="hint">Raw offers from each supplier's API for <b id="cmpCity">-</b>. The highlighted cell is the offer the API returned. Rule: cheapest price, then higher commission, then supplier name.</p>
        <div id="compare"></div>
      </section>

      <section class="card">
        <div class="card-head">
          <h2>Supplier catalogues</h2>
          <label style="grid-auto-flow: column; align-items: center; gap: 8px;">City
            <select id="catCity"><option value="">All cities</option></select>
          </label>
        </div>
        <p class="hint" id="catSummary">Loading...</p>
        <p class="hint" data-viewer>Log in as admin to add or remove hotels.</p>
        <form class="fields add" id="addForm" autocomplete="off" data-admin hidden>
          <label>Supplier
            <select id="addSupplier"><option value="A">Supplier A</option><option value="B">Supplier B</option></select>
          </label>
          <label>Hotel name<input id="addName" placeholder="e.g. Hyatt"></label>
          <label>City<input id="addCity" list="cities" placeholder="e.g. delhi"></label>
          <label>Price<input id="addPrice" inputmode="numeric" placeholder="e.g. 6500"></label>
          <label>Commission %<input id="addComm" inputmode="decimal" placeholder="e.g. 12"></label>
          <button type="submit" class="primary" id="addBtn">Add hotel</button>
        </form>
        <p class="form-msg" id="addMsg" data-admin hidden></p>
        <div id="catalogue"></div>
      </section>

      <section class="card">
        <h2>What happens on each search</h2>
        <ol class="flow">
          <li>The API validates the query with zod and starts <code>hotelSearchWorkflow</code> on Temporal.</li>
          <li>The worker calls <code>fetchSupplierA</code> and <code>fetchSupplierB</code> in parallel, with retries. One failing supplier is tolerated.</li>
          <li><code>selectBestOffers</code> keeps one offer per hotel name.</li>
          <li><code>cacheOffers</code> writes a Redis sorted set (score = price) and a hash of offer details.</li>
          <li><code>readFilteredOffers</code> runs a Lua script: <code>ZRANGEBYSCORE</code> + <code>HMGET</code>, so Redis applies the price filter.</li>
        </ol>
      </section>
    </div>

    <div class="col">
      <section class="card">
        <div class="card-head">
          <h2>Health</h2>
          <button type="button" class="small" id="healthBtn">Refresh</button>
        </div>
        <div class="deps" id="health"><div class="loading">Checking...</div></div>
        <div class="foot" id="healthFoot"></div>
      </section>

      <section class="card">
        <h2>Supplier outages</h2>
        <p class="hint" data-admin hidden>Take a supplier down or make it slow, then search again. One down still returns results; both down returns 502.</p>
        <p class="hint" data-viewer>Current state of each supplier. Log in as admin to simulate an outage.</p>
        <div id="controls"><div class="loading">Loading...</div></div>
      </section>

      <section class="card">
        <h2>Endpoints</h2>
        <ul class="links" id="links"></ul>
      </section>
    </div>
  </div>
</div>

<dialog id="loginDlg">
  <form id="loginForm">
    <h2>Admin login</h2>
    <p class="hint">Admins can add or remove supplier hotels and simulate outages.</p>
    <label>Password<input type="password" id="pw" autocomplete="current-password"></label>
    <p class="form-msg bad" id="loginMsg" hidden></p>
    <div class="row-end">
      <button type="button" id="loginCancel">Cancel</button>
      <button type="submit" class="primary" id="loginSubmit">Log in</button>
    </div>
  </form>
</dialog>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  function money(n) { return '\\u20B9' + Number(n).toLocaleString('en-IN'); }

  function supBadge(name) {
    var letter = /B$/.test(name) ? 'b' : 'a';
    return el('span', 'sup sup-' + letter, name);
  }

  function statusClass(code) { return code < 300 ? 'ok' : code < 500 ? 'warn' : 'bad'; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  async function getJson(url, opts) {
    var started = performance.now();
    var res = await fetch(url, opts);
    var body = null;
    try { body = await res.json(); } catch (e) { body = null; }
    return { status: res.status, ok: res.ok, body: body, ms: Math.round(performance.now() - started) };
  }

  // ---- admin session ------------------------------------------------------------
  var token = null;
  try { token = sessionStorage.getItem('adminToken'); } catch (e) { token = null; }

  function saveToken(t) {
    token = t;
    try {
      if (t) sessionStorage.setItem('adminToken', t);
      else sessionStorage.removeItem('adminToken');
    } catch (e) { /* storage unavailable: keep the token in memory only */ }
  }

  function isAdmin() { return !!token; }

  async function adminFetch(url, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (token) headers.authorization = 'Bearer ' + token;
    opts.headers = headers;
    var res = await getJson(url, opts);
    if (res.status === 401) {
      saveToken(null);
      applyRole();
      toast('Admin session expired. Please log in again.');
    }
    return res;
  }

  function applyRole() {
    var admin = isAdmin();
    Array.prototype.forEach.call(document.querySelectorAll('[data-admin]'), function (n) { n.hidden = !admin; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-viewer]'), function (n) { n.hidden = admin; });
    $('role').textContent = admin ? 'Admin' : 'Viewer';
    $('role').className = 'pill big' + (admin ? ' admin' : '');
    $('loginBtn').hidden = admin;
    $('logoutBtn').hidden = !admin;
    loadControls();
    renderCatalogue();
  }

  function openLogin() {
    $('pw').value = '';
    $('loginMsg').hidden = true;
    $('loginDlg').showModal();
    $('pw').focus();
  }

  $('loginBtn').addEventListener('click', openLogin);
  $('loginCancel').addEventListener('click', function () { $('loginDlg').close(); });
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('loginSubmit').disabled = true;
    var res;
    try {
      res = await getJson('/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: $('pw').value }),
      });
    } catch (err) {
      res = { ok: false, body: { message: 'Could not reach the API.' } };
    }
    $('loginSubmit').disabled = false;
    if (res.ok && res.body && res.body.token) {
      saveToken(res.body.token);
      $('loginDlg').close();
      applyRole();
      toast('Logged in as admin');
    } else {
      $('loginMsg').textContent = (res.body && res.body.message) || 'Login failed';
      $('loginMsg').hidden = false;
    }
  });

  $('logoutBtn').addEventListener('click', async function () {
    try { await adminFetch('/admin/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    saveToken(null);
    applyRole();
    toast('Logged out');
  });

  // ---- search ---------------------------------------------------------------
  var lastSearch = 0;

  async function search() {
    var city = $('city').value.trim();
    var min = $('min').value.trim();
    var max = $('max').value.trim();
    var qs = new URLSearchParams();
    if (city) qs.set('city', city);
    if (min !== '') qs.set('minPrice', min);
    if (max !== '') qs.set('maxPrice', max);
    var url = '/api/hotels' + (qs.toString() ? '?' + qs.toString() : '');

    var tokenId = ++lastSearch;
    $('reqUrl').textContent = 'GET ' + url;
    $('reqMeta').replaceChildren(el('span', '', 'Running workflow...'));
    $('results').replaceChildren(el('div', 'loading', 'Waiting for the Temporal workflow...'));
    $('searchBtn').disabled = true;

    var res;
    try {
      res = await getJson(url);
    } catch (e) {
      res = { status: 0, ok: false, body: { error: 'NetworkError', message: 'Could not reach the API.' }, ms: 0 };
    }
    if (tokenId !== lastSearch) return;
    $('searchBtn').disabled = false;

    var meta = $('reqMeta');
    meta.replaceChildren();
    meta.append(
      el('span', 'pill ' + statusClass(res.status || 500), res.status ? 'HTTP ' + res.status : 'No response'),
      el('span', '', res.ms + ' ms')
    );

    renderResults(res);
    compare(city, res.ok && Array.isArray(res.body) ? res.body : null);
    refreshHealth();
  }

  function errorBox(body, status) {
    body = body || {};
    var err = el('div', 'error');
    var title = el('div');
    title.append(el('b', '', body.error || ('HTTP ' + status)));
    if (body.message) title.append(document.createTextNode(' - ' + body.message));
    err.append(title);
    if (Array.isArray(body.details) && body.details.length) {
      var ul = el('ul');
      body.details.forEach(function (d) {
        var li = el('li');
        li.append(el('code', '', d.field), document.createTextNode(': ' + d.message));
        ul.append(li);
      });
      err.append(ul);
    }
    return err;
  }

  function renderResults(res) {
    var box = $('results');
    if (!(res.ok && Array.isArray(res.body))) {
      box.replaceChildren(errorBox(res.body, res.status));
      return;
    }
    if (res.body.length === 0) {
      box.replaceChildren(el('p', 'empty', 'No hotels match. An empty result is a 200 with [], not an error.'));
      return;
    }
    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var head = el('tr');
    ['#', 'Hotel', 'Price', 'Supplier', 'Commission'].forEach(function (h, i) {
      head.append(el('th', i === 2 || i === 4 ? 'num' : '', h));
    });
    table.append(el('thead')).append(head);
    var tbody = el('tbody');
    res.body.forEach(function (o, i) {
      var tr = el('tr');
      tr.append(el('td', 'muted', String(i + 1)));
      tr.append(el('td', '', o.name));
      tr.append(el('td', 'num', money(o.price)));
      var sup = el('td'); sup.append(supBadge(o.supplier)); tr.append(sup);
      tr.append(el('td', 'num', o.commissionPct + '%'));
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    box.replaceChildren(wrap);
  }

  // ---- supplier comparison ----------------------------------------------------
  async function compare(city, apiOffers) {
    $('cmpCity').textContent = city || '-';
    var box = $('compare');
    if (!city) { box.replaceChildren(el('p', 'empty', 'Enter a city to compare the suppliers.')); return; }
    box.replaceChildren(el('div', 'loading', 'Loading supplier offers...'));

    var q = '?city=' + encodeURIComponent(city);
    var raw = await Promise.all([
      getJson('/supplierA/hotels' + q).catch(function () { return { ok: false }; }),
      getJson('/supplierB/hotels' + q).catch(function () { return { ok: false }; }),
    ]);
    var sources = [['Supplier A', raw[0]], ['Supplier B', raw[1]]];

    var rows = {};
    var order = [];
    sources.forEach(function (s) {
      if (!s[1].ok || !Array.isArray(s[1].body)) return;
      s[1].body.forEach(function (h) {
        var key = String(h.name).trim().toLowerCase();
        if (!rows[key]) { rows[key] = { name: h.name }; order.push(key); }
        rows[key][s[0]] = h;
      });
    });

    if (order.length === 0) {
      var allDown = sources.every(function (s) { return !s[1].ok; });
      box.replaceChildren(el('p', 'empty', allDown ? 'Both suppliers are unavailable.' : 'Neither supplier lists hotels in this city.'));
      return;
    }

    var picked = {};
    (apiOffers || []).forEach(function (o) { picked[String(o.name).trim().toLowerCase()] = o; });

    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var head = el('tr');
    head.append(el('th', '', 'Hotel'));
    sources.forEach(function (s) { head.append(el('th', 'num', s[0] + (s[1].ok ? '' : ' (down)'))); });
    head.append(el('th', '', 'API returned'));
    table.append(el('thead')).append(head);

    var tbody = el('tbody');
    order.forEach(function (key) {
      var row = rows[key];
      var win = picked[key];
      var tr = el('tr');
      tr.append(el('td', '', row.name));
      sources.forEach(function (s) {
        var h = row[s[0]];
        if (!h) { tr.append(el('td', 'num muted', '-')); return; }
        var isWin = win && win.supplier === s[0] && win.price === h.price;
        tr.append(el('td', 'num' + (isWin ? ' win' : ''), money(h.price) + ' \\u00B7 ' + h.commissionPct + '%'));
      });
      var result = el('td');
      if (win) {
        result.append(supBadge(win.supplier));
      } else {
        result.className = 'muted';
        result.textContent = apiOffers === null ? 'search failed' : 'outside price range';
      }
      tr.append(result);
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    box.replaceChildren(wrap);
  }

  // ---- supplier catalogues ------------------------------------------------------
  var catalogue = null;

  async function loadCatalogue() {
    var res;
    try { res = await getJson('/suppliers/catalogue'); } catch (e) { res = null; }
    if (!res || !res.ok || !res.body) {
      $('catalogue').replaceChildren(el('p', 'empty', 'Could not load the supplier catalogues.'));
      return;
    }
    catalogue = res.body;
    renderCities();
    renderCatalogue();
  }

  function allCities() {
    var seen = {};
    ['A', 'B'].forEach(function (id) {
      (catalogue[id] || []).forEach(function (h) { seen[h.city.toLowerCase()] = true; });
    });
    return Object.keys(seen).sort();
  }

  function renderCities() {
    var cities = allCities();
    var list = $('cities');
    list.replaceChildren();
    // jaipur is listed even though no supplier serves it: it is the "no results" demo city.
    var suggestions = cities.indexOf('jaipur') === -1 ? cities.concat(['jaipur']) : cities;
    suggestions.forEach(function (c) { var o = el('option'); o.value = c; list.append(o); });
    var select = $('catCity');
    var current = select.value;
    select.replaceChildren();
    var all = el('option', '', 'All cities'); all.value = ''; select.append(all);
    cities.forEach(function (c) { var o = el('option', '', c); o.value = c; select.append(o); });
    select.value = cities.indexOf(current) !== -1 ? current : '';
  }

  function renderCatalogue() {
    var box = $('catalogue');
    if (!catalogue) return;
    var city = $('catCity').value;
    var rows = [];
    ['A', 'B'].forEach(function (id) {
      (catalogue[id] || []).forEach(function (h) {
        if (!city || h.city.toLowerCase() === city) rows.push({ supplier: id, hotel: h });
      });
    });
    rows.sort(function (x, y) {
      return x.hotel.city.localeCompare(y.hotel.city) ||
        x.hotel.name.localeCompare(y.hotel.name) ||
        x.supplier.localeCompare(y.supplier);
    });

    var countA = rows.filter(function (r) { return r.supplier === 'A'; }).length;
    $('catSummary').textContent = rows.length + ' listings' + (city ? ' in ' + city : '') +
      ' \\u00B7 Supplier A: ' + countA + ' \\u00B7 Supplier B: ' + (rows.length - countA);

    if (rows.length === 0) {
      box.replaceChildren(el('p', 'empty', 'No hotels listed for this city.'));
      return;
    }

    var admin = isAdmin();
    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var head = el('tr');
    var cols = ['Supplier', 'Hotel', 'City', 'Price', 'Commission', 'ID'];
    if (admin) cols.push('');
    cols.forEach(function (h, i) { head.append(el('th', i === 3 || i === 4 ? 'num' : '', h)); });
    table.append(el('thead')).append(head);

    var tbody = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr');
      var sup = el('td'); sup.append(supBadge('Supplier ' + r.supplier)); tr.append(sup);
      tr.append(el('td', '', r.hotel.name));
      tr.append(el('td', 'cap', r.hotel.city));
      tr.append(el('td', 'num', money(r.hotel.price)));
      tr.append(el('td', 'num', r.hotel.commissionPct + '%'));
      tr.append(el('td', 'muted mono', r.hotel.hotelId));
      if (admin) {
        var act = el('td', 'act');
        var btn = el('button', 'small danger', 'Remove');
        btn.type = 'button';
        btn.addEventListener('click', function () { removeHotel(r.supplier, r.hotel, btn); });
        act.append(btn);
        tr.append(act);
      }
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    box.replaceChildren(wrap);
  }

  function showAddMsg(cls, text) {
    var m = $('addMsg');
    m.className = 'form-msg ' + cls;
    m.textContent = text;
    m.hidden = !isAdmin();
  }

  function numberOrNull(v) { v = v.trim(); return v === '' ? null : Number(v); }

  $('addForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var supplier = $('addSupplier').value;
    var body = {
      name: $('addName').value,
      city: $('addCity').value,
      price: numberOrNull($('addPrice').value),
      commissionPct: numberOrNull($('addComm').value),
    };
    $('addBtn').disabled = true;
    var res;
    try {
      res = await adminFetch('/suppliers/' + supplier + '/hotels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      res = { ok: false, status: 0, body: { message: 'Could not reach the API.' } };
    }
    $('addBtn').disabled = false;

    if (res.status === 201 && res.body && res.body.hotel) {
      var h = res.body.hotel;
      showAddMsg('ok', 'Added ' + h.name + ' (' + h.city + ', ' + money(h.price) + ') to Supplier ' + supplier + ' as ' + h.hotelId + '.');
      $('addName').value = '';
      $('addPrice').value = '';
      $('addComm').value = '';
      await loadCatalogue();
      $('city').value = h.city;
      $('min').value = '';
      $('max').value = '';
      search();
      return;
    }
    if (res.status === 401) return;
    var b = res.body || {};
    var detail = Array.isArray(b.details) && b.details.length
      ? b.details.map(function (d) { return d.field + ': ' + d.message; }).join('; ')
      : (b.message || 'Could not add the hotel');
    showAddMsg('bad', detail);
  });

  async function removeHotel(supplier, hotel, btn) {
    if (!confirm('Remove ' + hotel.name + ' (' + hotel.city + ') from Supplier ' + supplier + '?')) return;
    btn.disabled = true;
    var res = await adminFetch('/suppliers/' + supplier + '/hotels/' + encodeURIComponent(hotel.hotelId), { method: 'DELETE' });
    if (res.ok) {
      toast('Removed ' + hotel.name + ' from Supplier ' + supplier);
      await loadCatalogue();
      if ($('city').value.trim().toLowerCase() === hotel.city.toLowerCase()) search();
    } else if (res.status !== 401) {
      btn.disabled = false;
      toast((res.body && res.body.message) || 'Could not remove the hotel');
    }
  }

  $('catCity').addEventListener('change', renderCatalogue);

  // ---- health -----------------------------------------------------------------
  var LABELS = { ok: 'All systems up', degraded: 'Degraded - one supplier down', unhealthy: 'Unhealthy' };

  function setOverall(cls, text) {
    $('overall').className = 'pill big ' + cls;
    $('overallText').textContent = text;
  }

  async function refreshHealth() {
    var res;
    try { res = await getJson('/health'); } catch (e) { res = null; }
    var box = $('health');
    if (!res || !res.body || !res.body.dependencies) {
      setOverall('bad', 'API unreachable');
      box.replaceChildren(el('p', 'empty', 'Could not reach /health.'));
      return;
    }
    var b = res.body;
    setOverall(b.status === 'ok' ? 'ok' : b.status === 'degraded' ? 'warn' : 'bad', LABELS[b.status] || b.status);

    var deps = [
      ['Supplier A', b.dependencies.suppliers['Supplier A']],
      ['Supplier B', b.dependencies.suppliers['Supplier B']],
      ['Redis', b.dependencies.redis],
      ['Temporal', b.dependencies.temporal],
    ];
    box.replaceChildren();
    deps.forEach(function (d) {
      var info = d[1] || { status: 'down', latencyMs: 0, error: 'not reported' };
      var row = el('div', 'dep ' + (info.status === 'up' ? 'up' : 'down'));
      row.append(el('span', 'dot'), el('span', 'name', d[0]), el('span', 'lat', info.latencyMs + ' ms'));
      row.append(el('span', 'detail', info.status === 'up' ? (info.detail || 'up') : (info.error || 'down')));
      box.append(row);
    });
    $('healthFoot').textContent = 'HTTP ' + res.status + ' \\u00B7 checked ' + new Date().toLocaleTimeString() + ' \\u00B7 auto-refreshes every 10s';
  }

  // ---- outage controls --------------------------------------------------------
  var MODES = [
    ['Healthy', { down: false, delayMs: 0 }],
    ['Down', { down: true, delayMs: 0 }],
    ['Slow 3s', { down: false, delayMs: 3000 }],
  ];

  function modeOf(s) { return s.down ? 'Down' : s.delayMs > 0 ? 'Slow 3s' : 'Healthy'; }

  async function loadControls() {
    var res;
    try { res = await getJson('/suppliers/control'); } catch (e) { res = null; }
    var box = $('controls');
    if (!res || !res.body) { box.replaceChildren(el('p', 'empty', 'Could not load supplier state.')); return; }
    var admin = isAdmin();
    box.replaceChildren();
    ['A', 'B'].forEach(function (id) {
      var s = res.body[id] || { down: false, delayMs: 0 };
      var mode = modeOf(s);
      var row = el('div', 'ctl');
      var head = el('div', 'ctl-head');
      head.append(supBadge('Supplier ' + id));
      var stateText = s.down ? 'Down (503)' : s.delayMs > 0 ? 'Slow (+' + s.delayMs + ' ms)' : 'Healthy';
      head.append(el('span', 'pill ' + (s.down ? 'bad' : s.delayMs > 0 ? 'warn' : 'ok'), stateText));
      row.append(head);
      if (admin) {
        var btns = el('div', 'btns');
        MODES.forEach(function (m) {
          var btn = el('button', 'small' + (m[0] === mode ? ' active' : ''), m[0]);
          btn.type = 'button';
          btn.addEventListener('click', async function () {
            btn.disabled = true;
            try {
              await adminFetch('/suppliers/' + id + '/control', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(m[1]),
              });
            } finally {
              loadControls();
              refreshHealth();
            }
          });
          btns.append(btn);
        });
        row.append(btns);
      }
      box.append(row);
    });
  }

  // ---- endpoint links ---------------------------------------------------------
  function renderLinks() {
    var temporalUi = location.protocol + '//' + location.hostname + ':8080';
    var links = [
      ['GET', '/api/hotels?city=delhi', '/api/hotels?city=delhi'],
      ['GET', '/api/hotels?city=delhi&minPrice=5000&maxPrice=9000', '/api/hotels (5000-9000)'],
      ['GET', '/health', '/health'],
      ['GET', '/supplierA/hotels?city=delhi', '/supplierA/hotels'],
      ['GET', '/supplierB/hotels?city=delhi', '/supplierB/hotels'],
      ['GET', '/suppliers/catalogue', '/suppliers/catalogue'],
      ['GET', '/suppliers/control', '/suppliers/control'],
      ['UI', temporalUi, 'Temporal UI (:8080)'],
    ];
    var ul = $('links');
    links.forEach(function (l) {
      var li = el('li');
      var a = el('a');
      a.href = l[1];
      a.target = '_blank';
      a.rel = 'noopener';
      a.append(el('span', 'mono', l[2]), el('span', 'm', l[0]));
      li.append(a);
      ul.append(li);
    });
  }

  // ---- wiring -------------------------------------------------------------------
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); search(); });
  $('healthBtn').addEventListener('click', refreshHealth);
  Array.prototype.forEach.call($('presets').querySelectorAll('button'), function (btn) {
    btn.addEventListener('click', function () {
      $('city').value = btn.dataset.city;
      $('min').value = btn.dataset.min;
      $('max').value = btn.dataset.max;
      search();
    });
  });

  async function init() {
    renderLinks();
    if (token) {
      // Drop a stored token the server no longer recognises (e.g. after a restart).
      try {
        var s = await getJson('/admin/session', { headers: { authorization: 'Bearer ' + token } });
        if (!(s.body && s.body.admin)) saveToken(null);
      } catch (e) { /* keep it; the next admin call will re-check */ }
    }
    await loadCatalogue();
    applyRole();
    refreshHealth();
    search();
    setInterval(refreshHealth, 10000);
  }

  init();
})();
</script>
</body>
</html>
`;

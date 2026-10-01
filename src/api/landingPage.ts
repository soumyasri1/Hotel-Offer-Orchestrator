/**
 * Landing page served at `GET /` to browsers.
 *
 * Three parts:
 *   - Customer view (default): pick a city and budget, see the best price per
 *     hotel as cards. Runs the real search endpoint (and so the workflow).
 *   - Admin dashboard (after login): each supplier's catalogue with
 *     commissions, add/remove hotels, and simulate supplier outages. The
 *     server enforces admin rights with a bearer token; the page only decides
 *     what to show.
 *   - Technical details (collapsed): health, the raw last request, the
 *     supplier price comparison, how a search flows, and every endpoint.
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
    --bg: #f6f5fb; --surface: #ffffff; --surface-2: #f1effa; --text: #1b1736; --muted: #6a6585;
    --border: #e6e2f3; --primary: #5b3df5; --primary-text: #ffffff; --primary-weak: #ece8ff;
    --pink: #e23d8f; --ok: #12805c; --ok-weak: #dcf5ea; --warn: #a15c00; --warn-weak: #fdf0d8;
    --bad: #cc2f45; --bad-weak: #fde4e7; --a: #4f46e5; --a-weak: #e8e7fd; --b: #c0267a; --b-weak: #fce4f1;
    --new: #fff6d6; --shadow: 0 8px 24px rgba(40, 24, 110, 0.10); --shadow-lg: 0 16px 40px rgba(40, 24, 110, 0.18);
    --hero: linear-gradient(120deg, #4f46e5 0%, #8b3df0 40%, #e23d8f 75%, #f97316 100%);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg: #12101c; --surface: #1c1929; --surface-2: #252136; --text: #eeecf8; --muted: #a49fbd;
      --border: #332e48; --primary: #8f7bff; --primary-text: #120f22; --primary-weak: #2a2550;
      --pink: #f472b6; --ok: #4fd1a1; --ok-weak: #15352b; --warn: #f5b454; --warn-weak: #3b2c12;
      --bad: #f47a8a; --bad-weak: #3d1b22; --a: #a5a1ff; --a-weak: #26234d; --b: #f48ac0; --b-weak: #3b1c30;
      --new: #3a3315; --shadow: 0 8px 24px rgba(0, 0, 0, 0.35); --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.5);
    }
  }
  :root[data-theme="dark"] {
    --bg: #12101c; --surface: #1c1929; --surface-2: #252136; --text: #eeecf8; --muted: #a49fbd;
    --border: #332e48; --primary: #8f7bff; --primary-text: #120f22; --primary-weak: #2a2550;
    --pink: #f472b6; --ok: #4fd1a1; --ok-weak: #15352b; --warn: #f5b454; --warn-weak: #3b2c12;
    --bad: #f47a8a; --bad-weak: #3d1b22; --a: #a5a1ff; --a-weak: #26234d; --b: #f48ac0; --b-weak: #3b1c30;
    --new: #3a3315; --shadow: 0 8px 24px rgba(0, 0, 0, 0.35); --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.5);
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  code, .mono { font-family: ui-monospace, "Cascadia Code", Consolas, monospace; font-size: 13px; }
  a { color: var(--primary); }
  .wrap { max-width: 1160px; margin: 0 auto; padding: 0 16px; }

  /* ---- top bar ---- */
  .bar { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--border); }
  .bar .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; flex-wrap: wrap; padding-top: 8px; padding-bottom: 8px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 17px; letter-spacing: -0.01em; }
  .logo { width: 34px; height: 34px; border-radius: 10px; background: var(--hero); display: grid; place-items: center; font-size: 18px; }
  .bar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tabs { display: inline-flex; background: var(--surface-2); border-radius: 10px; padding: 3px; }
  .tabs button { border: 0; background: transparent; padding: 6px 12px; border-radius: 8px; font-weight: 600; color: var(--muted); }
  .tabs button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

  button { font: inherit; font-size: 14px; cursor: pointer; border-radius: 10px; padding: 8px 14px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
  button:hover { background: var(--surface-2); }
  button:disabled { opacity: 0.6; cursor: progress; }
  button.primary { background: var(--primary); color: var(--primary-text); border-color: var(--primary); font-weight: 700; }
  button.primary:hover { filter: brightness(1.08); background: var(--primary); }
  button.small { padding: 4px 10px; font-size: 13px; border-radius: 8px; }
  button.danger { color: var(--bad); }
  button.danger:hover { background: var(--bad-weak); }
  button.on-state { border-color: var(--primary); color: var(--primary); font-weight: 700; background: var(--primary-weak); }

  input, select { font: inherit; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; width: 100%; min-width: 0; }
  input:focus, select:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
  label { display: grid; gap: 4px; font-size: 12px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }

  /* ---- full-page photo slideshow (customer view only) ----
     Photos are served locally from /static so the page works offline. Each new
     slide wipes in from top to bottom (clip-path) over the previous one, with a
     slow zoom; the gradient behind them shows until the first photo loads. */
  .bgshow { position: fixed; inset: 0; z-index: -1; overflow: hidden; background: var(--hero); }
  .bgshow::after {
    content: ""; position: absolute; inset: 0; z-index: 2;
    background: linear-gradient(180deg, rgba(18, 10, 48, 0.62) 0%, rgba(18, 10, 48, 0.28) 40%, rgba(18, 10, 48, 0.58) 100%);
  }
  .slide { position: absolute; inset: 0; background-size: cover; background-position: center; clip-path: inset(0 0 100% 0); transform: scale(1.08); }
  .slide.prev { clip-path: inset(0 0 0 0); transform: scale(1); z-index: 0; }
  .slide.on { clip-path: inset(0 0 0 0); transform: scale(1); z-index: 1; transition: clip-path 1.6s cubic-bezier(0.65, 0, 0.35, 1), transform 9s ease-out; }
  @media (prefers-reduced-motion: reduce) {
    .slide { clip-path: none; transform: none; opacity: 0; }
    .slide.prev, .slide.on { opacity: 1; transform: none; }
    .slide.on { transition: opacity 0.8s; }
  }
  .bgcap {
    position: fixed; left: 16px; bottom: 16px; z-index: 5; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    max-width: calc(100vw - 32px); padding: 6px 8px 6px 14px; border-radius: 999px; color: #fff; font-size: 13px;
    background: rgba(15, 10, 35, 0.55); backdrop-filter: blur(8px);
  }
  .bgcap .place { font-weight: 700; }
  .bgcap .credit { opacity: 0.7; font-size: 11px; }
  .bgdots { display: flex; gap: 6px; }
  .bgdot { width: 9px; height: 9px; padding: 0; border-radius: 50%; border: 0; background: rgba(255, 255, 255, 0.45); }
  .bgdot:hover { background: rgba(255, 255, 255, 0.8); }
  .bgdot.on { background: #fff; width: 22px; border-radius: 999px; }
  body.mode-admin .bgshow, body.mode-admin .bgcap { display: none; }
  body:not(.mode-admin) .bar { background: color-mix(in srgb, var(--surface) 84%, transparent); backdrop-filter: blur(10px); }
  #userView .results-head h2 { color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, 0.45); }
  #userView .results-head .sub { color: rgba(255, 255, 255, 0.92); text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5); }

  /* ---- hero + search ---- */
  .hero { color: #fff; padding: 72px 0 120px; }
  .hero h1 { margin: 0 0 8px; font-size: clamp(28px, 4.4vw, 44px); letter-spacing: -0.02em; line-height: 1.12; text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35); }
  .hero p { margin: 0; font-size: 17px; max-width: 620px; text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4); }
  .hero .eyebrow { display: inline-block; margin-bottom: 12px; padding: 4px 12px; border-radius: 999px; background: rgba(255, 255, 255, 0.18); backdrop-filter: blur(6px); font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
  .searchbox { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow-lg); padding: 18px; margin-top: -60px; position: relative; }
  .searchrow { display: grid; grid-template-columns: 1.5fr 1fr 1fr auto; gap: 12px; align-items: end; }
  .searchrow button { height: 44px; padding: 0 26px; font-size: 15px; }
  @media (max-width: 680px) { .searchrow { grid-template-columns: 1fr 1fr; } .searchrow .city-field, .searchrow button { grid-column: 1 / -1; } }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; align-items: center; }
  .chips .lbl { font-size: 13px; color: var(--muted); margin-right: 4px; }
  .chip { border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 600; background: var(--surface-2); border: 1px solid transparent; color: var(--text); text-transform: capitalize; }
  .chip:hover { border-color: var(--primary); background: var(--surface-2); }
  .chip.on { background: var(--primary); color: var(--primary-text); }

  /* ---- results ---- */
  .results-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 28px 0 14px; }
  .results-head h2 { margin: 0; font-size: 22px; letter-spacing: -0.01em; text-transform: capitalize; }
  .results-head .sub { color: var(--muted); font-size: 14px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
  .hotel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: transform 0.15s, box-shadow 0.15s; }
  .hotel:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .hotel-img { height: 128px; position: relative; display: grid; place-items: center; color: rgba(255,255,255,0.95); font-size: 46px; font-weight: 800; }
  .hotel-img .tag { position: absolute; top: 10px; left: 10px; background: rgba(255,255,255,0.95); color: #1b1736; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
  .hotel-img .rank { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.28); color: #fff; font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
  .hotel-body { padding: 14px 16px 16px; display: grid; gap: 6px; flex: 1; }
  .hotel-body h3 { margin: 0; font-size: 18px; }
  .loc { margin: 0; color: var(--muted); font-size: 14px; text-transform: capitalize; }
  .price-row { display: flex; align-items: baseline; gap: 6px; margin-top: auto; padding-top: 6px; }
  .price { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
  .per { color: var(--muted); font-size: 13px; }
  .save { margin: 0; font-size: 13px; font-weight: 600; color: var(--ok); }
  .save.neutral { color: var(--muted); font-weight: 500; }
  .via { font-size: 12px; color: var(--muted); }

  .state { text-align: center; padding: 44px 16px; background: var(--surface); border: 1px dashed var(--border); border-radius: 16px; }
  .state .big { font-size: 40px; }
  .state h3 { margin: 8px 0 4px; }
  .state p { margin: 0; color: var(--muted); }
  .state.err { border-color: var(--bad); background: var(--bad-weak); }
  .state.err h3 { color: var(--bad); }
  .skeleton { height: 270px; border-radius: 16px; background: linear-gradient(90deg, var(--surface-2), var(--surface), var(--surface-2)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  /* ---- admin ---- */
  .admin-head { padding: 28px 0 8px; display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
  .reset-btn { margin-left: auto; border-radius: 999px; padding: 5px 14px; font-size: 13px; font-weight: 700; color: var(--pink); border-color: var(--pink); background: transparent; }
  .reset-btn:hover { background: var(--b-weak); }
  .admin-head h1 { margin: 0; font-size: 26px; letter-spacing: -0.02em; }
  .admin-head p { margin: 4px 0 0; color: var(--muted); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
  .stat .v { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
  .stat .k { font-size: 13px; color: var(--muted); }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px; box-shadow: var(--shadow); min-width: 0; }
  .panel h2 { margin: 0 0 12px; font-size: 17px; }
  .addform { display: grid; grid-template-columns: 1fr 1.4fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; }
  @media (max-width: 860px) { .addform { grid-template-columns: 1fr 1fr; } .addform button { grid-column: 1 / -1; } }
  .addform button { height: 44px; }
  .form-msg { margin: 10px 0 0; font-size: 14px; font-weight: 600; }
  .form-msg.ok { color: var(--ok); }
  .form-msg.bad { color: var(--bad); }
  .suppliers { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
  @media (max-width: 900px) { .suppliers { grid-template-columns: 1fr; } }
  .sup-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
  .sup-title { display: flex; align-items: center; gap: 10px; }
  .sup-title h2 { margin: 0; }
  .sup-mark { width: 12px; height: 12px; border-radius: 4px; }
  .outage { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 10px; background: var(--surface-2); border-radius: 10px; font-size: 13px; }
  .outage .lbl { color: var(--muted); margin-right: auto; }
  .filter-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
  .filter-row select { width: auto; padding: 6px 10px; }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 700; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 9px 10px; border-bottom: 1px solid var(--border); white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.act { text-align: right; width: 1%; }
  td.cap { text-transform: capitalize; }
  tr.new td { background: var(--new); }
  .badge-new { display: inline-block; margin-left: 6px; font-size: 11px; font-weight: 800; color: #1b1736; background: #ffd23f; padding: 1px 7px; border-radius: 999px; }
  .comm { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--ok-weak); color: var(--ok); }
  .empty { color: var(--muted); padding: 16px; text-align: center; background: var(--surface-2); border-radius: 10px; margin: 0; }

  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--surface-2); color: var(--muted); white-space: nowrap; }
  .pill.ok { background: var(--ok-weak); color: var(--ok); }
  .pill.warn { background: var(--warn-weak); color: var(--warn); }
  .pill.bad { background: var(--bad-weak); color: var(--bad); }
  .pill.admin { background: var(--b-weak); color: var(--b); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; display: inline-block; }
  .sup { display: inline-block; padding: 1px 8px; border-radius: 6px; font-size: 12px; font-weight: 700; }
  .sup-a { background: var(--a-weak); color: var(--a); }
  .sup-b { background: var(--b-weak); color: var(--b); }

  /* ---- technical details ---- */
  details.tech { margin: 36px 0 48px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
  details.tech > summary { list-style: none; cursor: pointer; padding: 16px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-weight: 700; }
  details.tech > summary::-webkit-details-marker { display: none; }
  details.tech > summary .chev { transition: transform 0.2s; color: var(--muted); }
  details.tech[open] > summary .chev { transform: rotate(90deg); }
  details.tech > summary .hint { font-weight: 500; color: var(--muted); font-size: 14px; margin-right: auto; }
  .tech-body { padding: 0 18px 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 860px) { .tech-body { grid-template-columns: 1fr; } }
  .tech-card { background: var(--surface-2); border-radius: 12px; padding: 14px; min-width: 0; }
  .tech-card.wide { grid-column: 1 / -1; }
  .tech-card h3 { margin: 0 0 10px; font-size: 14px; }
  .tech-card td { background: transparent; }
  td.win { background: var(--ok-weak) !important; color: var(--ok); font-weight: 700; }
  .deps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .dep { background: var(--surface); border-radius: 10px; padding: 10px; display: grid; gap: 2px; }
  .dep .n { font-weight: 700; display: flex; align-items: center; gap: 6px; }
  .dep.up .dot { color: var(--ok); }
  .dep.down .dot { color: var(--bad); }
  .dep .d { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
  .dep.down .d { color: var(--bad); }
  .req { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  .req code { overflow-wrap: anywhere; }
  pre.raw { margin: 0; max-height: 220px; overflow: auto; background: var(--surface); border-radius: 10px; padding: 10px; font-size: 12px; }
  ol.flow { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 14px; }
  ul.eps { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; font-size: 13px; }
  ul.eps li { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid var(--border); }
  ul.eps li:last-child { border-bottom: 0; }
  ul.eps .m { font-weight: 800; font-size: 11px; min-width: 52px; }
  ul.eps .m.get { color: var(--ok); }
  ul.eps .m.post { color: var(--primary); }
  ul.eps .m.del { color: var(--bad); }
  ul.eps .what { color: var(--muted); margin-left: auto; text-align: right; }
  .tries { display: flex; gap: 6px; flex-wrap: wrap; }

  dialog { border: 0; border-radius: 18px; padding: 0; background: var(--surface); color: var(--text); width: min(400px, calc(100vw - 32px)); box-shadow: var(--shadow-lg); overflow: hidden; }
  dialog::backdrop { background: rgba(20, 12, 50, 0.5); }
  .dlg-top { background: var(--hero); color: #fff; padding: 20px 22px; }
  .dlg-top h2 { margin: 0; font-size: 20px; }
  .dlg-top p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
  dialog form { display: grid; gap: 12px; padding: 20px 22px 22px; }
  .row-end { display: flex; justify-content: flex-end; gap: 8px; }

  .toast { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); max-width: calc(100vw - 32px); background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 10px; font-size: 14px; box-shadow: var(--shadow-lg); opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 50; }
  .toast.show { opacity: 1; }
</style>
</head>
<body>

<header class="bar">
  <div class="wrap">
    <div class="brand"><span class="logo">🏨</span><span>Hotel Offer Orchestrator</span></div>
    <div class="bar-right">
      <div class="tabs" id="tabs" hidden>
        <button type="button" id="tabUser" class="on">Find hotels</button>
        <button type="button" id="tabAdmin">Supplier dashboard</button>
      </div>
      <span class="pill admin" id="adminPill" hidden>Admin</span>
      <button type="button" id="loginBtn">Admin login</button>
      <button type="button" id="logoutBtn" hidden>Log out</button>
    </div>
  </div>
</header>

<!-- full-page background slideshow (customer view) -->
<div class="bgshow" id="bgshow" aria-hidden="true"></div>
<div class="bgcap" id="bgcap">
  <span>📍 <span class="place" id="bgplace"></span></span>
  <span class="credit" id="bgcredit"></span>
  <span class="bgdots" id="bgdots"></span>
</div>

<!-- ================= customer view ================= -->
<main id="userView">
  <section class="hero">
    <div class="wrap">
      <span class="eyebrow">✈️ Your next getaway starts here</span>
      <h1>Find the best hotel price, instantly</h1>
      <p>We compare offers from every partner supplier and show you only the lowest price for each hotel.</p>
    </div>
  </section>

  <div class="wrap">
    <form class="searchbox" id="searchForm" autocomplete="off">
      <div class="searchrow">
        <label class="city-field">Where to?
          <select id="city"></select>
        </label>
        <label>Min budget (₹)<input id="min" inputmode="numeric" placeholder="Any"></label>
        <label>Max budget (₹)<input id="max" inputmode="numeric" placeholder="Any"></label>
        <button type="submit" class="primary" id="searchBtn">Search</button>
      </div>
      <div class="chips" id="budgetChips">
        <span class="lbl">Budget:</span>
        <button type="button" class="chip" data-min="" data-max="">Any</button>
        <button type="button" class="chip" data-min="" data-max="5000">Under ₹5,000</button>
        <button type="button" class="chip" data-min="5000" data-max="9000">₹5,000 – ₹9,000</button>
        <button type="button" class="chip" data-min="9000" data-max="">₹9,000+</button>
        <button type="button" class="reset-btn" id="resetSearch">↺ Reset</button>
      </div>
    </form>

    <div class="results-head">
      <h2 id="resultsTitle">Hotels</h2>
      <span class="sub" id="resultsSub"></span>
    </div>
    <div id="results"></div>
  </div>
</main>

<!-- ================= admin view ================= -->
<main id="adminView" hidden>
  <div class="wrap">
    <div class="admin-head">
      <div>
        <h1>Supplier dashboard</h1>
        <p>Each supplier's catalogue with commissions. Add a hotel and it is offered to customers on the next search.</p>
      </div>
      <button type="button" class="reset-btn" id="resetDemo">↺ Reset demo data</button>
    </div>

    <div class="stats" id="stats"></div>

    <section class="panel">
      <h2>➕ Add a hotel to a supplier</h2>
      <form class="addform" id="addForm" autocomplete="off">
        <label>Supplier
          <select id="addSupplier"><option value="A">Supplier A</option><option value="B">Supplier B</option></select>
        </label>
        <label>Hotel name<input id="addName" placeholder="e.g. Grand Palace"></label>
        <label>City<input id="addCity" list="cityList" placeholder="e.g. delhi"></label>
        <label>Price (₹)<input id="addPrice" inputmode="numeric" placeholder="e.g. 6500"></label>
        <label>Commission %<input id="addComm" inputmode="decimal" placeholder="e.g. 12"></label>
        <button type="submit" class="primary" id="addBtn">Add hotel</button>
      </form>
      <datalist id="cityList"></datalist>
      <p class="form-msg" id="addMsg" hidden></p>
    </section>

    <div class="filter-row">
      <strong>Supplier catalogues</strong>
      <label style="display:flex; align-items:center; gap:8px; text-transform:none; letter-spacing:0;">City
        <select id="adminCity"><option value="">All cities</option></select>
      </label>
    </div>

    <div class="suppliers">
      <section class="panel" id="panelA"></section>
      <section class="panel" id="panelB"></section>
    </div>
  </div>
</main>

<!-- ================= technical details ================= -->
<div class="wrap">
  <details class="tech" id="tech">
    <summary>
      <span class="chev">▶</span>
      <span>⚙️ Technical details</span>
      <span class="hint">Health, raw API calls, price comparison and endpoints</span>
      <span class="pill" id="healthPill"><span class="dot"></span><span id="healthText">Checking...</span></span>
    </summary>
    <div class="tech-body">
      <div class="tech-card">
        <h3>System health <span class="muted" id="healthTime" style="font-weight:400; color:var(--muted);"></span></h3>
        <div class="deps" id="deps"></div>
      </div>

      <div class="tech-card">
        <h3>Last API request</h3>
        <div class="req" id="reqLine"><code>-</code></div>
        <pre class="raw" id="reqBody">Run a search to see the raw response.</pre>
      </div>

      <div class="tech-card wide">
        <h3>How the best price was picked for <span id="cmpCity">-</span></h3>
        <p style="margin:-4px 0 10px; color:var(--muted); font-size:13px;">Raw offers from each supplier API. Green = the offer the API returned. Rule: cheapest price, then higher commission, then supplier name.</p>
        <div id="compare"></div>
      </div>

      <div class="tech-card">
        <h3>What happens on each search</h3>
        <ol class="flow">
          <li>The API validates the query (zod) and starts <code>hotelSearchWorkflow</code> on <b>Temporal</b>.</li>
          <li>The worker calls <b>Supplier A and B in parallel</b> as activities, with retries. One failing supplier is tolerated; both failing returns 502.</li>
          <li><code>selectBestOffers</code> keeps one offer per hotel name.</li>
          <li>The result is saved to <b>Redis</b>: a sorted set (score = price) plus a hash of details.</li>
          <li>A <b>Lua script</b> runs <code>ZRANGEBYSCORE</code> + <code>HMGET</code>, so Redis applies the price filter.</li>
        </ol>
        <h3 style="margin-top:14px;">Try the validation errors</h3>
        <div class="tries">
          <button type="button" class="small" data-try="missing">Missing city</button>
          <button type="button" class="small" data-try="nan">Price = "abc"</button>
          <button type="button" class="small" data-try="inverted">Min &gt; max</button>
          <button type="button" class="small" data-try="jaipur">City with no hotels</button>
        </div>
      </div>

      <div class="tech-card">
        <h3>Endpoints</h3>
        <ul class="eps" id="eps"></ul>
      </div>
    </div>
  </details>
</div>

<dialog id="loginDlg">
  <div class="dlg-top">
    <h2>Admin login</h2>
    <p>Manage supplier hotels and commissions.</p>
  </div>
  <form id="loginForm">
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
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function money(n) { return '\\u20B9' + Number(n).toLocaleString('en-IN'); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function supBadge(id) { return el('span', 'sup sup-' + id.toLowerCase(), 'Supplier ' + id); }
  function letterOf(name) { return /B$/.test(name) ? 'B' : 'A'; }

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

  // Card artwork: a stable gradient per hotel name.
  var GRADIENTS = [
    'linear-gradient(135deg, #6366f1, #a855f7)', 'linear-gradient(135deg, #ec4899, #f97316)',
    'linear-gradient(135deg, #14b8a6, #3b82f6)', 'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #10b981, #0ea5e9)', 'linear-gradient(135deg, #d946ef, #6366f1)',
    'linear-gradient(135deg, #0ea5e9, #22c55e)', 'linear-gradient(135deg, #f43f5e, #8b5cf6)',
  ];
  function gradientFor(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return GRADIENTS[h % GRADIENTS.length];
  }

  // ---- admin session ------------------------------------------------------------
  var token = null;
  try { token = sessionStorage.getItem('adminToken'); } catch (e) { token = null; }
  function saveToken(t) {
    token = t;
    try { if (t) sessionStorage.setItem('adminToken', t); else sessionStorage.removeItem('adminToken'); } catch (e) { /* memory only */ }
  }
  function isAdmin() { return !!token; }

  async function adminFetch(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (token) opts.headers.authorization = 'Bearer ' + token;
    var res = await getJson(url, opts);
    if (res.status === 401) {
      saveToken(null);
      applyRole();
      toast('Admin session expired. Please log in again.');
    }
    return res;
  }

  var view = 'user';
  function setView(v) {
    view = v === 'admin' && isAdmin() ? 'admin' : 'user';
    $('userView').hidden = view !== 'user';
    $('adminView').hidden = view !== 'admin';
    $('tabUser').className = view === 'user' ? 'on' : '';
    $('tabAdmin').className = view === 'admin' ? 'on' : '';
    document.body.classList.toggle('mode-admin', view === 'admin');
    // Re-read the catalogue so cities an admin just added appear under "Where to?".
    loadCatalogue();
    window.scrollTo(0, 0);
  }

  // ---- background slideshow ----------------------------------------------------------
  // Photos via Wikimedia Commons; credits are shown in the caption as their licences require.
  var SLIDES = [
    { file: 'jaipur-hawa-mahal.jpg', place: 'Hawa Mahal, Jaipur', credit: 'Photo: Marcin Białek, CC BY-SA 4.0', pos: 'center 35%' },
    { file: 'udaipur-lake-pichola-sunset.jpg', place: 'Lake Pichola at sunset, Udaipur', credit: 'Photo: UnpetitproleX, CC BY-SA 4.0', pos: 'center 40%' },
    { file: 'jaipur-amber-fort.jpg', place: 'Amber Fort, Jaipur', credit: 'Photo: A.Savin, Free Art License', pos: 'center 40%' },
    { file: 'rajasthan-lakeside-sunset.jpg', place: 'Lakeside sunset, Rajasthan', credit: 'Photo: Mohd Danish Ansari, CC BY-SA 4.0', pos: 'center 50%' },
    { file: 'udaipur-city-palace.jpg', place: 'City Palace, Udaipur', credit: 'Photo: Hirumon, CC BY 3.0', pos: 'center 40%' },
  ];
  var slideEls = [];
  var dotEls = [];
  var slideIdx = -1;
  var slideTimer = null;

  function showSlide(i) {
    if (i === slideIdx) return;
    slideEls.forEach(function (d) { d.classList.remove('prev'); });
    if (slideIdx !== -1) {
      slideEls[slideIdx].classList.remove('on');
      slideEls[slideIdx].classList.add('prev');
    }
    var next = slideEls[i];
    next.classList.remove('on');
    void next.offsetWidth; // restart the wipe-in transition
    next.classList.add('on');
    slideIdx = i;
    $('bgplace').textContent = SLIDES[i].place;
    $('bgcredit').textContent = SLIDES[i].credit;
    dotEls.forEach(function (d, j) { d.classList.toggle('on', j === i); });
  }

  function restartSlides() {
    clearInterval(slideTimer);
    slideTimer = setInterval(function () {
      if (document.hidden || view !== 'user') return;
      showSlide((slideIdx + 1) % SLIDES.length);
    }, 6500);
  }

  function buildSlides() {
    SLIDES.forEach(function (s, i) {
      var d = el('div', 'slide');
      d.style.backgroundImage = 'url("/static/backgrounds/' + s.file + '")';
      d.style.backgroundPosition = s.pos;
      $('bgshow').append(d);
      slideEls.push(d);
      var dot = el('button', 'bgdot');
      dot.type = 'button';
      dot.setAttribute('aria-label', 'Show ' + s.place);
      dot.addEventListener('click', function () { showSlide(i); restartSlides(); });
      $('bgdots').append(dot);
      dotEls.push(dot);
    });
    showSlide(0);
    restartSlides();
  }

  function applyRole() {
    var admin = isAdmin();
    $('tabs').hidden = !admin;
    $('adminPill').hidden = !admin;
    $('loginBtn').hidden = admin;
    $('logoutBtn').hidden = !admin;
    if (!admin) setView('user');
  }

  $('loginBtn').addEventListener('click', function () {
    $('pw').value = '';
    $('loginMsg').hidden = true;
    $('loginDlg').showModal();
    $('pw').focus();
  });
  $('loginCancel').addEventListener('click', function () { $('loginDlg').close(); });
  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    $('loginSubmit').disabled = true;
    var res;
    try {
      res = await getJson('/admin/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: $('pw').value }),
      });
    } catch (err) { res = { ok: false, body: { message: 'Could not reach the server.' } }; }
    $('loginSubmit').disabled = false;
    if (res.ok && res.body && res.body.token) {
      saveToken(res.body.token);
      $('loginDlg').close();
      applyRole();
      setView('admin');
      toast('Welcome, admin');
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
  $('tabUser').addEventListener('click', function () { setView('user'); });
  $('tabAdmin').addEventListener('click', function () { setView('admin'); });

  // ---- catalogue (cities, admin tables) -------------------------------------------
  var catalogue = { A: [], B: [] };
  var justAdded = {};

  async function loadCatalogue() {
    try {
      var res = await getJson('/suppliers/catalogue');
      if (res.ok && res.body) catalogue = res.body;
    } catch (e) { /* keep the previous copy */ }
    renderCities();
    if (view === 'admin') renderAdmin();
  }

  function allCities() {
    var seen = {};
    ['A', 'B'].forEach(function (id) { (catalogue[id] || []).forEach(function (h) { seen[h.city.toLowerCase()] = true; }); });
    return Object.keys(seen).sort();
  }

  function fillSelect(select, values, firstLabel) {
    var current = select.value;
    select.replaceChildren();
    if (firstLabel !== undefined) { var f = el('option', '', firstLabel); f.value = ''; select.append(f); }
    values.forEach(function (v) { var o = el('option', '', cap(v)); o.value = v; select.append(o); });
    if (values.indexOf(current) !== -1 || (firstLabel !== undefined && current === '')) select.value = current;
  }

  function renderCities() {
    var cities = allCities();
    // jaipur stays selectable: no supplier serves it, which shows the empty state.
    var searchable = cities.indexOf('jaipur') === -1 ? cities.concat(['jaipur']) : cities;
    var citySel = $('city');
    var had = citySel.value;
    fillSelect(citySel, searchable);
    citySel.value = had && searchable.indexOf(had) !== -1 ? had : (searchable.indexOf('delhi') !== -1 ? 'delhi' : searchable[0] || '');
    fillSelect($('adminCity'), cities, 'All cities');
    var list = $('cityList');
    list.replaceChildren();
    cities.forEach(function (c) { var o = el('option'); o.value = c; list.append(o); });
  }

  // ---- customer search ------------------------------------------------------------
  var searchSeq = 0;

  function syncBudgetChips() {
    var min = $('min').value.trim(), max = $('max').value.trim();
    each($('budgetChips').querySelectorAll('.chip'), function (c) {
      c.classList.toggle('on', c.dataset.min === min && c.dataset.max === max);
    });
  }

  async function search(override) {
    var city = override && 'city' in override ? override.city : $('city').value;
    var min = override && 'min' in override ? override.min : $('min').value.trim();
    var max = override && 'max' in override ? override.max : $('max').value.trim();
    syncBudgetChips();

    var qs = new URLSearchParams();
    if (city) qs.set('city', city);
    if (min !== '') qs.set('minPrice', min);
    if (max !== '') qs.set('maxPrice', max);
    var url = '/api/hotels' + (qs.toString() ? '?' + qs.toString() : '');

    var seq = ++searchSeq;
    $('resultsTitle').textContent = city ? 'Hotels in ' + city : 'Hotels';
    $('resultsSub').textContent = 'Comparing suppliers...';
    var sk = el('div', 'cards');
    for (var i = 0; i < 3; i++) sk.append(el('div', 'skeleton'));
    $('results').replaceChildren(sk);
    $('searchBtn').disabled = true;

    var cq = city ? '?city=' + encodeURIComponent(city) : null;
    var calls = await Promise.all([
      getJson(url).catch(function () { return { status: 0, ok: false, body: null, ms: 0 }; }),
      cq ? getJson('/supplierA/hotels' + cq).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: false }),
      cq ? getJson('/supplierB/hotels' + cq).catch(function () { return { ok: false }; }) : Promise.resolve({ ok: false }),
    ]);
    if (seq !== searchSeq) return;
    $('searchBtn').disabled = false;

    var res = calls[0];
    var raw = { A: calls[1], B: calls[2] };
    renderLastRequest(url, res);
    renderHotels(city, min, max, res, raw);
    renderCompare(city, res.ok && Array.isArray(res.body) ? res.body : null, raw);
    refreshHealth();
  }

  function offersByHotel(raw) {
    var map = {};
    ['A', 'B'].forEach(function (id) {
      var r = raw[id];
      if (!r.ok || !Array.isArray(r.body)) return;
      r.body.forEach(function (h) {
        var k = String(h.name).trim().toLowerCase();
        map[k] = map[k] || {};
        map[k][id] = h;
      });
    });
    return map;
  }

  function friendlyError(res) {
    var b = res.body || {};
    if (res.status === 400) {
      var msgs = (b.details || []).map(function (d) {
        if (d.field === 'city') return 'Please choose a city.';
        if (d.field === 'minPrice' || d.field === 'maxPrice') return 'Budget: ' + d.message.replace('minPrice', 'minimum').replace('maxPrice', 'maximum') + '.';
        return d.message;
      });
      return { icon: '✏️', title: 'Please check your search', text: msgs.join(' ') || b.message || 'Invalid search.' };
    }
    if (res.status === 502) return { icon: '🔌', title: 'Our partners are not responding', text: 'No supplier could be reached right now. Please try again in a moment.' };
    if (res.status === 503) return { icon: '🛠️', title: 'Search is temporarily unavailable', text: 'Please try again shortly.' };
    if (res.status === 0) return { icon: '📡', title: 'Cannot reach the server', text: 'Check that the app is running.' };
    return { icon: '⚠️', title: 'Something went wrong', text: b.message || 'Please try again.' };
  }

  function stateBox(cls, icon, title, text) {
    var s = el('div', 'state ' + cls);
    s.append(el('div', 'big', icon), el('h3', '', title), el('p', '', text));
    return s;
  }

  function renderHotels(city, min, max, res, raw) {
    var box = $('results');
    if (!(res.ok && Array.isArray(res.body))) {
      var f = friendlyError(res);
      $('resultsSub').textContent = '';
      box.replaceChildren(stateBox('err', f.icon, f.title, f.text));
      return;
    }
    var list = res.body;
    var budget = min || max ? ' within your budget' : '';
    $('resultsSub').textContent = list.length
      ? list.length + ' hotel' + (list.length === 1 ? '' : 's') + budget + ' \\u00B7 best price from 2 suppliers \\u00B7 ' + res.ms + ' ms'
      : '';
    if (!list.length) {
      box.replaceChildren(min || max
        ? stateBox('', '💸', 'No hotels in this budget', 'Try widening your budget range.')
        : stateBox('', '🧭', 'No hotels in ' + cap(city) + ' yet', 'Our suppliers do not list any stays here. Try another city.'));
      return;
    }

    var offers = offersByHotel(raw);
    var grid = el('div', 'cards');
    list.forEach(function (o, i) {
      var card = el('article', 'hotel');
      var img = el('div', 'hotel-img');
      img.style.background = gradientFor(o.name);
      img.append(document.createTextNode(o.name.charAt(0).toUpperCase()));
      if (i === 0) img.append(el('span', 'tag', '⭐ Cheapest'));
      img.append(el('span', 'rank', '#' + (i + 1)));
      card.append(img);

      var body = el('div', 'hotel-body');
      body.append(el('h3', '', o.name), el('p', 'loc', '📍 ' + cap(city)));

      var both = offers[o.name.trim().toLowerCase()] || {};
      var mine = letterOf(o.supplier);
      var other = both[mine === 'A' ? 'B' : 'A'];
      if (other && other.price > o.price) {
        body.append(el('p', 'save', '✓ Best of 2 prices \\u00B7 save ' + money(other.price - o.price)));
      } else if (other && other.price === o.price) {
        body.append(el('p', 'save neutral', 'Same price at both suppliers'));
      } else {
        body.append(el('p', 'save neutral', 'Exclusive to one partner'));
      }

      var pr = el('div', 'price-row');
      pr.append(el('span', 'price', money(o.price)), el('span', 'per', '/ night'));
      body.append(pr, el('span', 'via', 'via ' + o.supplier));
      card.append(body);
      grid.append(card);
    });
    box.replaceChildren(grid);
  }

  function resetSearch() {
    var sel = $('city');
    var hasDelhi = Array.prototype.some.call(sel.options, function (o) { return o.value === 'delhi'; });
    if (hasDelhi) sel.value = 'delhi';
    $('min').value = '';
    $('max').value = '';
    search();
  }

  $('resetSearch').addEventListener('click', resetSearch);
  $('searchForm').addEventListener('submit', function (e) { e.preventDefault(); search(); });
  $('city').addEventListener('change', function () { search(); });
  each($('budgetChips').querySelectorAll('.chip'), function (c) {
    c.addEventListener('click', function () {
      $('min').value = c.dataset.min;
      $('max').value = c.dataset.max;
      search();
    });
  });

  // ---- admin dashboard ------------------------------------------------------------
  function renderAdmin() {
    var cityFilter = $('adminCity').value;
    var a = catalogue.A || [], b = catalogue.B || [];
    var namesA = {}, overlap = 0, comm = 0, n = 0;
    a.forEach(function (h) { namesA[h.city + '|' + h.name.toLowerCase()] = true; });
    b.forEach(function (h) { if (namesA[h.city + '|' + h.name.toLowerCase()]) overlap++; });
    a.concat(b).forEach(function (h) { comm += h.commissionPct; n++; });

    var stats = $('stats');
    stats.replaceChildren();
    [
      [a.length, 'Supplier A hotels'], [b.length, 'Supplier B hotels'],
      [overlap, 'Hotels at both (compared)'], [allCities().length, 'Cities'],
      [n ? (comm / n).toFixed(1) + '%' : '-', 'Avg. commission'],
    ].forEach(function (s) {
      var c = el('div', 'stat');
      c.append(el('div', 'v', String(s[0])), el('div', 'k', s[1]));
      stats.append(c);
    });

    renderSupplierPanel('A', a, cityFilter);
    renderSupplierPanel('B', b, cityFilter);
    loadOutages(); // the panels were just rebuilt, so refill their status rows

  }

  function renderSupplierPanel(id, hotels, cityFilter) {
    var panel = $('panel' + id);
    var rows = hotels.filter(function (h) { return !cityFilter || h.city.toLowerCase() === cityFilter; })
      .slice().sort(function (x, y) { return x.city.localeCompare(y.city) || x.price - y.price; });

    panel.replaceChildren();
    var head = el('div', 'sup-head');
    var title = el('div', 'sup-title');
    var mark = el('span', 'sup-mark');
    mark.style.background = id === 'A' ? 'var(--a)' : 'var(--b)';
    title.append(mark, el('h2', '', 'Supplier ' + id));
    head.append(title, el('span', 'pill', rows.length + ' hotel' + (rows.length === 1 ? '' : 's')));
    panel.append(head);

    var outage = el('div', 'outage');
    outage.id = 'outage' + id;
    outage.append(el('span', 'lbl', 'Loading status...'));
    panel.append(outage);

    if (!rows.length) {
      panel.append(el('p', 'empty', 'No hotels' + (cityFilter ? ' in ' + cap(cityFilter) : '') + '.'));
      return;
    }
    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var hr = el('tr');
    [['Hotel', ''], ['City', ''], ['Price', 'num'], ['Commission', 'num'], ['', '']].forEach(function (c) { hr.append(el('th', c[1], c[0])); });
    var thead = el('thead'); thead.append(hr); table.append(thead);
    var tb = el('tbody');
    rows.forEach(function (h) {
      var tr = el('tr', justAdded[id + ':' + h.hotelId] ? 'new' : '');
      var nameTd = el('td', '', h.name);
      if (justAdded[id + ':' + h.hotelId]) nameTd.append(el('span', 'badge-new', 'NEW'));
      tr.append(nameTd, el('td', 'cap', h.city), el('td', 'num', money(h.price)));
      var c = el('td', 'num'); c.append(el('span', 'comm', h.commissionPct + '%')); tr.append(c);
      var act = el('td', 'act');
      var rm = el('button', 'small danger', 'Remove');
      rm.type = 'button';
      rm.addEventListener('click', function () { removeHotel(id, h, rm); });
      act.append(rm);
      tr.append(act);
      tb.append(tr);
    });
    table.append(tb);
    wrap.append(table);
    panel.append(wrap);
  }

  $('adminCity').addEventListener('change', function () { renderAdmin(); loadOutages(); });

  $('resetDemo').addEventListener('click', async function () {
    if (!confirm('Reset the demo? Every added or removed hotel is undone and both suppliers come back online.')) return;
    var btn = $('resetDemo');
    btn.disabled = true;
    var res = await adminFetch('/admin/reset', { method: 'POST' });
    btn.disabled = false;
    if (!res.ok) { if (res.status !== 401) toast('Reset failed'); return; }
    justAdded = {};
    $('addMsg').hidden = true;
    $('addForm').reset();
    $('adminCity').value = '';
    await loadCatalogue();
    loadOutages();
    refreshHealth();
    resetSearch();
    toast('Demo data reset');
  });

  function numberOrNull(v) { v = v.trim(); return v === '' ? null : Number(v); }
  function showAddMsg(cls, text) { var m = $('addMsg'); m.className = 'form-msg ' + cls; m.textContent = text; m.hidden = false; }

  $('addForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var supplier = $('addSupplier').value;
    var body = { name: $('addName').value, city: $('addCity').value, price: numberOrNull($('addPrice').value), commissionPct: numberOrNull($('addComm').value) };
    $('addBtn').disabled = true;
    var res;
    try {
      res = await adminFetch('/suppliers/' + supplier + '/hotels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch (err) { res = { ok: false, status: 0, body: { message: 'Could not reach the server.' } }; }
    $('addBtn').disabled = false;

    if (res.status === 201 && res.body && res.body.hotel) {
      var h = res.body.hotel;
      justAdded[supplier + ':' + h.hotelId] = true;
      showAddMsg('ok', '✓ Added ' + h.name + ' (' + cap(h.city) + ', ' + money(h.price) + ', ' + h.commissionPct + '% commission) to Supplier ' + supplier + '. Customers will see it on their next search.');
      $('addName').value = ''; $('addPrice').value = ''; $('addComm').value = '';
      $('adminCity').value = '';
      await loadCatalogue();
      loadOutages();
      return;
    }
    if (res.status === 401) return;
    var b = res.body || {};
    var detail = Array.isArray(b.details) && b.details.length
      ? b.details.map(function (d) { return cap(d.field) + ': ' + d.message; }).join(' \\u00B7 ')
      : (b.message || 'Could not add the hotel');
    showAddMsg('bad', detail);
  });

  async function removeHotel(supplier, hotel, btn) {
    if (!confirm('Remove ' + hotel.name + ' (' + cap(hotel.city) + ') from Supplier ' + supplier + '?')) return;
    btn.disabled = true;
    var res = await adminFetch('/suppliers/' + supplier + '/hotels/' + encodeURIComponent(hotel.hotelId), { method: 'DELETE' });
    if (res.ok) {
      toast('Removed ' + hotel.name + ' from Supplier ' + supplier);
      await loadCatalogue();
      loadOutages();
    } else if (res.status !== 401) {
      btn.disabled = false;
      toast((res.body && res.body.message) || 'Could not remove the hotel');
    }
  }

  // Outage simulation lives on each supplier panel.
  var MODES = [['Online', { down: false, delayMs: 0 }], ['Down', { down: true, delayMs: 0 }], ['Slow 3s', { down: false, delayMs: 3000 }]];

  async function loadOutages() {
    if (view !== 'admin') return;
    var res;
    try { res = await getJson('/suppliers/control'); } catch (e) { return; }
    if (!res.body) return;
    ['A', 'B'].forEach(function (id) {
      var box = $('outage' + id);
      if (!box) return;
      var s = res.body[id] || { down: false, delayMs: 0 };
      var mode = s.down ? 'Down' : s.delayMs > 0 ? 'Slow 3s' : 'Online';
      box.replaceChildren();
      var lbl = el('span', 'lbl');
      lbl.append(document.createTextNode('API status: '));
      lbl.append(el('span', 'pill ' + (s.down ? 'bad' : s.delayMs > 0 ? 'warn' : 'ok'), s.down ? 'Down' : s.delayMs > 0 ? 'Slow' : 'Online'));
      box.append(lbl);
      MODES.forEach(function (m) {
        var b = el('button', 'small' + (m[0] === mode ? ' on-state' : ''), m[0]);
        b.type = 'button';
        b.addEventListener('click', async function () {
          b.disabled = true;
          await adminFetch('/suppliers/' + id + '/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(m[1]) });
          toast('Supplier ' + id + ': ' + m[0]);
          loadOutages();
          refreshHealth();
        });
        box.append(b);
      });
    });
  }

  // ---- technical details ----------------------------------------------------------
  function renderLastRequest(url, res) {
    var line = $('reqLine');
    line.replaceChildren();
    var cls = res.status >= 200 && res.status < 300 ? 'ok' : res.status >= 500 || res.status === 0 ? 'bad' : 'warn';
    line.append(el('code', '', 'GET ' + url), el('span', 'pill ' + cls, res.status ? 'HTTP ' + res.status : 'no response'), el('span', 'pill', res.ms + ' ms'));
    var text = res.body === null ? '(no body)' : JSON.stringify(res.body, null, 2);
    $('reqBody').textContent = text.length > 4000 ? text.slice(0, 4000) + '\\n...' : text;
  }

  function renderCompare(city, apiOffers, raw) {
    $('cmpCity').textContent = city ? cap(city) : '-';
    var box = $('compare');
    var offers = offersByHotel(raw);
    var keys = Object.keys(offers);
    if (!city || !keys.length) {
      var down = !raw.A.ok && !raw.B.ok && city;
      box.replaceChildren(el('p', 'empty', !city ? 'Choose a city to compare suppliers.' : down ? 'Both supplier APIs are unavailable.' : 'Neither supplier lists hotels here.'));
      return;
    }
    var picked = {};
    (apiOffers || []).forEach(function (o) { picked[o.name.trim().toLowerCase()] = o; });
    var wrap = el('div', 'table-wrap');
    var table = el('table');
    var hr = el('tr');
    hr.append(el('th', '', 'Hotel'));
    ['A', 'B'].forEach(function (id) { hr.append(el('th', 'num', 'Supplier ' + id + (raw[id].ok ? '' : ' (down)'))); });
    hr.append(el('th', '', 'API returned'));
    var thead = el('thead'); thead.append(hr); table.append(thead);
    var tb = el('tbody');
    keys.sort().forEach(function (k) {
      var row = offers[k];
      var win = picked[k];
      var tr = el('tr');
      tr.append(el('td', '', (row.A || row.B).name));
      ['A', 'B'].forEach(function (id) {
        var h = row[id];
        if (!h) { tr.append(el('td', 'num', '-')); return; }
        var isWin = win && letterOf(win.supplier) === id && win.price === h.price;
        tr.append(el('td', 'num' + (isWin ? ' win' : ''), money(h.price) + ' \\u00B7 ' + h.commissionPct + '%'));
      });
      var r = el('td');
      if (win) r.append(supBadge(letterOf(win.supplier)));
      else r.textContent = apiOffers === null ? 'search failed' : 'outside budget';
      tr.append(r);
      tb.append(tr);
    });
    table.append(tb);
    wrap.append(table);
    box.replaceChildren(wrap);
  }

  var HEALTH_LABEL = { ok: 'All systems up', degraded: 'Degraded', unhealthy: 'Unhealthy' };
  async function refreshHealth() {
    var res;
    try { res = await getJson('/health'); } catch (e) { res = null; }
    var pill = $('healthPill');
    if (!res || !res.body || !res.body.dependencies) {
      pill.className = 'pill bad';
      $('healthText').textContent = 'Server unreachable';
      return;
    }
    var b = res.body;
    pill.className = 'pill ' + (b.status === 'ok' ? 'ok' : b.status === 'degraded' ? 'warn' : 'bad');
    $('healthText').textContent = HEALTH_LABEL[b.status] || b.status;
    var deps = $('deps');
    deps.replaceChildren();
    [['Supplier A', b.dependencies.suppliers['Supplier A']], ['Supplier B', b.dependencies.suppliers['Supplier B']],
     ['Redis', b.dependencies.redis], ['Temporal', b.dependencies.temporal]].forEach(function (d) {
      var info = d[1] || { status: 'down', latencyMs: 0, error: 'not reported' };
      var c = el('div', 'dep ' + (info.status === 'up' ? 'up' : 'down'));
      var n = el('div', 'n'); n.append(el('span', 'dot'), document.createTextNode(d[0] + ' \\u00B7 ' + info.latencyMs + ' ms'));
      c.append(n, el('div', 'd', info.status === 'up' ? (info.detail || 'up') : (info.error || 'down')));
      deps.append(c);
    });
    $('healthTime').textContent = '(HTTP ' + res.status + ', ' + new Date().toLocaleTimeString() + ')';
  }

  function renderEndpoints() {
    var ui = location.protocol + '//' + location.hostname + ':8080';
    var eps = [
      ['GET', '/api/hotels?city=delhi&minPrice=5000&maxPrice=9000', 'Search (runs the workflow)', true],
      ['GET', '/health', 'Per-dependency health', true],
      ['GET', '/supplierA/hotels?city=delhi', 'Mock Supplier A API', true],
      ['GET', '/supplierB/hotels?city=delhi', 'Mock Supplier B API', true],
      ['GET', '/suppliers/catalogue', 'Both catalogues', true],
      ['GET', '/suppliers/control', 'Outage state', true],
      ['POST', '/admin/login', 'Password \\u2192 bearer token', false],
      ['POST', '/suppliers/{A|B}/hotels', 'Admin: add hotel', false],
      ['DELETE', '/suppliers/{A|B}/hotels/{id}', 'Admin: remove hotel', false],
      ['POST', '/suppliers/{A|B}/control', 'Admin: simulate outage', false],
      ['POST', '/admin/reset', 'Admin: restore demo data', false],
      ['UI', ui, 'Temporal UI (workflow history)', true],
    ];
    var ul = $('eps');
    eps.forEach(function (e) {
      var li = el('li');
      li.append(el('span', 'm ' + (e[0] === 'DELETE' ? 'del' : e[0] === 'POST' ? 'post' : 'get'), e[0]));
      if (e[3]) {
        var a = el('a', 'mono', e[1].replace(location.protocol + '//', ''));
        a.href = e[1]; a.target = '_blank'; a.rel = 'noopener';
        li.append(a);
      } else {
        li.append(el('code', '', e[1]));
      }
      li.append(el('span', 'what', e[2]));
      ul.append(li);
    });
  }

  each(document.querySelectorAll('[data-try]'), function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.try;
      setView('user');
      if (t === 'missing') search({ city: '', min: '', max: '' });
      if (t === 'nan') search({ city: $('city').value, min: 'abc', max: '' });
      if (t === 'inverted') search({ city: $('city').value, min: '9000', max: '1000' });
      if (t === 'jaipur') { $('city').value = 'jaipur'; $('min').value = ''; $('max').value = ''; search(); }
      document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ---- start ------------------------------------------------------------------------
  // Another tab (e.g. the admin's) may have changed the catalogue meanwhile.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) loadCatalogue(); });
  window.addEventListener('focus', function () { loadCatalogue(); });

  async function init() {
    renderEndpoints();
    buildSlides();
    if (token) {
      try {
        var s = await getJson('/admin/session', { headers: { authorization: 'Bearer ' + token } });
        if (!(s.body && s.body.admin)) saveToken(null);
      } catch (e) { /* re-checked on the next admin call */ }
    }
    await loadCatalogue();
    applyRole();
    search();
    refreshHealth();
    setInterval(refreshHealth, 15000);
  }
  init();
})();
</script>
</body>
</html>
`;

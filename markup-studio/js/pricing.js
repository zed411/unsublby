/* pricing.js — the Estimate tab: an editable rate library plus a live cost
 * rollup that prices every markup by matching its Subject to a rate.
 *
 * NOTE ON DATA: the seeded rates are PLACEHOLDER numbers only. Commercial
 * cost-book data (e.g. Rawlhouse, Rawlinsons, CoreLogic/Cordell) is licensed
 * IP and is not, and must not be, bundled here. Replace these with your own
 * rates or ones you have licensed. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const A = MS.annotations;
  const P = (MS.pricing = {});

  // How each markup type contributes a quantity to the estimate.
  //   length -> calibrated length (unit m), area -> calibrated area (unit m2),
  //   everything else -> a count of 1 (unit ea).
  P.quantityOf = function (a) {
    const cal = S.calibration;
    if (a.type === "length") {
      const q = MS.polylineLength(a.points || []) * (cal ? cal.unitsPerPoint : 1);
      return { qty: q, unit: cal ? cal.unit : "pt" };
    }
    if (a.type === "area") {
      const f = cal ? cal.unitsPerPoint : 1;
      const q = MS.polygonArea(a.points || []) * f * f;
      return { qty: q, unit: (cal ? cal.unit : "pt") + "2" };
    }
    return { qty: 1, unit: "ea" };
  };

  P.findRate = function (subject) {
    if (!subject) return null;
    const key = subject.trim().toLowerCase();
    return S.rates.find((r) =>
      (r.code && r.code.trim().toLowerCase() === key) ||
      (r.trade && r.trade.trim().toLowerCase() === key)) || null;
  };

  // Classify a unit into a dimension so a length isn't priced against an
  // "each" rate (etc). "ea" -> count, anything ending in 2 -> area, else linear.
  P.dimension = function (unit) {
    const u = (unit || "").trim().toLowerCase();
    if (u === "ea" || u === "no" || u === "item" || u === "") return "count";
    if (/2$|²$|sq/.test(u)) return "area";
    return "linear";
  };

  // Build the priced estimate: grouped by matched rate, plus an unpriced bucket.
  P.build = function () {
    const lines = {};      // rateId -> line
    const unpriced = [];   // markups with a subject but no matching (compatible) rate
    S.annotations.forEach((a) => {
      if (!a.subject) return;
      const q = P.quantityOf(a);
      const rate = P.findRate(a.subject);
      // require a matching rate whose unit dimension fits the markup's quantity
      if (!rate || P.dimension(rate.unit) !== P.dimension(q.unit)) {
        unpriced.push({ a, q, reason: rate ? "unit" : "norate" });
        return;
      }
      const L = lines[rate.id] || (lines[rate.id] = {
        rate, trade: rate.trade || "—", desc: rate.desc || rate.code,
        unit: rate.unit, qty: 0, count: 0,
      });
      L.qty += q.qty;
      L.count += 1;
    });
    const list = Object.values(lines).map((L) => ({ ...L, amount: L.qty * (+L.rate.rate || 0) }));
    // group by trade for subtotals
    const byTrade = {};
    list.forEach((L) => { (byTrade[L.trade] = byTrade[L.trade] || []).push(L); });
    const total = list.reduce((s, L) => s + L.amount, 0);
    return { list, byTrade, unpriced, total };
  };

  // ---- rate library CRUD ----
  P.addRate = function (r) {
    S.rates.push(Object.assign({ id: MS.uid("rt"), code: "", trade: "", desc: "", unit: "ea", rate: 0 }, r));
    MS.savePrefs(); P.render();
  };
  P.updateRate = function (id, patch) {
    const r = S.rates.find((x) => x.id === id);
    if (r) { Object.assign(r, patch); MS.savePrefs(); P.renderEstimate(); }
  };
  P.removeRate = function (id) {
    S.rates = S.rates.filter((x) => x.id !== id);
    MS.savePrefs(); P.render();
  };

  // ---- init / seed ----
  P.init = function () {
    if (!S.rates.length) {
      // PLACEHOLDER sample rates — replace with your own licensed/derived rates.
      S.rates = [
        { id: MS.uid("rt"), code: "Concrete", trade: "Structure", desc: "Slab on ground incl. mesh & pump (SAMPLE)", unit: "m2", rate: 95 },
        { id: MS.uid("rt"), code: "Blockwork", trade: "Structure", desc: "200mm core-filled blockwork (SAMPLE)", unit: "m2", rate: 145 },
        { id: MS.uid("rt"), code: "Skirting", trade: "Carpentry", desc: "MDF skirting supply & fix (SAMPLE)", unit: "m", rate: 18 },
        { id: MS.uid("rt"), code: "GPO", trade: "Electrical", desc: "Double power outlet (SAMPLE)", unit: "ea", rate: 85 },
        { id: MS.uid("rt"), code: "Downlight", trade: "Electrical", desc: "LED downlight supply & install (SAMPLE)", unit: "ea", rate: 65 },
        { id: MS.uid("rt"), code: "Door", trade: "Doors", desc: "Internal hinged door hung complete (SAMPLE)", unit: "ea", rate: 340 },
      ];
      MS.savePrefs();
    }
    document.getElementById("btn-rate-add").addEventListener("click", () => P.addRate({ code: "New", trade: "Trade", unit: "ea", rate: 0 }));
    document.getElementById("btn-rate-export").addEventListener("click", exportRates);
    document.getElementById("btn-rate-import").addEventListener("click", () => document.getElementById("rate-import-input").click());
    document.getElementById("rate-import-input").addEventListener("change", importRates);
    document.getElementById("btn-est-export").addEventListener("click", exportEstimate);
    document.getElementById("btn-est-copy").addEventListener("click", copyForSheets);
    document.getElementById("est-project").addEventListener("input", (e) => { S.estimateName = e.target.value; });
    MS.on("annots-changed", P.renderEstimate);
    MS.on("doc-loaded", P.renderEstimate);
    P.render();
  };

  P.render = function () { renderRates(); P.renderEstimate(); };

  function renderRates() {
    const host = document.getElementById("rate-list");
    host.innerHTML = "";
    if (!S.rates.length) { host.innerHTML = `<div class="list-empty">No rates. Add one or import a CSV.</div>`; return; }
    S.rates.forEach((r) => {
      const row = document.createElement("div");
      row.className = "rate-row";
      row.innerHTML = `
        <input class="rate-code" value="${attr(r.code)}" placeholder="Code" title="Code — match to markup Subject" />
        <input class="rate-trade" value="${attr(r.trade)}" placeholder="Trade" />
        <select class="rate-unit">
          ${["ea", "m", "m2"].map((u) => `<option ${u === r.unit ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <input class="rate-val" type="number" step="0.01" value="${+r.rate || 0}" title="Unit rate" />
        <span class="mini-x" title="Delete rate">✕</span>
        <input class="rate-desc" value="${attr(r.desc)}" placeholder="Description" />`;
      row.querySelector(".rate-code").addEventListener("change", (e) => P.updateRate(r.id, { code: e.target.value }));
      row.querySelector(".rate-trade").addEventListener("change", (e) => P.updateRate(r.id, { trade: e.target.value }));
      row.querySelector(".rate-unit").addEventListener("change", (e) => P.updateRate(r.id, { unit: e.target.value }));
      row.querySelector(".rate-val").addEventListener("change", (e) => P.updateRate(r.id, { rate: +e.target.value }));
      row.querySelector(".rate-desc").addEventListener("change", (e) => P.updateRate(r.id, { desc: e.target.value }));
      row.querySelector(".mini-x").addEventListener("click", () => P.removeRate(r.id));
      host.appendChild(row);
    });
  }

  P.renderEstimate = function () {
    const host = document.getElementById("est-table");
    const totalEl = document.getElementById("est-total");
    if (!host) return;
    const est = P.build();
    if (!est.list.length && !est.unpriced.length) {
      host.innerHTML = `<div class="list-empty">Tag markups with a <b>Subject</b> that matches a rate Code/Trade to price them.</div>`;
      totalEl.textContent = "";
      return;
    }
    let html = "";
    Object.keys(est.byTrade).sort().forEach((trade) => {
      const rows = est.byTrade[trade];
      const sub = rows.reduce((s, L) => s + L.amount, 0);
      html += `<div class="est-trade">${esc(trade)}<span>${money(sub)}</span></div>`;
      rows.forEach((L) => {
        html += `<div class="est-line">
          <div class="est-desc">${esc(L.desc)} <span class="est-code">${esc(L.rate.code)}</span></div>
          <div class="est-nums">
            <span>${fmt(L.qty)} ${esc(L.unit)}</span>
            <span>@ ${money(+L.rate.rate)}</span>
            <span class="est-amt">${money(L.amount)}</span>
          </div>
          <div class="est-src">${L.count} markup${L.count > 1 ? "s" : ""}</div>
        </div>`;
      });
    });
    if (est.unpriced.length) {
      const subs = {};
      est.unpriced.forEach((u) => {
        const k = u.a.subject + "|" + u.reason;
        (subs[k] = subs[k] || { subject: u.a.subject, reason: u.reason, n: 0 }).n++;
      });
      html += `<div class="est-trade est-unpriced">Unpriced</div>`;
      Object.values(subs).forEach((g) => {
        const note = g.reason === "unit"
          ? "rate unit doesn't fit this markup (count vs length vs area)"
          : "no rate with this Code/Trade — add one above";
        html += `<div class="est-line"><div class="est-desc">${esc(g.subject)}</div><div class="est-src">${g.n} markup(s) — ${note}</div></div>`;
      });
    }
    host.innerHTML = html;
    totalEl.innerHTML = `<span>Estimated total</span><b>${money(est.total)}</b>`;
  };

  // ---- CSV import / export ----
  function exportRates() {
    const head = ["Code", "Trade", "Description", "Unit", "Rate"];
    const rows = S.rates.map((r) => [r.code, r.trade, r.desc, r.unit, r.rate]);
    MS.download(toCsv([head, ...rows]), "rate-library.csv", "text/csv");
  }
  function importRates(e) {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      const rows = parseCsv(rd.result);
      if (!rows.length) { alert("Empty or unreadable CSV."); return; }
      const start = /code/i.test(rows[0][0] || "") ? 1 : 0; // skip header row if present
      const add = [];
      for (let i = start; i < rows.length; i++) {
        const c = rows[i];
        if (!c.length || !(c[0] || "").trim()) continue;
        add.push({ id: MS.uid("rt"), code: c[0] || "", trade: c[1] || "", desc: c[2] || "", unit: (c[3] || "ea").trim(), rate: parseFloat(c[4]) || 0 });
      }
      if (!add.length) { alert("No rate rows found. Expected columns: Code, Trade, Description, Unit, Rate."); return; }
      if (confirm(`Import ${add.length} rates? Choose Cancel to replace the library, OK to append.`)) S.rates.push(...add);
      else S.rates = add;
      MS.savePrefs(); P.render();
    };
    rd.readAsText(f); e.target.value = "";
  }
  // Build a tab-separated estimate and copy it — pasting into Google Sheets
  // cell A1 fills the grid directly, no import step.
  function copyForSheets() {
    const est = P.build();
    const rows = [["Trade", "Code", "Description", "Quantity", "Unit", "Rate", "Amount"]];
    est.list.forEach((L) => rows.push([L.trade, L.rate.code, L.desc, MS.round(L.qty, 3), L.unit, +L.rate.rate, MS.round(L.amount, 2)]));
    rows.push([]);
    rows.push(["", "", "", "", "", "TOTAL", MS.round(est.total, 2)]);
    const tsv = rows.map((r) => r.map((v) => String(v == null ? "" : v).replace(/\t|\n/g, " ")).join("\t")).join("\n");
    const btn = document.getElementById("btn-est-copy");
    const done = () => { btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = "Copy for Sheets"), 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done, () => fallbackCopy(tsv, done));
    else fallbackCopy(tsv, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { alert("Copy failed — use Export CSV."); }
    ta.remove();
  }

  function exportEstimate() {
    const est = P.build();
    const head = ["Trade", "Code", "Description", "Quantity", "Unit", "Rate", "Amount"];
    const rows = est.list.map((L) => [L.trade, L.rate.code, L.desc, MS.round(L.qty, 3), L.unit, +L.rate.rate, MS.round(L.amount, 2)]);
    rows.push([]);
    rows.push(["", "", "", "", "", "TOTAL", MS.round(est.total, 2)]);
    const name = (S.estimateName || S.fileName || "estimate").replace(/\.pdf$/i, "");
    MS.download(toCsv([head, ...rows]), name + "-estimate.csv", "text/csv");
  }

  // ---- helpers ----
  function money(v) { return "$" + (Math.round((+v || 0) * 100) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmt(v) { return MS.round(v, 2).toLocaleString("en-AU"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
  function attr(s) { return String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function toCsv(rows) {
    return rows.map((r) => r.map((v) => {
      const s = String(v == null ? "" : v);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(",")).join("\r\n");
  }
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.length && r.some((x) => x !== ""));
  }
})();

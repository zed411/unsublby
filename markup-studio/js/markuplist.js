/* markuplist.js — the right-hand Markups panel: live list, status/subject
 * editing, filtering, CSV export, and a quantity-takeoff estimate summary. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const A = MS.annotations;
  const L = (MS.list = {});

  let filter = "all";

  L.init = function () {
    document.getElementById("filter-status").addEventListener("change", (e) => {
      filter = e.target.value; L.render();
    });
    document.getElementById("btn-export-csv").addEventListener("click", L.exportCsv);
    MS.on("annots-changed", L.render);
    MS.on("selection-changed", L.render);
  };

  function label(a) {
    if (a.type === "length" || a.type === "area") return A.measureText(a);
    if (a.subject) return a.subject;
    if (a.text) return a.text.slice(0, 40);
    return a.type;
  }

  L.render = function () {
    const host = document.getElementById("markup-list");
    const items = S.annotations.filter((a) => filter === "all" || a.status === filter);
    if (!items.length) {
      host.innerHTML = `<div class="list-empty">${S.annotations.length ? "No markups match this filter." : "No markups yet. Pick a tool and draw on the page."}</div>`;
      renderSummary();
      return;
    }
    host.innerHTML = "";
    items.forEach((a) => host.appendChild(row(a)));
    renderSummary();
  };

  function row(a) {
    const div = document.createElement("div");
    div.className = "mk-item" + (a.id === S.selectedId ? " selected" : "");
    div.innerHTML = `
      <div class="mk-swatch" style="background:${a.color}"></div>
      <div class="mk-body">
        <div class="mk-top">
          <span class="mk-type">${a.type}</span>
          <span class="mk-page">p.${a.page}</span>
        </div>
        <div class="mk-subject">${escapeHtml(label(a)) || "&nbsp;"}</div>
        <div class="mk-meta">
          <span class="mk-status status-${a.status}">${a.status === "none" ? "open" : a.status}</span>
          <span>${escapeHtml(a.author)}</span>
        </div>
      </div>`;
    div.addEventListener("click", () => {
      A.select(a.id);
      const info = MS.viewer.pageInfoFor(a.page);
      if (info) info.wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // cycle status on right-click
    div.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      const i = MS.STATUSES.indexOf(a.status);
      A.update(a.id, { status: MS.STATUSES[(i + 1) % MS.STATUSES.length] });
      L.render();
    });
    return div;
  }

  function renderSummary() {
    const el = document.getElementById("list-summary");
    const total = S.annotations.length;
    if (!total) { el.innerHTML = ""; return; }
    const counts = { none: 0, accepted: 0, rejected: 0, completed: 0 };
    S.annotations.forEach((a) => counts[a.status]++);
    const measures = S.annotations.filter((a) => a.type === "length" || a.type === "area");
    let takeoff = "";
    if (measures.length) {
      const lens = measures.filter((a) => a.type === "length");
      const areas = measures.filter((a) => a.type === "area");
      const totLen = lens.reduce((s, a) => s + MS.polylineLength(a.points), 0);
      const totArea = areas.reduce((s, a) => s + MS.polygonArea(a.points), 0);
      const cal = S.calibration;
      const lenTxt = cal ? MS.round(totLen * cal.unitsPerPoint, 2) + " " + cal.unit : MS.round(totLen, 0) + " pt";
      const areaTxt = cal ? MS.round(totArea * cal.unitsPerPoint * cal.unitsPerPoint, 2) + " " + cal.unit + "²" : MS.round(totArea, 0) + " pt²";
      takeoff = `<div style="margin-top:6px">Takeoff — length: <b>${lenTxt}</b>${areas.length ? `, area: <b>${areaTxt}</b>` : ""}</div>`;
    }
    el.innerHTML =
      `<b>${total}</b> markups · open ${counts.none} · done ${counts.completed} · ✓ ${counts.accepted} · ✗ ${counts.rejected}${takeoff}`;
  }

  L.exportCsv = function () {
    if (!S.annotations.length) return;
    const cal = S.calibration;
    const head = ["#", "Page", "Type", "Subject", "Text", "Status", "Author", "Color", "Measurement", "Unit"];
    const rows = S.annotations.map((a, i) => {
      let meas = "", unit = "";
      if (a.type === "length") { meas = cal ? MS.round(MS.polylineLength(a.points) * cal.unitsPerPoint, 3) : MS.round(MS.polylineLength(a.points), 1); unit = cal ? cal.unit : "pt"; }
      if (a.type === "area") { const f = cal ? cal.unitsPerPoint : 1; meas = MS.round(MS.polygonArea(a.points) * f * f, 3); unit = cal ? cal.unit + "2" : "pt2"; }
      return [i + 1, a.page, a.type, a.subject, (a.text || "").replace(/\n/g, " "), a.status, a.author, a.color, meas, unit];
    });
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    download(csv, (S.fileName || "markups").replace(/\.pdf$/i, "") + "-markups.csv", "text/csv");
  };

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function download(text, name, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  MS.download = download;
})();

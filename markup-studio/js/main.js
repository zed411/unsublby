/* main.js — bootstraps the app: wires UI controls, file open/drop, property
 * editors, keyboard shortcuts, and the side-panel tabs. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const V = MS.viewer;
  const A = MS.annotations;
  const T = MS.tools;

  function $(id) { return document.getElementById(id); }

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (!window.pdfjsLib) { alert("PDF renderer failed to load (offline?). Reconnect and reload."); }

    T.buildRail();
    T.attach();
    MS.list.init();
    MS.workflows.init();
    MS.pricing.init();
    buildSwatches();
    wireProps();
    wireFiles();
    wireChrome();
    wireTabs();
    wireKeys();
    wireTextPopover();
    wireAnalyze();
    syncProps();
    V.updateChrome();
  }

  // ---- Color swatches + style controls ----
  function buildSwatches() {
    const host = $("color-swatches");
    MS.PALETTE.forEach((c) => {
      const s = document.createElement("div");
      s.className = "swatch" + (c === S.style.color ? " active" : "");
      s.style.background = c;
      s.dataset.color = c;
      s.addEventListener("click", () => setColor(c));
      host.appendChild(s);
    });
  }
  function setColor(c) {
    S.style.color = c;
    $("color-picker").value = /^#[0-9a-f]{6}$/i.test(c) ? c : "#000000";
    document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.color === c));
    applyToSelection({ color: c });
  }

  function wireProps() {
    $("color-picker").addEventListener("input", (e) => { S.style.color = e.target.value; document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active")); applyToSelection({ color: e.target.value }); });
    $("stroke-range").addEventListener("input", (e) => { S.style.strokeWidth = +e.target.value; $("stroke-value").textContent = (+e.target.value).toFixed(1); applyToSelection({ strokeWidth: +e.target.value }); });
    $("opacity-range").addEventListener("input", (e) => { S.style.opacity = +e.target.value; applyToSelection({ opacity: +e.target.value }); });
    $("fill-toggle").addEventListener("change", (e) => { S.style.fill = e.target.checked; applyToSelection({ fill: e.target.checked }); });
    $("font-range").addEventListener("input", (e) => { S.style.fontSize = +e.target.value; $("font-value").textContent = e.target.value; applyToSelection({ fontSize: +e.target.value }); });
    $("subject-input").addEventListener("input", (e) => { S.style.subject = e.target.value; applyToSelection({ subject: e.target.value }); });
    MS.on("style-changed", syncProps);
    MS.on("selection-changed", onSelectionChanged);
  }

  // When something is selected, edits target it; otherwise they set defaults
  function applyToSelection(patch) {
    if (S.selectedId) A.update(S.selectedId, patch);
  }
  function onSelectionChanged() {
    const a = S.selectedId && A.get(S.selectedId);
    if (a) {
      // reflect the selected annotation's style in the controls
      $("stroke-range").value = a.strokeWidth; $("stroke-value").textContent = a.strokeWidth.toFixed(1);
      $("opacity-range").value = a.opacity;
      $("fill-toggle").checked = !!a.fill;
      $("font-range").value = a.fontSize; $("font-value").textContent = a.fontSize;
      $("subject-input").value = a.subject || "";
      $("color-picker").value = /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#000000";
      document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.color === a.color));
    }
  }
  function syncProps() {
    $("stroke-range").value = S.style.strokeWidth; $("stroke-value").textContent = S.style.strokeWidth.toFixed(1);
    $("opacity-range").value = S.style.opacity;
    $("fill-toggle").checked = S.style.fill;
    $("font-range").value = S.style.fontSize; $("font-value").textContent = S.style.fontSize;
    $("subject-input").value = S.style.subject;
    document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.color === S.style.color));
  }

  // ---- File open / drag & drop / save / load / export ----
  function wireFiles() {
    const open = (input) => input.addEventListener("change", (e) => { const f = e.target.files[0]; if (f) V.openFile(f); e.target.value = ""; });
    open($("file-input")); open($("file-input-2"));

    $("btn-save-json").addEventListener("click", MS.exporter.saveProject);
    $("btn-export-pdf").addEventListener("click", async () => {
      const btn = $("btn-export-pdf"); btn.disabled = true; btn.textContent = "Exporting…";
      try { await MS.exporter.exportPdf(); } catch (err) { alert("Export failed: " + err.message); }
      btn.textContent = "Export PDF"; btn.disabled = false;
    });
    $("load-input").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { try { MS.exporter.loadProject(JSON.parse(rd.result)); } catch (x) { alert("Could not read file."); } };
      rd.readAsText(f); e.target.value = "";
    });

    // Drag & drop
    const ov = $("drop-overlay");
    let depth = 0;
    window.addEventListener("dragenter", (e) => { e.preventDefault(); depth++; ov.classList.add("show"); });
    window.addEventListener("dragover", (e) => e.preventDefault());
    window.addEventListener("dragleave", (e) => { depth--; if (depth <= 0) { depth = 0; ov.classList.remove("show"); } });
    window.addEventListener("drop", (e) => {
      e.preventDefault(); depth = 0; ov.classList.remove("show");
      const f = [...e.dataTransfer.files].find((x) => x.type === "application/pdf" || /\.pdf$/i.test(x.name));
      if (f) V.openFile(f);
    });
  }

  // ---- Status bar chrome ----
  function wireChrome() {
    $("btn-zoom-in").addEventListener("click", V.zoomIn);
    $("btn-zoom-out").addEventListener("click", V.zoomOut);
    $("btn-fit-width").addEventListener("click", V.fitWidth);
    $("btn-prev").addEventListener("click", () => V.gotoPage(S.currentPage - 1));
    $("btn-next").addEventListener("click", () => V.gotoPage(S.currentPage + 1));
  }

  function wireTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".tabpanel").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        document.querySelector(`.tabpanel[data-panel="${t.dataset.tab}"]`).classList.add("active");
      });
    });
  }

  // ---- Keyboard shortcuts ----
  const KEYS = { v: "select", r: "rect", o: "ellipse", l: "line", a: "arrow", p: "pen", t: "text", h: "highlight", c: "cloud", m: "length", s: "stamp", k: "callout" };
  function wireKeys() {
    window.addEventListener("keydown", (e) => {
      if (/input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "Escape") { if (T.isDrawingPoly()) T.finishPoly(true); else A.select(null); return; }
      if (e.key === "Enter" && T.isDrawingPoly()) { T.finishPoly(false); return; }
      if ((e.key === "Delete" || e.key === "Backspace") && S.selectedId) { A.remove(S.selectedId); e.preventDefault(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (S.pdfDoc) MS.exporter.saveProject(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (KEYS[k]) { T.setTool(KEYS[k]); }
      else if (e.key === "+" || e.key === "=") V.zoomIn();
      else if (e.key === "-") V.zoomOut();
    });
  }

  function wireAnalyze() {
    const note = $("auto-note");
    const needDoc = () => { if (!S.pdfDoc) { note.textContent = "Open a PDF first."; return true; } return false; };

    $("btn-analyze").addEventListener("click", async () => {
      if (needDoc()) return;
      note.textContent = "Analyzing…";
      const r = await MS.analyze.report();
      if (r.likelyScanned) {
        note.textContent = "This looks like a scanned image (no text layer) — auto tools can't read it. Mark it up manually.";
      } else {
        note.textContent = `${r.pages} page(s), ${r.textItems} text items` +
          (r.scale ? ` · scale ${"1:" + r.scale.ratio} detected` : " · no scale text found");
      }
    });

    $("btn-auto-scale").addEventListener("click", async () => {
      if (needDoc()) return;
      note.textContent = "Detecting scale…";
      const r = await MS.analyze.applyAutoScale();
      note.textContent = r.ok ? `Scale set from “${r.raw}” (1:${r.ratio}). Verify against a known dimension.`
        : "No “1:NN” scale text found — use the Calibrate tool instead.";
    });

    const doCount = async () => {
      if (needDoc()) return;
      const term = $("find-term").value.trim();
      if (!term) { note.textContent = "Type a tag to find."; return; }
      note.textContent = `Finding “${term}”…`;
      const r = await MS.analyze.findAndCount(term);
      note.textContent = r.ok ? `Placed ${r.count} “${term}” marker(s). Review, then price via the Estimate tab.`
        : "Nothing to count.";
    };
    $("btn-find-count").addEventListener("click", doCount);
    $("find-term").addEventListener("keydown", (e) => { if (e.key === "Enter") doCount(); });
  }

  function wireTextPopover() {
    $("text-popover-ok").addEventListener("click", () => T.commitText(true));
    $("text-popover-cancel").addEventListener("click", () => T.commitText(false));
    $("text-popover-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) T.commitText(true);
      if (e.key === "Escape") T.commitText(false);
    });
  }

  // Re-fit on window resize
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (S.pdfDoc) V.fitWidth(); }, 250); });
})();

/* workflows.js — custom workflows: reusable tool "chest" presets, a per-drawing
 * checklist, and named workflows the user can save and re-apply across files. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const T = MS.tools;
  const W = (MS.workflows = {});

  W.init = function () {
    MS.loadPrefs();
    document.getElementById("btn-add-preset").addEventListener("click", addPreset);
    document.getElementById("btn-add-step").addEventListener("click", addStep);
    document.getElementById("btn-save-wf").addEventListener("click", saveCurrentWorkflow);
    // seed a couple of useful defaults on first run
    if (!S.presets.length) {
      S.presets = [
        { id: MS.uid("ps"), name: "Redline", tool: "cloud", color: "#e11d48", strokeWidth: 2.5, fill: false, opacity: 0.25, fontSize: 14, subject: "Revision" },
        { id: MS.uid("ps"), name: "Approve stamp", tool: "stamp", color: "#22c55e", strokeWidth: 2, fill: false, opacity: 0.15, fontSize: 16, subject: "Approved" },
        { id: MS.uid("ps"), name: "Dimension", tool: "length", color: "#3b82f6", strokeWidth: 1.5, fill: false, opacity: 0.25, fontSize: 12, subject: "Measure" },
      ];
    }
    if (!S.checklist.length) {
      S.checklist = [
        { id: MS.uid("ck"), text: "Calibrate drawing scale", done: false },
        { id: MS.uid("ck"), text: "Cloud all revisions", done: false },
        { id: MS.uid("ck"), text: "Measure key quantities", done: false },
        { id: MS.uid("ck"), text: "Export markups to CSV", done: false },
      ];
    }
    renderPresets(); renderChecklist(); renderWorkflows();
  };

  // ---- Presets (tool chest) ----
  function addPreset() {
    const st = S.style;
    const name = prompt("Preset name:", (MS.tools.def(S.activeTool) || {}).name || "Preset");
    if (!name) return;
    S.presets.push({
      id: MS.uid("ps"), name, tool: S.activeTool,
      color: st.color, strokeWidth: st.strokeWidth, fill: st.fill,
      opacity: st.opacity, fontSize: st.fontSize, subject: st.subject,
    });
    MS.savePrefs(); renderPresets();
  }

  W.applyPreset = function (p) {
    Object.assign(S.style, {
      color: p.color, strokeWidth: p.strokeWidth, fill: p.fill,
      opacity: p.opacity, fontSize: p.fontSize, subject: p.subject || "",
    });
    MS.emit("style-changed");
    if (p.tool) T.setTool(p.tool);
  };

  function renderPresets() {
    const host = document.getElementById("preset-list");
    host.innerHTML = "";
    if (!S.presets.length) { host.innerHTML = `<div class="list-empty">No presets yet.</div>`; return; }
    S.presets.forEach((p) => {
      const d = document.createElement("div");
      d.className = "preset";
      d.innerHTML =
        `<span class="preset-dot" style="background:${p.color}"></span>
         <span class="preset-name">${esc(p.name)}</span>
         <span class="preset-tool">${p.tool}</span>
         <span class="mini-x" title="Delete">✕</span>`;
      d.addEventListener("click", (e) => {
        if (e.target.classList.contains("mini-x")) {
          S.presets = S.presets.filter((x) => x.id !== p.id); MS.savePrefs(); renderPresets(); return;
        }
        W.applyPreset(p);
      });
      host.appendChild(d);
    });
  }

  // ---- Checklist ----
  function addStep() {
    const text = prompt("Checklist step:");
    if (!text) return;
    S.checklist.push({ id: MS.uid("ck"), text, done: false });
    renderChecklist();
  }
  function renderChecklist() {
    const host = document.getElementById("checklist");
    host.innerHTML = "";
    S.checklist.forEach((s) => {
      const d = document.createElement("div");
      d.className = "step" + (s.done ? " done" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.checked = s.done;
      cb.addEventListener("change", () => { s.done = cb.checked; renderChecklist(); });
      const span = document.createElement("span");
      span.className = "step-text"; span.textContent = s.text;
      const x = document.createElement("span");
      x.className = "mini-x"; x.textContent = "✕";
      x.addEventListener("click", () => { S.checklist = S.checklist.filter((c) => c.id !== s.id); renderChecklist(); });
      d.append(cb, span, x);
      host.appendChild(d);
    });
    const done = S.checklist.filter((s) => s.done).length;
    const pct = S.checklist.length ? Math.round((done / S.checklist.length) * 100) : 0;
    document.getElementById("wf-progress-bar").style.width = pct + "%";
  }

  // ---- Saved workflows ----
  function saveCurrentWorkflow() {
    const name = prompt("Workflow name:", "My workflow");
    if (!name) return;
    S.workflows.push({
      id: MS.uid("wf"), name,
      presets: JSON.parse(JSON.stringify(S.presets)),
      checklist: S.checklist.map((s) => ({ id: MS.uid("ck"), text: s.text, done: false })),
    });
    MS.savePrefs(); renderWorkflows();
  }
  function renderWorkflows() {
    const host = document.getElementById("wf-list");
    host.innerHTML = "";
    if (!S.workflows.length) { host.innerHTML = `<div class="list-empty">No saved workflows.</div>`; return; }
    S.workflows.forEach((w) => {
      const d = document.createElement("div");
      d.className = "wf-item";
      d.innerHTML =
        `<span class="wf-item-name">${esc(w.name)}</span>
         <button class="btn btn-sm">Load</button>
         <span class="mini-x">✕</span>`;
      d.querySelector(".btn").addEventListener("click", () => {
        S.presets = JSON.parse(JSON.stringify(w.presets));
        S.checklist = w.checklist.map((s) => ({ id: MS.uid("ck"), text: s.text, done: false }));
        MS.savePrefs(); renderPresets(); renderChecklist();
      });
      d.querySelector(".mini-x").addEventListener("click", () => {
        S.workflows = S.workflows.filter((x) => x.id !== w.id); MS.savePrefs(); renderWorkflows();
      });
      host.appendChild(d);
    });
  }

  function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
})();

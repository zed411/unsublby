/* state.js — shared application state, constants, and small helpers.
 * Everything hangs off the global MS namespace so the classic <script> files
 * can talk to each other without a bundler. */
(function () {
  "use strict";

  const MS = (window.MS = window.MS || {});

  // ---- Configure the PDF.js worker (must run before any getDocument call) ----
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
  }

  MS.PALETTE = [
    "#e11d48", "#f59e0b", "#eab308", "#22c55e",
    "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
    "#111827", "#ffffff",
  ];

  // Tool ids that consume the current drawing style
  MS.STATUSES = ["none", "accepted", "rejected", "completed"];

  // ---- Live application state ----
  MS.state = {
    pdfDoc: null,          // pdf.js document proxy
    pdfBytes: null,        // ArrayBuffer of the original file (for export)
    fileName: null,
    numPages: 0,
    currentPage: 1,
    scale: 1,              // current render scale
    baseScale: 1,          // fit-width scale reference
    pages: [],             // per-page render info: {pageNum, widthPt, heightPt, wrap, svg, canvas, viewport}

    annotations: [],       // all markups (see annotations.js for shape)
    selectedId: null,
    activeTool: "select",

    // current drawing style
    style: {
      color: "#e11d48",
      strokeWidth: 2,
      fill: false,
      opacity: 0.25,
      fontSize: 14,
      subject: "",
    },

    author: localStorage.getItem("ms_author") || "You",

    // measurement calibration: real-world units per PDF point
    calibration: null,     // { unitsPerPoint, unit, label }

    presets: [],
    checklist: [],
    workflows: [],

    dirty: false,
  };

  // ---- ID + math helpers ----
  let idCounter = 0;
  MS.uid = function (prefix) {
    idCounter += 1;
    // Time-free, deterministic-ish unique id
    return (prefix || "id") + "_" + idCounter.toString(36) + "_" +
      (performance.now() | 0).toString(36);
  };

  MS.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  MS.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  MS.round = (v, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  };

  MS.polylineLength = function (pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += MS.dist(pts[i - 1], pts[i]);
    return L;
  };

  // Shoelace area (absolute), for polygon area measurement
  MS.polygonArea = function (pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  };

  MS.emit = function (name, detail) {
    window.dispatchEvent(new CustomEvent("ms:" + name, { detail }));
  };
  MS.on = function (name, fn) {
    window.addEventListener("ms:" + name, (e) => fn(e.detail));
  };

  MS.markDirty = function () {
    MS.state.dirty = true;
    MS.emit("dirty");
  };

  // Persist lightweight prefs (presets, workflows) between sessions
  MS.savePrefs = function () {
    try {
      localStorage.setItem("ms_presets", JSON.stringify(MS.state.presets));
      localStorage.setItem("ms_workflows", JSON.stringify(MS.state.workflows));
      localStorage.setItem("ms_author", MS.state.author);
    } catch (e) { /* storage may be unavailable */ }
  };
  MS.loadPrefs = function () {
    try {
      MS.state.presets = JSON.parse(localStorage.getItem("ms_presets") || "[]");
      MS.state.workflows = JSON.parse(localStorage.getItem("ms_workflows") || "[]");
    } catch (e) {
      MS.state.presets = [];
      MS.state.workflows = [];
    }
  };
})();

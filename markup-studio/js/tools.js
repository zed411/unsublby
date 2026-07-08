/* tools.js — the tool rail, active-tool handling, and all pointer interaction
 * for drawing, selecting, moving and editing markups on the page overlays. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const A = MS.annotations;
  const V = MS.viewer;
  const T = (MS.tools = {});

  // Tool definitions. `kind` drives how the pointer gesture is interpreted.
  const TOOLS = [
    { id: "select", name: "Select", icon: "M4 3l14 6-6 2-2 6z", kind: "select" },
    { sep: true },
    { id: "rect", name: "Rectangle", icon: "M4 5h16v14H4z", kind: "rect" },
    { id: "ellipse", name: "Ellipse", icon: "M12 5c5 0 8 3 8 7s-3 7-8 7-8-3-8-7 3-7 8-7z", kind: "rect" },
    { id: "cloud", name: "Revision cloud", icon: "M7 18a4 4 0 010-8 5 5 0 019-2 4 4 0 011 8z", kind: "poly" },
    { id: "line", name: "Line", icon: "M4 20L20 4", kind: "line" },
    { id: "arrow", name: "Arrow", icon: "M4 20L20 4M20 4h-7M20 4v7", kind: "line" },
    { id: "pen", name: "Freehand ink", icon: "M4 20c6-2 8-12 15-15", kind: "free" },
    { id: "highlight", name: "Highlight", icon: "M4 14l10-10 6 6-10 10H4z", kind: "rect" },
    { sep: true },
    { id: "text", name: "Text box", icon: "M5 5h14M12 5v14", kind: "rect", after: "text" },
    { id: "callout", name: "Callout", icon: "M4 5h16v10H10l-4 4v-4H4z", kind: "callout" },
    { id: "stamp", name: "Stamp", icon: "M7 3h10v6l-2 3v4H9v-4L7 9z M5 20h14", kind: "rect", after: "stamp" },
    { sep: true },
    { id: "length", name: "Measure length", icon: "M3 12h18M6 9v6M18 9v6", kind: "line", after: "measure" },
    { id: "area", name: "Measure area", icon: "M4 4h16v16H4z M4 4l16 16", kind: "poly", after: "measure" },
    { id: "calibrate", name: "Calibrate scale", icon: "M3 12h18M8 8v8M16 8v8", kind: "line", after: "calibrate" },
  ];
  T.TOOLS = TOOLS;
  const byId = {};
  TOOLS.forEach((t) => { if (t.id) byId[t.id] = t; });
  T.def = (id) => byId[id];

  T.buildRail = function () {
    const rail = document.getElementById("toolrail");
    rail.innerHTML = "";
    TOOLS.forEach((t) => {
      if (t.sep) {
        const s = document.createElement("div");
        s.className = "tool-sep";
        rail.appendChild(s);
        return;
      }
      const b = document.createElement("button");
      b.className = "tool-btn" + (t.id === S.activeTool ? " active" : "");
      b.title = t.name + shortcutHint(t.id);
      b.dataset.tool = t.id;
      b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg>`;
      b.addEventListener("click", () => T.setTool(t.id));
      rail.appendChild(b);
    });
  };

  const SHORTCUTS = { select: "v", rect: "r", ellipse: "o", line: "l", arrow: "a", pen: "p", text: "t", highlight: "h", cloud: "c", length: "m" };
  function shortcutHint(id) { return SHORTCUTS[id] ? ` (${SHORTCUTS[id].toUpperCase()})` : ""; }

  T.setTool = function (id) {
    S.activeTool = id;
    document.querySelectorAll(".tool-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tool === id));
    document.getElementById("active-tool-name").textContent = byId[id] ? byId[id].name : id;
    if (id !== "select") A.select(null);
    A.renderAll();
  };

  // ---- Pointer interaction wiring ----------------------------------------
  let drag = null; // active gesture

  T.attach = function () {
    const pages = document.getElementById("pages");
    pages.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // double click to edit text
    pages.addEventListener("dblclick", onDblClick);
  };

  function overlayFromEvent(e) {
    const svg = e.target.closest ? e.target.closest("svg.page-overlay") : null;
    return svg;
  }

  function onDown(e) {
    const svg = overlayFromEvent(e);
    if (!svg) return;
    const info = V.pageInfoFor(svg);
    const p = V.eventToPoint(svg, e);
    const tool = byId[S.activeTool];

    // ---- select / move / resize ----
    if (S.activeTool === "select") {
      const handle = e.target.closest(".handle");
      if (handle) {
        drag = { mode: "resize", id: handle.dataset.id, handle: handle.dataset.handle, svg, start: p };
        return;
      }
      const annNode = e.target.closest(".annot");
      if (annNode) {
        const id = annNode.dataset.id;
        A.select(id);
        drag = { mode: "move", id, svg, start: p, last: p };
      } else {
        A.select(null);
      }
      return;
    }

    if (!tool) return;

    // ---- multi-point tools: cloud / area / polygon accumulate clicks ----
    if (tool.kind === "poly") {
      if (!drag || drag.svg !== svg) {
        drag = { mode: "poly", tool: S.activeTool, svg, page: info.pageNum, points: [p, p] };
      } else {
        drag.points[drag.points.length - 1] = p;
        drag.points.push(p);
      }
      previewPoly(svg, drag);
      return;
    }

    // ---- single-gesture tools ----
    drag = { mode: tool.kind, tool: S.activeTool, svg, page: info.pageNum, start: p, points: [p], after: tool.after };
    if (tool.kind === "free") drag.points = [p];
  }

  function onMove(e) {
    if (!drag) return;
    const p = V.eventToPoint(drag.svg, e);

    if (drag.mode === "move") {
      const a = A.get(drag.id);
      if (a) { A.moveBy(a, p.x - drag.last.x, p.y - drag.last.y); drag.last = p; A.renderPage(a.page); }
      return;
    }
    if (drag.mode === "resize") {
      resizeAnn(A.get(drag.id), drag.handle, p);
      A.renderPage(A.get(drag.id).page);
      return;
    }
    if (drag.mode === "free") { drag.points.push(p); previewFree(drag.svg, drag); return; }
    if (drag.mode === "rect" || drag.mode === "callout") { drag.cur = p; previewRect(drag.svg, drag, p); return; }
    if (drag.mode === "line") { drag.cur = p; previewLine(drag.svg, drag, p); return; }
    if (drag.mode === "poly") { drag.points[drag.points.length - 1] = p; previewPoly(drag.svg, drag); return; }
  }

  function onUp(e) {
    if (!drag) return;

    if (drag.mode === "move" || drag.mode === "resize") { drag = null; MS.markDirty(); return; }
    if (drag.mode === "poly") return; // finished by double-click / Enter / Esc

    const p = V.eventToPoint(drag.svg, e);
    clearPreview(drag.svg);

    if (drag.mode === "rect") {
      const r = normRect(drag.start, p);
      if (r.w < 3 && r.h < 3) { drag = null; return; }
      if (drag.after === "text" || drag.tool === "text") {
        const a = A.create("text", drag.page, { rect: r, text: "" });
        drag = null; openTextEditor(a); afterCreate(a); return;
      }
      if (drag.after === "stamp") {
        const a = A.create("stamp", drag.page, { rect: r, text: pickStamp() });
        drag = null; afterCreate(a); return;
      }
      const a = A.create(drag.tool, drag.page, { rect: r });
      drag = null; afterCreate(a); return;
    }

    if (drag.mode === "line") {
      const pts = [drag.start, p];
      if (MS.dist(pts[0], pts[1]) < 3) { drag = null; return; }
      if (drag.after === "calibrate") { drag = null; startCalibration(pts); return; }
      const type = drag.tool === "length" ? "length" : drag.tool;
      const a = A.create(type, drag.page, { points: pts });
      drag = null; afterCreate(a); return;
    }

    if (drag.mode === "callout") {
      const r = normRect(drag.start, p);
      const anchor = { x: r.x - 30, y: r.y - 20 };
      const a = A.create("callout", drag.page, { rect: r, points: [anchor, { x: r.x, y: r.y + r.h / 2 }], text: "" });
      drag = null; openTextEditor(a); afterCreate(a); return;
    }

    if (drag.mode === "free") {
      if (drag.points.length < 2) { drag = null; return; }
      const a = A.create("pen", drag.page, { points: drag.points.slice() });
      drag = null; afterCreate(a); return;
    }
    drag = null;
  }

  function finishPoly(cancel) {
    if (!drag || drag.mode !== "poly") return;
    const pts = drag.points.slice(0, -1); // drop the floating last point
    clearPreview(drag.svg);
    const page = drag.page, tool = drag.tool;
    drag = null;
    if (cancel || pts.length < 2) return;
    const type = tool === "area" ? "area" : (tool === "cloud" ? "cloud" : "polygon");
    const a = A.create(type, page, { points: pts });
    afterCreate(a);
  }

  function onDblClick(e) {
    if (drag && drag.mode === "poly") { finishPoly(false); return; }
    const node = e.target.closest && e.target.closest(".annot");
    if (node) {
      const a = A.get(node.dataset.id);
      if (a && (a.type === "text" || a.type === "callout" || a.type === "stamp")) openTextEditor(a);
    }
  }

  function afterCreate(a) {
    if (S.activeTool !== "pen" && S.activeTool !== "cloud") T.setTool("select");
    A.select(a.id);
  }

  // ---- Resize logic ----
  function resizeAnn(a, handle, p) {
    if (!a) return;
    if (a.rect) {
      const r = a.rect;
      const x2 = r.x + r.w, y2 = r.y + r.h;
      if (handle === "nw") { r.w = x2 - p.x; r.h = y2 - p.y; r.x = p.x; r.y = p.y; }
      if (handle === "ne") { r.w = p.x - r.x; r.h = y2 - p.y; r.y = p.y; }
      if (handle === "sw") { r.w = x2 - p.x; r.x = p.x; r.h = p.y - r.y; }
      if (handle === "se") { r.w = p.x - r.x; r.h = p.y - r.y; }
    } else if (a.points && (handle === "p0" || handle === "p1")) {
      a.points[handle === "p0" ? 0 : 1] = p;
    }
    MS.markDirty();
  }

  // ---- Previews (transient SVG while dragging) ----
  const SVGNS = "http://www.w3.org/2000/svg";
  function preview(svg) {
    let g = svg.querySelector(".preview");
    if (!g) { g = document.createElementNS(SVGNS, "g"); g.setAttribute("class", "preview"); svg.appendChild(g); }
    g.innerHTML = "";
    return g;
  }
  function clearPreview(svg) { const g = svg.querySelector(".preview"); if (g) g.remove(); }
  function elp(tag, attrs) { const n = document.createElementNS(SVGNS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; }
  const stroke = () => ({ stroke: S.style.color, "stroke-width": S.style.strokeWidth, fill: "none", "vector-effect": "non-scaling-stroke", "stroke-dasharray": "4 3" });

  function previewRect(svg, d, p) {
    const g = preview(svg); const r = normRect(d.start, p);
    g.appendChild(elp("rect", { ...stroke(), x: r.x, y: r.y, width: r.w, height: r.h }));
  }
  function previewLine(svg, d, p) {
    const g = preview(svg);
    g.appendChild(elp("line", { ...stroke(), x1: d.start.x, y1: d.start.y, x2: p.x, y2: p.y }));
  }
  function previewFree(svg, d) {
    const g = preview(svg);
    g.appendChild(elp("polyline", { ...stroke(), "stroke-dasharray": "none", points: d.points.map((p) => `${p.x},${p.y}`).join(" ") }));
  }
  function previewPoly(svg, d) {
    const g = preview(svg);
    g.appendChild(elp("polyline", { ...stroke(), points: d.points.map((p) => `${p.x},${p.y}`).join(" ") }));
    d.points.forEach((p) => g.appendChild(elp("circle", { cx: p.x, cy: p.y, r: 3 / S.scale, fill: S.style.color })));
  }

  function normRect(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  // ---- Text editing popover ----
  let editing = null;
  function openTextEditor(a) {
    editing = a;
    const pop = document.getElementById("text-popover");
    const input = document.getElementById("text-popover-input");
    input.value = a.text || "";
    pop.hidden = false;
    // position near the annotation's page
    const info = V.pageInfoFor(a.page);
    const rectPx = info.wrap.getBoundingClientRect();
    const b = A.bbox(a);
    pop.style.left = Math.min(window.innerWidth - 260, rectPx.left + (b.x / info.widthPt) * rectPx.width) + "px";
    pop.style.top = (rectPx.top + (b.y / info.heightPt) * rectPx.height + 24) + "px";
    input.focus();
  }
  T.commitText = function (ok) {
    const pop = document.getElementById("text-popover");
    const input = document.getElementById("text-popover-input");
    if (editing && ok) A.update(editing.id, { text: input.value });
    else if (editing && !ok && !editing.text) A.remove(editing.id);
    pop.hidden = true; editing = null;
  };

  function pickStamp() {
    const s = prompt("Stamp text:", "APPROVED");
    return (s || "APPROVED").slice(0, 24);
  }

  // ---- Calibration ----
  function startCalibration(pts) {
    const lenPt = MS.dist(pts[0], pts[1]);
    const val = prompt(`This line is ${MS.round(lenPt, 1)} pt long.\nEnter its real-world length (e.g. "5 m", "12 ft", "300 mm"):`, "1 m");
    if (!val) { T.setTool("select"); return; }
    const m = val.trim().match(/^([\d.]+)\s*([a-zA-Z"']+)$/);
    if (!m) { alert("Could not parse. Use e.g. 5 m or 12 ft."); return; }
    const real = parseFloat(m[1]);
    const unit = m[2];
    S.calibration = { unitsPerPoint: real / lenPt, unit, label: `${val} = ${MS.round(lenPt, 1)}pt` };
    const ind = document.getElementById("calib-indicator");
    ind.textContent = "1 " + unit + " scale set";
    ind.classList.add("set");
    MS.emit("annots-changed"); // refresh any measurement labels
    A.renderAll();
    T.setTool("length");
  }

  // Public: finish/cancel polygon from keyboard
  T.finishPoly = finishPoly;
  T.isDrawingPoly = () => !!(drag && drag.mode === "poly");
})();

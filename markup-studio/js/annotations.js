/* annotations.js — the markup data model plus SVG rendering, selection,
 * dragging and geometry editing. Coordinates are stored in PDF points. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const SVGNS = "http://www.w3.org/2000/svg";
  const A = (MS.annotations = {});

  // Types that draw with a bounding rect vs. a point path
  const RECT_TYPES = new Set(["rect", "ellipse", "highlight", "text", "callout", "stamp"]);
  const PATH_TYPES = new Set(["line", "arrow", "pen", "cloud", "polygon", "length", "area"]);
  A.RECT_TYPES = RECT_TYPES;
  A.PATH_TYPES = PATH_TYPES;

  function el(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ---- Model construction -------------------------------------------------
  A.create = function (type, page, geom) {
    const st = S.style;
    const ann = {
      id: MS.uid("mk"),
      type,
      page,               // 1-based
      color: st.color,
      strokeWidth: st.strokeWidth,
      fill: st.fill,
      opacity: st.opacity,
      fontSize: st.fontSize,
      subject: st.subject || "",
      author: S.author,
      status: "none",
      comment: "",
      seq: S.annotations.length + 1,
      rect: null,         // {x,y,w,h}
      points: null,       // [{x,y}...]
      text: "",
    };
    Object.assign(ann, geom);
    S.annotations.push(ann);
    MS.markDirty();
    MS.emit("annots-changed");
    return ann;
  };

  A.remove = function (id) {
    const i = S.annotations.findIndex((a) => a.id === id);
    if (i >= 0) {
      S.annotations.splice(i, 1);
      if (S.selectedId === id) S.selectedId = null;
      MS.markDirty();
      A.renderAll();
      MS.emit("annots-changed");
      MS.emit("selection-changed");
    }
  };

  A.get = (id) => S.annotations.find((a) => a.id === id);

  A.select = function (id) {
    S.selectedId = id;
    A.renderAll();
    MS.emit("selection-changed");
  };

  A.update = function (id, patch) {
    const a = A.get(id);
    if (!a) return;
    Object.assign(a, patch);
    MS.markDirty();
    A.renderPage(a.page);
    MS.emit("annots-changed");
  };

  // ---- Measurement helpers ------------------------------------------------
  A.measureText = function (a) {
    const cal = S.calibration;
    if (a.type === "length") {
      const lenPt = MS.polylineLength(a.points || []);
      if (!cal) return MS.round(lenPt, 1) + " pt";
      return MS.round(lenPt * cal.unitsPerPoint, 2) + " " + cal.unit;
    }
    if (a.type === "area") {
      const areaPt = MS.polygonArea(a.points || []);
      if (!cal) return MS.round(areaPt, 1) + " pt²";
      const f = cal.unitsPerPoint;
      return MS.round(areaPt * f * f, 2) + " " + cal.unit + "²";
    }
    return "";
  };

  // ---- Rendering ----------------------------------------------------------
  A.renderAll = function () {
    for (let n = 1; n <= S.numPages; n++) A.renderPage(n);
  };

  A.renderPage = function (pageNum) {
    const info = MS.viewer.pageInfoFor(pageNum);
    if (!info) return;
    const svg = info.svg;
    svg.innerHTML = "";

    S.annotations
      .filter((a) => a.page === pageNum)
      .forEach((a) => svg.appendChild(buildNode(a)));

    if (S.selectedId) {
      const sel = A.get(S.selectedId);
      if (sel && sel.page === pageNum) svg.appendChild(buildSelection(sel));
    }
  };

  function strokeAttrs(a) {
    return {
      stroke: a.color,
      "stroke-width": a.strokeWidth,
      "vector-effect": "non-scaling-stroke",
      fill: "none",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    };
  }

  function buildNode(a) {
    const g = el("g", { class: "annot" + (S.activeTool === "select" ? " selectable" : ""), "data-id": a.id });
    g.style.opacity = "1";

    switch (a.type) {
      case "rect": {
        const r = a.rect;
        g.appendChild(el("rect", {
          ...strokeAttrs(a), x: r.x, y: r.y, width: r.w, height: r.h,
          fill: a.fill ? a.color : "none", "fill-opacity": a.fill ? a.opacity : 0,
        }));
        break;
      }
      case "highlight": {
        const r = a.rect;
        g.appendChild(el("rect", {
          x: r.x, y: r.y, width: r.w, height: r.h,
          fill: a.color, "fill-opacity": Math.max(0.15, a.opacity),
          stroke: "none",
        }));
        g.style.mixBlendMode = "multiply";
        break;
      }
      case "ellipse": {
        const r = a.rect;
        g.appendChild(el("ellipse", {
          ...strokeAttrs(a),
          cx: r.x + r.w / 2, cy: r.y + r.h / 2,
          rx: Math.abs(r.w / 2), ry: Math.abs(r.h / 2),
          fill: a.fill ? a.color : "none", "fill-opacity": a.fill ? a.opacity : 0,
        }));
        break;
      }
      case "line":
      case "length": {
        const [p0, p1] = a.points;
        g.appendChild(el("line", { ...strokeAttrs(a), x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }));
        if (a.type === "length") addMeasureLabel(g, a, midpoint(a.points));
        break;
      }
      case "arrow": {
        const [p0, p1] = a.points;
        g.appendChild(el("line", { ...strokeAttrs(a), x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y }));
        addArrowHead(g, p0, p1, a);
        break;
      }
      case "pen": {
        g.appendChild(el("polyline", { ...strokeAttrs(a), points: ptsStr(a.points) }));
        break;
      }
      case "cloud": {
        g.appendChild(el("path", { ...strokeAttrs(a), d: cloudPath(a.points, a.strokeWidth) }));
        break;
      }
      case "polygon":
      case "area": {
        g.appendChild(el("polygon", {
          ...strokeAttrs(a), points: ptsStr(a.points),
          fill: a.fill ? a.color : "none", "fill-opacity": a.fill ? a.opacity : 0,
        }));
        if (a.type === "area") addMeasureLabel(g, a, centroid(a.points));
        break;
      }
      case "text": {
        drawTextBox(g, a, false);
        break;
      }
      case "callout": {
        drawTextBox(g, a, true);
        break;
      }
      case "stamp": {
        drawStamp(g, a);
        break;
      }
    }
    return g;
  }

  // ---- geometry helpers ----
  const ptsStr = (pts) => pts.map((p) => `${p.x},${p.y}`).join(" ");
  const midpoint = (pts) => ({ x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 });
  function centroid(pts) {
    let x = 0, y = 0; pts.forEach((p) => { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }

  function addArrowHead(g, p0, p1, a) {
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const len = 6 + a.strokeWidth * 2.2;
    const spread = 0.42;
    const wing = (s) => ({
      x: p1.x - len * Math.cos(ang + s),
      y: p1.y - len * Math.sin(ang + s),
    });
    const w1 = wing(spread), w2 = wing(-spread);
    g.appendChild(el("polygon", {
      points: `${p1.x},${p1.y} ${w1.x},${w1.y} ${w2.x},${w2.y}`,
      fill: a.color, stroke: a.color, "stroke-width": a.strokeWidth,
      "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round",
    }));
  }

  function addMeasureLabel(g, a, at) {
    const txt = A.measureText(a);
    const fs = a.fontSize;
    const padw = txt.length * fs * 0.55 + 8;
    g.appendChild(el("rect", {
      x: at.x - padw / 2, y: at.y - fs, width: padw, height: fs * 1.5,
      rx: 3, fill: "#111827", "fill-opacity": 0.82,
    }));
    const t = el("text", {
      x: at.x, y: at.y + fs * 0.15, "text-anchor": "middle",
      "font-size": fs, fill: "#fff", "font-family": "sans-serif",
    });
    t.textContent = txt;
    g.appendChild(t);
  }

  // Revision cloud: scalloped arcs along the polyline/closed loop
  function cloudPath(pts, sw) {
    if (pts.length < 2) return "";
    const r = Math.max(6, 5 + sw); // scallop radius in points
    let d = "";
    const closed = pts.length > 2;
    const loop = closed ? [...pts, pts[0]] : pts;
    for (let i = 1; i < loop.length; i++) {
      const a = loop[i - 1], b = loop[i];
      const seg = MS.dist(a, b);
      const n = Math.max(1, Math.round(seg / (r * 1.6)));
      for (let j = 0; j < n; j++) {
        const t0 = j / n, t1 = (j + 1) / n;
        const s = { x: a.x + (b.x - a.x) * t0, y: a.y + (b.y - a.y) * t0 };
        const e = { x: a.x + (b.x - a.x) * t1, y: a.y + (b.y - a.y) * t1 };
        if (i === 1 && j === 0) d += `M ${s.x} ${s.y} `;
        d += `A ${r} ${r} 0 0 1 ${e.x} ${e.y} `;
      }
    }
    return d;
  }

  function drawTextBox(g, a, isCallout) {
    const r = a.rect;
    if (isCallout && a.points && a.points.length === 2) {
      // leader line from anchor point to the box
      g.appendChild(el("line", {
        ...strokeAttrs(a), x1: a.points[0].x, y1: a.points[0].y,
        x2: r.x, y2: r.y + r.h / 2,
      }));
    }
    g.appendChild(el("rect", {
      x: r.x, y: r.y, width: r.w, height: r.h, rx: 3,
      fill: "#ffffff", "fill-opacity": 0.92,
      stroke: a.color, "stroke-width": a.strokeWidth, "vector-effect": "non-scaling-stroke",
    }));
    wrapText(g, a.text || "", r, a.fontSize, "#111827");
  }

  function drawStamp(g, a) {
    const r = a.rect;
    g.appendChild(el("rect", {
      x: r.x, y: r.y, width: r.w, height: r.h, rx: 4,
      fill: a.color, "fill-opacity": 0.12,
      stroke: a.color, "stroke-width": Math.max(1.5, a.strokeWidth), "vector-effect": "non-scaling-stroke",
    }));
    const t = el("text", {
      x: r.x + r.w / 2, y: r.y + r.h / 2 + a.fontSize * 0.35, "text-anchor": "middle",
      "font-size": Math.min(a.fontSize * 1.4, r.h * 0.6), fill: a.color,
      "font-family": "sans-serif", "font-weight": "700", "letter-spacing": "1",
    });
    t.textContent = (a.text || "STAMP").toUpperCase();
    g.appendChild(t);
  }

  function wrapText(g, text, r, fs, fill) {
    const lines = text.split("\n");
    const lineH = fs * 1.25;
    const maxChars = Math.max(4, Math.floor(r.w / (fs * 0.55)));
    let y = r.y + fs + 3;
    lines.forEach((line) => {
      let remaining = line;
      while (remaining.length && y < r.y + r.h) {
        const chunk = remaining.slice(0, maxChars);
        const t = el("text", {
          x: r.x + 5, y, "font-size": fs, fill,
          "font-family": "sans-serif",
        });
        t.textContent = chunk;
        g.appendChild(t);
        remaining = remaining.slice(maxChars);
        y += lineH;
      }
      if (!line.length) y += lineH;
    });
  }

  // ---- Selection outline + handles ----
  function bbox(a) {
    if (a.rect) {
      const r = a.rect;
      return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) };
    }
    const xs = a.points.map((p) => p.x), ys = a.points.map((p) => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  A.bbox = bbox;

  function buildSelection(a) {
    const g = el("g", { class: "selection", "data-sel": a.id });
    const b = bbox(a);
    const pad = 3;
    g.appendChild(el("rect", {
      class: "sel-outline",
      x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2,
    }));
    // corner handles for rect-based shapes; endpoint handles for 2-pt paths
    const handles = [];
    if (RECT_TYPES.has(a.type)) {
      const r = a.rect;
      handles.push({ x: r.x, y: r.y, k: "nw" }, { x: r.x + r.w, y: r.y, k: "ne" },
        { x: r.x, y: r.y + r.h, k: "sw" }, { x: r.x + r.w, y: r.y + r.h, k: "se" });
    } else if ((a.type === "line" || a.type === "arrow" || a.type === "length") && a.points) {
      handles.push({ x: a.points[0].x, y: a.points[0].y, k: "p0" },
        { x: a.points[1].x, y: a.points[1].y, k: "p1" });
    }
    handles.forEach((h) => {
      const c = el("rect", {
        class: "handle", x: h.x - 4, y: h.y - 4, width: 8, height: 8,
        "data-handle": h.k, "data-id": a.id,
      });
      // handles are drawn in point space but sized in px via non-scaling stroke;
      // keep them a fixed visual size by scaling with current zoom
      const px = 8 / S.scale;
      c.setAttribute("width", px); c.setAttribute("height", px);
      c.setAttribute("x", h.x - px / 2); c.setAttribute("y", h.y - px / 2);
      g.appendChild(c);
    });
    return g;
  }

  // Move an annotation by a delta in points
  A.moveBy = function (a, dx, dy) {
    if (a.rect) { a.rect.x += dx; a.rect.y += dy; }
    if (a.points) a.points = a.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  };
})();

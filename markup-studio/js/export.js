/* export.js — save/load the markup project (.mstudio JSON) and export a
 * flattened PDF with markups burned in using pdf-lib. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const A = MS.annotations;
  const E = (MS.exporter = {});

  // ---- Project save / load (markups only, references the same PDF) ----
  E.saveProject = function () {
    const doc = {
      format: "markup-studio/1",
      fileName: S.fileName,
      numPages: S.numPages,
      calibration: S.calibration,
      annotations: S.annotations,
      estimateName: S.estimateName,
      rates: S.rates,
    };
    MS.download(JSON.stringify(doc, null, 2),
      (S.fileName || "project").replace(/\.pdf$/i, "") + ".mstudio", "application/json");
  };

  E.loadProject = function (obj) {
    if (!obj || !Array.isArray(obj.annotations)) { alert("Not a valid Markup Studio file."); return; }
    S.annotations = obj.annotations;
    S.calibration = obj.calibration || null;
    if (typeof obj.estimateName === "string") {
      S.estimateName = obj.estimateName;
      const pn = document.getElementById("est-project");
      if (pn) pn.value = obj.estimateName;
    }
    if (Array.isArray(obj.rates) && obj.rates.length) {
      S.rates = obj.rates; MS.savePrefs(); if (MS.pricing) MS.pricing.render();
    }
    if (S.calibration) {
      const ind = document.getElementById("calib-indicator");
      ind.textContent = "1 " + S.calibration.unit + " scale set";
      ind.classList.add("set");
    }
    A.renderAll();
    MS.emit("annots-changed");
  };

  // ---- Flattened PDF export ----
  // We draw each annotation directly into the page content stream. pdf-lib's
  // origin is bottom-left, so Y is flipped from our top-left point space.
  E.exportPdf = async function () {
    if (!S.pdfBytes) return;
    const { PDFDocument, rgb, StandardFonts, degrees } = window.PDFLib;
    const src = await PDFDocument.load(S.pdfBytes.slice(0));
    const font = await src.embedFont(StandardFonts.Helvetica);
    const fontBold = await src.embedFont(StandardFonts.HelveticaBold);
    const pages = src.getPages();

    for (const a of S.annotations) {
      const page = pages[a.page - 1];
      if (!page) continue;
      const H = page.getHeight();
      const col = hexRgb(a.color, rgb);
      const fy = (y) => H - y;            // flip Y
      const lw = a.strokeWidth;
      const op = { color: col, thickness: lw, opacity: 1 };

      switch (a.type) {
        case "rect":
        case "highlight": {
          const r = norm(a.rect);
          page.drawRectangle({
            x: r.x, y: fy(r.y + r.h), width: r.w, height: r.h,
            borderColor: a.type === "highlight" ? undefined : col,
            borderWidth: a.type === "highlight" ? 0 : lw,
            color: (a.fill || a.type === "highlight") ? col : undefined,
            opacity: (a.fill || a.type === "highlight") ? Math.max(0.15, a.opacity) : undefined,
          });
          break;
        }
        case "ellipse": {
          const r = norm(a.rect);
          page.drawEllipse({
            x: r.x + r.w / 2, y: fy(r.y + r.h / 2), xScale: r.w / 2, yScale: r.h / 2,
            borderColor: col, borderWidth: lw,
            color: a.fill ? col : undefined, opacity: a.fill ? a.opacity : undefined,
          });
          break;
        }
        case "line":
        case "length": {
          const [p0, p1] = a.points;
          page.drawLine({ start: { x: p0.x, y: fy(p0.y) }, end: { x: p1.x, y: fy(p1.y) }, ...op });
          if (a.type === "length") drawLabel(page, font, A.measureText(a), mid(p0, p1, fy), col, rgb, a.fontSize);
          break;
        }
        case "arrow": {
          const [p0, p1] = a.points;
          page.drawLine({ start: { x: p0.x, y: fy(p0.y) }, end: { x: p1.x, y: fy(p1.y) }, ...op });
          drawArrow(page, p0, p1, fy, col, lw);
          break;
        }
        case "pen":
        case "polygon":
        case "area":
        case "cloud": {
          const pts = a.points.map((p) => ({ x: p.x, y: fy(p.y) }));
          const closed = a.type !== "pen";
          for (let i = 1; i < pts.length; i++)
            page.drawLine({ start: pts[i - 1], end: pts[i], ...op });
          if (closed && pts.length > 2)
            page.drawLine({ start: pts[pts.length - 1], end: pts[0], ...op });
          if (a.fill && closed) {
            // pdf-lib has no polygon fill; approximate with a bounding note skip
          }
          if (a.type === "area") drawLabel(page, font, A.measureText(a), centroidFlip(a.points, fy), col, rgb, a.fontSize);
          break;
        }
        case "text":
        case "callout": {
          const r = norm(a.rect);
          if (a.type === "callout" && a.points) {
            page.drawLine({ start: { x: a.points[0].x, y: fy(a.points[0].y) }, end: { x: r.x, y: fy(r.y + r.h / 2) }, ...op });
          }
          page.drawRectangle({ x: r.x, y: fy(r.y + r.h), width: r.w, height: r.h, borderColor: col, borderWidth: lw, color: rgb(1, 1, 1), opacity: 0.9 });
          drawWrapped(page, font, a.text || "", r, fy, a.fontSize, rgb(0.07, 0.09, 0.15));
          break;
        }
        case "count": {
          const r = norm(a.rect);
          const cx = r.x + r.w / 2, cy = fy(r.y + r.h / 2), rad = r.w / 2;
          page.drawCircle({ x: cx, y: cy, size: rad, color: col, opacity: 0.9, borderColor: rgb(1, 1, 1), borderWidth: 1 });
          const num = String(A.countIndex(a));
          const fs = rad * 1.1;
          const tw = fontBold.widthOfTextAtSize(num, fs);
          page.drawText(num, { x: cx - tw / 2, y: cy - fs * 0.35, size: fs, font: fontBold, color: rgb(1, 1, 1) });
          break;
        }
        case "stamp": {
          const r = norm(a.rect);
          page.drawRectangle({ x: r.x, y: fy(r.y + r.h), width: r.w, height: r.h, borderColor: col, borderWidth: Math.max(1.5, lw), color: col, opacity: 0.12 });
          const t = (a.text || "STAMP").toUpperCase();
          const fs = Math.min(a.fontSize * 1.4, r.h * 0.6);
          const tw = fontBold.widthOfTextAtSize(t, fs);
          page.drawText(t, { x: r.x + (r.w - tw) / 2, y: fy(r.y + r.h / 2) - fs * 0.35, size: fs, font: fontBold, color: col });
          break;
        }
      }
    }

    const bytes = await src.save();
    MS.download(bytes, (S.fileName || "document").replace(/\.pdf$/i, "") + "-markedup.pdf", "application/pdf");
  };

  // ---- helpers ----
  function norm(r) { return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) }; }
  function mid(p0, p1, fy) { return { x: (p0.x + p1.x) / 2, y: fy((p0.y + p1.y) / 2) }; }
  function centroidFlip(pts, fy) {
    let x = 0, y = 0; pts.forEach((p) => { x += p.x; y += p.y; });
    return { x: x / pts.length, y: fy(y / pts.length) };
  }
  function drawArrow(page, p0, p1, fy, col, lw) {
    const ang = Math.atan2(fy(p1.y) - fy(p0.y), p1.x - p0.x);
    const len = 6 + lw * 2.2, spread = 0.42;
    const wing = (s) => ({ x: p1.x - len * Math.cos(ang + s), y: fy(p1.y) - len * Math.sin(ang + s) });
    const w1 = wing(spread), w2 = wing(-spread);
    page.drawLine({ start: { x: p1.x, y: fy(p1.y) }, end: w1, color: col, thickness: lw });
    page.drawLine({ start: { x: p1.x, y: fy(p1.y) }, end: w2, color: col, thickness: lw });
  }
  function drawLabel(page, font, txt, at, col, rgb, fs) {
    if (!txt) return;
    const w = font.widthOfTextAtSize(txt, fs) + 6;
    page.drawRectangle({ x: at.x - w / 2, y: at.y - fs * 0.7, width: w, height: fs * 1.4, color: rgb(0.07, 0.09, 0.15), opacity: 0.82 });
    page.drawText(txt, { x: at.x - w / 2 + 3, y: at.y - fs * 0.2, size: fs, font, color: rgb(1, 1, 1) });
  }
  function drawWrapped(page, font, text, r, fy, fs, color) {
    const maxChars = Math.max(4, Math.floor(r.w / (fs * 0.52)));
    let y = fy(r.y) - fs - 2;
    text.split("\n").forEach((line) => {
      let rem = line || " ";
      while (rem.length && y > fy(r.y + r.h)) {
        const chunk = rem.slice(0, maxChars);
        page.drawText(chunk, { x: r.x + 4, y, size: fs, font, color });
        rem = rem.slice(maxChars); y -= fs * 1.25;
      }
    });
  }
  function hexRgb(hex, rgb) {
    const h = hex.replace("#", "");
    const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(n, 16);
    return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
  }
})();

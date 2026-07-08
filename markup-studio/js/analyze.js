/* analyze.js — assisted auto-takeoff. Reads the PDF's *vector* text layer to
 * detect the drawing scale and to find-and-count tagged items, dropping count
 * markers automatically. Nothing here fabricates quantities: it only surfaces
 * what the PDF actually contains, for the user to verify. Scanned/raster PDFs
 * have no text layer, so those features report that and do nothing. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const A = MS.annotations;
  const N = (MS.analyze = {});

  const textCache = {}; // pageNum -> [{str, x, y}] in top-left point coords

  N.reset = function () { for (const k in textCache) delete textCache[k]; };
  MS.on("doc-loaded", N.reset);

  async function pageText(n) {
    if (textCache[n]) return textCache[n];
    const page = await S.pdfDoc.getPage(n);
    const content = await page.getTextContent();
    const info = MS.viewer.pageInfoFor(n);
    const H = info ? info.heightPt : page.getViewport({ scale: 1 }).height;
    const items = content.items.map((it) => {
      const t = it.transform; // [a,b,c,d,e,f]; e,f = position (bottom-left origin)
      return { str: it.str, x: t[4], y: H - t[5], w: it.width || 0 };
    }).filter((i) => i.str && i.str.trim());
    textCache[n] = items;
    return items;
  }

  N.allText = async function () {
    const out = [];
    for (let n = 1; n <= S.numPages; n++) out.push({ page: n, items: await pageText(n) });
    return out;
  };

  // ---- scale detection: look for "1:100" style ratios in the text ----
  N.detectScale = async function () {
    const pages = await N.allText();
    // Only trust ratios that are standard architectural/engineering scales, and
    // reject anything that is really part of a longer number (e.g. "1:10,890").
    const STD = new Set([1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 1000, 1250, 2500, 5000]);
    const re = /(?:^|[^\d.,])1\s*[:：]\s*(\d{1,4})(?![\d.,])/g;
    const tally = {};
    let firstRaw = null;
    for (const p of pages) {
      // join items so a scale split across text runs ("1" ":" "100") still matches
      const joined = p.items.map((i) => i.str).join(" ");
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(joined))) {
        const n = parseInt(m[1], 10);
        if (STD.has(n) && n >= 5) {
          tally[n] = (tally[n] || 0) + 1;
          if (!firstRaw) firstRaw = { raw: `1:${n}`, page: p.page };
        }
      }
    }
    const keys = Object.keys(tally);
    if (!keys.length) return null;
    keys.sort((a, b) => tally[b] - tally[a]); // most frequent standard scale wins
    const ratio = parseInt(keys[0], 10);
    return { ratio, raw: firstRaw ? firstRaw.raw : `1:${ratio}`, page: firstRaw ? firstRaw.page : 1, candidates: tally };
  };

  // At scale 1:R, a length of L paper-points equals L * (25.4/72) mm on paper,
  // times R in the real world. Convert to metres/point for the calibration.
  N.applyAutoScale = async function () {
    const det = await N.detectScale();
    if (!det) return { ok: false, reason: "no-scale" };
    const mmPerPoint = 25.4 / 72;
    const unitsPerPoint = (mmPerPoint * det.ratio) / 1000; // metres per point
    S.calibration = { unitsPerPoint, unit: "m", label: `1:${det.ratio} (auto)`, auto: true };
    const ind = document.getElementById("calib-indicator");
    ind.textContent = `1:${det.ratio} · m`;
    ind.classList.add("set");
    A.renderAll();
    MS.emit("annots-changed");
    return { ok: true, ratio: det.ratio, raw: det.raw };
  };

  // ---- find & count: place a count marker on each text match ----
  N.findAndCount = async function (term) {
    term = (term || "").trim();
    if (!term) return { ok: false, reason: "empty" };
    const pages = await N.allText();
    // whole-token, case-insensitive match (exact token or the tag inside a cell)
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9])${esc}([^A-Za-z0-9]|$)`, "i");
    const d = S.style.fontSize * 1.6;
    let made = 0;
    const prevSubject = S.style.subject;
    S.style.subject = term;
    for (const p of pages) {
      for (const it of p.items) {
        if (re.test(it.str)) {
          A.create("count", p.page, { rect: { x: it.x - d / 2, y: it.y - d / 2, w: d, h: d } });
          made++;
        }
      }
    }
    S.style.subject = prevSubject;
    A.renderAll();
    MS.emit("annots-changed");
    return { ok: true, count: made };
  };

  // ---- overall report: vector vs scanned, scale, text volume ----
  N.report = async function () {
    const pages = await N.allText();
    const totalItems = pages.reduce((s, p) => s + p.items.length, 0);
    const chars = pages.reduce((s, p) => s + p.items.reduce((a, i) => a + i.str.length, 0), 0);
    const scale = await N.detectScale();
    const likelyScanned = totalItems < 3; // effectively no text layer
    return { pages: S.numPages, textItems: totalItems, chars, scale, likelyScanned };
  };
})();

/* viewer.js — loads and renders PDF pages, manages per-page SVG overlays,
 * and converts between screen pixels and PDF-point coordinates. */
(function () {
  "use strict";
  const MS = window.MS;
  const S = MS.state;
  const SVGNS = "http://www.w3.org/2000/svg";

  const els = {
    pages: () => document.getElementById("pages"),
    empty: () => document.getElementById("empty-state"),
    viewer: () => document.getElementById("viewer"),
  };

  const Viewer = (MS.viewer = {});

  Viewer.openFile = async function (file) {
    const buf = await file.arrayBuffer();
    S.pdfBytes = buf.slice(0); // keep a pristine copy for export
    S.fileName = file.name;
    await Viewer.loadBytes(buf);
    document.getElementById("doc-title").textContent = file.name;
  };

  Viewer.loadBytes = async function (buf) {
    const task = window.pdfjsLib.getDocument({ data: buf });
    S.pdfDoc = await task.promise;
    S.numPages = S.pdfDoc.numPages;
    S.currentPage = 1;
    els.empty().style.display = "none";
    document.getElementById("page-total").textContent = S.numPages;

    // Compute a fit-width base scale using the first page
    const first = await S.pdfDoc.getPage(1);
    const vp1 = first.getViewport({ scale: 1 });
    const avail = els.viewer().clientWidth - 60;
    S.baseScale = MS.clamp(avail / vp1.width, 0.4, 3);
    S.scale = S.baseScale;

    await Viewer.renderAll();
    MS.emit("doc-loaded");
    Viewer.updateChrome();
  };

  Viewer.renderAll = async function () {
    const host = els.pages();
    host.innerHTML = "";
    S.pages = [];
    for (let n = 1; n <= S.numPages; n++) {
      const page = await S.pdfDoc.getPage(n);
      const info = await renderPage(page, n);
      S.pages.push(info);
    }
    // Redraw every annotation onto its page overlay
    MS.annotations.renderAll();
    Viewer.observeVisiblePage();
  };

  async function renderPage(page, n) {
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: S.scale });

    const wrap = document.createElement("div");
    wrap.className = "page-wrap";
    wrap.style.width = viewport.width + "px";
    wrap.style.height = viewport.height + "px";
    wrap.dataset.page = n;

    const label = document.createElement("div");
    label.className = "page-label";
    label.textContent = "Page " + n;
    wrap.appendChild(label);

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + "px";
    canvas.style.height = viewport.height + "px";
    const ctx = canvas.getContext("2d");
    wrap.appendChild(canvas);

    // SVG overlay in PDF-point coordinates via viewBox
    const unscaled = page.getViewport({ scale: 1 });
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "page-overlay");
    svg.setAttribute("viewBox", `0 0 ${unscaled.width} ${unscaled.height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.style.width = viewport.width + "px";
    svg.style.height = viewport.height + "px";
    svg.dataset.page = n;
    wrap.appendChild(svg);

    els.pages().appendChild(wrap);

    await page.render({
      canvasContext: ctx,
      viewport: page.getViewport({ scale: S.scale * dpr }),
    }).promise;

    return {
      pageNum: n,
      widthPt: unscaled.width,
      heightPt: unscaled.height,
      wrap, svg, canvas, viewport,
    };
  }

  // Re-render pages at a new scale, preserving annotations
  Viewer.setScale = async function (scale) {
    S.scale = MS.clamp(scale, 0.2, 6);
    const scrollFrac = els.viewer().scrollTop / Math.max(1, els.pages().scrollHeight);
    await Viewer.renderAll();
    els.viewer().scrollTop = scrollFrac * els.pages().scrollHeight;
    Viewer.updateChrome();
  };

  Viewer.zoomIn = () => Viewer.setScale(S.scale * 1.2);
  Viewer.zoomOut = () => Viewer.setScale(S.scale / 1.2);
  Viewer.fitWidth = () => {
    const avail = els.viewer().clientWidth - 60;
    const w = S.pages[0] ? S.pages[0].widthPt : 612;
    Viewer.setScale(avail / w);
  };

  Viewer.updateChrome = function () {
    document.getElementById("zoom-indicator").textContent =
      Math.round(S.scale * 100) + "%";
    document.getElementById("page-current").textContent = S.currentPage;
    const hasDoc = !!S.pdfDoc;
    ["btn-save-json", "btn-export-pdf"].forEach((id) => {
      document.getElementById(id).disabled = !hasDoc;
    });
    document.getElementById("btn-prev").disabled = !hasDoc || S.currentPage <= 1;
    document.getElementById("btn-next").disabled = !hasDoc || S.currentPage >= S.numPages;
  };

  Viewer.gotoPage = function (n) {
    n = MS.clamp(n, 1, S.numPages);
    S.currentPage = n;
    const info = S.pages[n - 1];
    if (info) info.wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    Viewer.updateChrome();
  };

  // Track which page is centered for the page indicator
  Viewer.observeVisiblePage = function () {
    if (Viewer._io) Viewer._io.disconnect();
    Viewer._io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            S.currentPage = +en.target.dataset.page;
            document.getElementById("page-current").textContent = S.currentPage;
            Viewer.updateChrome();
          }
        });
      },
      { root: els.viewer(), threshold: 0.5 }
    );
    S.pages.forEach((p) => Viewer._io.observe(p.wrap));
  };

  // Convert a pointer event to PDF-point coordinates within an overlay svg
  Viewer.eventToPoint = function (svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  Viewer.pageInfoFor = function (svgOrPageNum) {
    if (typeof svgOrPageNum === "number") return S.pages[svgOrPageNum - 1];
    return S.pages.find((p) => p.svg === svgOrPageNum);
  };
})();

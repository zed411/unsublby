// Dump per-page text from the PDF using the vendored pdf.js (legacy build works in Node)
const fs = require("fs");
const path = process.env.MS_PDF; if(!path){console.error("Set MS_PDF=/path/to.pdf");process.exit(1);}
(async () => {
  const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path)), useSystemFonts: true }).promise;
  console.log("pages:", doc.numPages);
  const out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const p = await doc.getPage(n);
    const tc = await p.getTextContent();
    const vp = p.getViewport({ scale: 1 });
    const items = tc.items.map(it => ({ s: it.str, x: Math.round(it.transform[4]), y: Math.round(vp.height - it.transform[5]) })).filter(i => i.s.trim());
    out.push({ page: n, w: Math.round(vp.width), h: Math.round(vp.height), items });
  }
  fs.writeFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/doc-text.json", JSON.stringify(out));
  // quick summary: per page, first big-ish title strings
  out.forEach(p => {
    const joined = p.items.map(i => i.s).join(" ");
    const title = joined.slice(0, 150);
    console.log(String(p.page).padStart(2), `[${p.w}x${p.h}]`, p.items.length, "items |", title.replace(/\s+/g, " "));
  });
})().catch(e => { console.error(e.message); process.exit(1); });

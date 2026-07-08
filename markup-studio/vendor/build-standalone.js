const fs = require("fs"), path = require("path");
const R = path.resolve(__dirname, "..");
const rd = (p) => fs.readFileSync(path.join(R, p), "utf8");

const css = rd("css/styles.css");
let html = rd("index.html");
// extract body inner
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
  // strip the app's own script/link tags; we inline instead
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<link[^>]*>/g, "");

const pdfjs = rd("lib/pdf.min.js");
const pdflib = rd("lib/pdf-lib.min.js");
const worker = rd("lib/pdf.worker.min.js");
const appJs = ["state","viewer","annotations","tools","markuplist","workflows","pricing","analyze","export","main"]
  .map((n) => rd(`js/${n}.js`)).join("\n;\n");

// Worker handling: register the worker on the main thread AND expose a blob URL.
// If the page CSP allows blob workers it uses a real worker; otherwise PDF.js
// falls back to the main-thread copy — either way, no external request.
const bootWorker = `
(function(){
  try {
    var blob = new Blob([document.getElementById('pdfworker-src').textContent], {type:'text/javascript'});
    window.__pdfWorkerBlobUrl = URL.createObjectURL(blob);
  } catch(e) {}
})();`;

// The worker script is inline+executable: running it registers
// globalThis.pdfjsWorker (main-thread fallback), and we also read its own
// textContent to build a blob URL for a real worker when the CSP allows it.
const out = `<title>Markup Studio</title>
<style>${css}</style>
${body}
<script id="pdfjs-src">${pdfjs}</script>
<script id="pdfworker-src">${worker.replace(/<\/script>/g, "<\\/script>")}</script>
<script>${bootWorker}</script>
<script id="pdflib-src">${pdflib}</script>
<script>${appJs}</script>`;

fs.writeFileSync(path.join(R, "standalone.html"), out);
console.log("standalone.html", (out.length/1024/1024).toFixed(2)+"MB");

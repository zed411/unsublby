const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright-core");
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  await page.goto(base, { waitUntil: "networkidle" });

  const buf = fs.readFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/plan.pdf");
  await page.setInputFiles("#file-input", { name: "plan.pdf", mimeType: "application/pdf", buffer: buf });
  await page.waitForSelector(".page-wrap canvas");

  // auto-scale detection (1:100)
  const scale = await page.evaluate(async () => await window.MS.analyze.applyAutoScale());
  console.log("auto-scale:", JSON.stringify(scale));

  // report
  const report = await page.evaluate(async () => await window.MS.analyze.report());
  console.log("report:", JSON.stringify(report));

  // find & count GPO -> expect 5 markers
  const gpo = await page.evaluate(async () => await window.MS.analyze.findAndCount("GPO"));
  console.log("count GPO:", JSON.stringify(gpo));
  const markers = await page.evaluate(() => window.MS.state.annotations.filter((a) => a.type === "count" && a.subject === "GPO").length);
  console.log("GPO markers in state:", markers);

  // count doors D01/D02/D03 individually -> 1 each
  const d01 = await page.evaluate(async () => (await window.MS.analyze.findAndCount("D01")).count);
  console.log("count D01:", d01);

  await browser.close(); server.close();
  console.log("\nconsole errors:", errors.length);
  errors.forEach((e) => console.log("  ", e));

  const pass = scale.ok && scale.ratio === 100 && report.scale && report.scale.ratio === 100 &&
    !report.likelyScanned && gpo.ok && gpo.count === 5 && markers === 5 && d01 === 1 && errors.length === 0;
  console.log("\n" + (pass ? "PASS ✅" : "FAIL ❌"));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });

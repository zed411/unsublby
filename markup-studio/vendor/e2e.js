const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".pdf": "application/pdf" };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const errors = [];

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    headless: true,
    args: ["--headless=new", "--no-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("requestfailed", (r) => console.log("REQ FAILED:", r.url()));
  page.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });

  await page.goto(base, { waitUntil: "networkidle" });

  // 1. app booted, tool rail populated
  const tools = await page.$$eval(".tool-btn", (n) => n.length);
  console.log("tool buttons:", tools);

  // 2. load the test PDF via the hidden input
  const buf = fs.readFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/test.pdf");
  await page.setInputFiles("#file-input", { name: "test.pdf", mimeType: "application/pdf", buffer: buf });
  await page.waitForSelector(".page-wrap canvas", { timeout: 8000 });
  const pageCount = await page.$$eval(".page-wrap", (n) => n.length);
  console.log("rendered pages:", pageCount);

  // 3. select rectangle tool and draw a markup on the overlay
  await page.click('.tool-btn[data-tool="rect"]');
  const svg = await page.$("svg.page-overlay");
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + 60, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 180, { steps: 6 });
  await page.mouse.up();

  const annots = await page.$$eval("svg.page-overlay .annot", (n) => n.length);
  console.log("annotations after draw:", annots);

  // 4. it should appear in the markups list
  const listItems = await page.$$eval(".mk-item", (n) => n.length);
  console.log("markup list rows:", listItems);

  // 5. draw an arrow too
  await page.click('.tool-btn[data-tool="arrow"]');
  await page.mouse.move(box.x + 220, box.y + 220);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 300, { steps: 6 });
  await page.mouse.up();
  const annots2 = await page.$$eval("svg.page-overlay .annot", (n) => n.length);
  console.log("annotations after arrow:", annots2);

  // 6. exercise PDF export path (no download, just ensure it runs without throwing)
  const exportOk = await page.evaluate(async () => {
    try { await window.MS.exporter.exportPdf(); return true; } catch (e) { return "ERR:" + e.message; }
  });
  console.log("export ran:", exportOk);

  // 7. calibration + measurement math sanity (pure logic)
  const mathOk = await page.evaluate(() => {
    const MS = window.MS;
    MS.state.calibration = { unitsPerPoint: 0.1, unit: "m" };
    const a = { type: "length", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], fontSize: 12 };
    return MS.annotations.measureText(a); // 100pt * 0.1 = 10 m
  });
  console.log("measure label:", mathOk);

  // 8. estimating: place 3 count markers tagged "GPO", price at $85 ea → $255
  const estOk = await page.evaluate(() => {
    const MS = window.MS;
    MS.state.rates = [{ id: "r1", code: "GPO", trade: "Electrical", desc: "Double outlet", unit: "ea", rate: 85 }];
    MS.state.style.subject = "GPO";
    for (let i = 0; i < 3; i++) MS.annotations.create("count", 1, { rect: { x: 50 + i * 30, y: 400, w: 20, h: 20 } });
    const est = MS.pricing.build();
    return { total: est.total, lines: est.list.length, qty: est.list[0] && est.list[0].qty };
  });
  console.log("estimate:", JSON.stringify(estOk));

  // 9. length markup priced per-metre after calibration
  const lenPrice = await page.evaluate(() => {
    const MS = window.MS;
    MS.state.calibration = { unitsPerPoint: 0.01, unit: "m" }; // 100pt = 1 m
    MS.state.rates.push({ id: "r2", code: "Skirting", trade: "Carpentry", desc: "Skirting", unit: "m", rate: 20 });
    MS.state.style.subject = "Skirting";
    MS.annotations.create("length", 1, { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }] }); // 500pt = 5m → 5*20 = 100
    const est = MS.pricing.build();
    const line = est.list.find((l) => l.rate.code === "Skirting");
    return line ? line.amount : null;
  });
  console.log("skirting amount:", lenPrice);

  await browser.close();
  server.close();

  console.log("\nconsole errors:", errors.length);
  errors.forEach((e) => console.log("  ", e));

  const pass = tools > 10 && pageCount === 1 && annots >= 1 && annots2 >= 2 && listItems >= 1 &&
    exportOk === true && mathOk === "10 m" &&
    estOk.total === 255 && estOk.lines === 1 && estOk.qty === 3 &&
    lenPrice === 100 && errors.length === 0;
  console.log("\n" + (pass ? "PASS ✅" : "FAIL ❌"));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });

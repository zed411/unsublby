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
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--headless=new", "--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  await page.goto(base, { waitUntil: "networkidle" });
  const buf = fs.readFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/test.pdf");
  await page.setInputFiles("#file-input", { name: "Floor-Plan.pdf", mimeType: "application/pdf", buffer: buf });
  await page.waitForSelector(".page-wrap canvas");
  const svg = await page.$("svg.page-overlay"); const b = await svg.boundingBox();
  // rectangle
  await page.click('.tool-btn[data-tool="rect"]');
  await page.mouse.move(b.x + 60, b.y + 90); await page.mouse.down(); await page.mouse.move(b.x + 190, b.y + 175, { steps: 5 }); await page.mouse.up();
  // cloud (needs distinct color)
  await page.click('.swatch[data-color="#f59e0b"]');
  await page.click('.tool-btn[data-tool="arrow"]');
  await page.mouse.move(b.x + 250, b.y + 120); await page.mouse.down(); await page.mouse.move(b.x + 360, b.y + 210, { steps: 5 }); await page.mouse.up();
  // measure with calibration
  await page.evaluate(() => { window.MS.state.calibration = { unitsPerPoint: 0.0254, unit: "m" }; document.getElementById("calib-indicator").textContent = "1 m scale set"; document.getElementById("calib-indicator").classList.add("set"); });
  await page.click('.swatch[data-color="#3b82f6"]');
  await page.click('.tool-btn[data-tool="length"]');
  await page.mouse.move(b.x + 70, b.y + 250); await page.mouse.down(); await page.mouse.move(b.x + 330, b.y + 250, { steps: 5 }); await page.mouse.up();
  // count markers tagged for estimating
  await page.fill("#subject-input", "GPO");
  await page.click('.tool-btn[data-tool="count"]');
  for (const [dx, dy] of [[120, 400], [180, 430], [240, 405]]) await page.mouse.click(b.x + dx, b.y + dy);
  await page.click('.tool-btn[data-tool="select"]');
  await page.mouse.click(b.x + 550, b.y + 600);
  await page.screenshot({ path: "/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/markup-studio.png" });
  // switch to Estimate tab for a second shot
  await page.click('.tab[data-tab="estimate"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/markup-studio-estimate.png" });
  await browser.close(); server.close();
  console.log("screenshot saved");
})();

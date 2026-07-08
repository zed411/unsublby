const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript"};
const SCRATCH="/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad";
const PDF=process.env.MS_PDF; if(!PDF){console.error("Set MS_PDF=/path/to.pdf");process.exit(1);}
const PAGES=(process.argv[2]||"13,14").split(",").map(Number);
const server=http.createServer((q,r)=>{let p=q.url.split("?")[0];if(p==="/")p="/index.html";const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--headless=new","--no-sandbox"]});
  const pg=await br.newPage({viewport:{width:2000,height:1500},deviceScaleFactor:1});
  await pg.goto(base,{waitUntil:"networkidle"});
  const buf=fs.readFileSync(PDF);
  await pg.setInputFiles("#file-input",{name:"arch.pdf",mimeType:"application/pdf",buffer:buf});
  await pg.waitForSelector(".page-wrap canvas",{timeout:60000});
  // bump zoom for legibility
  await pg.evaluate(async()=>{ await window.MS.viewer.setScale(1.6); });
  await pg.waitForTimeout(1500);
  for(const n of PAGES){
    await pg.waitForSelector(`.page-wrap[data-page="${n}"] canvas`,{timeout:60000});
    const el=await pg.$(`.page-wrap[data-page="${n}"]`);
    await el.scrollIntoViewIfNeeded();
    await pg.waitForTimeout(300);
    await el.screenshot({path:`${SCRATCH}/sheet-${n}.png`});
    console.log("rendered page",n);
  }
  await br.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});

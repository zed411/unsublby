const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript"};
const SCRATCH="/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad";
const PDF=process.env.MS_PDF; if(!PDF){console.error("Set MS_PDF=/path/to.pdf");process.exit(1);}
const [,,pageN,X,Y,W,H,SC,OUT]=process.argv;
const server=http.createServer((q,r)=>{let p=q.url.split("?")[0];if(p==="/")p="/index.html";const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--headless=new","--no-sandbox"]});
  const pg=await br.newPage({viewport:{width:Math.min(2400,Math.round((+W)*(+SC))+80),height:Math.min(1800,Math.round((+H)*(+SC))+80)}});
  await pg.goto(base,{waitUntil:"networkidle"});
  await pg.setInputFiles("#file-input",{name:"arch.pdf",mimeType:"application/pdf",buffer:fs.readFileSync(PDF)});
  await pg.waitForSelector(".page-wrap canvas",{timeout:60000});
  await pg.evaluate(async(s)=>{ await window.MS.viewer.setScale(s); },+SC);
  await pg.waitForSelector(`.page-wrap[data-page="${pageN}"] canvas`,{timeout:60000});
  // scroll the viewer so the region's top-left sits at the viewport top-left
  await pg.evaluate(({n,x,y,s})=>{
    const viewer=document.getElementById("viewer");
    const wrap=document.querySelector(`.page-wrap[data-page="${n}"]`);
    viewer.scrollTop = wrap.offsetTop + y*s - 10;
    viewer.scrollLeft = wrap.offsetLeft + x*s - 10;
  },{n:pageN,x:+X,y:+Y,s:+SC});
  await pg.waitForTimeout(900);
  const rect=await pg.evaluate(({n,x,y,s})=>{
    const w=document.querySelector(`.page-wrap[data-page="${n}"]`).getBoundingClientRect();
    return {x:w.x+x*s,y:w.y+y*s};
  },{n:pageN,x:+X,y:+Y,s:+SC});
  await pg.screenshot({path:`${SCRATCH}/${OUT}.png`,clip:{x:Math.max(0,rect.x),y:Math.max(0,rect.y),width:(+W)*(+SC),height:(+H)*(+SC)}});
  console.log("saved",OUT);
  await br.close();server.close();
})().catch(e=>{console.error(e.message);process.exit(1);});

// Load the user's PDF + takeoff project in the headless app, then run the
// app's own Export PDF path, capturing the flattened bytes.
const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript"};
const SCRATCH="/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad";
const PDF=process.env.MS_PDF; if(!PDF){console.error("Set MS_PDF=/path/to.pdf");process.exit(1);}
const server=http.createServer((q,r)=>{let p=q.url.split("?")[0];if(p==="/")p="/index.html";const f=path.join(ROOT,p);if(!fs.existsSync(f)){r.writeHead(404);return r.end();}r.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
(async()=>{
  await new Promise(r=>server.listen(0,r));
  const base=`http://127.0.0.1:${server.address().port}`;
  const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--headless=new","--no-sandbox"]});
  const pg=await br.newPage({viewport:{width:1400,height:900}});
  await pg.goto(base,{waitUntil:"networkidle"});
  await pg.setInputFiles("#file-input",{name:"Architecturals.pdf",mimeType:"application/pdf",buffer:fs.readFileSync(PDF)});
  await pg.waitForSelector(".page-wrap canvas",{timeout:60000});
  await pg.setInputFiles("#load-input",{name:"takeoff.mstudio",mimeType:"application/json",buffer:fs.readFileSync(process.env.MS_PROJECT)});
  await pg.waitForTimeout(1000);
  const b64=await pg.evaluate(async()=>{
    let captured=null;
    window.MS.download=(data)=>{captured=data;};   // intercept the download
    await window.MS.exporter.exportPdf();
    if(!captured) throw new Error("no bytes captured");
    let bin=""; const u8=captured; const CH=0x8000;
    for(let i=0;i<u8.length;i+=CH) bin+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
    return btoa(bin);
  });
  fs.writeFileSync(process.env.MS_OUT||(SCRATCH+"/flattened.pdf"),Buffer.from(b64,"base64"));
  console.log("flattened PDF saved,",Math.round(b64.length*0.75/1024/1024*100)/100,"MB");
  await br.close();server.close();
})().catch(e=>{console.error(e.message||e);process.exit(1);});

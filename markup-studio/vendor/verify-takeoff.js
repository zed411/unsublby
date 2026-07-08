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
  const pg=await br.newPage({viewport:{width:1900,height:1300}});
  const errs=[];pg.on("pageerror",e=>errs.push(e.message));
  await pg.goto(base,{waitUntil:"networkidle"});
  await pg.setInputFiles("#file-input",{name:"Architecturals_260423.pdf",mimeType:"application/pdf",buffer:fs.readFileSync(PDF)});
  await pg.waitForSelector(".page-wrap canvas",{timeout:60000});
  // load the project
  const proj=fs.readFileSync(process.env.MS_PROJECT);
  await pg.setInputFiles("#load-input",{name:"pacific-regis-concrete.mstudio",mimeType:"application/json",buffer:proj});
  await pg.waitForTimeout(1200);
  const state=await pg.evaluate(()=>{
    const S=window.MS.state, est=window.MS.pricing.build();
    return { annots:S.annotations.length, cal:S.calibration&&S.calibration.label,
      measures:S.annotations.filter(a=>a.type==="area").map(a=>({s:a.subject,m:window.MS.annotations.measureText(a)})),
      estTotal:est.total, estLines:est.list.map(l=>({code:l.rate.code,qty:Math.round(l.qty),amt:Math.round(l.amount)})) };
  });
  console.log(JSON.stringify(state,null,1));
  // screenshot page 14 with markups
  await pg.evaluate(async()=>{await window.MS.viewer.setScale(1.5);});
  await pg.waitForSelector('.page-wrap[data-page="14"] canvas',{timeout:60000});
  await pg.evaluate(()=>{const v=document.getElementById("viewer");const w=document.querySelector('.page-wrap[data-page="14"]');v.scrollTop=w.offsetTop-8;v.scrollLeft=0;});
  await pg.waitForTimeout(900);
  await pg.screenshot({path:`${SCRATCH}/takeoff-marked.png`});
  console.log("errors:",errs.length);
  await br.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});

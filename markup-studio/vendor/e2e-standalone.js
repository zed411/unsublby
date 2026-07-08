const http=require("http"),fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"standalone.html"));
const CSPS={
  "blob-allowed":"default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; connect-src blob: data:; worker-src blob:; child-src blob:",
  "blob-blocked":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src data:; worker-src 'none'"
};
async function run(cspName){
  const server=http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/html","Content-Security-Policy":CSPS[cspName]});res.end(html);});
  await new Promise(r=>server.listen(0,r));const base=`http://127.0.0.1:${server.address().port}`;
  const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--headless=new","--no-sandbox"]});
  const page=await br.newPage();
  await page.goto(base,{waitUntil:"networkidle"});
  const buf=fs.readFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/plan.pdf");
  await page.setInputFiles("#file-input",{name:"plan.pdf",mimeType:"application/pdf",buffer:buf});
  let ok=false;try{await page.waitForSelector(".page-wrap canvas",{timeout:9000});
    await page.waitForFunction(()=>{const c=document.querySelector(".page-wrap canvas");if(!c)return false;const d=c.getContext("2d").getImageData(0,0,50,50).data;for(let i=0;i<d.length;i+=4)if(d[i]<250||d[i+1]<250||d[i+2]<250)return true;return false;},{timeout:9000});ok=true;}catch(e){}
  await br.close();server.close();
  console.log(cspName.padEnd(14),"->",ok?"renders ✅":"BLANK ❌");
  return ok;
}
(async()=>{const a=await run("blob-allowed");const b=await run("blob-blocked");
console.log(a&&b?"\nBOTH PASS ✅":"\nFAIL ❌");process.exit(a&&b?0:1);})().catch(e=>{console.error(e);process.exit(1);});

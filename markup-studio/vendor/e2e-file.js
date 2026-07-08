const fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const ROOT=path.resolve(__dirname,"..");
const fileUrl="file://"+path.join(ROOT,"standalone.html");
(async()=>{
  const br=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--headless=new","--no-sandbox","--allow-file-access-from-files"]});
  const page=await br.newPage();
  const errs=[];page.on("pageerror",e=>errs.push(e.message));
  await page.goto(fileUrl,{waitUntil:"load"});
  const buf=fs.readFileSync("/tmp/claude-0/-home-user/727cf07f-47b4-5036-aaaf-34befe0e2c86/scratchpad/plan.pdf");
  await page.setInputFiles("#file-input",{name:"plan.pdf",mimeType:"application/pdf",buffer:buf});
  let ok=false;try{await page.waitForSelector(".page-wrap canvas",{timeout:9000});
    await page.waitForFunction(()=>{const c=document.querySelector(".page-wrap canvas");if(!c)return false;const d=c.getContext("2d").getImageData(0,0,50,50).data;for(let i=0;i<d.length;i+=4)if(d[i]<250||d[i+1]<250||d[i+2]<250)return true;return false;},{timeout:9000});ok=true;}catch(e){}
  const gpo=await page.evaluate(async()=>(await window.MS.analyze.findAndCount("GPO")).count).catch(()=>"err");
  await br.close();
  console.log("file:// renders:",ok,"| GPO count:",gpo,"| errors:",errs.length);
  errs.slice(0,4).forEach(e=>console.log("  ",e));
  process.exit(ok&&gpo===5?0:1);
})().catch(e=>{console.error(e);process.exit(1);});

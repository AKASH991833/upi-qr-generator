const p=require('puppeteer-core'),jsQR=require('jsqr'),{PNG}=require('pngjs');
const Z=require('@zxing/library');
const cases=[
 ['link',{u:'example.com/page?a=1&b=2'},'Meri website','Visit karo','https://example.com/page?a=1&b=2'],
 ['yt',{u:'https://youtu.be/dQw4w9WgXcQ?si=abc'},'Akash ka YouTube','Subscribe karo','https://youtu.be/dQw4w9WgXcQ?si=abc'],
 ['yt',{u:'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123'},'Gaana',''],
 ['upi',{pn:'Sharma General Store',pa:'shop@okaxis',am:'250',tn:'Bill'},'','', 'upi://pay?pa=shop@okaxis&pn=Sharma%20General%20Store&cu=INR&am=250&tn=Bill'],
 ['upi',{pn:'राम किराना',pa:'ram@ybl'},'','',null],
 ['wa',{ph:'9876543210',ms:'Hi, mujhe booking karni hai'},'DJ Booking','','https://wa.me/919876543210?text=Hi%2C%20mujhe%20booking%20karni%20hai'],
 ['phone',{ph:'+91 98765 43210'},'Call me','', 'tel:+919876543210'],
 ['wifi',{ss:'Home;WiFi',pw:'pa:ss;w"rd',sec:'WPA'},'Ghar ka Wi-Fi','',null],
 ['vcard',{nm:'Akash Vishwakarma',ph:'9876543210',em:'a@example.com',og:'Linux Admin'},'','',null],
 ['email',{em:'hello@example.com',su:'Enquiry',bd:'Hello there'},'','',null],
 ['text',{tx:'नमस्ते! This is a text QR with Hindi and emoji 🙂. '+'x'.repeat(300)},'Note','',null],
 ['media',{u:'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing'},'Meri photo','',null],
 ['auto',{any:'https://www.youtube.com/watch?v=abc123XYZ00'},'Auto yt','','https://www.youtube.com/watch?v=abc123XYZ00'],
 ['auto',{any:'name@okaxis'},'','',null],
 ['auto',{any:'9876543210'},'','','tel:+919876543210'],
];
function dec(buf,scale){
  const png=PNG.sync.read(Buffer.from(buf,'base64'));
  let {width:w,height:h,data}=png;
  if(scale&&scale<1){const nw=Math.round(w*scale),nh=Math.round(h*scale),o=new Uint8ClampedArray(nw*nh*4);
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){ // box average
      const sx0=Math.floor(x/scale),sx1=Math.min(w,Math.floor((x+1)/scale)),sy0=Math.floor(y/scale),sy1=Math.min(h,Math.floor((y+1)/scale));let r=0,g=0,b=0,c=0;
      for(let yy=sy0;yy<sy1;yy++)for(let xx=sx0;xx<sx1;xx++){const i=(yy*w+xx)*4;r+=data[i];g+=data[i+1];b+=data[i+2];c++}
      const j=(y*nw+x)*4;o[j]=r/c;o[j+1]=g/c;o[j+2]=b/c;o[j+3]=255}
    w=nw;h=nh;data=o}
  const rgba=new Uint8ClampedArray(data.buffer?data:data);
  const j=jsQR(rgba,w,h,{inversionAttempts:'dontInvert'});
  let zx=null;try{
    const lum=new Uint8ClampedArray(w*h);for(let i=0;i<w*h;i++)lum[i]=(rgba[i*4]*299+rgba[i*4+1]*587+rgba[i*4+2]*114)/1000;
    const src=new Z.RGBLuminanceSource(lum,w,h);const bm=new Z.BinaryBitmap(new Z.HybridBinarizer(src));
    const rd=new Z.QRCodeReader();zx=rd.decode(bm,new Map([[Z.DecodeHintType.TRY_HARDER,true]])).getText()}catch(e){}
  return {js:j&&j.data,zx};
}
(async()=>{
const b=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const pg=await b.newPage();const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())});pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('http://localhost:8123/index.html');
let pass=0,fail=0,rows=[];
for(const [t,vals,lb,sb,expect] of cases){
  await pg.evaluate((t,v,l,s)=>QRS.setType(t,v,l,s),t,vals,lb,sb);
  await new Promise(r=>setTimeout(r,200));
  const payload=await pg.evaluate(()=>QRS.cur()&&QRS.cur().payload);
  if(!payload){fail++;rows.push([t,'NO PAYLOAD']);continue}
  if(expect&&payload!==expect){fail++;rows.push([t,'PAYLOAD MISMATCH',payload,expect]);continue}
  for(const sid of ['neon','aurora','mono','sunset']){
    await pg.evaluate(s=>QRS.setStyle(s),sid);
    const card=(await pg.evaluate(s=>QRS.cardPng(s),sid)).split(',')[1];
    const qr=(await pg.evaluate(s=>QRS.qrPng(s),sid)).split(',')[1];
    // svg raster via separate img in page
    const svgpng=(await pg.evaluate(async()=>{const s=QRS.svg(QRS.STYLES[0].id);return 1})).toString();
    const checks=[['card',dec(card)],['card@35%',dec(card,.35)],['qronly',dec(qr)],['qronly@25%',dec(qr,.25)]];
    for(const [n,r] of checks){const okjs=r.js===payload,okz=r.zx===payload;
      // require jsQR on all; zxing on full-size only
      const need=n.includes('@')?okjs||okz:okjs&&okz;
      if(need)pass++;else{fail++;rows.push([t+":"+(payload.length),sid,n,'js='+okjs,'zx='+okz])}}
  }
}
// svg decode: render each style's svg in page, screenshot canvas
for(const sid of ['neon','aurora','mono','sunset']){
  await pg.evaluate(s=>QRS.setStyle(s),sid);
  const url=await pg.evaluate(async s=>{const svg=QRS.svg(s);const img=new Image();await new Promise(r=>{img.onload=r;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)});const c=document.createElement('canvas');c.width=c.height=800;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,800,800);x.drawImage(img,0,0,800,800);return c.toDataURL('image/png')},sid);
  const r=dec(url.split(',')[1]);const pay=await pg.evaluate(()=>QRS.cur().payload);
  if(r.js===pay&&r.zx===pay)pass++;else{fail++;rows.push(['svg',sid,JSON.stringify(r).slice(0,80)])}
}
const mc=await pg.evaluate(()=>QRS.STYLES.map(s=>s.id+':'+QRS.minContrast(s).toFixed(1)));
console.log('contrast',mc.join(' '));
console.log('detect',await pg.evaluate(()=>['https://x.com','name@okaxis','a@b.com','9876543210','hello world','upi://pay?pa=a@ybl','www.site.in/x','WIFI:T:WPA;S:a;P:b;;'].map(QRS.detect).join(',')));
console.log('PASS',pass,'FAIL',fail,'console errors',errs.length,errs.slice(0,3));
rows.slice(0,60).forEach(r=>console.log(r.join(' | ')));
await b.close();})();

(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var pn=$('pn'),pa=$('pa'),am=$('am'),tn=$('tn'),cv=$('cv'),stage=$('stage');
var style='classic',timer;
var VPA=/^[a-zA-Z0-9][a-zA-Z0-9.\-_]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

// theme
$('themeBtn').addEventListener('click',function(){
  var n=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}
});

function clean(s){return String(s||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
function enc(s){return encodeURIComponent(s).replace(/%40/g,'@')}

function validate(show){
  var v={ok:true},name=clean(pn.value),id=clean(pa.value).toLowerCase(),amt=clean(am.value);
  var e={pn:'',pa:'',am:''};
  if(!name)e.pn='Please enter your shop or business name.';
  if(!id)e.pa='Please enter your UPI ID.';
  else if(!VPA.test(id))e.pa='This UPI ID looks wrong. It should look like name@bank (no spaces).';
  if(amt){
    if(!/^\d{1,6}(\.\d{1,2})?$/.test(amt))e.am='Amount should be a number like 250 or 99.50.';
    else if(parseFloat(amt)<=0)e.am='Amount must be more than 0.';
    else if(parseFloat(amt)>100000)e.am='UPI allows up to Rs 1,00,000 per payment.';
  }
  v.ok=!(e.pn||e.pa||e.am);
  v.name=name;v.id=id;v.amt=amt?parseFloat(amt).toFixed(2).replace(/\.00$/,''):'';v.note=clean(tn.value);
  if(show){
    [['pn',pn],['pa',pa],['am',am]].forEach(function(p){$(p[0]+'Err').textContent=e[p[0]];p[1].classList.toggle('bad',!!e[p[0]])});
  }
  v.e=e;return v;
}

function upiLink(v){
  var u='upi://pay?pa='+enc(v.id)+'&pn='+enc(v.name)+'&cu=INR';
  if(v.amt)u+='&am='+enc(v.amt);
  if(v.note)u+='&tn='+enc(v.note);
  return u;
}

function qrModules(text){
  var q=qrcode(0,'M');q.addData(text);q.make();
  return q;
}
function drawQr(ctx,q,x,y,size){
  var n=q.getModuleCount(),m=size/n;
  ctx.fillStyle='#000';
  for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(q.isDark(r,c))ctx.fillRect(Math.round(x+c*m),Math.round(y+r*m),Math.ceil(m),Math.ceil(m));
}
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function fit(ctx,text,maxW,start,weight){
  var s=start;do{ctx.font=weight+' '+s+'px system-ui,"Noto Sans","Noto Sans Devanagari",sans-serif';s-=2}while(ctx.measureText(text).width>maxW&&s>26);
}

var THEMES={
  classic:{bg:['#ffffff','#f3f4ff'],ink:'#12142b',sub:'#5d6280',chip:'#eef0ff',chipInk:'#4b3fd6',accent:'#6d5dfc'},
  violet:{bg:['#6d5dfc','#1fb5a5'],ink:'#ffffff',sub:'rgba(255,255,255,.88)',chip:'rgba(255,255,255,.2)',chipInk:'#ffffff',accent:'#ffffff'},
  dark:{bg:['#0f1220','#1a1f3d'],ink:'#ffffff',sub:'#b5bbe0',chip:'#252b52',chipInk:'#c9c2ff',accent:'#8b7dff'}
};

function poster(v,q){
  var W=1080,H=1500,t=THEMES[style],ctx=cv.getContext('2d');
  cv.width=W;cv.height=H;
  var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,t.bg[0]);g.addColorStop(1,t.bg[1]);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillStyle=t.sub;ctx.font='600 40px system-ui,sans-serif';ctx.fillText('SCAN & PAY',W/2,130);
  ctx.fillStyle=t.ink;fit(ctx,v.name,W-140,84,'800');ctx.fillText(v.name,W/2,235);
  // QR panel
  var px=140,py=290,ps=800;
  ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=50;ctx.shadowOffsetY=20;ctx.fillStyle='#fff';rr(ctx,px,py,ps,ps,56);ctx.fill();ctx.restore();
  drawQr(ctx,q,px+64,py+64,ps-128);
  // amount / chip
  var y=py+ps+120;
  if(v.amt){ctx.fillStyle=t.ink;ctx.font='800 92px system-ui,sans-serif';ctx.fillText('Rs '+Number(v.amt).toLocaleString('en-IN',{minimumFractionDigits:(v.amt.indexOf('.')>-1?2:0)}),W/2,y);y+=66}
  else{ctx.fillStyle=t.ink;ctx.font='700 52px system-ui,sans-serif';ctx.fillText('Enter amount in your app',W/2,y);y+=64}
  ctx.fillStyle=t.sub;fit(ctx,'UPI ID: '+v.id,W-140,44,'500');ctx.fillText('UPI ID: '+v.id,W/2,y);
  // footer chip
  ctx.fillStyle=t.chip;rr(ctx,150,H-170,W-300,86,43);ctx.fill();
  ctx.fillStyle=t.chipInk;ctx.font='700 34px system-ui,sans-serif';ctx.fillText('GPay  |  PhonePe  |  Paytm  |  BHIM  |  any UPI app',W/2,H-115);
}

var cur=null;
function render(){
  var v=validate(false);
  var ready=v.ok&&v.name&&v.id;
  ['dlPoster','dlQr','print','copy'].forEach(function(id){$(id).disabled=!ready});
  stage.classList.toggle('ready',!!ready);
  if(!ready){cur=null;return}
  var link=upiLink(v),q=qrModules(link);
  cur={v:v,link:link,q:q};poster(v,q);
}
function onInput(){
  clearTimeout(timer);timer=setTimeout(function(){
    // only show errors for fields the user has touched
    var v=validate(false);
    ['pn','pa','am'].forEach(function(k){var el=$(k);if(el.dataset.touched)validate(true)});
    render();save();
  },120);
}
[pn,pa,am,tn].forEach(function(el){
  el.addEventListener('input',onInput);
  el.addEventListener('blur',function(){el.dataset.touched='1';validate(true)});
});
document.querySelectorAll('.sty').forEach(function(b){b.addEventListener('click',function(){
  style=b.dataset.s;document.querySelectorAll('.sty').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});render();save();
})});
$('form').addEventListener('submit',function(e){e.preventDefault()});

function toast(m){var t=$('toast');t.textContent=m;clearTimeout(toast.t);toast.t=setTimeout(function(){t.textContent=''},2600)}
function fname(v,suffix){return 'upi-qr-'+(v.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'shop')+suffix+'.png'}
function download(canvas,name){
  canvas.toBlob(function(b){
    var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);toast('Downloaded');
  },'image/png');
}
$('dlPoster').addEventListener('click',function(){if(cur)download(cv,fname(cur.v,''))});
$('dlQr').addEventListener('click',function(){
  if(!cur)return;var c=document.createElement('canvas'),S=1000;c.width=c.height=S;var x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,S,S);drawQr(x,cur.q,70,70,S-140);download(c,fname(cur.v,'-only-qr'));
});
$('print').addEventListener('click',function(){if(cur)window.print()});
$('copy').addEventListener('click',function(){
  if(!cur)return;
  var done=function(){toast('UPI link copied')};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(cur.link).then(done,function(){fallback()});else fallback();
  function fallback(){var t=document.createElement('textarea');t.value=cur.link;document.body.appendChild(t);t.select();try{document.execCommand('copy');done()}catch(e){toast('Copy not allowed here')}t.remove()}
});

// remember
function save(){
  try{
    if($('remember').checked)localStorage.setItem('upiqr',JSON.stringify({pn:pn.value,pa:pa.value,am:am.value,tn:tn.value,style:style}));
    else localStorage.removeItem('upiqr');
    localStorage.setItem('upiqr_rem',$('remember').checked?'1':'');
  }catch(e){}
}
$('remember').addEventListener('change',save);
function load(){
  try{
    if(localStorage.getItem('upiqr_rem')==='1'){
      $('remember').checked=true;var d=JSON.parse(localStorage.getItem('upiqr')||'{}');
      pn.value=d.pn||'';pa.value=d.pa||'';am.value=d.am||'';tn.value=d.tn||'';
      if(THEMES[d.style]){style=d.style;document.querySelectorAll('.sty').forEach(function(x){x.setAttribute('aria-pressed',x.dataset.s===style?'true':'false')})}
    }
  }catch(e){}
  var p=new URLSearchParams(location.search);
  if(p.get('pa')){pa.value=p.get('pa');pn.value=p.get('pn')||pn.value;am.value=p.get('am')||'';tn.value=p.get('tn')||''}
}
load();render();

if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(function(){});
window.__upi={validate:validate,upiLink:upiLink};
})();

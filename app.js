(function(){
'use strict';
var $=function(id){return document.getElementById(id)};

// ---------- theme ----------
$('themeBtn').addEventListener('click',function(){
  var n=document.documentElement.dataset.theme==='dark'?'light':'dark';
  document.documentElement.dataset.theme=n;try{localStorage.setItem('theme',n)}catch(e){}
});

// ---------- helpers ----------
function clean(s){return String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()}
function enc(s){return encodeURIComponent(s).replace(/%40/g,'@')}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
var VPA=/^[a-zA-Z0-9][a-zA-Z0-9.\-_]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
var EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var DOMAIN=/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[\/:?#]\S*)?$/i;
function normUrl(s){
  s=clean(s);if(!s)return {err:'Link daalo.'};
  if(!/^[a-z][a-z0-9+.\-]*:/i.test(s)){
    if(!DOMAIN.test(s)&&!/^localhost/i.test(s))return {err:'Ye link sahi nahi lag raha. Jaise: youtube.com/watch?v=... ya https://example.com'};
    s='https://'+s;
  }
  var u;try{u=new URL(s)}catch(e){return {err:'Ye link sahi nahi lag raha.'}}
  if(u.protocol!=='http:'&&u.protocol!=='https:')return {err:'Sirf http ya https link allowed hai.'};
  if(!u.hostname||u.hostname.indexOf('.')<0)return {err:'Link me website ka naam chahiye, jaise example.com'};
  return {url:u.href,host:u.hostname.replace(/^www\./,'')};
}
function isYT(host){return /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/.test(host)}
function phoneDigits(s,cc){
  var raw=clean(s),plus=raw.charAt(0)==='+',d=raw.replace(/\D/g,'');
  if(!d)return {err:'Phone number daalo.'};
  if(!plus){if(d.length===10)d=cc+d;else if(d.length===11&&d.charAt(0)==='0')d=cc+d.slice(1)}
  if(d.length<8||d.length>15)return {err:'Number sahi nahi lag raha. Country code ke saath ya 10 digit daalo.'};
  return {digits:d};
}
function wifiEsc(s){return String(s).replace(/([\\;,:"])/g,'\\$1')}
function vEsc(s){return String(s).replace(/([\\;,])/g,'\\$1').replace(/\n/g,'\\n')}
function short(s,n){s=String(s);return s.length>n?s.slice(0,n-1)+'\u2026':s}

// ---------- types ----------
// each: id,label,fields[],build(vals)->{payload,gist,gist2,caption,label,foot,kind} | {err:{field:msg}}
var CHIP='Camera se scan karo';
var TYPES=[
 {id:'auto',label:'Auto',hint:'Kuch bhi paste karo: link, YouTube, UPI ID, number, email, Wi-Fi, text. Type apne aap pehchan lenge.',
  fields:[{id:'any',label:'Yahan paste karo',ph:'e.g. https://youtu.be/... ya name@okaxis ya 9876543210',area:true,max:1000}],
  build:function(v){
    var s=String(v.any||'').trim();if(!s)return {empty:true};
    var t=detect(s);var T=byId(t);var map={};
    if(t==='link'||t==='video')map.u=s;else if(t==='phone')map.ph=s;else if(t==='email')map.em=s;else if(t==='text')map.tx=s;
    else if(t==='upiraw'){return rawUpi(s)}
    else if(t==='raw'){return {payload:s,gist:short(clean(s),50),caption:'SCAN ME',foot:CHIP,kind:'Raw',detected:'Raw QR data'}}
    else if(t==='vcard'||t==='wifiraw'){return {payload:s,gist:t==='vcard'?'Contact card':'Wi-Fi',caption:t==='vcard'?'SAVE CONTACT':'JOIN WI-FI',foot:CHIP,kind:t,detected:t==='vcard'?'Contact card':'Wi-Fi'}}
    else if(t==='upi'){var rr=rawUpi('upi://pay?pa='+enc(s.toLowerCase())+'&cu=INR');rr.detected='UPI ID';return rr}
    var r=T.build(map);if(r&&!r.err&&!r.empty)r.detected=T.label;return r;
  }},
 {id:'link',label:'Website',hint:'Koi bhi website ya page ka link.',
  fields:[{id:'u',label:'Website link',ph:'e.g. example.com ya https://example.com/page',max:1000}],
  build:function(v){
    var n=normUrl(v.u);if(n.err)return {err:{u:n.err}};
    return {payload:n.url,gist:n.host,caption:isYT(n.host)?'SCAN TO WATCH':'SCAN TO OPEN',foot:CHIP,kind:isYT(n.host)?'YouTube':'Website'};
  }},
 {id:'yt',label:'YouTube',hint:'YouTube video, Shorts ya channel ka link paste karo. Scan karte hi YouTube me khulega.',
  fields:[{id:'u',label:'YouTube link',ph:'e.g. https://youtu.be/xxxx ya youtube.com/@channel',max:1000}],
  build:function(v){
    var n=normUrl(v.u);if(n.err)return {err:{u:n.err}};
    if(!isYT(n.host))return {err:{u:'Ye YouTube link nahi hai. Website type use karo ya YouTube link daalo.'}};
    return {payload:n.url,gist:n.host,caption:'SCAN TO WATCH',foot:CHIP,kind:'YouTube'};
  }},
 {id:'media',label:'Photo / Video',hint:'QR me file nahi aa sakti, sirf link. Photo ya video ko pehle Google Drive / Google Photos / Instagram par daalo, "Anyone with the link" share link copy karo, phir yahan paste karo.',
  fields:[{id:'u',label:'Photo ya video ka share link',ph:'e.g. https://drive.google.com/file/d/.../view',max:1000}],
  build:function(v){
    var n=normUrl(v.u);if(n.err)return {err:{u:n.err}};
    return {payload:n.url,gist:n.host,caption:'SCAN TO VIEW',foot:CHIP,kind:'Photo / Video link'};
  }},
 {id:'upi',label:'UPI',hint:'Dukaan ya personal payment QR. Customer scan karke seedha aapke UPI ID par pay karega.',
  fields:[
   {id:'pn',label:'Naam (customer ko dikhega)',ph:'e.g. Sharma General Store',max:60,req:1},
   {id:'pa',label:'UPI ID (name@bank)',ph:'e.g. shopname@okaxis',max:100,req:1,mode:'email'},
   {id:'am',label:'Amount (optional)',ph:'Khali = customer khud likhega',max:10,mode:'decimal',half:1},
   {id:'tn',label:'Note (optional)',ph:'e.g. Bill payment',max:40,half:1}],
  noLabel:true,
  build:function(v){
    var name=clean(v.pn),id=clean(v.pa).toLowerCase(),amt=clean(v.am),e={};
    if(!name)e.pn='Naam daalo.';
    if(!id)e.pa='UPI ID daalo.';else if(!VPA.test(id))e.pa='UPI ID galat lag raha hai. Aisa hona chahiye: name@bank (space nahi).';
    if(amt){if(!/^\d{1,6}(\.\d{1,2})?$/.test(amt))e.am='Amount number me likho, jaise 250 ya 99.50.';
      else if(parseFloat(amt)<=0)e.am='Amount 0 se zyada hona chahiye.';
      else if(parseFloat(amt)>100000)e.am='UPI me ek payment ki limit Rs 1,00,000 hai.'}
    if(e.pn||e.pa||e.am)return {err:e};
    var a=amt?parseFloat(amt).toFixed(2).replace(/\.00$/,''):'';
    var u='upi://pay?pa='+enc(id)+'&pn='+enc(name)+'&cu=INR';if(a)u+='&am='+enc(a);if(clean(v.tn))u+='&tn='+enc(clean(v.tn));
    return {payload:u,gist:'UPI ID: '+id,gist2:a?'Rs '+Number(a).toLocaleString('en-IN',{minimumFractionDigits:a.indexOf('.')>-1?2:0}):'',caption:'SCAN & PAY',label:name,foot:'GPay  |  PhonePe  |  Paytm  |  BHIM  |  any UPI app',kind:'UPI'};
  }},
 {id:'wa',label:'WhatsApp',hint:'Scan karte hi aapke number par WhatsApp chat khulega (optional message ke saath).',
  fields:[
   {id:'ph',label:'WhatsApp number',ph:'e.g. 9876543210 ya +91 98765 43210',max:20,mode:'tel',req:1},
   {id:'ms',label:'Pehle se likha message (optional)',ph:'e.g. Hi, mujhe booking karni hai',max:200,area:true}],
  build:function(v){
    var p=phoneDigits(v.ph,'91');if(p.err)return {err:{ph:p.err}};
    var u='https://wa.me/'+p.digits;var m=clean(v.ms);if(m)u+='?text='+enc(m);
    return {payload:u,gist:'+'+p.digits,caption:'SCAN TO CHAT',foot:CHIP,kind:'WhatsApp'};
  }},
 {id:'phone',label:'Phone',hint:'Scan karte hi call lagane ka option aayega.',
  fields:[{id:'ph',label:'Phone number',ph:'e.g. 9876543210',max:20,mode:'tel'}],
  build:function(v){var p=phoneDigits(v.ph,'91');if(p.err)return {err:{ph:p.err}};
    return {payload:'tel:+'+p.digits,gist:'+'+p.digits,caption:'SCAN TO CALL',foot:CHIP,kind:'Phone'}}},
 {id:'wifi',label:'Wi-Fi',hint:'Scan karke seedha Wi-Fi se jud jao. Password QR ke andar hota hai, isliye card par nahi likha jata. QR sirf bharosemand logon ko do.',
  fields:[
   {id:'ss',label:'Wi-Fi ka naam (SSID)',ph:'e.g. Home_WiFi',max:32,req:1},
   {id:'pw',label:'Password',ph:'Khali = open network',max:63,half:1},
   {id:'sec',label:'Security',select:['WPA','WEP','nopass'],half:1}],
  build:function(v){
    var ss=String(v.ss||'').trim(),pw=String(v.pw||''),sec=v.sec||'WPA';
    if(!ss)return {err:{ss:'Wi-Fi ka naam daalo.'}};
    if(sec!=='nopass'&&!pw)sec='nopass';
    var u='WIFI:T:'+(sec==='nopass'?'nopass':sec)+';S:'+wifiEsc(ss)+';'+(sec==='nopass'?'':'P:'+wifiEsc(pw)+';')+';';
    return {payload:u,gist:'Wi-Fi: '+ss,caption:'SCAN TO JOIN WI-FI',label:'',foot:CHIP,kind:'Wi-Fi'};
  }},
 {id:'vcard',label:'Contact',hint:'Scan karke contact phone me save ho jayega.',
  fields:[
   {id:'nm',label:'Naam',ph:'e.g. Akash Vishwakarma',max:60,req:1},
   {id:'ph',label:'Phone',ph:'e.g. 9876543210',max:20,mode:'tel',half:1},
   {id:'em',label:'Email',ph:'e.g. name@example.com',max:80,mode:'email',half:1},
   {id:'og',label:'Company / kaam (optional)',ph:'e.g. Linux Admin',max:60}],
  noLabel:true,
  build:function(v){
    var nm=clean(v.nm),e={};if(!nm)e.nm='Naam daalo.';
    var ph=clean(v.ph),em=clean(v.em),p;
    if(ph){p=phoneDigits(ph,'91');if(p.err)e.ph=p.err}
    if(em&&!EMAIL.test(em))e.em='Email sahi nahi lag raha.';
    if(!ph&&!em&&!e.nm)e.ph='Phone ya email me se ek daalo.';
    if(Object.keys(e).length)return {err:e};
    var s='BEGIN:VCARD\nVERSION:3.0\nFN:'+vEsc(nm)+'\nN:'+vEsc(nm)+';;;;\n';
    if(clean(v.og))s+='ORG:'+vEsc(clean(v.og))+'\n';
    if(p)s+='TEL:+'+p.digits+'\n';if(em)s+='EMAIL:'+em+'\n';s+='END:VCARD';
    return {payload:s,gist:p?'+'+p.digits:em,caption:'SAVE CONTACT',label:nm,sub:clean(v.og),foot:CHIP,kind:'Contact'};
  }},
 {id:'email',label:'Email',hint:'Scan karte hi email likhne ka screen khulega.',
  fields:[{id:'em',label:'Email address',ph:'e.g. name@example.com',max:80,mode:'email',req:1},
   {id:'su',label:'Subject (optional)',ph:'e.g. Enquiry',max:100},
   {id:'bd',label:'Message (optional)',ph:'',max:300,area:true}],
  build:function(v){
    var em=clean(v.em);if(!EMAIL.test(em))return {err:{em:'Email sahi nahi lag raha.'}};
    var u='mailto:'+em,q=[];if(clean(v.su))q.push('subject='+enc(clean(v.su)));if(clean(v.bd))q.push('body='+enc(clean(v.bd)));
    if(q.length)u+='?'+q.join('&');
    return {payload:u,gist:em,caption:'SCAN TO EMAIL',foot:CHIP,kind:'Email'};
  }},
 {id:'text',label:'Text',hint:'Koi bhi text. Scan karne wale ko wahi text dikhega. Hindi bhi chalega.',
  fields:[{id:'tx',label:'Text',ph:'Kuch bhi likho...',max:900,area:true,req:1}],
  build:function(v){
    var t=String(v.tx||'').trim();if(!t)return {empty:true};
    return {payload:t,gist:short(clean(t),48),caption:'SCAN TO READ',foot:CHIP,kind:'Text'};
  }}
];
function byId(id){for(var i=0;i<TYPES.length;i++)if(TYPES[i].id===id)return TYPES[i];if(id==='video')return byId('link');if(id==='upiraw')return byId('upi')}
function detect(s){
  var t=s.trim();
  if(/^upi:\/\//i.test(t))return 'upiraw';
  if(/^WIFI:/i.test(t))return 'wifiraw';
  if(/^BEGIN:VCARD/i.test(t))return 'vcard';
  if(/^(tel|sms|smsto|mailto|geo|matmsg):/i.test(t))return 'raw';
  if(/^https?:\/\/\S+$/i.test(t))return 'link';
  if(/^[a-z][a-z0-9+.\-]*:\/\//i.test(t))return 'raw';
  if(VPA.test(t))return 'upi';
  if(EMAIL.test(t))return 'email';
  if(DOMAIN.test(t))return 'link';
  if(/^\+?[\d][\d\s\-()]{7,17}$/.test(t)&&t.replace(/\D/g,'').length>=8&&t.replace(/\D/g,'').length<=15)return 'phone';
  return 'text';
}
function rawUpi(s){
  var q={};try{new URL(s).searchParams.forEach(function(v,k){q[k]=v})}catch(e){return {err:{any:'UPI link sahi nahi hai.'}}}
  if(!q.pa||!VPA.test(q.pa))return {err:{any:'UPI link me UPI ID nahi mili.'}};
  return {payload:s.trim(),gist:'UPI ID: '+q.pa,gist2:q.am?'Rs '+q.am:'',caption:'SCAN & PAY',label:q.pn||'',foot:'GPay  |  PhonePe  |  Paytm  |  BHIM  |  any UPI app',kind:'UPI',detected:'UPI payment'};
}

// ---------- QR styles ----------
// All styles: dark modules on a light panel. Contrast is checked in the app and in tests.
var STYLES=[
 {id:'neon',name:'Neon Grid',shape:'square',bg:['#060813','#1a0b3b'],ink:'#ffffff',sub:'#a9b4ff',chip:'#1b1f45',chipInk:'#7df9ff',glow:['#00e5ff','#d946ef'],
  mod:['#07123f','#2a0a5e'],eyeOut:'#07123f',eyeIn:'#86198f',panel:'#ffffff',deco:'grid'},
 {id:'aurora',name:'Aurora',shape:'round',k:.12,eyeR:.6,ov:1.04,bg:['#6d5dfc','#14b8a6'],ink:'#ffffff',sub:'rgba(255,255,255,.9)',chip:'rgba(255,255,255,.22)',chipInk:'#ffffff',glow:['#ffffff','#ffffff'],
  mod:['#2e1a9a','#0b5f73'],eyeOut:'#2e1a9a',eyeIn:'#0b5f73',panel:'#ffffff',deco:'orbs'},
 {id:'mono',name:'Mono Pro',shape:'dot',dr:.62,eyeR:.35,bg:['#ffffff','#eef0f6'],ink:'#0b0d1a',sub:'#5a6078',chip:'#e8eaf3',chipInk:'#2b2f4a',glow:['#c9ceea','#c9ceea'],
  mod:['#0b0d1a','#0b0d1a'],eyeOut:'#0b0d1a',eyeIn:'#0b0d1a',panel:'#ffffff',deco:'brackets',border:'#d5d9ec'},
 {id:'sunset',name:'Sunset Pulse',shape:'round',k:.12,eyeR:.6,ov:1.04,bg:['#ff6a5c','#ffb84d'],ink:'#2a0c1f',sub:'rgba(42,12,31,.82)',chip:'rgba(255,255,255,.55)',chipInk:'#2a0c1f',glow:['#ffffff','#ffffff'],
  mod:['#6b0f3c','#2d0a56'],eyeOut:'#6b0f3c',eyeIn:'#2d0a56',panel:'#ffffff',deco:'rings'}
];
var QUIET=4;
function lum(hex){var h=hex.replace('#','');var c=[0,2,4].map(function(i){var v=parseInt(h.substr(i,2),16)/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function contrast(a,b){var x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function minContrast(st){return Math.min.apply(null,[st.mod[0],st.mod[1],st.eyeOut,st.eyeIn].map(function(c){return contrast(c,st.panel)}))}

function inEye(r,c,n){return (r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7)}
function eyePath(x,y,rad){ // 7x7 ring (evenodd) and 3x3 core
  function rr(x,y,w,h,r){return 'M'+(x+r)+' '+y+'h'+(w-2*r)+'a'+r+' '+r+' 0 0 1 '+r+' '+r+'v'+(h-2*r)+'a'+r+' '+r+' 0 0 1 -'+r+' '+r+'h-'+(w-2*r)+'a'+r+' '+r+' 0 0 1 -'+r+' -'+r+'v-'+(h-2*r)+'a'+r+' '+r+' 0 0 1 '+r+' -'+r+'z'}
  return {ring:rr(x,y,7,7,rad)+rr(x+1,y+1,5,5,Math.max(rad-1,0.01)),core:rr(x+2,y+2,3,3,Math.max(rad-1,0.01))};
}
function qrSvg(q,st,opts){
  opts=opts||{};var n=q.getModuleCount(),T=n+QUIET*2,id=opts.uid||('g'+st.id);
  var d='',o=QUIET;
  for(var r=0;r<n;r++)for(var c=0;c<n;c++){
    if(!q.isDark(r,c)||inEye(r,c,n))continue;
    var x=o+c,y=o+r;
    if(st.shape==='dot'){var rd=st.dr||.47;d+='M'+(x+.5-rd)+' '+(y+.5)+'a'+rd+' '+rd+' 0 1 0 '+(2*rd)+' 0a'+rd+' '+rd+' 0 1 0 -'+(2*rd)+' 0z'}
    else if(st.shape==='round'){var k=st.k==null?.3:st.k,s=st.ov||1.02;d+='M'+(x+k)+' '+y+'h'+(s-2*k)+'a'+k+' '+k+' 0 0 1 '+k+' '+k+'v'+(s-2*k)+'a'+k+' '+k+' 0 0 1 -'+k+' '+k+'h-'+(s-2*k)+'a'+k+' '+k+' 0 0 1 -'+k+' -'+k+'v-'+(s-2*k)+'a'+k+' '+k+' 0 0 1 '+k+' -'+k+'z'}
    else d+='M'+x+' '+y+'h'+(st.ov||1.02)+'v'+(st.ov||1.02)+'h-'+(st.ov||1.02)+'z';
  }
  var rad=st.eyeR==null?(st.shape==='square'?0.6:(st.shape==='dot'?2.4:2)):st.eyeR;
  var eyes=[[o,o],[o+n-7,o],[o,o+n-7]].map(function(p){var e=eyePath(p[0],p[1],rad);
    return '<path d="'+e.ring+'" fill="'+st.eyeOut+'" fill-rule="evenodd"/><path d="'+e.core+'" fill="'+st.eyeIn+'"/>'}).join('');
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+T+' '+T+'" width="'+(opts.px||T*10)+'" height="'+(opts.px||T*10)+'" shape-rendering="geometricPrecision">'+
   '<defs><linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="'+T+'" y2="'+T+'"><stop offset="0" stop-color="'+st.mod[0]+'"/><stop offset="1" stop-color="'+st.mod[1]+'"/></linearGradient></defs>'+
   '<rect width="'+T+'" height="'+T+'" rx="'+(opts.round===false?0:2.2)+'" fill="'+st.panel+'"/>'+
   '<path d="'+d+'" fill="url(#'+id+')"/>'+eyes+'</svg>';
  return svg;
}

// ---------- state ----------
var S={type:'auto',style:'neon',vals:{},label:'',sub:''};
var cur=null,gen=0;

function renderTypes(){
  var h='';TYPES.forEach(function(t){h+='<button type="button" class="ty" data-t="'+t.id+'" aria-pressed="'+(t.id===S.type)+'">'+esc(t.label)+'</button>'});
  $('types').innerHTML=h;
}
function renderFields(){
  var T=byId(S.type),h='',half=false;
  T.fields.forEach(function(f,i){
    var val=S.vals[T.id+'.'+f.id]||'';
    var open=f.half&&!half,close=half&&!f.half;
    if(close){h+='</div>';half=false}
    if(open){h+='<div class="two">';half=true}
    h+='<div><label for="f_'+f.id+'">'+esc(f.label)+'</label>';
    if(f.select){h+='<select id="f_'+f.id+'" data-f="'+f.id+'">'+f.select.map(function(o){return '<option value="'+o+'"'+(val===o?' selected':'')+'>'+(o==='nopass'?'Koi password nahi':o)+'</option>'}).join('')+'</select>'}
    else if(f.area)h+='<textarea id="f_'+f.id+'" data-f="'+f.id+'" rows="3" maxlength="'+(f.max||500)+'" placeholder="'+esc(f.ph||'')+'">'+esc(val)+'</textarea>';
    else h+='<input id="f_'+f.id+'" data-f="'+f.id+'" type="text" maxlength="'+(f.max||100)+'" placeholder="'+esc(f.ph||'')+'"'+(f.mode?' inputmode="'+f.mode+'"':'')+' autocapitalize="off" spellcheck="false" value="'+esc(val)+'">';
    h+='<div class="err" id="e_'+f.id+'" role="alert"></div></div>';
    if(f.half&&(i===T.fields.length-1)){h+='</div>';half=false}
  });
  if(half)h+='</div>';
  h+='<p class="hint">'+esc(T.hint)+'</p><div class="detect" id="detect"></div>';
  $('fields').innerHTML=h;
  $('labelBox').style.display=T.noLabel?'none':'';
}
function renderThumbs(){
  var h='';STYLES.forEach(function(st){h+='<button type="button" class="th" data-s="'+st.id+'" aria-pressed="'+(st.id===S.style)+'" aria-label="Style '+esc(st.name)+'"><canvas width="270" height="375"></canvas><span>'+esc(st.name)+'</span></button>'});
  $('thumbs').innerHTML=h;
}

function currentResult(){
  var T=byId(S.type),vals={};
  T.fields.forEach(function(f){var el=$('f_'+f.id);vals[f.id]=el?el.value:''});
  return {T:T,vals:vals,r:T.build(vals)};
}
function showErrors(T,r,touched){
  T.fields.forEach(function(f){var e=$('e_'+f.id),inp=$('f_'+f.id);if(!e)return;
    var m=(r&&r.err&&r.err[f.id])||'';var show=m&&touched[f.id];e.textContent=show?m:'';if(inp)inp.classList.toggle('bad',!!show)});
}
var touched={};

// ---------- drawing ----------
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
var FONT='system-ui,"Segoe UI","Noto Sans","Noto Sans Devanagari",sans-serif';
function fit(ctx,text,maxW,start,weight,min){var s=start;do{ctx.font=weight+' '+s+'px '+FONT;s-=2}while(ctx.measureText(text).width>maxW&&s>(min||26));return ctx.measureText(text).width<=maxW}
function wrapFit(ctx,text,maxW,start,weight,lines){ // shrink then wrap to <= lines
  var s=start;
  for(;s>=40;s-=4){ctx.font=weight+' '+s+'px '+FONT;var ls=wrap(ctx,text,maxW);if(ls.length<=lines&&(ls.length===1||s<=start))return {size:s,lines:ls}}
  ctx.font=weight+' 40px '+FONT;var l=wrap(ctx,text,maxW);return {size:40,lines:l.slice(0,lines)}
}
function wrap(ctx,text,maxW){var words=text.split(' '),out=[],line='';words.forEach(function(w){var t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w}else line=t});if(line)out.push(line);return out}

function decorate(ctx,st,W,H){
  ctx.save();
  if(st.deco==='grid'){
    ctx.strokeStyle='rgba(0,229,255,.07)';ctx.lineWidth=2;
    for(var x=0;x<=W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}
    for(var y=0;y<=H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
    var g=ctx.createRadialGradient(W*.15,H*.1,10,W*.15,H*.1,520);g.addColorStop(0,'rgba(217,70,239,.35)');g.addColorStop(1,'rgba(217,70,239,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    g=ctx.createRadialGradient(W*.9,H*.95,10,W*.9,H*.95,560);g.addColorStop(0,'rgba(0,229,255,.28)');g.addColorStop(1,'rgba(0,229,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }else if(st.deco==='orbs'){
    [[.1,.08,420,.22],[.95,.55,380,.16],[.2,.97,460,.2]].forEach(function(o){var g=ctx.createRadialGradient(W*o[0],H*o[1],0,W*o[0],H*o[1],o[2]);g.addColorStop(0,'rgba(255,255,255,'+o[3]+')');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)});
  }else if(st.deco==='brackets'){
    ctx.strokeStyle='#0b0d1a';ctx.lineWidth=10;ctx.lineCap='round';var m=40,l=60;
    [[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(function(p){ctx.beginPath();ctx.moveTo(p[0],p[1]+p[3]*l);ctx.lineTo(p[0],p[1]);ctx.lineTo(p[0]+p[2]*l,p[1]);ctx.stroke()});
  }else if(st.deco==='rings'){
    ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=3;
    for(var i=1;i<=6;i++){ctx.beginPath();ctx.arc(W*.5,H*.38,300+i*90,0,Math.PI*2);ctx.stroke()}
  }
  ctx.restore();
}
function card(ctx,st,res,W,H,done,k){
  k=k||1;ctx.save();ctx.scale(k,k);
  var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,st.bg[0]);g.addColorStop(1,st.bg[1]);
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);decorate(ctx,st,W,H);
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillStyle=st.sub;ctx.font='700 38px '+FONT;
  if(ctx.letterSpacing!==undefined)ctx.letterSpacing='6px';ctx.fillText(res.caption||'SCAN ME',W/2,140);if(ctx.letterSpacing!==undefined)ctx.letterSpacing='0px';
  var label=res.label||'',y=235,extra=0;
  if(label){
    ctx.fillStyle=st.ink;var wf=wrapFit(ctx,label,W-160,86,'800',2);ctx.font='800 '+wf.size+'px '+FONT;
    wf.lines.forEach(function(l,i){ctx.fillText(l,W/2,y+i*(wf.size+8))});extra=(wf.lines.length-1)*(wf.size+8);y+=extra;
  }else{ctx.fillStyle=st.ink;ctx.font='800 70px '+FONT;ctx.fillText(res.kind==='Wi-Fi'?'Wi-Fi':(res.kind||'QR'),W/2,y)}
  if(res.sub){ctx.fillStyle=st.sub;fit(ctx,res.sub,W-200,40,'500');ctx.fillText(res.sub,W/2,y+62)}
  var ps=extra>0?700:780,py=(res.sub?345:315)+extra,px=(W-ps)/2;
  // glow + panel
  ctx.save();
  if(st.id==='neon'){var gg=ctx.createLinearGradient(px,py,px+ps,py+ps);gg.addColorStop(0,st.glow[0]);gg.addColorStop(1,st.glow[1]);ctx.shadowColor='rgba(0,229,255,.55)';ctx.shadowBlur=36;ctx.fillStyle=gg;rrect(ctx,px-6,py-6,ps+12,ps+12,62);ctx.fill();}
  else if(st.border){ctx.shadowColor='rgba(11,13,26,.18)';ctx.shadowBlur=40;ctx.shadowOffsetY=16;ctx.fillStyle='#fff';rrect(ctx,px,py,ps,ps,56);ctx.fill();ctx.shadowColor='transparent';ctx.lineWidth=4;ctx.strokeStyle=st.border;rrect(ctx,px,py,ps,ps,56);ctx.stroke()}
  else{ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=50;ctx.shadowOffsetY=22;ctx.fillStyle='#fff';rrect(ctx,px,py,ps,ps,56);ctx.fill()}
  ctx.restore();
  var img=new Image();
  img.onload=function(){ctx.save();ctx.scale(k,k);ctx.drawImage(img,px,py,ps,ps);tail();ctx.restore();done&&done()};
  img.onerror=function(){done&&done(new Error('svg'))};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qrSvg(res.q,st,{px:ps,uid:'c'+st.id}));
  ctx.restore();
  function tail(){
    ctx.textAlign='center';ctx.textBaseline='alphabetic';if(ctx.letterSpacing!==undefined)ctx.letterSpacing='0px';
    var y2=py+ps+105;
    if(res.gist2){ctx.fillStyle=st.ink;ctx.font='800 86px '+FONT;ctx.fillText(res.gist2,W/2,y2);y2+=62}
    if(res.gist){ctx.fillStyle=st.sub;fit(ctx,res.gist,W-160,44,'600');ctx.fillText(res.gist,W/2,y2)}
    ctx.fillStyle=st.chip;rrect(ctx,110,H-170,W-220,86,43);ctx.fill();
    ctx.fillStyle=st.chipInk;fit(ctx,res.foot||CHIP,W-300,34,'700');ctx.fillText(res.foot||CHIP,W/2,H-115);
  }
}

function render(){
  var c=currentResult(),T=c.T,r=c.r;
  showErrors(T,r,touched);
  var ok=r&&!r.err&&!r.empty;
  var det=$('detect');det.textContent=ok&&r.detected?'\u2713 Pehchana: '+r.detected:'';
  if(ok){
    var bytes=(new TextEncoder()).encode(r.payload).length;
    if(bytes>1000){ok=false;r={err:{}};var f=T.fields[0];touched[f.id]=1;var e=$('e_'+f.id);if(e)e.textContent='Bahut lamba hai ('+bytes+' bytes). 1000 se kam rakho taaki QR aasani se scan ho.'}
  }
  var buttons=['dlPng','dlQr','dlSvg','share','copy','print'];
  buttons.forEach(function(id){$(id).disabled=!ok});
  $('stage').classList.toggle('ready',ok);
  $('thumbs').style.display=ok?'':'none';$('scanBadge').hidden=!ok;
  if(!ok){cur=null;return}
  var q;try{q=QRCore.make(r.payload,'M')}catch(ex){cur=null;buttons.forEach(function(id){$(id).disabled=true});$('stage').classList.remove('ready');$('thumbs').style.display='none';$('scanBadge').hidden=true;var f0=T.fields[0],e0=$('e_'+f0.id);if(e0)e0.textContent='Ye content QR me nahi aa raha, thoda chhota karo.';return}
  if(!T.noLabel){r.label=clean($('lb').value)||r.label||'';r.sub=clean($('sb').value)||r.sub||''}
  r.q=q;cur=r;
  var my=++gen;
  var st=getStyle(S.style),cv=$('cv');cv.width=1080;cv.height=1500;
  card(cv.getContext('2d'),st,r,1080,1500,function(){});
  document.querySelectorAll('.th').forEach(function(b){
    if(my!==gen)return;var s=getStyle(b.dataset.s),cc=b.querySelector('canvas'),x=cc.getContext('2d');
    x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,270,375);card(x,s,r,1080,1500,function(){},.25);
  });
  var mc=minContrast(st),ver=q.getModuleCount();
  var b=$('scanBadge');b.className='scanbadge'+(mc<4.5?' warn':'');
  b.textContent=(mc<4.5?'\u26A0 Contrast kam hai. ':'\u2713 Scan-safe: ')+'contrast '+mc.toFixed(1)+':1, QR '+ver+'x'+ver;
  save();
}
function getStyle(id){for(var i=0;i<STYLES.length;i++)if(STYLES[i].id===id)return STYLES[i];return STYLES[0]}

// ---------- events ----------
var timer;
function schedule(){clearTimeout(timer);timer=setTimeout(render,120)}
$('types').addEventListener('click',function(e){
  var b=e.target.closest('.ty');if(!b)return;
  readVals();S.type=b.dataset.t;touched={};renderTypes();renderFields();render();
});
function readVals(){
  var T=byId(S.type);T.fields.forEach(function(f){var el=$('f_'+f.id);if(el)S.vals[T.id+'.'+f.id]=el.value});
}
$('fields').addEventListener('input',function(e){if(e.target.dataset.f)touched[e.target.dataset.f]=touched[e.target.dataset.f]||false;readVals();schedule()});
$('fields').addEventListener('change',function(){readVals();render()});
$('fields').addEventListener('focusout',function(e){if(e.target.dataset&&e.target.dataset.f){touched[e.target.dataset.f]=1;render()}});
['lb','sb'].forEach(function(id){$(id).addEventListener('input',function(){S.label=$('lb').value;S.sub=$('sb').value;schedule()})});
$('thumbs').addEventListener('click',function(e){var b=e.target.closest('.th');if(!b)return;S.style=b.dataset.s;document.querySelectorAll('.th').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});render()});
$('form').addEventListener('submit',function(e){e.preventDefault()});
$('remember').addEventListener('change',save);

function toast(m){var t=$('toast');t.textContent=m;clearTimeout(toast.t);toast.t=setTimeout(function(){t.textContent=''},2800)}
function slug(){var b=(cur&&(cur.label||cur.gist)||'qr');return 'qr-'+(String(b).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'code')}
function dlBlob(blob,name){var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);toast('Download ho gaya')}
function cardCanvas(styleId,cb){var c=document.createElement('canvas');c.width=1080;c.height=1500;card(c.getContext('2d'),getStyle(styleId),cur,1080,1500,function(err){cb(err?null:c)})}
function qrCanvas(styleId,cb){
  var st=getStyle(styleId),S2=1200,c=document.createElement('canvas');c.width=c.height=S2;var x=c.getContext('2d'),img=new Image();
  img.onload=function(){x.fillStyle='#fff';x.fillRect(0,0,S2,S2);x.drawImage(img,0,0,S2,S2);cb(c)};
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qrSvg(cur.q,st,{px:S2,uid:'d',round:false}));
}
$('dlPng').addEventListener('click',function(){if(!cur)return;cardCanvas(S.style,function(c){c&&c.toBlob(function(b){dlBlob(b,slug()+'-'+S.style+'.png')},'image/png')})});
$('dlQr').addEventListener('click',function(){if(!cur)return;qrCanvas(S.style,function(c){c.toBlob(function(b){dlBlob(b,slug()+'-'+S.style+'-only-qr.png')},'image/png')})});
$('dlSvg').addEventListener('click',function(){if(!cur)return;dlBlob(new Blob([qrSvg(cur.q,getStyle(S.style),{px:1200,uid:'s',round:false})],{type:'image/svg+xml'}),slug()+'-'+S.style+'.svg')});
$('print').addEventListener('click',function(){if(cur)window.print()});
function copyText(t,msg){
  var done=function(){toast(msg)};
  function fb(){var a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();try{document.execCommand('copy');done()}catch(e){toast('Copy allowed nahi hai')}a.remove()}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,fb);else fb();
}
$('copy').addEventListener('click',function(){if(cur)copyText(cur.payload,'Link copy ho gaya')});
$('share').addEventListener('click',function(){
  if(!cur)return;
  cardCanvas(S.style,function(c){
    if(!c)return;
    c.toBlob(function(b){
      var f=new File([b],slug()+'.png',{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:cur.label||'QR code'}).catch(function(){})}
      else if(navigator.share){navigator.share({title:cur.label||'QR code',text:cur.payload}).catch(function(){})}
      else{dlBlob(b,slug()+'.png');toast('Share is device par nahi hai, PNG download kar di')}
    },'image/png');
  });
});

// ---------- remember ----------
function save(){
  try{
    if($('remember').checked)localStorage.setItem('qrs',JSON.stringify({type:S.type,style:S.style,vals:S.vals,lb:$('lb').value,sb:$('sb').value}));
    else localStorage.removeItem('qrs');
    localStorage.setItem('qrs_rem',$('remember').checked?'1':'');
  }catch(e){}
}
function load(){
  try{
    if(localStorage.getItem('qrs_rem')==='1'){
      $('remember').checked=true;var d=JSON.parse(localStorage.getItem('qrs')||'{}');
      if(d.type&&byId(d.type))S.type=d.type;if(d.style)S.style=d.style;S.vals=d.vals||{};$('lb').value=d.lb||'';$('sb').value=d.sb||'';
    }else{
      // migrate old UPI-only app data
      if(localStorage.getItem('upiqr_rem')==='1'){var o=JSON.parse(localStorage.getItem('upiqr')||'{}');
        S.type='upi';S.vals={'upi.pn':o.pn||'','upi.pa':o.pa||'','upi.am':o.am||'','upi.tn':o.tn||''};$('remember').checked=true}
    }
  }catch(e){}
  var p=new URLSearchParams(location.search);
  if(p.get('pa')){S.type='upi';S.vals['upi.pa']=p.get('pa');S.vals['upi.pn']=p.get('pn')||S.vals['upi.pn']||'';S.vals['upi.am']=p.get('am')||'';S.vals['upi.tn']=p.get('tn')||''}
  if(!getStyle(S.style)||!STYLES.some(function(s){return s.id===S.style}))S.style='neon';
}
$('notice').innerHTML='<b>Dhyan do:</b> QR sirf wahi cheez kholta hai jo uske andar likhi hai. UPI QR me paisa seedha customer se aapke UPI ID par jata hai, yahan koi payment nahi hoti. Print karne se pehle apne phone se ek baar scan karke dekh lo. Photo/video ki file QR me nahi jaati, uska link jaata hai.';
load();renderTypes();renderFields();renderThumbs();render();
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0)navigator.serviceWorker.register('sw.js').catch(function(){});
window.QRS={TYPES:TYPES,STYLES:STYLES,detect:detect,qrSvg:qrSvg,minContrast:minContrast,cur:function(){return cur},
  setType:function(t,vals,lb,sb){S.type=t;S.vals={};Object.keys(vals||{}).forEach(function(k){S.vals[t+'.'+k]=vals[k]});$('lb').value=lb||'';$('sb').value=sb||'';touched={};renderTypes();renderFields();render()},
  setStyle:function(id){S.style=id;render()},
  cardPng:function(id){return new Promise(function(res){cardCanvas(id,function(c){res(c.toDataURL('image/png'))})})},
  qrPng:function(id){return new Promise(function(res){qrCanvas(id,function(c){res(c.toDataURL('image/png'))})})},
  svg:function(id){return qrSvg(cur.q,getStyle(id),{px:1200,uid:'s',round:false})}};
})();

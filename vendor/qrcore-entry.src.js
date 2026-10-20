const QR=require('qrcode/lib/core/qrcode');
window.QRCore={make:function(text,ecl){var q=QR.create(text,{errorCorrectionLevel:ecl||'M'});var m=q.modules,n=m.size;return {getModuleCount:function(){return n},isDark:function(r,c){return !!m.get(r,c)},version:q.version}}};

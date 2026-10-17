// Semantic color contract, independent of CSS layout implementation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../viewer/src/experience.css',import.meta.url),'utf8');
const token=name=>{const m=css.match(new RegExp(`--${name}: (#\\w{6})`));assert(m,`Missing ${name}`);return m[1];};
const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const ratio=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (values[1]+.05)/(values[0]+.05);};
const result=[];
for(const bg of ['bg','surface','raised','hover']) {
  for(const fg of ['text','muted','accent']) {const contrast=ratio(token(fg),token(bg));assert(contrast>=4.5,`${fg}/${bg}: ${contrast}`);result.push({fg,bg,contrast});}
  for(const fg of ['border','focus']) {const contrast=ratio(token(fg),token(bg));assert(contrast>=3,`${fg}/${bg}: ${contrast}`);result.push({fg,bg,contrast});}
}
console.log(JSON.stringify({pass:true,scope:'declared opaque palette pairs; disabled controls excluded; browser compositing checked separately',result},null,2));

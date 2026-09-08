/**
 * RIFT Core - Effects & Shaders Engine
 * 65+ Algorithmic Effects: Glitch, Distortion, Mirror Lab symmetries,
 * Pixel Sorting, Color Science, Conformal Geometry, and 3D Projections.
 */

import { luma, clamp, hsl2rgb, rgb2hsl, px, bl, sp, mkId, hash, vnoise, fbm, PALETTES, toPolar, fromPolar, c_mul, c_div, c_exp, mobius } from './math.js';
import { copyImageData } from './transforms.js';

export const EFFECTS = {
// ── GLITCH ──────────────────────────────────────────────────
  scanline_tear:{cat:'glitch',name:'Scanline Tear',
    desc:'Randomly offsets horizontal scanlines simulating VHS/CRT signal loss. Dir bias controls left vs right tearing (0=all left, 0.5=balanced, 1=all right).',
    math:'x′=x+dir(bias)·offset(intensity), gated by frequency threshold',
    presets:[{name:'subtle',p:{intensity:8,freq:8,bias:.5,seed:1}},{name:'medium',p:{intensity:22,freq:20,bias:.5,seed:42}},{name:'heavy',p:{intensity:60,freq:40,bias:.8,seed:77}},{name:'sparse',p:{intensity:45,freq:4,bias:.6,seed:13}}],
    params:[
    {id:'intensity',label:'intensity',min:0,max:80,step:.5,def:22},
    {id:'freq',label:'frequency',min:1,max:100,step:1,def:20},
    {id:'bias',label:'dir bias (0=L 1=R)',min:0,max:1,step:.01,def:.5},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:42},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const b=p.bias!==undefined?p.bias:0.5;
    for(let y=0;y<h;y++){
      if(rn()*100<p.freq){
        const dir=rn()<b?1:-1;
        const off=Math.round(dir*rn()*p.intensity);
        for(let x=0;x<w;x++){
          const sx=Math.max(0,Math.min(w-1,x+off));
          const si=(y*w+sx)*4,di=(y*w+x)*4;
          for(let k=0;k<3;k++)dst.data[di+k]=src.data[si+k];
        }
      }
    }
    return dst;
  }},
  channel_shift:{cat:'glitch',name:'Channel Shift',
    desc:'Displaces R and B colour channels independently from G, creating chromatic aberration and fringing.',
    math:'R(x+dx_r,y+dy_r) · G(x,y) · B(x+dx_b,y+dy_b)',
    presets:[{name:'classic CA',p:{rx:12,ry:0,bx:-12,by:0}},{name:'diagonal',p:{rx:8,ry:8,bx:-8,by:-8}},{name:'vertical',p:{rx:0,ry:16,bx:0,by:-16}},{name:'extreme',p:{rx:40,ry:5,bx:-40,by:-5}}],
    params:[
    {id:'rx',label:'R shift x',min:-80,max:80,step:.5,def:14},
    {id:'ry',label:'R shift y',min:-40,max:40,step:.5,def:0},
    {id:'bx',label:'B shift x',min:-80,max:80,step:.5,def:-14},
    {id:'by',label:'B shift y',min:-40,max:40,step:.5,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const di=(y*w+x)*4;
      const[ri]=px(src.data,w,h,x+p.rx,y+p.ry);
      const[,gi]=px(src.data,w,h,x,y);
      const[,,bi]=px(src.data,w,h,x+p.bx,y+p.by);
      dst.data[di]=ri;dst.data[di+1]=gi;dst.data[di+2]=bi;dst.data[di+3]=255;
    }
    return dst;
  }},
  block_shuffle:{cat:'glitch',name:'Block Shuffle',
    desc:'Divides image into rectangular tiles and randomly swaps them — like corrupted memory pages.',
    math:'tile(bx,by) ↔ tile(rng(seed)) with probability p',
    presets:[{name:'fine',p:{bsize:6,prob:.3,seed:1}},{name:'medium',p:{bsize:16,prob:.3,seed:7}},{name:'coarse',p:{bsize:40,prob:.2,seed:3}},{name:'chaos',p:{bsize:8,prob:.8,seed:99}}],
    params:[
    {id:'bsize',label:'block size',min:4,max:80,step:2,def:16},
    {id:'prob',label:'probability',min:0,max:1,step:.01,def:.3},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:7},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const bs=p.bsize|0,cols=Math.ceil(w/bs),rows=Math.ceil(h/bs);
    for(let by=0;by<rows;by++)for(let bx=0;bx<cols;bx++){if(rn()<p.prob){const tx=Math.floor(rn()*cols),ty=Math.floor(rn()*rows);for(let dy=0;dy<bs;dy++)for(let dx=0;dx<bs;dx++){const sx=Math.min(w-1,bx*bs+dx),sy=Math.min(h-1,by*bs+dy),tx2=Math.min(w-1,tx*bs+dx),ty2=Math.min(h-1,ty*bs+dy);const si=(sy*w+sx)*4,di=(ty2*w+tx2)*4;for(let k=0;k<4;k++){const t=dst.data[si+k];dst.data[si+k]=dst.data[di+k];dst.data[di+k]=t;}}}}
    return dst;
  }},
  pixel_scatter:{cat:'glitch',name:'Pixel Scatter',params:[
    {id:'radius',label:'radius',min:0,max:40,step:.5,def:8},
    {id:'prob',label:'probability',min:0,max:1,step:.01,def:.2},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:3},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(rn()<p.prob){const dx=Math.round((rn()-.5)*2*p.radius),dy=Math.round((rn()-.5)*2*p.radius);const tx=Math.max(0,Math.min(w-1,x+dx)),ty=Math.max(0,Math.min(h-1,y+dy));const si=(y*w+x)*4,di=(ty*w+tx)*4;for(let k=0;k<4;k++){const t=dst.data[si+k];dst.data[si+k]=dst.data[di+k];dst.data[di+k]=t;}}}
    return dst;
  }},
  jpeg_artifact:{cat:'glitch',name:'JPEG Artifact',params:[
    {id:'bsize',label:'block size',min:4,max:32,step:4,def:8},
    {id:'quant',label:'quantise',min:1,max:64,step:1,def:16},
    {id:'drift',label:'row drift',min:0,max:1,step:.01,def:.35},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    const bs=p.bsize|0,q=p.quant;let s=13;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    for(let by=0;by<Math.ceil(h/bs);by++)for(let bx=0;bx<Math.ceil(w/bs);bx++){
      let ar=0,ag=0,ab=0,n=0;
      for(let dy=0;dy<bs;dy++)for(let dx=0;dx<bs;dx++){const xi=Math.min(w-1,bx*bs+dx),yi=Math.min(h-1,by*bs+dy);const i=(yi*w+xi)*4;ar+=src.data[i];ag+=src.data[i+1];ab+=src.data[i+2];n++;}
      const qr=Math.round(ar/n/q)*q,qg=Math.round(ag/n/q)*q,qb=Math.round(ab/n/q)*q;
      const shift=p.drift>0&&rn()<p.drift?Math.floor((rn()-.5)*bs*2):0;
      for(let dy=0;dy<bs;dy++)for(let dx=0;dx<bs;dx++){const xi=Math.max(0,Math.min(w-1,bx*bs+dx+shift)),yi=Math.min(h-1,by*bs+dy);const i=(yi*w+xi)*4;dst.data[i]=qr;dst.data[i+1]=qg;dst.data[i+2]=qb;dst.data[i+3]=255;}
    }
    return dst;
  }},
  data_reinterpret:{cat:'glitch',name:'Data Reinterpret',params:[
    {id:'stride',label:'stride',min:1,max:12,step:1,def:3},
    {id:'offset',label:'offset',min:0,max:8,step:1,def:1},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:.75},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const d=src.data,o=dst.data;
    const stride=Math.max(1,p.stride|0),off=p.offset|0;
    for(let i=0;i<d.length;i+=4){
      const j=Math.min(d.length-4,((i/4+off)%(Math.ceil(d.length/4/stride)*stride))*4);
      o[i]=d[i]*(1-p.blend)+d[j]*p.blend;o[i+1]=d[i+1]*(1-p.blend)+d[j+1]*p.blend;
      o[i+2]=d[i+2]*(1-p.blend)+d[j+2]*p.blend;o[i+3]=255;
    }
    return dst;
  }},
  word_corrupt:{cat:'glitch',name:'Word Corrupt',params:[
    {id:'wsize',label:'word size',min:1,max:8,step:1,def:3},
    {id:'prob',label:'probability',min:0,max:1,step:.01,def:.18},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:77},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const ws=Math.max(1,p.wsize|0)*4;
    for(let i=0;i<dst.data.length-ws;i+=ws){if(rn()<p.prob){const j=Math.floor(rn()*(dst.data.length/ws))*ws;for(let k=0;k<ws;k++){const t=dst.data[i+k];dst.data[i+k]=dst.data[j+k];dst.data[j+k]=t;}}}
    return dst;
  }},
  row_duplicate:{cat:'glitch',name:'Row Duplicate',params:[
    {id:'freq',label:'frequency',min:1,max:50,step:1,def:10},
    {id:'len',label:'length',min:1,max:20,step:1,def:4},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:17},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    for(let y=0;y<h;y++){if(rn()*100<p.freq){const sy2=Math.max(0,y-1);for(let rep=0;rep<p.len&&y+rep<h;rep++){const di=((y+rep)*w)*4,si=(sy2*w)*4;for(let x=0;x<w*4;x++)dst.data[di+x]=src.data[si+x];}}}
    return dst;
  }},
// ── DISTORT ─────────────────────────────────────────────────
  wave:{cat:'distort',name:'Wave Distortion',
    desc:'Applies sinusoidal displacement to sampling coordinates, creating a liquid ripple or heat-haze effect.',
    math:'x′=x+Ax·sin(ωy·y+φ),  y′=y+Ay·sin(ωx·x+φ)',
    presets:[{name:'gentle',p:{ax:8,ay:8,fx:.03,fy:.03,phase:0}},{name:'medium',p:{ax:20,ay:20,fx:.04,fy:.04,phase:0}},{name:'wild',p:{ax:50,ay:10,fx:.08,fy:.02,phase:1.57}},{name:'h-only',p:{ax:0,ay:30,fx:0,fy:.06,phase:0}}],
    params:[
    {id:'ax',label:'amplitude x',min:0,max:80,step:.5,def:20},
    {id:'ay',label:'amplitude y',min:0,max:80,step:.5,def:20},
    {id:'fx',label:'frequency x',min:0,max:.15,step:.001,def:.04},
    {id:'fy',label:'frequency y',min:.001,max:.15,step:.001,def:.04},
    {id:'phase',label:'phase',min:0,max:6.28,step:.05,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[r,g,b]=bl(src.data,w,h,x+p.ax*Math.sin(y*p.fy*2*Math.PI+p.phase),y+p.ay*Math.sin(x*p.fx*2*Math.PI+p.phase));sp(dst.data,w,x,y,r,g,b);}
    return dst;
  }},
  swirl:{cat:'distort',name:'Twirl / Swirl',
    desc:'Rotates pixels around a centre point by an angle that decreases with distance, forming a vortex.',
    math:'θ′=θ+angle·(1−r/R), r unchanged',
    presets:[{name:'gentle',p:{angle:1,radius:.5,cx:.5,cy:.5}},{name:'medium',p:{angle:2.5,radius:.5,cx:.5,cy:.5}},{name:'tight',p:{angle:6,radius:.25,cx:.5,cy:.5}},{name:'galaxy',p:{angle:-4,radius:1,cx:.5,cy:.5}}],
    params:[
    {id:'angle',label:'angle',min:-8,max:8,step:.05,def:2.5},
    {id:'radius',label:'radius',min:.05,max:2,step:.01,def:.5},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    const cx=p.cx*w,cy=p.cy*h,R=p.radius*Math.min(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-cx,dy=y-cy,r=Math.sqrt(dx*dx+dy*dy),a2=p.angle*(1-r/R),cos=Math.cos(a2),sin=Math.sin(a2);const[rv,gv,bv]=bl(src.data,w,h,cx+dx*cos-dy*sin,cy+dx*sin+dy*cos);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  polar_inv:{cat:'distort',name:'Polar Inversion',params:[
    {id:'r',label:'radius',min:.01,max:2,step:.01,def:.5},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-p.cx*w)/w,dy=(y-p.cy*h)/h,r2=dx*dx+dy*dy||1e-9,scale=(p.r*p.r)/r2;const[rv,gv,bv]=bl(src.data,w,h,p.cx*w+dx*scale*w,p.cy*h+dy*scale*h);const[or,og,ob]=px(src.data,w,h,x,y);sp(dst.data,w,x,y,or+(rv-or)*p.blend,og+(gv-og)*p.blend,ob+(bv-ob)*p.blend);}
    return dst;
  }},
  pinch_bulge:{cat:'distort',name:'Pinch / Bulge',params:[
    {id:'k',label:'power',min:.1,max:4,step:.05,def:.5},
    {id:'r',label:'radius',min:.01,max:1.5,step:.01,def:.5},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    const cx=p.cx*w,cy=p.cy*h,R=p.r*Math.min(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-cx,dy=y-cy,r=Math.sqrt(dx*dx+dy*dy)||.001;if(r>R){sp(dst.data,w,x,y,...px(src.data,w,h,x,y));continue;}const wr=Math.pow(r/R,p.k)*R;const[rv,gv,bv]=bl(src.data,w,h,cx+dx/r*wr,cy+dy/r*wr);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  ripple:{cat:'distort',name:'Ripple',params:[
    {id:'amp',label:'amplitude',min:0,max:60,step:.5,def:12},
    {id:'freq',label:'frequency',min:.005,max:.2,step:.005,def:.05},
    {id:'phase',label:'phase',min:0,max:6.28,step:.05,def:0},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-p.cx*w,dy=y-p.cy*h,r=Math.sqrt(dx*dx+dy*dy)||.001,off=p.amp*Math.sin(r*p.freq*2*Math.PI+p.phase);const[rv,gv,bv]=bl(src.data,w,h,x+dx/r*off,y+dy/r*off);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  shear:{cat:'distort',name:'Shear / Skew',params:[
    {id:'kx',label:'shear x',min:-1,max:1,step:.01,def:.25},
    {id:'ky',label:'shear y',min:-1,max:1,step:.01,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[rv,gv,bv]=bl(src.data,w,h,x-p.kx*(y-h/2),y-p.ky*(x-w/2));sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
// ── CORRUPT ─────────────────────────────────────────────────
  bitplane:{cat:'corrupt',name:'Bitplane Isolate',params:[
    {id:'bit',label:'bit plane 0-7',min:0,max:7,step:1,def:4},
    {id:'ch',label:'channel 0=all',min:0,max:3,step:1,def:0},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const bit=p.bit|0,ch=p.ch|0;
    for(let i=0;i<src.data.length;i+=4){
      let r=src.data[i],g=src.data[i+1],b=src.data[i+2];
      const pr=(ch===0||ch===1)?((r>>bit)&1)*255:r;
      const pg=(ch===0||ch===2)?((g>>bit)&1)*255:g;
      const pb=(ch===0||ch===3)?((b>>bit)&1)*255:b;
      dst.data[i]=r+(pr-r)*p.blend;dst.data[i+1]=g+(pg-g)*p.blend;dst.data[i+2]=b+(pb-b)*p.blend;dst.data[i+3]=255;
    }
    return dst;
  }},
  bitwise_xor:{cat:'corrupt',name:'Bitwise XOR',params:[
    {id:'mask',label:'xor mask',min:0,max:255,step:1,def:85},
    {id:'ch',label:'channel 0=all',min:0,max:3,step:1,def:0},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const mk=p.mask|0,ch=p.ch|0;
    for(let i=0;i<src.data.length;i+=4){const r=src.data[i],g=src.data[i+1],b=src.data[i+2];dst.data[i]=(ch===0||ch===1)?r+(((r^mk)-r)*p.blend):r;dst.data[i+1]=(ch===0||ch===2)?g+(((g^mk)-g)*p.blend):g;dst.data[i+2]=(ch===0||ch===3)?b+(((b^mk)-b)*p.blend):b;dst.data[i+3]=255;}
    return dst;
  }},
  noise_inject:{cat:'corrupt',name:'Noise Injection',params:[
    {id:'amt',label:'amount',min:0,max:255,step:1,def:40},
    {id:'prob',label:'probability',min:0,max:1,step:.01,def:.5},
    {id:'mono',label:'mono 0/1',min:0,max:1,step:1,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);let s=Date.now()|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    for(let i=0;i<src.data.length;i+=4){if(rn()<p.prob){const n=(rn()-.5)*2*p.amt;dst.data[i]=clamp(src.data[i]+(p.mono>.5?n:(rn()-.5)*2*p.amt));dst.data[i+1]=clamp(src.data[i+1]+(p.mono>.5?n:(rn()-.5)*2*p.amt));dst.data[i+2]=clamp(src.data[i+2]+(p.mono>.5?n:(rn()-.5)*2*p.amt));}else{dst.data[i]=src.data[i];dst.data[i+1]=src.data[i+1];dst.data[i+2]=src.data[i+2];}dst.data[i+3]=255;}
    return dst;
  }},
  echo:{cat:'corrupt',name:'Echo / Ghost',
    desc:'Blends a shifted copy of the image over itself at reduced opacity — like a VHS ghost or tape echo artefact.',
    math:'out = lerp(src(x,y), src(x+dx, y+dy), opacity)  repeated n times',
    presets:[
      {name:'ghost right', p:{dx:30,dy:0,opac:.4,n:2}},
      {name:'multi echo',  p:{dx:20,dy:0,opac:.3,n:4}},
      {name:'diagonal',    p:{dx:15,dy:15,opac:.35,n:3}},
      {name:'strong 2',    p:{dx:40,dy:0,opac:.5,n:2}},
    ],
    params:[
      {id:'dx',  label:'offset x',  min:-200,max:200,step:1,  def:30},
      {id:'dy',  label:'offset y',  min:-200,max:200,step:1,  def:0},
      {id:'opac',label:'opacity',   min:0,   max:1,  step:.01, def:.4},
      {id:'n',   label:'echoes',    min:1,   max:5,  step:1,   def:2},
    ],fn(src,p){
      const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
      for(let pass=1;pass<=p.n;pass++){
        const opac=p.opac/pass;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const[rv,gv,bv]=px(src.data,w,h,x+Math.round(p.dx*pass),y+Math.round(p.dy*pass));
          const di=(y*w+x)*4;
          dst.data[di]  =clamp(dst.data[di]  *(1-opac)+rv*opac);
          dst.data[di+1]=clamp(dst.data[di+1]*(1-opac)+gv*opac);
          dst.data[di+2]=clamp(dst.data[di+2]*(1-opac)+bv*opac);
        }
      }
      return dst;
    }},
  color_bleed:{cat:'corrupt',name:'Color Bleed',params:[
    {id:'dir',label:'axis 0=H 1=V',min:0,max:1,step:1,def:0},
    {id:'len',label:'smear',min:1,max:60,step:1,def:20},
    {id:'ch',label:'channel 1=R 2=G 3=B',min:1,max:3,step:1,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);const ch=(p.ch|0)-1;
    const decay=Math.max(0.01,Math.min(0.99,1-1/Math.max(1,p.len||20)));const feed=1-decay;
    if(p.dir<.5){for(let y=0;y<h;y++){let last=src.data[(y*w)*4+ch];for(let x=0;x<w;x++){const i=(y*w+x)*4;last=last*decay+src.data[i+ch]*feed;dst.data[i+ch]=clamp(last);}}}
    else{for(let x=0;x<w;x++){let last=src.data[x*4+ch];for(let y=0;y<h;y++){const i=(y*w+x)*4;last=last*decay+src.data[i+ch]*feed;dst.data[i+ch]=clamp(last);}}}
    return dst;
  }},
// ── MIRROR ──────────────────────────────────────────────────
  mirror_h:{cat:'mirror',name:'Mirror H',params:[
    {id:'pos',label:'axis',min:0,max:1,step:.01,def:.5},
    {id:'side',label:'source 0=left',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const ax=Math.floor(p.pos*w);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sx=p.side<.5?(x<ax?x:ax-(x-ax)):(x>=ax?x:ax+(ax-x));sp(dst.data,w,x,y,...px(src.data,w,h,sx,y));}
    return dst;
  }},
  mirror_v:{cat:'mirror',name:'Mirror V',params:[
    {id:'pos',label:'axis',min:0,max:1,step:.01,def:.5},
    {id:'side',label:'source 0=top',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const ay=Math.floor(p.pos*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const sy=p.side<.5?(y<ay?y:ay-(y-ay)):(y>=ay?y:ay+(ay-y));sp(dst.data,w,x,y,...px(src.data,w,h,x,sy));}
    return dst;
  }},
  kaleidoscope:{cat:'mirror',name:'Kaleidoscope',
    desc:'Divides image into N radial sectors and reflects the first sector into all others — like inside a kaleidoscope.',
    math:'θ mod (2π/N); reflect if θ > π/N',
    presets:[{name:'hexagon',p:{n:6,angle:0,cx:.5,cy:.5}},{name:'octagon',p:{n:8,angle:.39,cx:.5,cy:.5}},{name:'square',p:{n:4,angle:.78,cx:.5,cy:.5}},{name:'many',p:{n:18,angle:0,cx:.5,cy:.5}}],
    params:[
    {id:'n',label:'segments',min:2,max:24,step:1,def:6},
    {id:'angle',label:'angle offset',min:0,max:6.28,step:.05,def:0},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const cx=p.cx*w,cy=p.cy*h,n=Math.max(2,p.n|0),seg=Math.PI*2/n;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let ang=Math.atan2(y-cy,x-cx)+p.angle,r=Math.sqrt((x-cx)**2+(y-cy)**2);ang=((ang%seg)+seg)%seg;if(ang>seg/2)ang=seg-ang;const[rv,gv,bv]=bl(src.data,w,h,cx+r*Math.cos(ang-p.angle),cy+r*Math.sin(ang-p.angle));sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  tile_mirror:{cat:'mirror',name:'Tile Mirror',params:[
    {id:'sx',label:'scale x',min:.1,max:4,step:.05,def:2},
    {id:'sy',label:'scale y',min:.1,max:4,step:.05,def:2},
    {id:'rot',label:'rotation',min:0,max:6.28,step:.05,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    const cos=Math.cos(p.rot||0),sin=Math.sin(p.rot||0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let rx=x/w-.5,ry=y/h-.5;if(p.rot){const tx=rx*cos-ry*sin;ry=rx*sin+ry*cos;rx=tx;}let nx=rx*p.sx+.5,ny=ry*p.sy+.5;nx=((nx%1)+1)%1;ny=((ny%1)+1)%1;if(Math.floor((x/w)*p.sx)%2===1)nx=1-nx;if(Math.floor((y/h)*p.sy)%2===1)ny=1-ny;const[rv,gv,bv]=bl(src.data,w,h,nx*w,ny*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  droste:{cat:'mirror',name:'Droste Spiral',params:[
    {id:'rate',label:'spiral rate',min:.1,max:3,step:.05,def:1},
    {id:'inner',label:'inner r',min:.01,max:.5,step:.01,def:.1},
    {id:'outer',label:'outer r',min:.5,max:2,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/w,dy=(y-h/2)/h,ang=Math.atan2(dy,dx),r=Math.sqrt(dx*dx+dy*dy)||.001;const logr=((Math.log(r)*p.rate-Math.log(p.inner))%(Math.log(p.outer)-Math.log(p.inner)))+Math.log(p.inner);const[rv,gv,bv]=bl(src.data,w,h,w/2+Math.exp(logr)*Math.cos(ang)*w,h/2+Math.exp(logr)*Math.sin(ang)*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  radial_tile:{cat:'mirror',name:'Radial Tile',params:[
    {id:'n',label:'copies',min:2,max:16,step:1,def:4},
    {id:'scale',label:'scale',min:.1,max:2,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let ang=Math.atan2(y-h/2,x-w/2),r=Math.sqrt((x-w/2)**2+(y-h/2)**2)*p.scale;ang=((ang%(Math.PI*2/p.n))+Math.PI*2)%(Math.PI*2/p.n);const[rv,gv,bv]=bl(src.data,w,h,w/2+r*Math.cos(ang),h/2+r*Math.sin(ang));sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
// ── PIXEL ───────────────────────────────────────────────────
  sort_luma:{cat:'pixel',name:'Sort by Luminance',
    desc:'Sorts contiguous bright pixel runs by luminance along a scan direction — the classic pixel sorting art technique.',
    math:'sort intervals where luma(px) > threshold',
    presets:[{name:'light sort',p:{threshold:180,axis:0,rev:0}},{name:'dark sort',p:{threshold:50,axis:0,rev:1}},{name:'medium H',p:{threshold:80,axis:0,rev:0}},{name:'vertical',p:{threshold:80,axis:1,rev:0}}],
    params:[
    {id:'threshold',label:'threshold',min:0,max:255,step:1,def:80},
    {id:'axis',label:'axis 0=H 1=V',min:0,max:1,step:1,def:0},
    {id:'rev',label:'reverse 0/1',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    const rev=p.rev>.5;
    function sortSeg(y,x0,x1){const px2=[];for(let x=x0;x<=x1;x++){const i=(y*w+x)*4;px2.push([dst.data[i],dst.data[i+1],dst.data[i+2]]);}px2.sort((a,b)=>(rev?-1:1)*(luma(...a)-luma(...b)));for(let x=x0;x<=x1;x++){const i=(y*w+x)*4;[dst.data[i],dst.data[i+1],dst.data[i+2]]=px2[x-x0];}}
    if(p.axis<.5){for(let y=0;y<h;y++){let s=-1;for(let x=0;x<=w;x++){const above=x<w&&luma(...px(dst.data,w,h,x,y))>p.threshold;if(above&&s<0)s=x;else if(!above&&s>=0){sortSeg(y,s,x-1);s=-1;}}}}
    else{for(let x=0;x<w;x++){const col=[];for(let y=0;y<h;y++){const i=(y*w+x)*4;col.push([dst.data[i],dst.data[i+1],dst.data[i+2]]);}let seg=[],segs=[];for(let y=0;y<=h;y++){if(y<h&&luma(...col[y])>p.threshold)seg.push(y);else if(seg.length){segs.push([...seg]);seg=[];}}for(const sg of segs){const sorted=sg.map(i=>col[i]).sort((a,b)=>(rev?-1:1)*(luma(...a)-luma(...b)));sg.forEach((y,j)=>{const i=(y*w+x)*4;[dst.data[i],dst.data[i+1],dst.data[i+2]]=sorted[j];});}}}
    return dst;
  }},
  sort_hue:{cat:'pixel',name:'Sort by Hue',params:[
    {id:'threshold',label:'threshold',min:0,max:360,step:1,def:90},
    {id:'axis',label:'axis 0=H 1=V',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);dst.data.set(src.data);
    if(p.axis<.5){
      for(let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++){const i=(y*w+x)*4;const[hv]=rgb2hsl(dst.data[i],dst.data[i+1],dst.data[i+2]);row.push({x,h:hv,rgb:[dst.data[i],dst.data[i+1],dst.data[i+2]]});}let seg=[];for(const px2 of row){if(px2.h*360>p.threshold)seg.push(px2);else if(seg.length){seg.sort((a,b)=>a.h-b.h);seg.forEach((pp,j)=>{const i=(y*w+seg[0].x+j)*4;[dst.data[i],dst.data[i+1],dst.data[i+2]]=pp.rgb;});seg=[];}}}
    }else{
      for(let x=0;x<w;x++){const col=[];for(let y=0;y<h;y++){const i=(y*w+x)*4;const[hv]=rgb2hsl(dst.data[i],dst.data[i+1],dst.data[i+2]);col.push({y,h:hv,rgb:[dst.data[i],dst.data[i+1],dst.data[i+2]]});}let seg=[];for(const px2 of col){if(px2.h*360>p.threshold)seg.push(px2);else if(seg.length){seg.sort((a,b)=>a.h-b.h);seg.forEach((pp,j)=>{const i=((seg[0].y+j)*w+x)*4;[dst.data[i],dst.data[i+1],dst.data[i+2]]=pp.rgb;});seg=[];}}}
    }
    return dst;
  }},
  pixelate:{cat:'pixel',name:'Pixelate',
    desc:'Reduces resolution by averaging NxN pixel blocks — classic mosaic or retro 8-bit look.',
    math:'block_colour = Σpixels / N²',
    presets:[{name:'2px',p:{size:2}},{name:'8px',p:{size:8}},{name:'16px',p:{size:16}},{name:'32px',p:{size:32}}],
    params:[
    {id:'size',label:'block size',min:1,max:64,step:1,def:8},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const s=Math.max(1,p.size|0);
    for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){let r=0,g=0,b=0,n=0;for(let dy=0;dy<s&&y+dy<h;dy++)for(let dx=0;dx<s&&x+dx<w;dx++){const i=((y+dy)*w+(x+dx))*4;r+=src.data[i];g+=src.data[i+1];b+=src.data[i+2];n++;}r/=n;g/=n;b/=n;for(let dy=0;dy<s&&y+dy<h;dy++)for(let dx=0;dx<s&&x+dx<w;dx++){const i=((y+dy)*w+(x+dx))*4;dst.data[i]=r;dst.data[i+1]=g;dst.data[i+2]=b;dst.data[i+3]=255;}}
    return dst;
  }},
  halftone:{cat:'pixel',name:'Halftone',params:[
    {id:'size',label:'dot size',min:2,max:20,step:1,def:6},
    {id:'angle',label:'angle deg',min:0,max:90,step:1,def:45},
    {id:'invert',label:'invert 0/1',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let i=0;i<dst.data.length;i+=4){dst.data[i]=dst.data[i+1]=dst.data[i+2]=255;dst.data[i+3]=255;}
    const s=Math.max(2,p.size|0);const ang=(p.angle||0)*Math.PI/180;
    const cos=Math.cos(ang),sin=Math.sin(ang);const diag=Math.hypot(w,h);
    for(let y=-diag;y<diag;y+=s)for(let x=-diag;x<diag;x+=s){
      const cx2=Math.round(w/2+x*cos-y*sin),cy2=Math.round(h/2+x*sin+y*cos);
      if(cx2<-s||cx2>w+s||cy2<-s||cy2>h+s)continue;
      const[r,g,b]=px(src.data,w,h,cx2,cy2);const l=luma(r,g,b)/255;const rad=s/2*(p.invert>.5?l:1-l);
      for(let dy=-s;dy<s;dy++)for(let dx=-s;dx<s;dx++){if(dx*dx+dy*dy<=rad*rad)sp(dst.data,w,cx2+dx,cy2+dy,0,0,0);}
    }
    return dst;
  }},
  bayer_dither:{cat:'pixel',name:'Bayer Dither',params:[
    {id:'levels',label:'levels',min:2,max:16,step:1,def:4},
    {id:'msize',label:'matrix 2/4',min:2,max:4,step:2,def:4},
    {id:'spread',label:'spread',min:.1,max:3,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    const m4=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];const m2=[[0,2],[3,1]];const mat=p.msize<3?m2:m4;const ms=mat.length;
    const levels=Math.max(2,p.levels|0),step=256/(levels-1);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;const thr=(mat[y%ms][x%ms]/(ms*ms)-.5)*step*p.spread;dst.data[i]=Math.round(clamp(src.data[i]+thr)/step)*step;dst.data[i+1]=Math.round(clamp(src.data[i+1]+thr)/step)*step;dst.data[i+2]=Math.round(clamp(src.data[i+2]+thr)/step)*step;dst.data[i+3]=255;}
    return dst;
  }},
// ── COLOR ───────────────────────────────────────────────────
  hue_rotate:{cat:'color',name:'Hue Rotation',
    desc:'Rotates all pixel hues by a fixed angle in HSL colour space, with optional saturation and lightness scaling.',
    math:'H′=(H+Δ) mod 360,  S′=S×sat,  L′=L×lit',
    presets:[{name:'180°',p:{angle:180,sat:1,lit:1}},{name:'warm',p:{angle:30,sat:1.3,lit:1}},{name:'cold',p:{angle:300,sat:1.2,lit:1}},{name:'desaturate',p:{angle:0,sat:.1,lit:1}}],
    params:[
    {id:'angle',label:'hue shift',min:0,max:360,step:1,def:180},
    {id:'sat',label:'saturation',min:0,max:3,step:.05,def:1},
    {id:'lit',label:'lightness',min:.1,max:3,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let i=0;i<src.data.length;i+=4){let[h2,s,l]=rgb2hsl(src.data[i],src.data[i+1],src.data[i+2]);h2=(h2+p.angle)%360;s=Math.min(1,s*p.sat);l=Math.min(1,l*p.lit);const[r,g,b]=hsl2rgb(h2,s,l);dst.data[i]=r;dst.data[i+1]=g;dst.data[i+2]=b;dst.data[i+3]=255;}
    return dst;
  }},
  palette_crush:{cat:'color',name:'Palette Crush',params:[
    {id:'n',label:'colors',min:2,max:32,step:1,def:8},
    {id:'dither',label:'dither',min:0,max:1,step:.01,def:.3},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const step=256/Math.max(2,p.n|0);let s=42;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    for(let i=0;i<src.data.length;i+=4){const d2=p.dither*(rn()-.5)*step;dst.data[i]=clamp(Math.round((src.data[i]+d2)/step)*step);dst.data[i+1]=clamp(Math.round((src.data[i+1]+d2)/step)*step);dst.data[i+2]=clamp(Math.round((src.data[i+2]+d2)/step)*step);dst.data[i+3]=255;}
    return dst;
  }},
  false_color:{cat:'color',name:'False Color',params:[
    {id:'lut',label:'palette 0-6',min:0,max:6,step:1,def:0},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const pal=PALETTES[p.lut%PALETTES.length];
    for(let i=0;i<src.data.length;i+=4){const l=luma(src.data[i],src.data[i+1],src.data[i+2])/255;const[r,g,b]=pal(l);dst.data[i]=src.data[i]+(r-src.data[i])*p.blend;dst.data[i+1]=src.data[i+1]+(g-src.data[i+1])*p.blend;dst.data[i+2]=src.data[i+2]+(b-src.data[i+2])*p.blend;dst.data[i+3]=255;}
    return dst;
  }},
  channel_swap:{cat:'color',name:'Channel Swap',params:[
    {id:'r',label:'R from 0=R 1=G 2=B',min:0,max:2,step:1,def:1},
    {id:'g',label:'G from',min:0,max:2,step:1,def:2},
    {id:'b',label:'B from',min:0,max:2,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let i=0;i<src.data.length;i+=4){const ch=[src.data[i],src.data[i+1],src.data[i+2]];dst.data[i]=ch[p.r|0];dst.data[i+1]=ch[p.g|0];dst.data[i+2]=ch[p.b|0];dst.data[i+3]=255;}
    return dst;
  }},
  invert:{cat:'color',name:'Invert',params:[
    {id:'r',label:'R 0/1',min:0,max:1,step:1,def:1},{id:'g',label:'G 0/1',min:0,max:1,step:1,def:1},{id:'b',label:'B 0/1',min:0,max:1,step:1,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let i=0;i<src.data.length;i+=4){dst.data[i]=p.r>.5?255-src.data[i]:src.data[i];dst.data[i+1]=p.g>.5?255-src.data[i+1]:src.data[i+1];dst.data[i+2]=p.b>.5?255-src.data[i+2]:src.data[i+2];dst.data[i+3]=255;}
    return dst;
  }},
  threshold:{cat:'color',name:'Threshold',params:[
    {id:'level',label:'level',min:0,max:255,step:1,def:128},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let i=0;i<src.data.length;i+=4){const v=luma(src.data[i],src.data[i+1],src.data[i+2])>p.level?255:0;dst.data[i]=v;dst.data[i+1]=v;dst.data[i+2]=v;dst.data[i+3]=255;}
    return dst;
  }},
// ── ART ─────────────────────────────────────────────────────
  floyd_steinberg:{cat:'art',name:'Floyd-Steinberg',params:[
    {id:'levels',label:'levels',min:2,max:16,step:1,def:4},
    {id:'str',label:'diffusion',min:0,max:2,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const buf=new Float32Array(src.data.length);for(let i=0;i<src.data.length;i++)buf[i]=src.data[i];
    const lv=Math.max(2,p.levels|0),step=255/(lv-1);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){const old=buf[i+c],nv=clamp(Math.round(old/step)*step),err=(old-nv)*p.str;buf[i+c]=nv;if(x+1<w)buf[i+4+c]+=err*7/16;if(y+1<h){if(x>0)buf[i+w*4-4+c]+=err*3/16;buf[i+w*4+c]+=err*5/16;if(x+1<w)buf[i+w*4+4+c]+=err/16;}}dst.data[i]=buf[i];dst.data[i+1]=buf[i+1];dst.data[i+2]=buf[i+2];dst.data[i+3]=255;}
    return dst;
  }},
  emboss:{cat:'art',name:'Emboss',params:[
    {id:'angle',label:'light angle',min:0,max:360,step:1,def:135},
    {id:'depth',label:'depth',min:1,max:8,step:.25,def:2},
    {id:'gray',label:'grayscale 0/1',min:0,max:1,step:1,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const ang=p.angle*Math.PI/180;const kx=Math.round(Math.cos(ang)),ky=Math.round(Math.sin(ang));
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;const[r0]=px(src.data,w,h,x-kx,y-ky);const[r1]=px(src.data,w,h,x+kx,y+ky);const v=clamp((r1-r0)*p.depth+128);if(p.gray>.5){dst.data[i]=v;dst.data[i+1]=v;dst.data[i+2]=v;}else{dst.data[i]=clamp(src.data[i]+(v-128)*.5);dst.data[i+1]=clamp(src.data[i+1]+(v-128)*.5);dst.data[i+2]=clamp(src.data[i+2]+(v-128)*.5);}dst.data[i+3]=255;}
    return dst;
  }},
  oil_paint:{cat:'art',name:'Oil Paint',params:[
    {id:'radius',label:'radius',min:1,max:8,step:1,def:4},
    {id:'levels',label:'intensity levels',min:2,max:16,step:1,def:8},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const r2=Math.max(1,p.radius|0),lv=Math.max(2,p.levels|0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const bins=Array.from({length:lv},()=>({cnt:0,r:0,g:0,b:0}));for(let dy=-r2;dy<=r2;dy++)for(let dx=-r2;dx<=r2;dx++){const[pr,pg,pb]=px(src.data,w,h,x+dx,y+dy);const bin=Math.min(lv-1,Math.floor(luma(pr,pg,pb)*lv/256));bins[bin].cnt++;bins[bin].r+=pr;bins[bin].g+=pg;bins[bin].b+=pb;}let best=bins[0];for(const b of bins)if(b.cnt>best.cnt)best=b;const n=best.cnt||1;sp(dst.data,w,x,y,best.r/n,best.g/n,best.b/n);}
    return dst;
  }},
  voronoi_art:{cat:'art',name:'Voronoi Shatter',params:[
    {id:'n',label:'points',min:4,max:120,step:1,def:30},
    {id:'disp',label:'displacement',min:0,max:40,step:.5,def:8},
    {id:'border',label:'border',min:0,max:5,step:.5,def:1},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:42},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const pts=[];for(let i=0;i<p.n;i++)pts.push([rn()*w,rn()*h]);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let md=Infinity,mi=0,sec=Infinity;for(let i=0;i<pts.length;i++){const d=Math.hypot(x-pts[i][0],y-pts[i][1]);if(d<md){sec=md;md=d;mi=i;}else if(d<sec)sec=d;}const dx=Math.round((rn()-.5)*p.disp),dy=Math.round((rn()-.5)*p.disp);const[rv,gv,bv]=px(src.data,w,h,pts[mi][0]+dx,pts[mi][1]+dy);const brd=p.border>0&&(sec-md)<p.border;sp(dst.data,w,x,y,brd?0:rv,brd?0:gv,brd?0:bv);}
    return dst;
  }},
  stipple:{cat:'art',name:'Stipple',params:[
    {id:'density',label:'density',min:.01,max:.5,step:.005,def:.08},
    {id:'dotR',label:'dot radius',min:.3,max:4,step:.1,def:1.2},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);for(let i=0;i<dst.data.length;i+=4){dst.data[i]=dst.data[i+1]=dst.data[i+2]=255;dst.data[i+3]=255;}
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const count=Math.floor(p.density*w*h);
    for(let i=0;i<count;i++){const x=rn()*w,y=rn()*h;const[rv,gv,bv]=px(src.data,w,h,x,y);const l=1-luma(rv,gv,bv)/255;if(rn()<l){const r2=p.dotR*l;for(let dy=-r2;dy<=r2;dy++)for(let dx=-r2;dx<=r2;dx++){if(dx*dx+dy*dy<=r2*r2)sp(dst.data,w,Math.round(x+dx),Math.round(y+dy),0,0,0);}}}
    return dst;
  }},
  ascii_art:{cat:'art',name:'ASCII Art',params:[
    {id:'size',label:'char size',min:4,max:14,step:1,def:6},
    {id:'inv',label:'invert 0/1',min:0,max:1,step:1,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const chars=' .:-=+*#%@';const s=Math.max(4,p.size|0);
    const oc=document.createElement('canvas');oc.width=w;oc.height=h;const oc2=oc.getContext('2d');oc2.fillStyle='#000';oc2.fillRect(0,0,w,h);oc2.font=`${s}px monospace`;oc2.fillStyle='#fff';
    for(let y=0;y<h;y+=s)for(let x=0;x<w;x+=s){const[rv,gv,bv]=px(src.data,w,h,x,y);const l=luma(rv,gv,bv)/255;const idx=Math.min(chars.length-1,Math.floor((p.inv>.5?1-l:l)*chars.length));oc2.fillText(chars[idx],x,y+s);}
    const id2=oc2.getImageData(0,0,w,h);for(let i=0;i<id2.data.length;i+=4){dst.data[i]=id2.data[i];dst.data[i+1]=id2.data[i+1];dst.data[i+2]=id2.data[i+2];dst.data[i+3]=255;}
    return dst;
  }},
// ── GEOMETRY ────────────────────────────────────────────────
  mobius:{cat:'geometry',name:'Möbius Transform',params:[
    {id:'ar',label:'a real',min:-2,max:2,step:.01,def:1},{id:'ai',label:'a imag',min:-2,max:2,step:.01,def:0},
    {id:'cr',label:'c real',min:-2,max:2,step:.01,def:.5},{id:'ci',label:'c imag',min:-2,max:2,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=2/Math.min(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let zr=(x-w/2)*sc,zi=(y-h/2)*sc;const nr=p.ar*zr-p.ai*zi+1,ni=p.ar*zi+p.ai*zr,dr=p.cr*zr-p.ci*zi+1,di=p.cr*zi+p.ci*zr;const dm=dr*dr+di*di||1e-10;const[rv,gv,bv]=bl(src.data,w,h,(nr*dr+ni*di)/dm/sc+w/2,(ni*dr-nr*di)/dm/sc+h/2);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  log_polar:{cat:'geometry',name:'Log-Polar Spiral',params:[
    {id:'s',label:'log scale',min:.1,max:4,step:.05,def:1},
    {id:'k',label:'spiral k',min:-3,max:3,step:.05,def:1},
    {id:'cx',label:'center x',min:0,max:1,step:.01,def:.5},
    {id:'cy',label:'center y',min:0,max:1,step:.01,def:.5},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-p.cx*w,dy=y-p.cy*h,r=Math.sqrt(dx*dx+dy*dy)||.01,ang=Math.atan2(dy,dx),logr=Math.log(r)*p.s,newAng=ang+p.k*Math.log(r);const[rv,gv,bv]=bl(src.data,w,h,p.cx*w+Math.exp(logr)*Math.cos(newAng),p.cy*h+Math.exp(logr)*Math.sin(newAng));sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  affine_tile:{cat:'geometry',name:'Affine Tile',params:[
    {id:'a',label:'a',min:-2,max:2,step:.05,def:1},{id:'b',label:'b',min:-2,max:2,step:.05,def:.2},
    {id:'c',label:'c',min:-2,max:2,step:.05,def:.2},{id:'d',label:'d',min:-2,max:2,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=x/w-.5,ny=y/h-.5,tx=p.a*nx+p.b*ny,ty=p.c*nx+p.d*ny;const[rv,gv,bv]=bl(src.data,w,h,((tx%1+1)%1)*w,((ty%1+1)%1)*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  conformal:{cat:'geometry',name:'Conformal zⁿ',params:[
    {id:'n',label:'power',min:1,max:5,step:.1,def:2},
    {id:'scale',label:'scale',min:.1,max:3,step:.05,def:1},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=p.scale*2/Math.min(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const zr=(x-w/2)*sc,zi=(y-h/2)*sc,r=Math.pow(Math.sqrt(zr*zr+zi*zi),p.n),ang=Math.atan2(zi,zr)*p.n;const[rv,gv,bv]=bl(src.data,w,h,r*Math.cos(ang)/sc+w/2,r*Math.sin(ang)/sc+h/2);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  perspective:{cat:'geometry',name:'Perspective',params:[
    {id:'tlx',label:'TL x',min:-.5,max:.5,step:.01,def:0},
    {id:'trx',label:'TR x',min:.5,max:1.5,step:.01,def:1},
    {id:'blx',label:'BL x',min:-.5,max:.5,step:.01,def:.1},
    {id:'brx',label:'BR x',min:.5,max:1.5,step:.01,def:.9},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h;const sx=((1-v)*(u*(p.trx-p.tlx)+p.tlx)+v*(u*(p.brx-p.blx)+p.blx))*w;const[rv,gv,bv]=bl(src.data,w,h,sx,y);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  wallpaper:{cat:'geometry',name:'Wallpaper Group',params:[
    {id:'group',label:'group 1-6',min:1,max:6,step:1,def:2},
    {id:'scale',label:'scale',min:.05,max:2,step:.05,def:.5},
    {id:'rot',label:'rotation',min:0,max:6.28,step:.05,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const s2=p.scale*Math.min(w,h),cos=Math.cos(p.rot),sin=Math.sin(p.rot);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let nx=(x-w/2)/s2,ny=(y-h/2)/s2;let tx=nx*cos-ny*sin,ty=nx*sin+ny*cos;switch(p.group|0){case 2:tx=Math.abs(tx%1);ty=Math.abs(ty%1);break;case 3:{const t=tx;tx=(tx-ty)/2;ty=(t+ty)/2;}break;case 4:{const ang2=Math.atan2(ty,tx),len=Math.sqrt(tx*tx+ty*ty),na=((ang2%(Math.PI/2))+Math.PI/2)%(Math.PI/2);tx=len*Math.cos(na);ty=len*Math.sin(na);}break;case 5:tx=((tx%1)+1)%1;if(Math.floor(tx*2)%2===1)ty=1-ty;ty=((ty%1)+1)%1;break;case 6:tx=((tx%1)+1)%1;ty=((ty%1)+1)%1;if(Math.floor(tx+ty)%2===1)tx=1-tx;break;}tx=((tx%1)+1)%1;ty=((ty%1)+1)%1;const[rv,gv,bv]=bl(src.data,w,h,tx*w,ty*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
// ── 3D ──────────────────────────────────────────────────────
  sphere_wrap:{cat:'3d',name:'Sphere Wrap',params:[
    {id:'radius',label:'radius',min:.1,max:1,step:.01,def:.45},
    {id:'rotY',label:'rotation Y',min:0,max:6.28,step:.05,def:0},
    {id:'ambient',label:'ambient',min:0,max:1,step:.01,def:.25},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const R=p.radius*Math.min(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=x-w/2,dy=y-h/2,d=Math.sqrt(dx*dx+dy*dy);if(d>R)continue;const nz=Math.sqrt(Math.max(0,1-(d/R)**2)),nx2=dx/R,ny2=dy/R;const ang=Math.atan2(Math.sqrt(nx2*nx2+ny2*ny2),nz),phi=Math.atan2(ny2,nx2)+p.rotY;const[rv,gv,bv]=bl(src.data,w,h,((phi/(2*Math.PI))+.5)*w,(ang/Math.PI)*h);const diff=p.ambient+(1-p.ambient)*Math.max(0,nz);sp(dst.data,w,x,y,rv*diff,gv*diff,bv*diff);}
    return dst;
  }},
  bump_map:{cat:'3d',name:'Bump Map',params:[
    {id:'depth',label:'depth',min:0,max:20,step:.25,def:5},
    {id:'lx',label:'light x',min:-1,max:1,step:.05,def:.6},
    {id:'ly',label:'light y',min:-1,max:1,step:.05,def:-.4},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const llen=Math.sqrt(p.lx**2+p.ly**2+1);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=(y*w+x)*4;const lu=([r,g,b])=>luma(r,g,b)/255;const gx2=lu(px(src.data,w,h,x+1,y))-lu(px(src.data,w,h,x-1,y)),gy2=lu(px(src.data,w,h,x,y+1))-lu(px(src.data,w,h,x,y-1));const nx2=-gx2*p.depth,ny2=-gy2*p.depth,nz=1,nl=Math.sqrt(nx2*nx2+ny2*ny2+nz*nz);const diff=Math.max(0,(nx2/nl)*p.lx/llen+(ny2/nl)*p.ly/llen+(nz/nl)/llen);dst.data[i]=clamp(src.data[i]*diff*1.5);dst.data[i+1]=clamp(src.data[i+1]*diff*1.5);dst.data[i+2]=clamp(src.data[i+2]*diff*1.5);dst.data[i+3]=255;}
    return dst;
  }},
  parallax:{cat:'3d',name:'Parallax',params:[
    {id:'strength',label:'strength',min:0,max:40,step:.5,def:10},
    {id:'angle',label:'angle',min:0,max:6.28,step:.05,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const cos=Math.cos(p.angle),sin=Math.sin(p.angle);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[r2,g2,b2]=px(src.data,w,h,x,y);const depth=luma(r2,g2,b2)/255,off=depth*p.strength;const[rv,gv,bv]=bl(src.data,w,h,x+cos*off,y+sin*off);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  refraction:{cat:'3d',name:'Glass Refraction',params:[
    {id:'ior',label:'IOR',min:1,max:3,step:.05,def:1.5},
    {id:'thick',label:'thickness',min:0,max:1,step:.01,def:.3},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const bend=(p.ior-1)*p.thick;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const nx=vnoise(x*.02,y*.02)*2-1,ny=vnoise(x*.02+100,y*.02+100)*2-1;const[rv,gv,bv]=bl(src.data,w,h,x+nx*bend*60,y+ny*bend*60);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  depth_of_field:{cat:'3d',name:'Depth of Field',params:[
    {id:'focus',label:'focus plane',min:0,max:1,step:.01,def:.5},
    {id:'aperture',label:'aperture',min:0,max:20,step:.25,def:4},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[r2,g2,b2]=px(src.data,w,h,x,y);const depth=luma(r2,g2,b2)/255,blur=Math.abs(depth-p.focus)*p.aperture,r3=Math.round(blur);if(!r3){sp(dst.data,w,x,y,r2,g2,b2);continue;}let sr=0,sg=0,sb=0,n=0;for(let dy=-r3;dy<=r3;dy++)for(let dx=-r3;dx<=r3;dx++){if(dx*dx+dy*dy>r3*r3)continue;const[pr,pg,pb]=px(src.data,w,h,x+dx,y+dy);sr+=pr;sg+=pg;sb+=pb;n++;}sp(dst.data,w,x,y,sr/n,sg/n,sb/n);}
    return dst;
  }},
  cube_face:{cat:'3d',name:'Cube Face Map',params:[
    {id:'fov',label:'FOV',min:.2,max:2,step:.05,def:1},
    {id:'rotX',label:'pitch',min:-1.5,max:1.5,step:.05,def:0},
    {id:'rotY',label:'yaw',min:-3.14,max:3.14,step:.05,def:0},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    const cx1=Math.cos(p.rotX||0),sx1=Math.sin(p.rotX||0);
    const cy2=Math.cos(p.rotY||0),sy2=Math.sin(p.rotY||0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      let nx=(x/w-.5)*p.fov*2,ny=(y/h-.5)*p.fov*2;
      const py=ny*cx1-sx1,pz=ny*sx1+cx1;
      const px2=nx*cy2+pz*sy2;
      const u=((Math.atan2(px2,pz+.001)+Math.PI)/(2*Math.PI))*w,v=((Math.asin(Math.max(-1,Math.min(1,py)))/Math.PI)+.5)*h;
      const[rv,gv,bv]=bl(src.data,w,h,u,v);sp(dst.data,w,x,y,rv,gv,bv);
    }
    return dst;
  }},
// ── FRACTAL ─────────────────────────────────────────────────
  mandelbrot_lens:{cat:'fractal',name:'Mandelbrot Lens',
    desc:'Uses Mandelbrot escape-time as a warp field. Points near the set boundary create strongest distortion.',
    math:'z_{n+1}=z_n²+c;  warp ∝ (zr,zi)·t·strength',
    presets:[{name:'gentle',p:{zoom:3,cx:0,cy:0,strength:.3}},{name:'medium',p:{zoom:3,cx:0,cy:0,strength:.7}},{name:'strong',p:{zoom:5,cx:-.7,cy:.1,strength:.9}}],
    params:[
    {id:'zoom',label:'zoom',min:.5,max:20,step:.1,def:3},
    {id:'cx',label:'center x',min:-2,max:2,step:.01,def:0},
    {id:'cy',label:'center y',min:-2,max:2,step:.01,def:0},
    {id:'strength',label:'strength',min:0,max:1,step:.01,def:.7},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=4/p.zoom;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const cr=(x/w-.5)*sc+p.cx,ci=(y/h-.5)*sc+p.cy;let zr=0,zi=0,n=0;while(zr*zr+zi*zi<4&&n<24){const t=zr*zr-zi*zi+cr;zi=2*zr*zi+ci;zr=t;n++;}const t=n/24;const[rv,gv,bv]=bl(src.data,w,h,(x/w+zr*t*p.strength*.1)*w,(y/h+zi*t*p.strength*.1)*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  julia_warp:{cat:'fractal',name:'Julia Warp',
    desc:'Applies Julia set iteration as a coordinate warp. Escape distance maps to displacement magnitude.',
    math:'z_{n+1}=z_n²+c (c fixed); warp = (zr,zi)·t·scale',
    presets:[{name:'classic',p:{cr:-.7,ci:.27,zoom:1.5,iters:16}},{name:'dendrite',p:{cr:0,ci:1,zoom:1.5,iters:20}},{name:'rabbit',p:{cr:-.123,ci:.745,zoom:1.5,iters:18}}],
    params:[
    {id:'cr',label:'c real',min:-2,max:2,step:.01,def:-.7},
    {id:'ci',label:'c imag',min:-2,max:2,step:.01,def:.27},
    {id:'zoom',label:'zoom',min:.1,max:10,step:.1,def:1.5},
    {id:'iters',label:'iterations',min:4,max:48,step:1,def:16},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=4/p.zoom;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let zr=(x/w-.5)*sc,zi=(y/h-.5)*sc;let n=0;while(zr*zr+zi*zi<4&&n<p.iters){const t=zr*zr-zi*zi+p.cr;zi=2*zr*zi+p.ci;zr=t;n++;}const t=n/p.iters;const sx=((x+zr*t*20)%w+w)%w,sy=((y+zi*t*20)%h+h)%h;const[rv,gv,bv]=bl(src.data,w,h,sx,sy);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  newton_warp:{cat:'fractal',name:'Newton Warp',params:[
    {id:'zoom',label:'zoom',min:.5,max:10,step:.1,def:2},
    {id:'cx',label:'cx',min:-2,max:2,step:.01,def:0},
    {id:'cy',label:'cy',min:-2,max:2,step:.01,def:0},
    {id:'strength',label:'strength',min:0,max:1,step:.01,def:.6},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=4/p.zoom;const roots=[[1,0],[-.5,Math.sqrt(3)/2],[-.5,-Math.sqrt(3)/2]];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let zr=(x/w-.5)*sc+p.cx,zi=(y/h-.5)*sc+p.cy;let n=0,ri=0;while(n<24){const z2r=zr*zr-zi*zi,z2i=2*zr*zi,z3r=z2r*zr-z2i*zi-1,z3i=z2r*zi+z2i*zr;const dm=3*(z2r*z2r+z2i*z2i)||1e-10;zr-=(z3r*z2r+z3i*z2i)/dm;zi-=(z3i*z2r-z3r*z2i)/dm;let md=Infinity;roots.forEach(([rr,ri2],i)=>{const d=Math.hypot(zr-rr,zi-ri2);if(d<md){md=d;ri=i;}});if(md<1e-5)break;n++;}const shade=1-n/24*.8;const cols=[[255,80,80],[80,220,120],[80,120,255]];const[br,bg2,bb]=cols[ri];const[or,og,ob]=px(src.data,w,h,x,y);sp(dst.data,w,x,y,or+(br*shade-or)*p.strength,og+(bg2*shade-og)*p.strength,ob+(bb*shade-ob)*p.strength);}
    return dst;
  }},
  ifs_warp:{cat:'fractal',name:'IFS Warp',params:[
    {id:'a',label:'affine a',min:-1.5,max:1.5,step:.05,def:.85},
    {id:'b',label:'affine b',min:-1.5,max:1.5,step:.05,def:.04},
    {id:'iters',label:'iterations',min:1,max:8,step:1,def:3},
    {id:'blend',label:'blend',min:0,max:1,step:.01,def:.8},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let nx=x/w-.5,ny=y/h-.5;for(let i=0;i<p.iters;i++){const tx=p.a*nx+p.b*ny;ny=p.b*nx+p.a*ny+.1;nx=tx;}const sx=((nx+.5)%1+1)%1*w,sy=((ny+.5)%1+1)%1*h;const[rv,gv,bv]=bl(src.data,w,h,sx,sy);const[or,og,ob]=px(src.data,w,h,x,y);sp(dst.data,w,x,y,or+(rv-or)*p.blend,og+(gv-og)*p.blend,ob+(bv-ob)*p.blend);}
    return dst;
  }},
  hyperbolic:{cat:'fractal',name:'Hyperbolic Tile',params:[
    {id:'p',label:'p',min:3,max:8,step:1,def:4},
    {id:'q',label:'q',min:3,max:8,step:1,def:5},
    {id:'zoom',label:'zoom',min:.1,max:2,step:.05,def:.8},
  ],fn(src,p2){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sc=p2.zoom*Math.min(w,h)/2;
    const iters=Math.max(4,Math.min(12,Math.round((p2.q||5)*1.5)));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-w/2)/sc,dy=(y-h/2)/sc;if(dx*dx+dy*dy>=1){sp(dst.data,w,x,y,0,0,0);continue;}let ur=dx,ui=dy;for(let i=0;i<iters;i++){const r3=ur*ur+ui*ui;if(r3>1){const inv=1/r3;ur=ur*inv;ui=-ui*inv;}const rot=2*Math.PI/p2.p,ang=Math.atan2(ui,ur),na=((ang%rot)+rot)%rot,len=Math.sqrt(r3);ur=len*Math.cos(na);ui=len*Math.sin(na);}const[rv,gv,bv]=bl(src.data,w,h,(ur*.5+.5)*w,(ui*.5+.5)*h);sp(dst.data,w,x,y,rv,gv,bv);}
    return dst;
  }},
  reaction_warp:{cat:'fractal',name:'Reaction Diffusion',params:[
    {id:'feed',label:'feed',min:.01,max:.1,step:.001,def:.055},
    {id:'kill',label:'kill',min:.01,max:.1,step:.001,def:.062},
    {id:'iters',label:'iterations',min:5,max:40,step:1,def:18},
    {id:'str',label:'strength',min:0,max:1,step:.01,def:.7},
  ],fn(src,p){
    const{width:w,height:h}=src;const dst=mkId(w,h);const sz=w*h;
    const U=new Float32Array(sz),V=new Float32Array(sz),U2=new Float32Array(sz),V2=new Float32Array(sz);
    for(let i=0;i<sz;i++){const pi=i*4;U[i]=1-luma(src.data[pi],src.data[pi+1],src.data[pi+2])/255;V[i]=Math.random()*.08;}
    for(let it=0;it<(p.iters|0);it++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const lu=y>0?U[(y-1)*w+x]:U[i],ru=y<h-1?U[(y+1)*w+x]:U[i],uu=x>0?U[y*w+x-1]:U[i],du=x<w-1?U[y*w+x+1]:U[i];const lv=y>0?V[(y-1)*w+x]:V[i],rv2=y<h-1?V[(y+1)*w+x]:V[i],uv=x>0?V[y*w+x-1]:V[i],dv=x<w-1?V[y*w+x+1]:V[i];const uvv=U[i]*V[i]*V[i];U2[i]=Math.max(0,Math.min(1,U[i]+(.2*(lu+ru+uu+du-4*U[i])-uvv+p.feed*(1-U[i]))));V2[i]=Math.max(0,Math.min(1,V[i]+(.1*(lv+rv2+uv+dv-4*V[i])+uvv-(p.kill+p.feed)*V[i])));}U.set(U2);V.set(V2);}
    for(let i=0;i<sz;i++){const pi=i*4,t=V[i]*p.str;const[r,g,b]=PALETTES[0](t);dst.data[pi]=src.data[pi]*(1-t)+r*t;dst.data[pi+1]=src.data[pi+1]*(1-t)+g*t;dst.data[pi+2]=src.data[pi+2]*(1-t)+b*t;dst.data[pi+3]=255;}
    return dst;
  }},
  // ── NEW ONE LAB / GLITCH LAB / MIRROR LAB EXTENSIONS ────────────
  polyhedral_kaleidoscope: {
    cat: 'mirror',
    name: 'Polyhedral Kaleidoscope',
    desc: 'Multi-fold polygonal kaleidoscope with angular sector mirroring and phase rotation.',
    math: 'Polar sector reflection: theta′ = |(theta mod 2pi/N) - pi/N|',
    params: [
      { id: 'folds', label: 'fold count', min: 2, max: 24, step: 1, def: 8 },
      { id: 'rotation', label: 'rotation angle', min: -180, max: 180, step: 1, def: 0 },
      { id: 'zoom', label: 'zoom scale', min: 0.2, max: 3.0, step: 0.05, def: 1.0 }
    ],
    fn(src, p) {
      const { width: w, height: h } = src;
      const dst = mkId(w, h);
      const cx = w / 2, cy = h / 2;
      const n = Math.max(2, p.folds || 8);
      const sector = (Math.PI * 2) / n;
      const halfSec = sector / 2;
      const rot = ((p.rotation || 0) * Math.PI) / 180;
      const zoom = p.zoom || 1.0;
      const d = src.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x - cx) / zoom;
          const dy = (y - cy) / zoom;
          const r = Math.sqrt(dx * dx + dy * dy);
          let theta = Math.atan2(dy, dx) - rot;
          theta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

          const secIdx = Math.floor(theta / sector);
          let secAngle = theta - secIdx * sector;
          if (secAngle > halfSec) secAngle = sector - secAngle;

          const finalAngle = secAngle + rot;
          const sx = cx + r * Math.cos(finalAngle);
          const sy = cy + r * Math.sin(finalAngle);

          const [r0, g0, b0] = bl(d, w, h, sx, sy);
          const di = (y * w + x) * 4;
          dst.data[di] = r0;
          dst.data[di + 1] = g0;
          dst.data[di + 2] = b0;
          dst.data[di + 3] = 255;
        }
      }
      return dst;
    }
  },

  optical_dispersion: {
    cat: 'distort',
    name: 'Optical Dispersion & Caustics',
    desc: 'Wavelength-dependent refraction simulating glass prisms, caustic ripples, and chromatic dispersion.',
    math: 'Snellian chromatic displacement delta_r(lambda)',
    params: [
      { id: 'strength', label: 'refraction strength', min: 0, max: 60, step: 1, def: 20 },
      { id: 'dispersion', label: 'chroma dispersion', min: 0, max: 25, step: 0.5, def: 8 },
      { id: 'scale', label: 'ripple scale', min: 0.005, max: 0.08, step: 0.005, def: 0.03 }
    ],
    fn(src, p) {
      const { width: w, height: h } = src;
      const dst = mkId(w, h);
      const d = src.data;
      const str = p.strength ?? 20;
      const disp = p.dispersion ?? 8;
      const sc = p.scale || 0.03;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = Math.sin(y * sc) * Math.cos(x * sc * 0.7) * str;
          const ny = Math.cos(x * sc) * Math.sin(y * sc * 0.8) * str;

          const [r] = bl(d, w, h, x + nx + disp, y + ny);
          const [, g] = bl(d, w, h, x + nx, y + ny);
          const [, , b] = bl(d, w, h, x + nx - disp, y + ny);

          const di = (y * w + x) * 4;
          dst.data[di] = r;
          dst.data[di + 1] = g;
          dst.data[di + 2] = b;
          dst.data[di + 3] = 255;
        }
      }
      return dst;
    }
  },

  phosphor_bloom: {
    cat: 'glitch',
    name: 'Phosphor Bleed & Bloom',
    desc: 'Cathode beam persistence and horizontal phosphor bloom found in analog video monitors.',
    math: 'Horizontal low-pass accumulator: Acc = Acc * decay + In * (1 - decay)',
    params: [
      { id: 'decay', label: 'persistence decay', min: 0.5, max: 0.98, step: 0.02, def: 0.86 },
      { id: 'glow', label: 'bloom gain', min: 0.5, max: 3.0, step: 0.1, def: 1.4 },
      { id: 'tint', label: 'color tint 0=cyan 1=amber 2=green', min: 0, max: 2, step: 1, def: 0 }
    ],
    fn(src, p) {
      const { width: w, height: h } = src;
      const dst = mkId(w, h);
      const d = src.data;
      const decay = p.decay ?? 0.86;
      const glow = p.glow || 1.4;
      const tint = p.tint || 0;

      let tr = 0.6, tg = 1.0, tb = 1.0;
      if (tint === 1) { tr = 1.0; tg = 0.75; tb = 0.25; }
      else if (tint === 2) { tr = 0.25; tg = 1.0; tb = 0.35; }

      for (let y = 0; y < h; y++) {
        let accR = 0, accG = 0, accB = 0;
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          accR = accR * decay + d[idx] * (1 - decay);
          accG = accG * decay + d[idx + 1] * (1 - decay);
          accB = accB * decay + d[idx + 2] * (1 - decay);

          dst.data[idx] = clamp(Math.floor(d[idx] + accR * tr * glow));
          dst.data[idx + 1] = clamp(Math.floor(d[idx + 1] + accG * tg * glow));
          dst.data[idx + 2] = clamp(Math.floor(d[idx + 2] + accB * tb * glow));
          dst.data[idx + 3] = d[idx + 3];
        }
      }
      return dst;
    }
  },

  bit_crusher: {
    cat: 'corrupt',
    name: 'Bit Crusher & Quantizer',
    desc: 'Severely reduces color channel bit-depth with ordered Bayer matrix dithering.',
    math: 'd_quant = round((d + dither) / step) * step',
    params: [
      { id: 'bits', label: 'bit depth (1-7)', min: 1, max: 7, step: 1, def: 3 },
      { id: 'dither', label: 'dither intensity', min: 0, max: 1, step: 0.05, def: 0.5 }
    ],
    fn(src, p) {
      const { width: w, height: h } = src;
      const dst = mkId(w, h);
      const d = src.data;
      const bits = Math.max(1, Math.min(7, p.bits || 3));
      const levels = 1 << bits;
      const step = 255 / (levels - 1);
      const ditherAmt = p.dither ?? 0.5;

      const bayer4 = [
        [ 0,  8,  2, 10],
        [12,  4, 14,  6],
        [ 3, 11,  1,  9],
        [15,  7, 13,  5]
      ];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          const dVal = (bayer4[y % 4][x % 4] / 16 - 0.5) * step * ditherAmt;
          dst.data[idx] = clamp(Math.round((d[idx] + dVal) / step) * step);
          dst.data[idx + 1] = clamp(Math.round((d[idx + 1] + dVal) / step) * step);
          dst.data[idx + 2] = clamp(Math.round((d[idx + 2] + dVal) / step) * step);
          dst.data[idx + 3] = d[idx + 3];
        }
      }
      return dst;
    }
  }
};

// Aliases & Engine Compatibility
for (const [k, v] of Object.entries(EFFECTS)) {
  v.id = k;
  if (!v.apply) v.apply = v.fn;
}

/**
 * RIFT Core - Procedural Generators Suite
 * 21 Mathematical Generators: Perlin, Voronoi, Gray-Scott Turing Diffusion,
 * Mandelbrot & Julia Fractals, L-Systems, Flow Fields, Strange Attractors,
 * Bytebeats, Quantum Glitch Lattice, and Chladni Acoustics.
 */

import { luma, clamp, hsl2rgb, rgb2hsl, px, bl, sp, mkId, mkCanvas, hash, vnoise, fbm, PALETTES, toPolar, fromPolar } from './math.js';
import { createBlankImageData } from './transforms.js';

export const GENERATORS = {
perlin_noise:{cat:'generator',name:'Perlin Noise',params:[
    {id:'scale',label:'scale',min:.001,max:.05,step:.001,def:.01},
    {id:'octaves',label:'octaves',min:1,max:8,step:1,def:4},
    {id:'persist',label:'persistence',min:.1,max:.9,step:.05,def:.5},
    {id:'lacun',label:'lacunarity',min:1,max:4,step:.1,def:2},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:3},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:0},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);const pal=PALETTES[p.palette%PALETTES.length];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0,a=1,f=p.scale,mx=0;for(let o=0;o<p.octaves;o++){v+=vnoise(x*f,y*f,p.seed|0)*a;mx+=a;a*=p.persist;f*=p.lacun;}v/=mx;const[r,g,b]=pal(v);const i=(y*w+x)*4;id.data[i]=r;id.data[i+1]=g;id.data[i+2]=b;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  voronoi_field:{cat:'generator',name:'Voronoi Field',params:[
    {id:'n',label:'points',min:5,max:200,step:1,def:40},
    {id:'mode',label:'mode 0=dist 1=color 2=angle',min:0,max:2,step:1,def:1},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:2},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:7},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const pts=[],cols=[];for(let i=0;i<p.n;i++){pts.push([rn()*w,rn()*h]);cols.push([rn()*360]);}
    const pal=PALETTES[p.palette%PALETTES.length];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let md=Infinity,mi=0,sec=Infinity;for(let i=0;i<pts.length;i++){const d=Math.hypot(x-pts[i][0],y-pts[i][1]);if(d<md){sec=md;md=d;mi=i;}else if(d<sec)sec=d;}const idx=(y*w+x)*4;if(p.mode<.5){const[r,g,b]=pal(Math.min(1,md/60));id.data[idx]=r;id.data[idx+1]=g;id.data[idx+2]=b;}else if(p.mode<1.5){const[r,g,b]=hsl2rgb(cols[mi][0],.7,.5);id.data[idx]=r;id.data[idx+1]=g;id.data[idx+2]=b;}else{const ang=(Math.atan2(y-pts[mi][1],x-pts[mi][0])+Math.PI)/(2*Math.PI);const[r,g,b]=pal(ang);id.data[idx]=r;id.data[idx+1]=g;id.data[idx+2]=b;}id.data[idx+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  gray_scott:{cat:'generator',name:'Gray-Scott RD',params:[
    {id:'feed',label:'feed',min:.01,max:.1,step:.001,def:.055},
    {id:'kill',label:'kill',min:.01,max:.1,step:.001,def:.062},
    {id:'steps',label:'steps',min:100,max:2000,step:50,def:700},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:0},
  ],fn(w,h,p){
    const sz=w*h;const U=new Float32Array(sz).fill(1),V=new Float32Array(sz).fill(0);
    const U2=new Float32Array(sz),V2=new Float32Array(sz);
    for(let i=0;i<20;i++){const sx=Math.floor(Math.random()*w),sy=Math.floor(Math.random()*h);for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const idx=Math.max(0,Math.min(h-1,sy+dy))*w+Math.max(0,Math.min(w-1,sx+dx));V[idx]=.5+Math.random()*.1;U[idx]=.5;}}
    for(let it=0;it<Math.min(2000,p.steps|0);it++){for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;const lu=y>0?U[(y-1)*w+x]:U[i],ru=y<h-1?U[(y+1)*w+x]:U[i],uu=x>0?U[y*w+x-1]:U[i],du=x<w-1?U[y*w+x+1]:U[i];const lv=y>0?V[(y-1)*w+x]:V[i],rv=y<h-1?V[(y+1)*w+x]:V[i],uv=x>0?V[y*w+x-1]:V[i],dv=x<w-1?V[y*w+x+1]:V[i];const uvv=U[i]*V[i]*V[i];U2[i]=Math.max(0,Math.min(1,U[i]+(.2*(lu+ru+uu+du-4*U[i])-uvv+p.feed*(1-U[i]))));V2[i]=Math.max(0,Math.min(1,V[i]+(.1*(lv+rv+uv+dv-4*V[i])+uvv-(p.kill+p.feed)*V[i])));}U.set(U2);V.set(V2);}
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);const pal=PALETTES[p.palette%PALETTES.length];
    for(let i=0;i<sz;i++){const[r,g,b]=pal(V[i]);id.data[i*4]=r;id.data[i*4+1]=g;id.data[i*4+2]=b;id.data[i*4+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  plasma:{cat:'generator',name:'Plasma',params:[
    {id:'scale',label:'scale',min:.005,max:.1,step:.005,def:.02},
    {id:'time',label:'time phase',min:0,max:10,step:.1,def:0},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:2},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);const pal=PALETTES[p.palette%PALETTES.length];const t=p.time;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=((Math.sin(x*p.scale+t)+Math.sin(y*p.scale+t)+Math.sin((x+y)*p.scale+t)+Math.sin(Math.sqrt(x*x+y*y)*p.scale+t))*.25+.5);const[r,g,b]=pal(v);const i=(y*w+x)*4;id.data[i]=r;id.data[i+1]=g;id.data[i+2]=b;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  mandelbrot:{cat:'generator',name:'Mandelbrot Set',params:[
    {id:'zoom',label:'zoom',min:.5,max:500,step:.5,def:2.5},
    {id:'cx',label:'center x',min:-2.5,max:1,step:.001,def:-.5},
    {id:'cy',label:'center y',min:-1.5,max:1.5,step:.001,def:0},
    {id:'iters',label:'iterations',min:32,max:512,step:8,def:128},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:0},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);const sc=4/p.zoom;const pal=PALETTES[p.palette%PALETTES.length];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const cr=(x/w-.5)*sc+p.cx,ci=(y/h-.5)*sc+p.cy;let zr=0,zi=0,n=0;const mx=p.iters|0;while(zr*zr+zi*zi<4&&n<mx){const t=zr*zr-zi*zi+cr;zi=2*zr*zi+ci;zr=t;n++;}const tv=n===mx?0:n/mx;const[r,g,b]=pal(tv);const i=(y*w+x)*4;id.data[i]=r;id.data[i+1]=g;id.data[i+2]=b;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  julia:{cat:'generator',name:'Julia Set',params:[
    {id:'cr',label:'c real',min:-2,max:2,step:.005,def:-.7},
    {id:'ci',label:'c imag',min:-2,max:2,step:.005,def:.27},
    {id:'zoom',label:'zoom',min:.5,max:20,step:.1,def:1.5},
    {id:'iters',label:'iterations',min:32,max:512,step:8,def:128},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:5},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);const sc=4/p.zoom;const pal=PALETTES[p.palette%PALETTES.length];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let zr=(x/w-.5)*sc,zi=(y/h-.5)*sc;let n=0;const mx=p.iters|0;while(zr*zr+zi*zi<4&&n<mx){const t=zr*zr-zi*zi+p.cr;zi=2*zr*zi+p.ci;zr=t;n++;}const tv=n===mx?0:n/mx;const[r,g,b]=pal(tv);const i=(y*w+x)*4;id.data[i]=r;id.data[i+1]=g;id.data[i+2]=b;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  newton:{cat:'generator',name:'Newton Fractal',params:[
    {id:'zoom',label:'zoom',min:.1,max:5,step:.05,def:1},
    {id:'cx',label:'cx',min:-2,max:2,step:.01,def:0},
    {id:'cy',label:'cy',min:-2,max:2,step:.01,def:0},
    {id:'iters',label:'iterations',min:8,max:128,step:4,def:32},
    {id:'roots',label:'roots 3/4/5',min:3,max:5,step:1,def:3},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);
    const sc=4/p.zoom;const nr=Math.round(p.roots);
    const roots=Array.from({length:nr},(_,i)=>[Math.cos(2*Math.PI*i/nr),Math.sin(2*Math.PI*i/nr)]);
    const rootCols=roots.map((_,i)=>hsl2rgb((i/nr)*360,1,.5));
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let zr=(x/w-.5)*sc+p.cx,zi=(y/h-.5)*sc+p.cy;let n=0,ri=0;const mx=p.iters|0;
      while(n<mx){// z^nr - 1
        let pr=1,pi2=0;for(let k=0;k<nr-1;k++){const tr=pr*zr-pi2*zi,ti=pr*zi+pi2*zr;pr=tr;pi2=ti;}// numerator z^nr - 1
        const numr=pr*zr-pi2*zi-1,numi=pr*zi+pi2*zr;// denominator nr*z^(nr-1)
        const dr2=pr*nr,di2=pi2*nr;const dm=dr2*dr2+di2*di2||1e-10;zr-=(numr*dr2+numi*di2)/dm;zi-=(numi*dr2-numr*di2)/dm;
        let md=Infinity;roots.forEach(([rr,ri2],k)=>{const d=Math.hypot(zr-rr,zi-ri2);if(d<md){md=d;ri=k;}});if(md<1e-5)break;n++;}
      const shade=1-n/mx*.7;const[br,bg2,bb]=rootCols[ri];const i=(y*w+x)*4;id.data[i]=br*shade;id.data[i+1]=bg2*shade;id.data[i+2]=bb*shade;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  lsystem:{cat:'generator',name:'L-System',params:[
    {id:'preset',label:'preset 0-5',min:0,max:5,step:1,def:1},
    {id:'iters',label:'iterations',min:1,max:7,step:1,def:4},
    {id:'angle',label:'branch angle°',min:5,max:90,step:1,def:25},
    {id:'step',label:'step length',min:1,max:20,step:.5,def:5},
    {id:'lw',label:'line width',min:.1,max:3,step:.1,def:.7},
  ],fn(w,h,p){
    const prs=[
      {axiom:'F',rules:{F:'F+F-F-F+F'},angle:90},
      {axiom:'F',rules:{F:'FF+[+F-F-F]-[-F+F+F]'},angle:p.angle},
      {axiom:'X',rules:{X:'F+[[X]-X]-F[-FX]+X',F:'FF'},angle:p.angle},
      {axiom:'F-F-F-F',rules:{F:'F-F+F+FF-F-F+F'},angle:90},
      {axiom:'FX',rules:{X:'X+YF+',Y:'-FX-Y'},angle:90},
      {axiom:'-F',rules:{F:'F+F-F-F+F'},angle:90},
    ];
    const pr=prs[p.preset|0]||prs[1];let str=pr.axiom;
    for(let i=0;i<(p.iters|0);i++){let ns='';for(const ch of str)ns+=(pr.rules[ch]||ch);if(ns.length>300000)break;str=ns;}
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');ctx.fillStyle='#07070a';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(162,155,254,0.7)';ctx.lineWidth=p.lw;const ar=pr.angle*Math.PI/180;
    let x=w/2,y=h*.8,ang=-Math.PI/2;const stk=[];ctx.beginPath();ctx.moveTo(x,y);
    for(const ch of str){if(ch==='F'||ch==='G'){const nx=x+p.step*Math.cos(ang),ny=y+p.step*Math.sin(ang);ctx.lineTo(nx,ny);x=nx;y=ny;}else if(ch==='+')ang+=ar;else if(ch==='-')ang-=ar;else if(ch==='['){stk.push([x,y,ang]);ctx.moveTo(x,y);}else if(ch===']'&&stk.length){[x,y,ang]=stk.pop();ctx.moveTo(x,y);}}
    ctx.stroke();return c;
  }},
  flow_field:{cat:'generator',name:'Flow Field',params:[
    {id:'scale',label:'noise scale',min:.001,max:.05,step:.001,def:.008},
    {id:'parts',label:'particles',min:500,max:8000,step:100,def:3000},
    {id:'steps',label:'trace steps',min:10,max:200,step:5,def:80},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:1},
    {id:'alpha',label:'line opacity',min:.05,max:1,step:.05,def:.3},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:0},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');ctx.fillStyle='#07070a';ctx.fillRect(0,0,w,h);
    const pal=PALETTES[p.palette%PALETTES.length];let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    ctx.lineWidth=.8;
    for(let i=0;i<(p.parts|0);i++){
      let px2=rn()*w,py=rn()*h;ctx.beginPath();ctx.moveTo(px2,py);
      for(let st=0;st<(p.steps|0);st++){const ang=fbm(px2,py,2,.5,p.scale,s)*Math.PI*4;px2+=Math.cos(ang)*1.5;py+=Math.sin(ang)*1.5;if(px2<0||px2>w||py<0||py>h)break;ctx.lineTo(px2,py);}
      const t=i/(p.parts|0);const[r,g,b]=pal(t);ctx.strokeStyle=`rgba(${r},${g},${b},${p.alpha})`;ctx.stroke();ctx.beginPath();ctx.moveTo(px2,py);
    }
    return c;
  }},
  truchet:{cat:'generator',name:'Truchet Tiles',params:[
    {id:'size',label:'tile size',min:8,max:80,step:4,def:32},
    {id:'mode',label:'mode 0=arc 1=line 2=diag',min:0,max:2,step:1,def:0},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:3},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:5},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');
    const pal=PALETTES[p.palette%PALETTES.length];const bg=pal(.2),fg=pal(.8);
    ctx.fillStyle=`rgb(${bg[0]},${bg[1]},${bg[2]})`;ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=`rgb(${fg[0]},${fg[1]},${fg[2]})`;ctx.lineWidth=2;
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const sz=p.size|0;
    for(let y=0;y<h;y+=sz)for(let x=0;x<w;x+=sz){const t=Math.floor(rn()*4);ctx.beginPath();
      if(p.mode<.5){if(t%2===0){ctx.arc(x,y,sz/2,0,Math.PI/2);ctx.arc(x+sz,y+sz,sz/2,Math.PI,1.5*Math.PI);}else{ctx.arc(x+sz,y,sz/2,Math.PI/2,Math.PI);ctx.arc(x,y+sz,sz/2,-Math.PI/2,0);}}
      else if(p.mode<1.5){if(t%2===0){ctx.moveTo(x,y+sz/2);ctx.lineTo(x+sz,y+sz/2);}else{ctx.moveTo(x+sz/2,y);ctx.lineTo(x+sz/2,y+sz);}}
      else{if(t%2===0){ctx.moveTo(x,y);ctx.lineTo(x+sz,y+sz);}else{ctx.moveTo(x+sz,y);ctx.lineTo(x,y+sz);}}
      ctx.stroke();}
    return c;
  }},
  interference:{cat:'generator',name:'Wave Interference',params:[
    {id:'sources',label:'sources',min:2,max:8,step:1,def:3},
    {id:'freq',label:'frequency',min:.01,max:.2,step:.005,def:.06},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:2},
    {id:'seed',label:'seed',min:0,max:999,step:1,def:0},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');const id=ctx.createImageData(w,h);
    let s=p.seed|0;const rn=()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/4294967295;};
    const srcs=[];for(let i=0;i<p.sources;i++)srcs.push([rn()*w,rn()*h]);
    const pal=PALETTES[p.palette%PALETTES.length];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){let v=0;for(const[sx,sy] of srcs)v+=Math.sin(Math.hypot(x-sx,y-sy)*p.freq*2*Math.PI);v=v/srcs.length*.5+.5;const[r,g,b]=pal(v);const i=(y*w+x)*4;id.data[i]=r;id.data[i+1]=g;id.data[i+2]=b;id.data[i+3]=255;}
    ctx.putImageData(id,0,0);return c;
  }},
  spirograph:{cat:'generator',name:'Spirograph',params:[
    {id:'R',label:'outer radius',min:10,max:200,step:1,def:100},
    {id:'r',label:'inner radius',min:5,max:100,step:1,def:60},
    {id:'d',label:'pen offset',min:5,max:100,step:1,def:50},
    {id:'steps',label:'steps',min:100,max:10000,step:100,def:3000},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:2},
    {id:'lw',label:'line width',min:.1,max:3,step:.1,def:.8},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');ctx.fillStyle='#07070a';ctx.fillRect(0,0,w,h);
    const pal=PALETTES[p.palette%PALETTES.length];const cx2=w/2,cy2=h/2;
    const steps=p.steps|0;ctx.lineWidth=p.lw;
    let ox=(p.R-p.r)*1+p.d,oy=0;ctx.beginPath();ctx.moveTo(cx2+ox,cy2+oy);
    for(let i=1;i<=steps;i++){const t=i/steps*Math.PI*2*(p.r/(Math.abs(p.R-p.r)||1)+1);const x2=(p.R-p.r)*Math.cos(t)+p.d*Math.cos((p.R-p.r)/p.r*t);const y2=(p.R-p.r)*Math.sin(t)-p.d*Math.sin((p.R-p.r)/p.r*t);ctx.lineTo(cx2+x2,cy2+y2);const t2=i/steps;const[r,g,b]=pal(t2);ctx.strokeStyle=`rgba(${r},${g},${b},0.8)`;ctx.stroke();ctx.beginPath();ctx.moveTo(cx2+x2,cy2+y2);}
    return c;
  }},
  lissajous:{cat:'generator',name:'Lissajous / Harmonics',params:[
    {id:'a',label:'freq a',min:1,max:10,step:1,def:3},
    {id:'b',label:'freq b',min:1,max:10,step:1,def:4},
    {id:'delta',label:'phase',min:0,max:6.28,step:.05,def:1.57},
    {id:'layers',label:'layers',min:1,max:8,step:1,def:4},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:6},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');ctx.fillStyle='#07070a';ctx.fillRect(0,0,w,h);
    const pal=PALETTES[p.palette%PALETTES.length];
    for(let layer=0;layer<(p.layers|0);layer++){
      const scale=(.4-layer*.04)*Math.min(w,h);const steps=2000;ctx.lineWidth=.6;
      ctx.beginPath();const t0=0;const x0=w/2+scale*Math.sin(p.a*t0+p.delta*layer),y0=h/2+scale*Math.sin(p.b*t0);ctx.moveTo(x0,y0);
      for(let i=1;i<=steps;i++){const t=i/steps*Math.PI*2*Math.max(p.a,p.b);const x2=w/2+scale*Math.sin(p.a*t+p.delta*layer),y2=h/2+scale*Math.sin(p.b*t);ctx.lineTo(x2,y2);}
      const[r,g,b]=pal(layer/(p.layers|0));ctx.strokeStyle=`rgba(${r},${g},${b},0.6)`;ctx.stroke();
    }
    return c;
  }},
  strange_attractor:{cat:'generator',name:'Strange Attractor',params:[
    {id:'type',label:'type 0=lorenz 1=rossa 2=deJong',min:0,max:2,step:1,def:0},
    {id:'steps',label:'iterations',min:10000,max:500000,step:10000,def:80000},
    {id:'palette',label:'palette 0-6',min:0,max:6,step:1,def:2},
  ],fn(w,h,p){
    const c=mkCanvas(w,h);const ctx=c.getContext('2d');ctx.fillStyle='#07070a';ctx.fillRect(0,0,w,h);
    const pal=PALETTES[p.palette%PALETTES.length];const steps=Math.min(500000,p.steps|0);
    const pts=[];let x=.1,y=0,z=0,dt=.005;
    if(p.type<.5){// Lorenz
      for(let i=0;i<steps;i++){const dx=10*(y-x),dy=x*(28-z)-y,dz=x*y-8/3*z;x+=dx*dt;y+=dy*dt;z+=dz*dt;if(i>100)pts.push([x,y,z]);}
    }else if(p.type<1.5){// Rossler
      for(let i=0;i<steps;i++){const dx=-(y+z),dy=x+.2*y,dz=.2+z*(x-5.7);x+=dx*dt;y+=dy*dt;z+=dz*dt;if(i>100)pts.push([x,y,z]);}
    }else{// DeJong
      const[a,b2,cc,d]=[1.4,-.5,1.4,.5];let px2=0.1,py=0;for(let i=0;i<steps;i++){const nx=Math.sin(a*py)-Math.cos(b2*px2),ny=Math.sin(cc*px2)-Math.cos(d*py);px2=nx;py=ny;pts.push([px2,py,0]);}
    }
    if(!pts.length)return c;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const[px2,py] of pts){minX=Math.min(minX,px2);maxX=Math.max(maxX,px2);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
    const rng=Math.max(maxX-minX,maxY-minY)||1,margin=.9;
    for(let i=0;i<pts.length;i++){const[px2,py]=pts[i];const sx=((px2-minX)/rng*margin+.05)*w;const sy=((py-minY)/rng*margin+.05)*h;const[r,g,b]=pal(i/pts.length);sp(ctx.getImageData(0,0,1,1).data,1,0,0,0,0,0);// dummy
      ctx.fillStyle=`rgba(${r},${g},${b},0.12)`;ctx.fillRect(sx,sy,1,1);}
    return c;
  }},
  // ── NEW ADVANCED MATHEMATICAL GENERATORS ──────────────────────
  bytebeat_fracture: {
    cat: 'generator',
    name: 'Bytebeat Fracture',
    desc: 'Low-level 8-bit mathematical bitwise bytebeat synthesis mapped to 2D RGBA planes.',
    params: [
      { id: 'formula', label: 'formula 0-3', min: 0, max: 3, step: 1, def: 0 },
      { id: 'scale', label: 'spatial scale', min: 0.1, max: 5.0, step: 0.1, def: 1.0 },
      { id: 'speed', label: 'phase shift', min: 0, max: 500, step: 1, def: 42 },
      { id: 'palette', label: 'palette 0-7', min: 0, max: 7, step: 1, def: 5 }
    ],
    fn(w, h, p) {
      const c = mkCanvas(w, h);
      const ctx = c.getContext('2d');
      const id = ctx.createImageData(w, h);
      const d = id.data;
      const formula = p.formula || 0;
      const scale = p.scale || 1.0;
      const tShift = p.speed || 42;
      const pal = PALETTES[p.palette % PALETTES.length];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = Math.floor(x * scale + y * scale * w + tShift) & 0xffffff;
          let val = 0;
          if (formula === 0) val = ((t * (t >> 8 | t >> 9) & 46 & (t >> 8)) ^ (t & (t >> 13 | t >> 6))) & 0xff;
          else if (formula === 1) val = ((t >> 7 | t | t >> 6) * 10 + ((t & 4096) ? (t >> 4) : 0)) & 0xff;
          else if (formula === 2) val = ((t * 5 & t >> 7) | (t * 3 & t >> 10)) & 0xff;
          else val = (((t >> 4) * (t >> 8)) & ((t >> 12) * (t >> 6))) & 0xff;

          const [r, g, b] = pal(val / 255);
          const idx = (y * w + x) * 4;
          d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      return c;
    }
  },

  quantum_glitch: {
    cat: 'generator',
    name: 'Quantum Glitch Lattice',
    desc: 'Cellular entropy lattice with non-linear bit-shifting XOR noise and phase collapses.',
    params: [
      { id: 'entropy', label: 'entropy level', min: 0.1, max: 1.0, step: 0.05, def: 0.65 },
      { id: 'blockSize', label: 'block lattice', min: 4, max: 64, step: 2, def: 16 },
      { id: 'seed', label: 'entropy seed', min: 1, max: 9999, step: 1, def: 1337 },
      { id: 'palette', label: 'palette 0-7', min: 0, max: 7, step: 1, def: 2 }
    ],
    fn(w, h, p) {
      const c = mkCanvas(w, h);
      const ctx = c.getContext('2d');
      const id = ctx.createImageData(w, h);
      const d = id.data;
      const entropy = p.entropy ?? 0.65;
      const bSize = Math.max(2, p.blockSize || 16);
      const seed = p.seed || 1337;
      const pal = PALETTES[p.palette % PALETTES.length];

      function prng(n) {
        let x = Math.sin(n) * 43758.5453123;
        return x - Math.floor(x);
      }

      for (let by = 0; by < h; by += bSize) {
        for (let bx = 0; bx < w; bx += bSize) {
          const bIdx = Math.floor(by / bSize) * Math.ceil(w / bSize) + Math.floor(bx / bSize);
          const blockRand = prng(bIdx + seed);

          if (blockRand < entropy) {
            for (let y = by; y < Math.min(h, by + bSize); y++) {
              for (let x = bx; x < Math.min(w, bx + bSize); x++) {
                const idx = (y * w + x) * 4;
                const pattern = ((x ^ y) * 13 + bIdx * 17) & 0xff;
                const [r, g, b] = pal(pattern / 255);
                d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
              }
            }
          } else {
            const baseShade = Math.floor(blockRand * 25);
            for (let y = by; y < Math.min(h, by + bSize); y++) {
              for (let x = bx; x < Math.min(w, bx + bSize); x++) {
                const idx = (y * w + x) * 4;
                d[idx] = baseShade; d[idx + 1] = baseShade; d[idx + 2] = baseShade + 6; d[idx + 3] = 255;
              }
            }
          }
        }
      }
      ctx.putImageData(id, 0, 0);
      return c;
    }
  },

  chladni_plate: {
    cat: 'generator',
    name: 'Chladni Resonance',
    desc: '2D acoustic resonance nodal vibrational patterns on a vibrating elastic plate.',
    math: 'cos(n pi x/L) cos(m pi y/L) - cos(m pi x/L) cos(n pi y/L) = 0',
    params: [
      { id: 'n', label: 'harmonic n', min: 1, max: 16, step: 1, def: 5 },
      { id: 'm', label: 'harmonic m', min: 1, max: 16, step: 1, def: 3 },
      { id: 'sharpness', label: 'nodal sharpness', min: 1, max: 20, step: 0.5, def: 8 },
      { id: 'palette', label: 'palette 0-7', min: 0, max: 7, step: 1, def: 5 }
    ],
    fn(w, h, p) {
      const c = mkCanvas(w, h);
      const ctx = c.getContext('2d');
      const id = ctx.createImageData(w, h);
      const d = id.data;
      const n = p.n || 5;
      const m = p.m || 3;
      const sharp = p.sharpness || 8;
      const pal = PALETTES[p.palette % PALETTES.length];

      for (let y = 0; y < h; y++) {
        const ny = (y / h - 0.5) * 2;
        for (let x = 0; x < w; x++) {
          const nx = (x / w - 0.5) * 2;
          const v = Math.cos(n * Math.PI * nx) * Math.cos(m * Math.PI * ny) -
                    Math.cos(m * Math.PI * nx) * Math.cos(n * Math.PI * ny);
          const intensity = Math.exp(-Math.abs(v) * sharp);
          const [r, g, b] = pal(intensity);
          const idx = (y * w + x) * 4;
          d[idx] = r; d[idx + 1] = g; d[idx + 2] = b; d[idx + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      return c;
    }
  },

  clifford_attractor: {
    cat: 'generator',
    name: 'Clifford Attractor',
    desc: 'Strange non-linear chaotic attractor map creating dense luminous orbital filaments.',
    math: 'x′ = sin(a y) + c cos(a x), y′ = sin(b x) + d cos(b y)',
    params: [
      { id: 'a', label: 'parameter a', min: -3, max: 3, step: 0.05, def: -1.4 },
      { id: 'b', label: 'parameter b', min: -3, max: 3, step: 0.05, def: 1.6 },
      { id: 'c', label: 'parameter c', min: -3, max: 3, step: 0.05, def: 1.0 },
      { id: 'd', label: 'parameter d', min: -3, max: 3, step: 0.05, def: 0.7 },
      { id: 'iters', label: 'points (k)', min: 50, max: 500, step: 50, def: 200 },
      { id: 'palette', label: 'palette 0-7', min: 0, max: 7, step: 1, def: 1 }
    ],
    fn(w, h, p) {
      const c = mkCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, w, h);

      const a = p.a ?? -1.4, b = p.b ?? 1.6, cp = p.c ?? 1.0, dp = p.d ?? 0.7;
      const total = (p.iters || 200) * 1000;
      const pal = PALETTES[p.palette % PALETTES.length];

      let x = 0.1, y = 0.1;
      const scale = Math.min(w, h) * 0.18;
      const cx = w / 2, cy = h / 2;

      for (let i = 0; i < total; i++) {
        const nx = Math.sin(a * y) + cp * Math.cos(a * x);
        const ny = Math.sin(b * x) + dp * Math.cos(b * y);
        x = nx; y = ny;

        if (i > 100) {
          const px = cx + x * scale;
          const py = cy + y * scale;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const [r, g, b] = pal((i % 1000) / 1000);
            ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
            ctx.fillRect(px, py, 1.2, 1.2);
          }
        }
      }
      return c;
    }
  }
};

// Aliases & Engine Compatibility
for (const [k, v] of Object.entries(GENERATORS)) {
  v.id = k;
  v.generate = function(w, h, p) {
    const res = v.fn(w, h, p);
    if (res instanceof ImageData) return res;
    if (res && res.getContext) return res.getContext('2d').getImageData(0, 0, w, h);
    return createBlankImageData(w, h);
  };
}

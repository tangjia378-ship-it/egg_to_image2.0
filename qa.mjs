import fs from 'node:fs';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const script=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
new vm.Script(script);
const width=process.argv.includes('--mobile')?390:1600;
const context={__AJ_HEADLESS__:true,innerWidth:width,performance,console,Float32Array,Math,Map,Array,Number,parseInt,document:{getElementById(){return null}},setTimeout,clearTimeout};
context.window=context;const buildStart=performance.now();new Function('window','document','innerWidth',script.replace('globalThis.__AJ_HEADLESS__','true'))(context,context.document,width);const aj=context.__aj,checks=[],buildMS=performance.now()-buildStart;
function check(name,fn){try{const detail=fn();checks.push({name,pass:true,detail})}catch(e){checks.push({name,pass:false,error:e.message})}}
function run(seconds,dt=1/60){for(let i=0;i<Math.ceil(seconds/dt);i++)aj.step(dt)}

check('No external resources',()=>{assert(!/<(?:script|link|img|iframe|audio|video)[^>]+(?:src|href)\s*=\s*["']https?:/i.test(html));assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script));return 'No network APIs or external resource elements'});
check('Mesh buffers and object transforms are finite',()=>{assert(aj.geometry.opaque.every(Number.isFinite));assert(aj.geometry.water.every(Number.isFinite));assert(aj.objects.every(Number.isFinite));return aj.inspect().geometry});
check('Waves propagate, stay finite, and decay',()=>{aj.reset();aj.sim.splash(.3,.6,-.045,.17,.5);const before=aj.sim.energy();run(2);const middle=aj.sim.energy();run(10);const after=aj.sim.energy();assert(aj.inspect().sim.finite);assert(after<before*.2,`${after} versus ${before}`);return {before,middle,after}});
check('Fish stay in water during feeding, tides, and splashes',()=>{aj.reset();let outside=0;aj.setTide(-.1);aj.feed();for(let i=0;i<1800;i++){if(i%100===0)aj.stir(Math.sin(i)*1.5,Math.cos(i)*1.5);aj.step(1/60);outside+=aj.inspect().fish.outside}assert.equal(outside,0);return {fish:aj.inspect().fish.count,eaten:aj.inspect().fed}});
check('Food attracts fish and is consumed',()=>{aj.reset();aj.setTide(0);aj.feed();run(30);assert(aj.inspect().fed>=8,`Only ${aj.inspect().fed} pellets eaten`);return {eaten:aj.inspect().fed,remaining:aj.inspect().pellets}});
check('One complete plane loop climbs and lands',()=>{aj.reset();aj.seaplane();run(60);const p=aj.inspect().plane;assert(p.maxAltitude>2.8);assert(p.touchdowns>=1);assert(aj.inspect().landings>=1);return p});
check('Floating plane follows four surface samples',()=>{aj.reset();aj.sim.splash(-1.8,.2,.045,.3,.3);let offset=0;for(let i=0;i<120;i++){aj.step(1/60);offset=Math.max(offset,Math.abs(aj.state.plane.y-(1.3+aj.state.tide+.2)))}assert(offset>.0005);assert(Math.abs(aj.state.plane.pitch)<.16&&Math.abs(aj.state.plane.roll)<.16);return {maxWaterOffset:offset}});
check('Touchdown makes foam and waves',()=>{aj.reset();aj.state.plane.phase=6;aj.state.plane.elapsed=4.99;aj.step(1/60);assert.equal(aj.inspect().plane.phase,'touchdown');assert(aj.sim.foam.some(v=>v>.2));assert(aj.sim.energy()>.0001);return {foamPeak:Math.max(...aj.sim.foam),waveEnergy:aj.sim.energy()}});
check('A finger scatters a school',()=>{aj.reset();const f=aj.state.fish[0],before=[f.vx,f.vz];aj.stir(f.x+.07,f.z);assert(f.fear>0);assert(f.vx<before[0]);return {beforeVelocity:before,afterVelocity:[f.vx,f.vz]}});
check('Rings settle flat and remain on the surface',()=>{aj.reset();run(6);const rings=aj.inspect().rings;assert(rings.every(r=>r.flat&&Math.abs(r.height-r.surface)<.03));return rings});
check('Tilt sloshes and returns to rest',()=>{aj.reset();aj.setTilt(.06,-.04);run(.5);assert(aj.sim.energy()>.00001);run(8);assert(Math.abs(aj.state.tiltX)+Math.abs(aj.state.tiltZ)<.0001);return {tilt:[aj.state.tiltX,aj.state.tiltZ],energy:aj.sim.energy()}});
check('Pause freezes physics and the plane',()=>{const t=aj.state.time,x=aj.state.plane.x;aj.pause();run(1);assert.equal(aj.state.time,t);assert.equal(aj.state.plane.x,x);aj.pause();});
check('Water simulation performance',()=>{aj.reset();for(let i=0;i<30;i++)aj.sim.step(1/60);const samples=[];for(let i=0;i<180;i++){const start=performance.now();aj.sim.step(1/60);samples.push(performance.now()-start)}samples.sort((a,b)=>a-b);return {resolution:aj.sim.n,meanMS:samples.reduce((a,b)=>a+b,0)/samples.length,p95MS:samples[Math.floor(samples.length*.95)]}});
const report={viewport:width,buildMS,htmlBytes:Buffer.byteLength(html),checks,passed:checks.filter(x=>x.pass).length,total:checks.length};
console.log(JSON.stringify(report,null,2));fs.writeFileSync(new URL(width<760?'./qa-mobile.json':'./qa-desktop.json',import.meta.url),JSON.stringify(report,null,2));

// This offline mesh proof is a CPU authoring preview, not a browser screenshot.
if(process.argv.includes('--preview')){
 aj.reset();run(.3);const w=1100,h=850,matrix=aj.camera(w,h),rgba=new Uint8Array(w*h*4),depth=new Float32Array(w*h);depth.fill(Infinity);for(let i=0;i<w*h;i++){rgba[i*4]=236;rgba[i*4+1]=233;rgba[i*4+2]=227;rgba[i*4+3]=255}
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)},light=norm([-3,7,5]);
 const xf=(p,m,translate=true)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+(translate?m[12]:0),m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+(translate?m[13]:0),m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+(translate?m[14]:0)];
 function draw(data,water=false){for(let k=0;k<data.length;k+=42){const verts=[];for(let j=0;j<3;j++){const off=k+j*14,id=data[off+12]|0,obj=aj.objects.subarray(id*16,id*16+16),p=xf(Array.from(data.subarray(off,off+3)),obj),n=norm(xf(Array.from(data.subarray(off+3,off+6)),obj,false)),s=xf(p,matrix),color=Array.from(data.subarray(off+6,off+10));verts.push({p,n,s:[(s[0]*.5+.5)*w,(.5-s[1]*.5)*h,s[2]],color})}const [a,b,c]=verts,area=(b.s[0]-a.s[0])*(c.s[1]-a.s[1])-(b.s[1]-a.s[1])*(c.s[0]-a.s[0]);if(Math.abs(area)<.01)continue;const x0=Math.max(0,Math.floor(Math.min(a.s[0],b.s[0],c.s[0]))),x1=Math.min(w-1,Math.ceil(Math.max(a.s[0],b.s[0],c.s[0]))),y0=Math.max(0,Math.floor(Math.min(a.s[1],b.s[1],c.s[1]))),y1=Math.min(h-1,Math.ceil(Math.max(a.s[1],b.s[1],c.s[1])));const mat=data[k+10];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=((b.s[0]-x)*(c.s[1]-y)-(b.s[1]-y)*(c.s[0]-x))/area,v=((c.s[0]-x)*(a.s[1]-y)-(c.s[1]-y)*(a.s[0]-x))/area,t=1-u-v;if(u<0||v<0||t<0)continue;const z=a.s[2]*u+b.s[2]*v+c.s[2]*t,idx=y*w+x;if(z>depth[idx])continue;const p=a.p.map((q,i)=>q*u+b.p[i]*v+c.p[i]*t),n=norm(a.n.map((q,i)=>q*u+b.n[i]*v+c.n[i]*t));let col=a.color.slice(0,3),alpha=a.color[3];if(water){if(mat===1&&p[1]<vm.runInContext(`floorAt(${p[0]},${p[2]})`,context))continue;alpha=mat===1?.17:.25;col=[.1,.76,.71]}else if(mat!==4){const shade=.43+.22*(n[1]*.5+.5)+Math.max(0,dot(n,light))*.53;col=col.map(q=>q*shade);if(p[1]<1.3&&Math.abs(p[0])<2.61&&Math.abs(p[2])<2.61){col[0]*=.83;col[1]*=.98;col[2]*=1.04}depth[idx]=z}for(let ch=0;ch<3;ch++)rgba[idx*4+ch]=Math.max(0,Math.min(255,Math.round(col[ch]*255*alpha+rgba[idx*4+ch]*(1-alpha))))}}}
 draw(aj.geometry.opaque);draw(aj.geometry.water,true);
 function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^-1)>>>0}
 const chunk=(type,bytes)=>{const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,bytes])));return Buffer.concat([len,tag,bytes,crc])};const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++){raw[y*(w*4+1)]=0;Buffer.from(rgba.buffer,y*w*4,w*4).copy(raw,y*(w*4+1)+1)}fs.writeFileSync(new URL('./scene-proof.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
if(checks.some(x=>!x.pass))process.exitCode=1;

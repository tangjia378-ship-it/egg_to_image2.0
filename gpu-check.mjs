import fs from 'node:fs';
import {deflateSync} from 'node:zlib';
import {create,globals} from './.tools/node_modules/webgpu/index.js';
Object.assign(globalThis,globals);
const gpu=create([]),html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).replace('globalThis.__AJ_HEADLESS__','true'),win={};
new Function('window','document','innerWidth','navigator',source)(win,{getElementById(){return null}},1600,{gpu});
const aj=win.__aj,w=1280,h=960;let device,output;const errors=[];
const context={configure(options){device=options.device;device.addEventListener('uncapturederror',e=>errors.push(e.error.message));output=device.createTexture({size:[w,h],format:options.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});},getCurrentTexture(){return output}};
try{
 const renderer=await aj.renderOffscreen({getContext(){return context}},w,h);
 await device.queue.onSubmittedWorkDone();
 const stride=Math.ceil(w*4/256)*256,buffer=device.createBuffer({size:stride*h,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),enc=device.createCommandEncoder();enc.copyTextureToBuffer({texture:output},{buffer,bytesPerRow:stride},[w,h]);device.queue.submit([enc.finish()]);await buffer.mapAsync(GPUMapMode.READ);const data=new Uint8Array(buffer.getMappedRange()),rgba=new Uint8Array(w*h*4);for(let y=0;y<h;y++)rgba.set(data.subarray(y*stride,y*stride+w*4),y*w*4);buffer.unmap();
 if(gpu.getPreferredCanvasFormat().startsWith('bgra'))for(let i=0;i<rgba.length;i+=4){const r=rgba[i];rgba[i]=rgba[i+2];rgba[i+2]=r}
 const crc32=bytes=>{let crc=-1;for(const byte of bytes){crc^=byte;for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^-1)>>>0},chunk=(name,bytes)=>{const tag=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(bytes.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,bytes])));return Buffer.concat([len,tag,bytes,crc])},header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const raw=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)Buffer.from(rgba.buffer,y*w*4,w*4).copy(raw,y*(w*4+1)+1);fs.writeFileSync(new URL('./scene-preview.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
 console.log(JSON.stringify({nativeGPU:true,errors,diagnostics:aj.inspect()},null,2));renderer.destroy();
 if(errors.length)process.exitCode=1;
}catch(error){console.error(error.stack);device?.destroy();process.exitCode=1}
process.exit(process.exitCode||0);

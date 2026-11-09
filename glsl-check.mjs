import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),glslang=require('./.tools/node_modules/@webgpu/glslang')();
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8'),source=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).replace('globalThis.__AJ_HEADLESS__','true'),win={};
new Function('window','document','innerWidth',source)(win,{getElementById(){return null}},390);
// glslang's SPIR-V target needs a newer header and explicit locations/bindings.
// Shader expressions and function bodies are left unchanged.
function normalize(text){let binding=1,inLocation=0,outLocation=0,uniforms=[];text=text.replace('#version 300 es','#version 450').replace(/precision\s+\w+\s+\w+;/g,'');text=text.replace(/uniform (mat4|vec4|int) ([^;]+);/g,(_,type,names)=>{uniforms.push(`${type} ${names};`);return ''});text=text.replace(/uniform sampler2D ([^;]+);/g,(_,names)=>names.split(',').map(name=>`layout(set=0,binding=${binding++}) uniform sampler2D ${name.trim()};`).join('\n'));text=text.replace(/(^|;)\s*(in|out) (vec[234]) ([^;]+);/g,(_,prefix,direction,type,names)=>prefix+names.split(',').map(name=>`layout(location=${direction==='in'?inLocation++:outLocation++}) ${direction} ${type} ${name.trim()};`).join('\n'));return text.replace('#version 450',`#version 450\nlayout(set=0,binding=0) uniform Globals {${uniforms.join('')}};`)}
for(const [name,stage]of[['GLSL_VERTEX','vertex'],['GLSL_FRAGMENT','fragment']]){const code=normalize(win.__aj.sources[name]);try{const spirv=glslang.compileGLSL(code,stage,false);console.log(`${name}: semantic compilation passed (${spirv.length} words)`)}catch(error){fs.writeFileSync(new URL(`./failed-${stage}.glsl`,import.meta.url),code);console.error(error);process.exitCode=1}}
process.exit(process.exitCode||0);

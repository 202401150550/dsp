import assert from 'node:assert/strict'
import fs from 'node:fs'
import { EventEmitter } from 'node:events'
// Execute the launcher with recorded process/network dependencies, never a real Desktop.
// Replace terminal process.exit with function return so VM tests can observe exit codes.
const source=fs.readFileSync(new URL('../scripts/launch-desktop-cdp.mjs',import.meta.url),'utf8').replace(/^#!.*\n/,'').replace(/^import .*\n/gm,'').replace(/process\.exit\((\d+)\)/g,'return $1')
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor
const program=new AsyncFunction('spawn','execSync','existsSync','connect','process','console','setTimeout','clearTimeout','fetch',source)
async function run(scenario){
 let sockets=0,fetches=0;const spawned=[];const env={DSH_DESKTOP_EXE:'fixture-desktop.exe',ELECTRON_RUN_AS_NODE:'1'}
 const connect=()=>{const sock=new EventEmitter();sock.destroy=()=>{};const index=++sockets;queueMicrotask(()=>sock.emit(scenario==='occupied'||index>1?'connect':'error'));return sock}
 const code=await program((...args)=>{spawned.push(args);return {unref(){}}},()=>scenario==='running'?'DSH Desktop.exe':'',()=>scenario!=='missing',connect,{env},{log(){},error(){}},(fn,ms)=>{if(ms===500)queueMicrotask(fn);return 1},()=>{},async()=>({json:async()=>{fetches++;return scenario==='no-page'||(scenario==='empty-then-ready'&&fetches===1)?[]:[{type:'page',url:scenario==='recovery'?'file:///old/recovery.html?state=x':scenario==='blank-page'?'about:blank':'http://127.0.0.1:43120/'}]}}))
 return {code,spawned,fetches,env}
}
let passed=0
function check(value,message){assert.ok(value,message);passed++;console.log('PASS '+message)}
for(const [scenario,code] of [['missing',2],['running',3],['occupied',4]]){const r=await run(scenario);check(r.code===code&&r.spawned.length===0,scenario+' refuses without spawning')}
const ready=await run('empty-then-ready')
check(ready.code===0&&ready.fetches===2,'empty target list is not ready')
check(ready.spawned.length===1,'spawns exactly once')
check(ready.spawned[0][0]==='fixture-desktop.exe','respects explicitly selected installation')
check(!('ELECTRON_RUN_AS_NODE' in ready.spawned[0][2].env),'GUI child does not inherit Node mode')
check(ready.env.ELECTRON_RUN_AS_NODE==='1','parent environment remains unchanged')
const timed=await run('no-page')
check(timed.code===5&&timed.fetches===120,'no page times out with nonzero exit')
check((await run('recovery')).code===6,'recovery page fails readiness without editing profile');
check((await run('blank-page')).code===5,'blank page does not count as a ready Desktop');
console.log(`desktop-launcher: ${passed} passed, 0 failed`)

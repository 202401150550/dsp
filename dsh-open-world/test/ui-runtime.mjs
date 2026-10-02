import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
const React={createElement:(type,props,...children)=>({type,props:props||{},children}),useState:v=>[typeof v==='function'?v():v,()=>{}],useEffect:()=>{},useRef:v=>({current:v}),useCallback:f=>f,useMemo:f=>f()}
test('CenterStage forwards garden handlers without free variables',()=>{const layout=load('app-layout.js');assert.doesNotThrow(()=>layout.CenterStage({view:'garden',snapshot:{},events:[],nodes:[],tasks:[]}))})
function load(file){let definition;vm.runInNewContext(fs.readFileSync(new URL('../client/modules/'+file,import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}},URL,console});return definition.factory(id=>id==='react'?React:id==='dsh-open-world/hubs'?load('hubs.js'):id==='dsh-open-world/chrome'?{renderEmbedSurface:panel=>({type:'surface',props:{panel}})}:{})}
test('garden embedded rewind uses canonical read-only points, not a separate anchors renderer',()=>{
 const tree=load('shell.js').EmbeddedAppSurface({panel:'rewind',snapshot:{rewind:{available:true,timeline:{points:[{id:'old',label:'Existing snapshot',anchorSeq:7,fileCount:1,ts:0}]}}},onAction:()=>{throw Error('must not execute')}})
 const walk=n=>Array.isArray(n)?n.flatMap(walk):n&&typeof n==='object'?[n,...walk(typeof n.type==='function'?n.type(n.props):n.children||[])]:[]
 const nodes=walk(tree);assert.ok(nodes.some(n=>n.props?.['data-rewind-readonly']));assert.ok(nodes.some(n=>n.children?.includes('Existing snapshot')))
 const buttons=nodes.filter(n=>n.type==='button'&&n.children.some(x=>typeof x==='string'&&/执行回退|仅对话|对话\+文件/.test(x)));assert.ok(buttons.length);for(const b of buttons){assert.equal(b.props.disabled,true);assert.equal(b.props.onClick,undefined)}
})
test('garden renders with all hooks bound',()=>{const g=load('garden-view.js');assert.doesNotThrow(()=>g.GardenView({snapshot:{},events:[],setToast:()=>{}}))})
test('garden inspection actions navigate, not toast-only',async()=>{const g=load('garden-view.js');const elements=g.buildElements({taskBoard:{available:true}});for(const [id,panel] of [['moon','monitor'],['lantern','fleet'],['capsule','monitor'],['tower','task-board'],['moongate','rewind'],['bridge','remote'],['stone','market']]){let action;await elements.find(e=>e.id===id).acts()[0].run({runBridge:a=>{action=a}});assert.equal(action.panel,panel,id)}})
test('offline task action is disabled',()=>{const g=load('garden-view.js');assert.equal(g.buildElements({taskBoard:{available:false}}).find(e=>e.id==='tower').acts()[0].disabled,true)})
test('content urls reject unsafe schemes and absent links',()=>{const c=load('chat.js');for(const v of ['', '#','javascript:alert(1)','data:text/html,hi','file:///C:/a','//bad.test'])assert.equal(c.safeContentUrl(v),null,v);assert.equal(c.safeContentUrl('https://example.com'),'https://example.com');assert.ok(c.safeContentUrl('/api/open-world/chat/file?thread=test&id=abcdef'))})
test('plain and markdown web links become real anchors',()=>{const c=load('chat.js');const nodes=c.renderMessageText('文档 [说明](https://example.com/docs) 和 https://example.com/help');const links=nodes.filter(x=>x?.type==='a');assert.equal(links.length,2);assert.equal(links[0].props.href,'https://example.com/docs');assert.equal(links[0].children[0],'说明');assert.equal(links[1].props.rel,'noopener noreferrer')})
for (const view of ['garden','idea','monitor']) test('embedded apps render in '+view,()=>{const c=load('app-layout.js').CenterStage({view,embed:'chat',snapshot:{},events:[],nodes:[],tasks:[]});assert.ok(c.children.some(x=>x?.type==='surface'&&x.props.panel==='chat'))})
test('standalone offline view does not invent reports or enable sending',async()=>{const html=fs.readFileSync(new URL('../bridge/chat-view.html',import.meta.url),'utf8');const nodes={};const el=id=>nodes[id]??=( {value:'',style:{},addEventListener:()=>{},classList:{add:()=>{},remove:()=>{}}} );const document={getElementById:el,addEventListener:()=>{},hidden:false};vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{document,fetch:async()=>{throw Error('offline')},setInterval:()=>0,console});await new Promise(r=>setImmediate(r));assert.equal(el('send').disabled,true);assert.equal(el('status').textContent,'未连接');assert.ok(!el('messages').innerHTML.includes('mcp-night'));assert.ok(!html.includes('var DEMO'))})

for (const compact of [false,true]) test('rewind execution is visibly disabled; history remains readable, compact='+compact,()=>{
 const m=load('hubs.js'),tree=m.RewindTimelinePanel({rewind:{available:true,timeline:{points:[{id:'old',label:'Existing snapshot',anchorSeq:7,fileCount:1,ts:0}]}},compact,onAction:()=>{throw Error('must not execute')}})
 const walk=n=>Array.isArray(n)?n.flatMap(walk):n&&typeof n==='object'?[n,...walk(n.children||[])]:[]
 const nodes=walk(tree),buttons=nodes.filter(n=>n.type==='button'&&n.children.some(x=>typeof x==='string'&&/执行回退|仅对话|对话\+文件/.test(x)))
 assert.ok(nodes.some(n=>n.props?.['data-rewind-readonly']));assert.ok(buttons.length>0);for(const b of buttons){assert.equal(b.props.disabled,true);assert.equal(b.props.onClick,undefined)}
 if(!compact)assert.ok(nodes.some(n=>n.children?.includes('Existing snapshot')))
})

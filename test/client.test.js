import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ScenarioAPI } from '../src/api.js';
import { readView } from '../src/server.js';
const token = 'sst_test_token_only';
test('rejects insecure URLs and malformed credentials', () => {
 for (const url of ['http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com/?token=secret']) assert.throws(()=>new ScenarioAPI(url,token));
 assert.throws(()=>new ScenarioAPI('https://scenario.whyamsx.com','wrong'));
 assert.doesNotThrow(()=>new ScenarioAPI('http://127.0.0.1:7310',token));
});
test('branch reads retain return context without following cycles', () => {
 const bundle={revision:'v1',scenario:{title:'Test',root:'root',nodes:[{id:'root',text:'root'},{id:'child',text:'child',disabled:true}],edges:[{id:'edge',from:'root',to:'child',label:'condition'}],transitions:[{id:'back',from:'child',to:'root',label:'retry'}]},layout:{}};
 const result=readView('test',bundle,'child',false);
 assert.deepEqual(result.nodes.map(n=>n.id),['child']);assert.equal(result.nodes[0].disabled,true);assert.equal(result.transitions.length,1);assert.equal(result.referencedNodes[0].id,'root');
});
test('real stdio MCP handshake and proposal metadata work without Scenario source',async t=>{
 let redirected=false;
 const bundle={revision:'v1',scenario:{version:1,title:'Flow',root:'start',nodes:[{id:'start',text:'Start'}],edges:[]},layout:{version:1,nodes:{}}};
 const server=http.createServer((req,res)=>{
  assert.equal(req.headers.authorization,'Bearer '+token);
  if(req.url==='/api/info'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({apiVersion:1,workspace:'account-test'}));return;}
  assert.equal(req.headers['x-scenario-workspace'],'account-test');
  if(req.url==='/api/scenarios/redirect'){res.writeHead(302,{Location:'/leak'});res.end();return;}
  if(req.url==='/leak'){redirected=true;res.end('{}');return;}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/api/scenarios'){res.end(JSON.stringify([{name:'main',title:'Flow',revision:'v1'}]));return;}
  if(req.method==='PATCH'){res.end(JSON.stringify({...bundle,revision:'pending-v2',review:{status:'pending',baseRevision:'v1',revision:'pending-v2'}}));return;}
  res.end(JSON.stringify(bundle));
 });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url='http://127.0.0.1:'+server.address().port;
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../src/cli.js',import.meta.url)),'--url',url],env:{SCENARIO_TOKEN:token},stderr:'pipe'});
 const client=new Client({name:'public-client-test',version:'1'});await client.connect(transport);t.after(()=>client.close());
 assert.equal((await client.listTools()).tools.length,5);
 const listed=await client.callTool({name:'list_scenarios',arguments:{}});assert.equal(listed.structuredContent.scenarios[0].name,'main');
 const changed=await client.callTool({name:'update_scenario',arguments:{name:'main',revision:'v1',operations:[{op:'update_node',id:'start',text:'Changed'}]}});assert.equal(changed.structuredContent.review.status,'pending');
 const redirection=await client.callTool({name:'read_scenario',arguments:{name:'redirect'}});assert.equal(redirection.isError,true);assert.equal(redirected,false);
 const bad=await client.callTool({name:'read_scenario',arguments:{name:'../../account'}});assert.equal(bad.isError,true);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/roasts/[[path]].js';
import { graphSvg } from '../src/lib/roast-graph.js';
const db=new DatabaseSync('.data/roasting.sqlite3',{readOnly:true});
const DB={prepare(sql){let params=[];return {bind(...args){params=args;return this;},async first(){return db.prepare(sql).get(...params);},async all(){return {results:db.prepare(sql).all(...params)};}};}};
const call=(path='',method='GET',env={DB})=>onRequest({request:new Request('https://test.invalid/api/roasts/'+path,{method}),env,params:{path:path?path.split('/'):[]}});
test('catalog and detail agree with the real imported SQLite database',async()=>{
  const response=await call();assert.equal(response.status,200);
  const catalog=await response.json();assert.equal(catalog.profiles.length,352);
  assert.equal(catalog.profiles.filter(p=>p.graph_eligible).length,237);
  const ref=catalog.profiles.find(p=>p.filename==='coffee_roast_26Jul25.ods'&&p.origin==='Gesha Village');
  const detail=await (await call(ref.roast_id)).json();
  assert.equal(detail.profile.elapsed_seconds,1559);assert.equal(detail.steps.length,26);
  const svg=graphSvg(detail);
  assert.equal((svg.match(/data-series="energy"/g)||[]).length,26);
  assert.equal((svg.match(/data-series="volume"/g)||[]).length,26);
  assert(svg.includes('Step 10: 287.5 mL (same as the initial volume)'));
  assert(svg.includes('Cumulative irradiation 7:50 / Elapsed 12:36'));
  assert(!/NaN|Infinity/.test(svg));
  detail.profile.coffee_title='<script>alert(1)</script>';
  assert(!graphSvg(detail).includes('<script>'));
});
test('all eligible profiles render finite coordinates; excluded profiles do not render',async()=>{
  const catalog=await (await call()).json();
  for(const p of catalog.profiles){
    const detail=await (await call(p.roast_id)).json();const svg=graphSvg(detail);
    assert.equal(Boolean(svg),p.graph_eligible,p.roast_id);
    assert(!/NaN|Infinity/.test(svg),p.roast_id);
  }
});
test('writes, unknown profiles, malformed paths and missing bindings are rejected',async()=>{
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await call('',method)).status,405);
  assert.equal((await call('roast-0000000000000000')).status,404);
  for(const path of ['admin','rebuild',"' OR 1=1 --",'roast-0000000000000000/extra'])assert.equal((await call(path)).status,404);
  assert.equal((await call('','GET',{})).status,503);
});

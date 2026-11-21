import assert from 'node:assert/strict';
import test from 'node:test';
import {dueCount,extendCollection,samePractice} from '../study/library.js';

const source = {id:'test',photos:['A','B','C','A','B','D'].map((family,i)=>({family,src:String(i)}))};
const config = {source:'test',target:'family',response:'recall',group:'',order:'',family:'',quality:'all'};

test('fresh examples preserve due dates, missing families and the original review-sheet photo indices',()=>{
  const pending = {name:'B',index:0,revealed:true};
  const state = {collection:{config:{...config,draw:{indices:[0,1,2]}}},pending,total:1,records:{A:{due:9999,turns:1,cursor:1}}};
  extendCollection(state,source,{id:'next',indices:[3,4,5]});
  assert.deepEqual(state.collection.config.draw.indices,[0,1,2,3,4,5]);
  assert.equal(state.records.A.cursor,1);
  assert.equal(state.records.A.due,9999);
  assert.deepEqual(state.pending,pending);
  assert.deepEqual(Object.keys(state.records),['A','B','C','D']);
  assert.equal(dueCount(state,100),3);
  assert.equal(dueCount(state,10000),4);
});

test('a draw in a full-source set keeps the pool and rotates away from the last graded photo',()=>{
  const state = {collection:{config:{...config}},pending:{name:'A',revealed:false},total:2,records:{A:{due:9999,turns:2,cursor:0,lastPhoto:'0'}}};
  extendCollection(state,source,{id:'next',indices:[0,3]});
  assert.equal(state.collection.config.draw,undefined);
  assert.equal(state.records.A.cursor,1);
  assert.equal(state.records.A.due,9999);
  assert.equal(state.pending,null);
});

test('only the same practice settings can extend a kept schedule',()=>{
  assert.equal(samePractice(config,{...config,keptId:'x',draw:{id:'y'}}),true);
  for (const field of ['source','target','response','group','order','family','quality']) {
    assert.equal(samePractice(config,{...config,[field]:'changed'}),false);
  }
});

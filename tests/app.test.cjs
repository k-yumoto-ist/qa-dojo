// Lightweight event/DOM adapter: exercises shared application logic without browser dependencies.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function app(id,explore,storage=new Map()) {
  const events={},elements=new Map(),location={search:`?app=${id}${explore?'&mode=explore':''}`};
  for(const id of ['main','toast','breadcrumb'])elements.set(id,{innerHTML:'',textContent:'',classList:{add(){},remove(){}}});
  const context={window:{location,scrollTo(){},confirm:()=>true},
    URLSearchParams,Date,setTimeout:()=>0,clearTimeout(){},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
    document:{getElementById:id=>elements.get(id)||null,querySelectorAll:()=>[],addEventListener:(n,fn)=>events[n]=fn},
    FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k]||'';}}};
  vm.runInNewContext(source('scenarios.js'),context);
  vm.runInNewContext(source('app.js'),context);
  const click=attrs=>events.click({preventDefault(){},target:{closest:selector=>selector==='[data-action]'?{getAttribute:k=>attrs[k]||null}:null}});
  return {
    html:()=>elements.get('main').innerHTML,
    click:(action,extra={})=>click({'data-action':action,...extra}),
    step:n=>click({'data-action':'step','data-step':String(n)}),
    choose:(kind,value)=>events.change({target:{closest:selector=>selector==='[data-home-picker]'?{getAttribute:()=>kind,value}:null}}),
    location:()=>location.href,
    input:(key,value,type='text')=>events.input({target:{closest:()=>({getAttribute:()=>key,value,type,checked:value==='yes'})}}),
    submit:(id,values)=>events.submit({preventDefault(){},target:{id,values}}),
    storage,key:`qa-dojo:${explore?'explore':'training'}:v1${id==='checkout'?'':':'+id}`,
    stored(){return JSON.parse(storage.get(this.key));}
  };
}
const design={title:'境界条件を確認する',category:'other',steps:'仕様書を開いて入力し操作する',expected:'仕様どおりの状態を確認できる'};
test('all five apps render and execute in both modes, preserving design gate',()=>{
  for(const id of ['checkout','booking','signup','search','expense'])for(const explore of [false,true]) {
    const a=app(id,explore);
    assert.equal((a.html().match(/<option value="(?:checkout|booking|signup|search|expense)"/g)||[]).length,5);
    assert.ok(a.html().includes('data-home-picker="app"'));
    assert.ok(a.html().indexOf('data-action="start"')<a.html().indexOf('<details class="home-details"'));
    assert.ok(a.html().includes('data-home-picker="mode"'));
    a.click('start');a.step(2);
    if(!explore){assert.ok(!a.html().includes('class="mock-browser"'));a.step(1);a.submit('case-form',design);a.step(2);}
    assert.ok(a.html().includes('class="mock-browser"'),id);
    if(id==='checkout')a.click('calculate');
    else a.click('scenario',{'data-operation':{booking:'reserve',signup:'register',search:'search',expense:'submit'}[id]});
    assert.equal(a.stored().logs.length,1,id);
    a.step(3);assert.ok(a.html().includes('id="report-form"'));
  }
});
test('observation, report matching and score persist independently across apps and modes',()=>{
  const storage=new Map(),a=app('booking',true,storage);
  a.click('start');a.step(2);a.input('people','7');a.click('scenario',{'data-operation':'reserve'});
  a.step(3);a.submit('report-form',{category:'capacity',title:'定員超過で予約できる',steps:'会議室Aを選択して人数7人で予約する',expected:'定員超過のため予約を拒否する',actual:'予約が正常に登録されてしまう'});
  assert.equal(a.stored().reports[0].accepted,true);
  assert.ok(a.html().includes('<strong>20</strong>'));
  const reloaded=app('booking',true,storage);
  assert.equal(reloaded.stored().observed[0],'capacity');
  assert.equal(app('booking',false,storage).stored().observed.length,0);
  assert.equal(app('expense',true,storage).stored().observed.length,0);
  const snapshot=storage.get(a.key);
  app('checkout',true,storage).click('reset');
  assert.equal(storage.get(a.key),snapshot);
});
test('legacy checkout key is retained and signup input secrets do not persist',()=>{
  const storage=new Map(),legacy=app('checkout',false,storage);
  legacy.submit('case-form',design);
  assert.equal(app('checkout',false,storage).stored().cases.length,1);
  const a=app('signup',true,storage);
  a.click('start');a.step(2);a.input('password','Private5678');a.input('confirm','Private5678');
  a.click('scenario',{'data-operation':'register'});
  assert.ok(!storage.get(a.key).includes('Private5678'));
  assert.equal(a.stored().mock.password,'');
  assert.equal(app('checkout',false,storage).stored().cases.length,1);
});
test('simulation reset preserves learning and recorded user content is escaped',()=>{
  const a=app('expense',true);
  a.click('start');a.step(2);a.input('title','<img src=x onerror=alert(1)>');
  a.click('scenario',{'data-operation':'submit'});
  assert.ok(a.html().includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!a.html().includes('<img src=x'));
  a.click('scenario',{'data-operation':'approve:1'});
  assert.ok(a.stored().observed.includes('role'));
  a.click('reset-simulation');
  assert.equal(Object.keys(a.stored().scenarioState).length,0);
  assert.ok(a.stored().observed.includes('role'));
  assert.equal(a.stored().logs.length,3);
});

test('home pickers switch app and mode, while advanced guidance stays collapsed',()=>{
  const a=app('checkout',false);
  assert.ok(a.html().includes('<details class="home-details">'));
  assert.ok(!a.html().includes('<details class="home-details" open'));
  a.choose('app','booking');
  assert.equal(a.location(),'./?app=booking');
  const b=app('booking',false);
  b.choose('mode','explore');
  assert.equal(b.location(),'./?app=booking&mode=explore');
});
test('feedback is gated until first report; explanations cover found and missed defects',()=>{
  const storage=new Map(),a=app('booking',true,storage);
  a.click('start');a.step(2);a.input('people','7');a.click('scenario',{'data-operation':'reserve'});
  a.step(3);
  assert.ok(a.html().includes('data-action="reveal-feedback" disabled'));
  assert.ok(!a.html().includes('120分ちょうどの予約が拒否される'));
  a.submit('report-form',{category:'capacity',title:'定員オーバーで予約できる',steps:'会議室Aで7人の予約を登録する',expected:'定員6人のため拒否する',actual:'7人でも予約できてしまう'});
  assert.ok(a.html().includes('定員を1人超えて予約できる'));
  assert.ok(!a.html().includes('120分ちょうどの予約が拒否される'));
  a.click('reveal-feedback');
  assert.ok(a.html().includes('120分ちょうどの予約が拒否される'));
  assert.ok(a.html().includes('未観測'));
  assert.ok(a.html().includes('報告受理'));
  assert.ok(a.html().includes('期待結果：'));
  assert.equal(a.stored().reviewUnlocked,true);
  const reloaded=app('booking',true,storage);
  reloaded.click('start');reloaded.step(3);
  assert.ok(reloaded.html().includes('修行の答え合わせ'));
});

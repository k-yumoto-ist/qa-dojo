const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../scenarios.js'),'utf8'),context);
const scenarios=context.window.QA_SCENARIOS;
const get=id=>scenarios.find(s=>s.id===id);
function run(id,changes={},action,state={}) {
  const s=get(id),m={...s.initial,...changes};
  const out=s.evaluate(m,action||s.actions[0][0],state);
  if(s.detect)s.detect(m,action||s.actions[0][0],out);
  return out;
}
const contains=(out,id)=>assert.ok(out.defects.includes(id),`${id}: ${out.message}`);
test('all four apps have five observable categories and a clean normal action',()=>{
  assert.equal(scenarios.length,4);
  for(const s of scenarios){
    assert.equal(s.specifications.length,7);
    assert.equal(s.categories.filter(c=>c.id!=='other').length,5);
    const out=run(s.id);
    assert.equal(out.type,'success');assert.equal(out.defects.length,0);
  }
});
test('booking: exact duration, capacity, title, touching slots and cancelled slot',()=>{
  contains(run('booking',{end:'12:00'}),'duration');
  contains(run('booking',{people:'7'}),'capacity');
  contains(run('booking',{title:'a'.repeat(31)}),'title');
  const first=run('booking').state;
  contains(run('booking',{start:'11:00',end:'12:00'},'reserve',first),'overlap');
  const cancelled=run('booking',{},'cancel:1',first);
  assert.equal(first.rows[0].cancelled,false,'evaluating an action does not mutate previous state');
  contains(run('booking',{},'reserve',cancelled.state),'cancel');
  const next=run('booking',{start:'13:00',end:'14:00'},'reserve',cancelled.state);
  assert.equal(next.state.rows[1].id,2,'IDs stay unique after cancelling');
});
test('booking: ordinary invalid cases and separate rooms',()=>{
  for(const patch of [{date:'2026-11-31'},{date:'2026-12-01'},{start:'08:30'},{end:'10:00'},{people:'1.5'},{people:'0'},{title:'  '}])assert.equal(run('booking',patch).type,'error');
  const state=run('booking').state;
  assert.equal(run('booking',{room:'B'},'reserve',state).type,'success');
  assert.equal(run('booking',{},'reserve',state).defects.length,0,'real overlap is no defect');
  const later=run('booking',{start:'12:00',end:'13:00'},'reserve',state).state;
  assert.equal(run('booking',{start:'11:00',end:'12:30'},'reserve',later).defects.length,0,'touching one reservation while overlapping another is a valid rejection');
});
test('signup: five independent discrepancies',()=>{
  contains(run('signup',{password:'abcdefgh',confirm:'abcdefgh'}),'password');
  contains(run('signup',{confirm:'Different123'}),'confirm');
  contains(run('signup',{age:'17'}),'age');
  contains(run('signup',{consent:''}),'consent');
  contains(run('signup',{email:'MEMBER@example.com'}),'duplicate');
  const state=run('signup').state;
  assert.equal(run('signup',{},'register',state).type,'error');
  assert.equal(run('signup',{email:'invalid'}).type,'error');
  assert.equal(run('signup',{age:'16'}).type,'error');
});
test('search: boundaries, stock, AND conditions, sort, no matches and invalid range',()=>{
  contains(run('search',{min:'1000'}),'min');
  contains(run('search',{max:'1000'}),'max');
  contains(run('search',{min:'1000',max:'1000'}),'min');
  contains(run('search',{min:'1000',max:'1000'}),'max');
  contains(run('search',{stock:'yes'}),'stock');
  contains(run('search',{keyword:'ノート',category:'生活雑貨'}),'combine');
  contains(run('search',{sort:'desc'}),'sort');
  assert.equal(run('search',{keyword:'存在しない商品'}).state.results.length,0);
  assert.equal(run('search',{min:'2000',max:'1000'}).type,'error');
  assert.equal(run('search',{min:'-1'}).type,'error');
  assert.ok(!run('search',{min:'2000',stock:'yes'}).defects.includes('min'),'out of stock boundary excluded by specification is not a price defect');
});
test('expense: tax, receipt, roles, edits and withdrawal after approval',()=>{
  contains(run('expense',{amount:'1005'}),'tax');
  contains(run('expense',{amount:'10000',receipt:''}),'receipt');
  const state=run('expense').state;
  contains(run('expense',{},'approve:1',state),'role');
  const approved=run('expense',{role:'approver'},'approve:1',state);
  assert.equal(approved.defects.length,0);
  contains(run('expense',{},'update:1',approved.state),'edit');
  contains(run('expense',{},'withdraw:1',approved.state),'withdraw');
  assert.equal(run('expense',{amount:'10001',receipt:''}).type,'error');
  assert.equal(run('expense',{amount:'0'}).type,'error');
  const withdrawn=run('expense',{},'withdraw:1',state);
  assert.equal(withdrawn.defects.length,0);
  assert.equal(run('expense',{},'approve:1',withdrawn.state).type,'error');
  assert.equal(run('expense',{},'update:1',withdrawn.state).type,'error');
});

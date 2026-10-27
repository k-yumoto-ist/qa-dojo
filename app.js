(() => {
  "use strict";

  const EXPLORATORY = new URLSearchParams(window.location.search).get("mode") === "explore";
  const BASE_KEY = EXPLORATORY ? "qa-dojo:explore:v1" : "qa-dojo:training:v1";
  const SCENARIOS = window.QA_SCENARIOS || [];
  const requested = new URLSearchParams(window.location.search).get("app");
  const mission = SCENARIOS.find(s => s.id === requested) || null;
  const missionId = mission ? mission.id : "checkout";
  const missionTitle = mission ? mission.title : "ECサイトの注文フォーム";
  const level = mission ? mission.level : "01";
  const KEY = mission ? BASE_KEY + ":" + mission.id : BASE_KEY;
  const CATEGORIES = mission ? mission.categories : [
    {id:"quantity", name:"数量・入力範囲"},
    {id:"shipping", name:"送料・境界値"},
    {id:"discount", name:"割引計算"},
    {id:"email", name:"メールアドレス"},
    {id:"memo", name:"備考・文字数"},
    {id:"other", name:"その他"}
  ];
  const DEFECTS = mission ? mission.categories.filter(c=>c.id!=="other").map(c=>c.id) : ["shipping","discount","quantity","email","memo"];
  const SPECIFICATIONS = mission ? mission.specifications : [
    {id:"FR-01", title:"購入数量", body:"購入数量は 1〜10 の整数のみ指定できる。0、マイナス値、11以上、小数は注文できない。"},
    {id:"FR-02", title:"商品価格と小計", body:"「オリジナルブレンド」1点の単価は 2,500円。商品小計は 単価 × 数量 で計算する。"},
    {id:"FR-03", title:"送料", body:"商品小計が 5,000円以上なら送料無料。5,000円未満の場合は一律500円を加算する。送料無料判定には割引前の商品小計を使う。"},
    {id:"FR-04", title:"クーポン", body:"クーポン「SAVE10」を入力すると、商品小計から10%割引（1円未満切り捨て）。送料には割引を適用しない。未入力、または対象外のコードでは割引しない。"},
    {id:"FR-05", title:"メールアドレス", body:"注文時にメールアドレスは必須。「local@domain.tld」の形式で入力する。@やドメインを欠く値は受け付けない。"},
    {id:"FR-06", title:"備考欄", body:"備考は任意で、0〜80文字まで入力できる。81文字以上の場合は注文できない。"},
    {id:"FR-07", title:"注文確定", body:"入力内容が全条件を満たすときだけ注文を受け付け、商品小計・割引・送料・合計金額を表示する。"}
  ];
  const STEPS = ["仕様を理解する","テストを設計する","アプリを操作する","不具合を報告する"];

  function blank() {
    return {
      cases:[], logs:[], reports:[], observed:[], notes:[], progressed:0, reviewUnlocked:false,
      mock:mission ? {...mission.initial} : {quantity:"2",coupon:"",email:"qa@example.com",memo:""},
      scenarioState:{},
      lastResult:"",resultType:"",orderCount:0
    };
  }
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || !Array.isArray(raw.cases) || !Array.isArray(raw.logs) ||
          !Array.isArray(raw.reports) || !Array.isArray(raw.observed)) return blank();
      const fresh = blank();
      return Object.assign(fresh, raw, {
        mock:Object.assign(fresh.mock,raw.mock || {}),
        cases:raw.cases.slice(-100),
        logs:raw.logs.slice(-100),
        notes:Array.isArray(raw.notes) ? raw.notes.slice(-100) : [],
        reports:raw.reports.slice(-100),
        observed:raw.observed.filter(id => DEFECTS.includes(id))
      });
    } catch (_) { return blank(); }
  }
  let data = load();
  let view = "dashboard";
  let step = 0;
  let toastTimer = null;
  const main = document.getElementById("main");
  const toastEl = document.getElementById("toast");
  if (!main) return;
  function save() {
    try {
      const persisted = {...data, mock:{...data.mock}};
      if (mission && mission.id === "signup") {
        persisted.mock.password = "";
        persisted.mock.confirm = "";
      }
      localStorage.setItem(KEY, JSON.stringify(persisted));
    } catch (_) {}
  }
  function missionUrl(id = missionId, explore = EXPLORATORY) {
    const params = new URLSearchParams();
    if (id !== "checkout") params.set("app",id);
    if (explore) params.set("mode","explore");
    return "./" + (params.size ? "?"+params.toString() : "");
  }
  function missionChoices() {
    return [{id:"checkout", title:"ECサイトの注文フォーム",level:"01"}, ...SCENARIOS];
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, ch =>
      ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }
  function yen(n) { return "¥" + Number(n).toLocaleString("ja-JP"); }
  function nameOf(id) { return (CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length-1]).name; }
  function fmtDate(iso) {
    try {return new Date(iso).toLocaleString("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});}
    catch (_) { return ""; }
  }
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }
  function observed() { return new Set(data.observed.filter(id => DEFECTS.includes(id))); }
  function score() {
    const categories = new Set(data.cases.map(c=>c.category).filter(id=>CATEGORIES.some(x=>x.id===id)));
    const design = EXPLORATORY ? 0 : Math.min(3,categories.size)*10;
    const execute = observed().size*(EXPLORATORY ? 10 : 8);
    const report = Math.min(5,data.reports.filter(r=>r.accepted).length)*(EXPLORATORY ? 10 : 6);
    return {design,execute,report,total:design+execute+report};
  }
  function progression() {
    const s = score();
    if (s.total >= 85) return "品質の達人";
    if (s.total >= 60) return "鋭眼のテスター";
    if (s.total >= 30) return "修行中のテスター";
    return "見習いテスター";
  }
  function cardStats() {
    const s = score();
    return '<div class="stats">' +
      stat(EXPLORATORY ? "探索メモ" : "テスト設計", EXPLORATORY ? data.notes.length : data.cases.length,"件",EXPLORATORY ? "打鍵中の気づき" : "設計済みのテストケース","◇","") +
      stat("不具合の観測", observed().size,"件","操作ログから検出","◎","amber") +
      stat("不具合報告", data.reports.filter(r=>r.accepted).length,"件","受理された報告","▤","blue") +
      stat("獲得スコア",s.total,"/ 100","ルールベース採点","✦","purple") + '</div>';
  }
  function stat(label,n,unit,note,icon,variant) {
    return '<div class="stat"><div class="stat-top"><span>'+label+'</span><span class="stat-icon '+variant+'">'+icon+'</span></div>' +
      '<div class="stat-number">'+n+'<span class="stat-unit">'+unit+'</span></div><div class="stat-note">'+note+'</div></div>';
  }
  function progressPercent() {
    if(EXPLORATORY) {
      if (!data.logs.length) return 0;
      if (!data.reports.some(r=>r.accepted)) return 50;
      if (data.reports.filter(r=>r.accepted).length<3) return 80;
      return 100;
    }
    if (!data.cases.length) return 0;
    if (!data.logs.length) return 25;
    if (!data.reports.some(r=>r.accepted)) return 60;
    if (data.reports.filter(r=>r.accepted).length<3) return 80;
    return 100;
  }
  const HOME_APPS = {
    checkout:{icon:"shopping-cart",short:"ECサイト",description:"数量・送料・クーポンをテスト"},
    booking:{icon:"calendar-event",short:"会議室予約",description:"日時・人数・予約の重複をテスト"},
    signup:{icon:"user-plus",short:"会員登録",description:"入力チェック・登録条件をテスト"},
    search:{icon:"search",short:"商品検索",description:"絞り込み・並び順をテスト"},
    expense:{icon:"receipt",short:"経費申請",description:"金額・申請・承認の流れをテスト"}
  };
  function icon(name, cls="") {
    return '<img class="ui-icon '+cls+'" src="./assets/icons/'+name+'.svg" alt="" aria-hidden="true">';
  }
  function savedProgress(id) {
    if(id===missionId) return progressPercent();
    try {
      const record=JSON.parse(localStorage.getItem(BASE_KEY+(id==="checkout"?"":":"+id)));
      if(!record) return 0;
      const reports=Array.isArray(record.reports)?record.reports.filter(r=>r.accepted).length:0;
      const logs=Array.isArray(record.logs)?record.logs.length:0;
      const cases=Array.isArray(record.cases)?record.cases.length:0;
      if(!EXPLORATORY&&!cases) return 0;
      if(!logs) return EXPLORATORY?0:25;
      if(!reports) return EXPLORATORY?50:60;
      return reports<3?80:100;
    } catch (_) {return 0;}
  }
  function dashboard() {
    const mode=EXPLORATORY?"探索的テスト":"テスト設計型";
    const started=data.logs.length>0||data.cases.length>0||data.notes.length>0||data.progressed>0;
    const selected=HOME_APPS[missionId];
    const flow=[{icon:"file-description",name:"仕様を読む",note:"正しい動きを知る"},
      ...(!EXPLORATORY?[{icon:"pencil",name:"テストを設計",note:"確かめたいことを考える"}]:[]),
      {icon:"player-play",name:"アプリを操作",note:"実際に動かして試す"},
      {icon:"bug",name:"不具合を報告",note:"仕様との差を伝える"}];
    return '<section class="visual-home" aria-labelledby="launch-title">'+
      '<header class="gallery-intro"><div class="eyebrow">QA道場</div><h1 id="launch-title">さあ、修行を始めよう。</h1>'+
      '<p>アプリを選んで、仕様を読み、実際に操作して不具合を見つけよう。</p></header>'+
      '<section class="gallery-section" aria-labelledby="gallery-title"><div class="gallery-heading"><h2 id="gallery-title">練習するアプリを選ぶ</h2>'+
      '<div class="gallery-controls"><span>全5アプリ</span><button class="gallery-arrow" data-action="gallery-prev" aria-label="前のアプリを見る">'+icon("chevron-left")+'</button>'+
      '<button class="gallery-arrow" data-action="gallery-next" aria-label="次のアプリを見る">'+icon("chevron-right")+'</button></div></div>'+
      '<div class="mission-gallery" id="mission-gallery" role="group" aria-label="練習するアプリ">'+missionChoices().map(m=>{
        const meta=HOME_APPS[m.id],percent=savedProgress(m.id),active=m.id===missionId;
        return '<a class="app-tile '+(active?'selected':'')+'" href="'+missionUrl(m.id)+'" data-app-id="'+m.id+'" '+(active?'aria-current="true"':'')+' aria-label="'+esc(m.title)+'、進捗'+percent+'%'+(active?'、選択中':'を選ぶ')+'">'+
          '<div class="tile-preview"><img src="./assets/'+m.id+'.webp" alt="" width="640" height="480" draggable="false">'+
          '<span class="tile-level">LEVEL '+esc(m.level)+'</span>'+(active?'<span class="tile-selected">'+icon("check")+'選択中</span>':'')+'</div>'+
          '<div class="tile-caption"><span class="app-symbol app-'+m.id+'">'+icon(meta.icon)+'</span><div class="tile-copy"><h3>'+esc(m.title)+'</h3><p>'+meta.description+'</p></div>'+
          '<span class="tile-progress" aria-hidden="true">'+percent+'<small>%</small></span></div><progress class="tile-meter" value="'+percent+'" max="100" aria-label="'+esc(m.title)+'の進捗">'+percent+'%</progress></a>';
      }).join('')+'</div></section>'+
      '<section class="training-launch" aria-labelledby="mode-title"><div class="selection-row"><div class="selection-name"><span class="app-symbol app-'+missionId+'">'+icon(selected.icon)+'</span><div><span class="selection-label" id="mode-title">選んだアプリで修行する</span><strong>'+esc(missionTitle)+'</strong></div></div>'+
      '<div class="mode-segments" role="group" aria-label="修行モード"><a href="'+missionUrl(missionId,false)+'" class="mode-segment '+(!EXPLORATORY?'selected':'')+'" '+(!EXPLORATORY?'aria-current="true"':'')+'>'+icon("file-description")+'<span>テスト設計<small>考えてから試す</small></span></a>'+
      '<a href="'+missionUrl(missionId,true)+'" class="mode-segment '+(EXPLORATORY?'selected':'')+'" '+(EXPLORATORY?'aria-current="true"':'')+'>'+icon("player-play")+'<span>探索的テスト<small>操作しながら探る</small></span></a></div></div>'+
      '<ol class="visual-flow '+(EXPLORATORY?'three-steps':'')+'" aria-label="修行の流れ">'+flow.map((f,i)=>'<li><span class="flow-icon">'+icon(f.icon)+'</span><div><span class="flow-number">0'+(i+1)+'</span><strong>'+f.name+'</strong><small>'+f.note+'</small></div>'+(i<flow.length-1?icon("chevron-right","flow-chevron"):'')+'</li>').join('')+'</ol>'+
      '<div class="gallery-launch"><button class="btn btn-primary btn-launch" data-action="start">'+(started?'修行を再開する':'修行を始める')+icon("arrow-right")+'</button><span class="launch-save">'+icon("device-floppy")+'このブラウザに自動保存</span></div></section></section>'+
      '<details class="home-details"><summary>初めての方へ・修行の進め方と記録を見る <span aria-hidden="true">⌄</span></summary>'+
      '<div class="home-detail-content"><p>学習の記録はアプリ・モード別に、このブラウザへ保存されます。</p>'+
      '<div class="section-head"><h2>現在の修行記録</h2><span class="hint">'+mode+'</span></div>'+cardStats()+
      '<div class="home-guides"><div class="roadmap-card"><h3>修行の進め方</h3>'+
      roadmapStep("01","仕様を読み解く","期待する動作を把握する")+
      (EXPLORATORY?"":roadmapStep("02","テストを設計する","観点・手順・期待結果を書く"))+
      roadmapStep(EXPLORATORY?"02":"03","アプリを操作する","入力・実行して動きを観察する")+
      roadmapStep(EXPLORATORY?"03":"04","不具合を報告する","再現手順と期待・実際を記録する")+
      '</div><div class="roadmap-card"><h3>鍛える3つの力</h3>'+
      chapter("◈","仕様理解力","正しい状態と境界を読み解く。")+
      chapter("▦","テスト設計力","正常・異常・組み合わせを考える。")+
      chapter("◎","不具合発見力","事実と仕様の差を見つける。")+
      '</div></div></div></details>';
  }
  function roadmapStep(no,title,subtitle) {
    return '<div class="roadmap-step"><div class="roadmap-number">'+no+'</div><div><strong>'+title+'</strong><small>'+subtitle+'</small></div><span class="roadmap-arrow">↗</span></div>';
  }
  function chapter(icon,title,subtitle) {
    return '<div class="chapter"><div class="chapter-icon">'+icon+'</div><div><strong>'+title+'</strong><p>'+subtitle+'</p></div></div>';
  }
  function dojo() {
    const titles = ["まずは、仕様を読み解こう。","自分だけのテストを設計しよう。","アプリを実際に操作してみよう。","発見した不具合を報告しよう。"];
    const leads = ["何が正しい状態なのかを把握する。テストはそこから始まる。",
      "テストケースは「何を、どのように試し、どうなれば正しいか」を明確にするもの。",
      EXPLORATORY ? "仕様を手掛かりに自由に試そう。発見や疑問は探索メモに残せる。" : "模擬アプリの挙動を実際に入力して確かめよう。",
      "起きた事実と期待動作を比較し、他の人が再現できる報告を作ろう。"];
    const sequence=EXPLORATORY ? [0,2,3] : [0,1,2,3];
    let tabs="";
    sequence.forEach((id,i)=>{
      const blocked=!EXPLORATORY && id>=2 && !data.cases.length;
      tabs+='<button type="button" class="step-tab '+(step===id?"current":id<data.progressed?"done":"")+'" data-action="step" data-step="'+id+'" '+(blocked?'disabled title="テストケースを1件以上作成してください"':"")+'><span class="step-no">'+(id<data.progressed?"✓":i+1)+'</span><span>'+esc(STEPS[id])+'</span></button>';
    });
    const page=[specPage,designPage,labPage,reportPage][step]();
    return '<div class="row-between wrap-mobile"><div><div class="eyebrow">TRAINING / LEVEL '+level+' · '+(EXPLORATORY?"EXPLORATORY":"TEST DESIGN")+'</div>' +
      '<h1 class="page-title">'+esc(missionTitle)+'</h1><p class="page-lead mb-0"><span class="pill">'+(EXPLORATORY?"探索的テスト":"テスト設計型")+'</span>　仕様とアプリの差分を見つけよう。</p></div>' +
      '<button class="btn btn-outline btn-sm" data-nav="dashboard">← アプリを選び直す</button></div>' +
      '<section class="step-head"><div class="eyebrow">STEP '+String(sequence.indexOf(step)+1).padStart(2,"0")+' / '+String(sequence.length).padStart(2,"0")+'</div>' +
      '<h2>'+titles[step]+'</h2><p>'+leads[step]+'</p><div class="steps '+(EXPLORATORY?"exploratory":"")+'" role="navigation" aria-label="演習ステップ">'+tabs+'</div></section>' + page;
  }
  function nextActions(back,next,nextLabel) {
    return '<div class="actions"><button class="btn btn-outline" data-action="step" data-step="'+back+'">← 前のステップ</button>' +
      (next == null ? '<button class="btn btn-dark" data-nav="records">修行の記録を見る →</button>' :
      '<button class="btn btn-dark" data-action="step" data-step="'+next+'">'+nextLabel+' →</button>')+'</div>';
  }
  function specPage() {
    let rows = SPECIFICATIONS.map(s =>
      '<div class="spec-row"><span class="spec-id">'+s.id+'</span><div><strong>'+s.title+'</strong><p>'+s.body+'</p></div></div>'
    ).join("");
    return '<div class="layout-aside"><div><section class="panel"><div class="panel-title"><h3>'+esc(missionTitle)+' 機能仕様書</h3><span class="pill">SPEC v1.0</span></div>' +
      '<p>あなたはこのアプリのQA担当です。以下の仕様を読み、'+(EXPLORATORY?'気になったところから自由に実機操作してください。':'テストを設計して実装を確認してください。')+'</p>' +
      rows+'</section>'+nextActions(0,EXPLORATORY ? 2 : 1,EXPLORATORY ? "アプリを操作する" : "テスト設計へ進む")+'</div>' +
      '<aside class="aside-stack"><div class="help-panel"><h3>◈ テスターへのヒント</h3><p>'+(EXPLORATORY?'仕様を読んだら、まず手を動かしてみよう。気づきは探索メモに保存できます。':'すぐに操作する前に、まず「何を確認すべきか」を考えてみよう。')+'</p>' +
      '<ul><li>境界値の前後で何が変わる？</li><li>入力が不正だったらどうなる？</li><li>複数条件が組み合わさると？</li><li>期待結果を数字で説明できる？</li></ul>' +
      '<p>不具合の個数や答えは公開しません。</p></div><div class="panel mt-20"><h3>修行のゴール</h3>' +
      '<p>'+(EXPLORATORY?'テスト設計なしで実機操作し、気づいた不具合を再現可能な形で報告すること。':'テストケースを記録し、操作して不具合を報告すること。')+'</p>' +
      '<span class="pill gray">AI採点なし・ローカル保存</span></div></aside></div>';
  }
  function categoryOptions(defaultLabel) {
    return '<option value="">'+defaultLabel+'</option>' +
      CATEGORIES.map(c => '<option value="'+c.id+'">'+c.name+'</option>').join("");
  }
  function designPage() {
    let list = !data.cases.length
      ? '<div class="empty-state"><span class="empty-icon">▦</span>まだテストケースはありません。<br>左のフォームから最初の1件を登録しましょう。</div>'
      : '<div class="test-list">'+data.cases.map((t,i) =>
        '<div class="test-item"><div class="item-top"><div><span class="micro">TC-'+String(i+1).padStart(2,"0")+' · '+esc(nameOf(t.category))+'</span><br><strong>'+esc(t.title)+'</strong></div>' +
        '<button class="link-button danger" data-action="remove-case" data-id="'+esc(t.id)+'" aria-label="テストケースを削除">削除</button></div>' +
        '<p><b>手順：</b>'+esc(t.steps)+'</p><p><b>期待：</b>'+esc(t.expected)+'</p></div>').join("")+'</div>';
    return '<div class="layout-aside"><div><section class="panel"><div class="panel-title"><h3>テストケースを追加</h3><span class="pill gray">自分で考える</span></div>' +
      '<p>単に「動くこと」ではなく、入力値と期待する結果を具体的に記述してください。</p>' +
      '<form id="case-form"><div class="field"><label for="case-title">テストケース名 *</label><input id="case-title" name="title" maxlength="100" required placeholder="例：仕様の上限値を確認する"></div>' +
      '<div class="form-grid"><div class="field"><label for="case-category">テスト観点 *</label><select id="case-category" name="category" required>'+categoryOptions("観点を選択")+'</select></div>' +
      '<div class="field"><label for="case-pre">前提条件（任意）</label><input id="case-pre" name="precondition" maxlength="160" placeholder="例：模擬アプリを表示"></div></div>' +
      '<div class="field"><label for="case-steps">操作手順 *</label><textarea id="case-steps" name="steps" maxlength="1000" required placeholder="1. 対象の入力値を設定する&#10;2. 実行して結果を確認する"></textarea></div>' +
      '<div class="field"><label for="case-expected">期待結果 *</label><textarea id="case-expected" name="expected" maxlength="1000" required placeholder="例：仕様書にある条件どおりの結果を数値や状態で記載"></textarea></div>' +
      '<button class="btn btn-dark w-full" type="submit">＋ このテストケースを登録</button></form></section>' +
      '<section class="panel"><div class="panel-title"><h3>作成したテストケース</h3><span class="small-count">'+data.cases.length+' 件</span></div>'+list+'</section>' +
      nextActions(0,2,"実機検証へ進む")+'</div><aside class="aside-stack"><div class="help-panel"><h3>◎ 設計のポイント</h3>' +
      '<p>ケース名だけでなく、誰がやっても同じ結果が確認できる手順にしよう。</p>' +
      '<ol><li>正常系と異常系を分ける</li><li>境界値の直前・ちょうど・直後を試す</li><li>期待する数値や状態を明確にする</li></ol></div>' +
      '<section class="panel mt-20"><h3>設計の進み具合</h3><p>3種類以上の観点を考えると、設計スコアが満点になります。</p>' +
      '<div class="score-meter"><div class="row-between"><span>設計スコア</span><span>'+score().design+' / 30</span></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:'+(score().design/30*100)+'%"></div></div></div>' +
      '<p class="micro">※ルール上は観点の種類と記述の有無のみ採点します。内容の妥当性は自動判定しません。</p></section></aside></div>';
  }
  function totals() {
    const q = Number(data.mock.quantity);
    const qty = Number.isFinite(q) ? q : 0;
    const subtotal = Math.max(0,qty * 2500);
    const shipping = subtotal > 5000 ? 0 : 500; // Intentional training defect: exactly 5000 is charged.
    const coupon = data.mock.coupon.trim().toUpperCase();
    const discount = coupon === "SAVE10" ? Math.floor((subtotal + shipping) * 0.1) : 0; // Intentional training defect: shipping is discounted.
    return {qty,subtotal,shipping,discount,total:Math.max(0,subtotal+shipping-discount),coupon};
  }
  function labPage() {
    if (!EXPLORATORY && !data.cases.length) {
      return '<div class="panel"><h3>先にテストケースを作成してください</h3><p>テスト設計を1件以上登録すると模擬アプリを操作できます。</p><button class="btn btn-dark" data-action="step" data-step="1">テスト設計へ</button></div>';
    }
    const t = mission ? null : totals();
    const logs = data.logs.length ?
      '<div class="log-list">'+data.logs.slice().reverse().slice(0,8).map(log =>
        '<div class="log-item"><time>'+esc(fmtDate(log.at))+'</time><strong>'+esc(log.action)+'</strong>' +
        '<p>'+esc(log.detail)+'</p></div>').join("")+'</div>' :
      '<div class="empty-state"><span class="empty-icon">◎</span>操作ログはまだありません。<br>模擬アプリの実行ボタンを試そう。</div>';
    return '<div class="exercise-guide">◈ '+(EXPLORATORY?'探索的テスト：テスト設計なしで自由に打鍵し、気づいたことを探索メモに残そう。':'実機検証モード：仕様をもとに操作しよう。')+' このフォームには<strong>意図的な不具合</strong>があります。</div>' +
      '<div class="lab-grid"><section>' + (mission ? scenarioLab() : '<div class="mock-browser"><div class="browser-bar"><i class="browser-dot"></i><i class="browser-dot"></i><i class="browser-dot"></i>' +
      '<span class="browser-url">demo.coffee-market.test / checkout</span></div>' +
      '<div class="store-banner"><small>COFFEE MARKET</small>注文情報の入力</div><div class="store-content">' +
      '<div class="product-block"><div class="product-img" aria-hidden="true">☕</div><div><strong>オリジナルブレンド 200g</strong>' +
      '<small>香り豊かな定番コーヒー</small><div class="product-price">¥2,500 <span class="micro">/ 個</span></div></div></div>' +
      '<div class="form-grid"><div class="field"><label for="mock-quantity">購入数量</label><input id="mock-quantity" data-mock="quantity" type="number" inputmode="numeric" step="1" value="'+esc(data.mock.quantity)+'"></div>' +
      '<div class="field"><label for="mock-coupon">クーポン</label><input id="mock-coupon" data-mock="coupon" type="text" placeholder="コードを入力" value="'+esc(data.mock.coupon)+'"></div></div>' +
      '<div class="field"><label for="mock-email">メールアドレス</label><input id="mock-email" data-mock="email" type="text" placeholder="you@example.com" value="'+esc(data.mock.email)+'"></div>' +
      '<div class="field"><label for="mock-memo">備考（任意）</label><textarea id="mock-memo" data-mock="memo" rows="3" placeholder="配送に関するご要望">'+esc(data.mock.memo)+'</textarea>' +
      '<small><span id="memo-count">'+data.mock.memo.length+'</span>文字入力中</small></div>' +
      '<div class="receipt"><div class="price-row"><span>商品小計</span><strong id="t-subtotal">'+yen(t.subtotal)+'</strong></div>' +
      '<div class="price-row"><span>クーポン割引</span><strong id="t-discount">−'+yen(t.discount)+'</strong></div>' +
      '<div class="price-row"><span>送料</span><strong id="t-shipping">'+yen(t.shipping)+'</strong></div>' +
      '<div class="price-row total"><span>お支払い合計</span><strong id="t-total">'+yen(t.total)+'</strong></div></div>' +
      '<button class="mock-button mock-secondary" data-action="calculate" type="button">▤ 計算結果を記録</button>' +
      '<button class="mock-button" data-action="order" type="button">注文を確定する →</button>' +
      '<div class="lab-result '+esc(data.resultType)+'" role="status">'+
      (data.lastResult ? esc(data.lastResult) : 'まだ注文は確定していません。入力値を変更しながら試してください。') +
      '</div></div></div>') + '</section>' +
      '<aside><section class="panel"><div class="panel-title"><h3>操作ログ</h3><span class="pill gray">直近8件</span></div>' +
      '<p>実行した入力と結果が自動で記録されます。気づいた点を仕様書と照合しよう。</p>'+logs+
      '<div class="actions"><span class="micro">累計 '+data.logs.length+' 操作</span><button class="btn btn-outline btn-sm" data-action="clear-logs">ログを消去</button></div></section>' +
      (EXPLORATORY ? '<section class="panel"><div class="panel-title"><h3>探索メモ</h3><span class="pill gray">'+data.notes.length+' 件</span></div>' +
      '<p>何を試したか、気になった点、次に試すことを自由に残そう。メモは採点対象外です。</p>' +
      '<form id="note-form"><div class="field"><label for="note-content">気づき・疑問・次の仮説</label><textarea id="note-content" name="content" maxlength="1000" required placeholder="例：境界値で結果が変わった。前後の値や組み合わせも試したい。"></textarea></div>' +
      '<button class="btn btn-dark btn-sm" type="submit">＋ メモを保存</button></form>' +
      (data.notes.length ? '<div class="divider"></div><div class="log-list">'+data.notes.slice().reverse().slice(0,10).map(n=>'<div class="log-item"><time>'+esc(fmtDate(n.at))+'</time><p>'+esc(n.content)+'</p></div>').join("")+'</div>' : '') +
      '</section>' : '') +
      '<div class="help-panel"><h3>検証時のチェックポイント</h3>' +
      '<p>実行ボタンで入力と結果を記録できます。状態が変わる操作では、一覧と次の操作の結果も確認しよう。</p>' +
      '<p>意図的な不具合が観測されたかどうかは内部で記録されます。答えは不具合報告時に照合します。</p></div></aside></div>' +
      nextActions(EXPLORATORY ? 0 : 1,3,"不具合報告へ進む");
  }
  function scenarioButton(operation,label) {
    return '<button type="button" class="btn btn-outline btn-sm" data-action="scenario" data-operation="'+esc(operation)+'">'+esc(label)+'</button>';
  }
  function productTable(rows) {
    return '<div class="table-scroll"><table class="scenario-table"><thead><tr><th>ID</th><th>商品名</th><th>分類</th><th>価格</th><th>在庫</th></tr></thead><tbody>'+rows.map(p=>'<tr><td>'+esc(p.id)+'</td><td>'+esc(p.name)+'</td><td>'+esc(p.category)+'</td><td>'+yen(p.price)+'</td><td>'+p.stock+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function scenarioLab() {
    const state=data.scenarioState||{};
    const fields=mission.fields.map(f=>{
      const id='scenario-'+f.key,value=data.mock[f.key]||'';
      let input;
      if(f.type==='select') input='<select id="'+id+'" data-mock="'+f.key+'">'+f.options.map(([v,t])=>'<option value="'+esc(v)+'" '+(v===value?'selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
      else if(f.type==='checkbox') input='<input id="'+id+'" data-mock="'+f.key+'" type="checkbox" '+(value==='yes'?'checked':'')+'>';
      else input='<input id="'+id+'" data-mock="'+f.key+'" type="'+f.type+'" '+(f.type==='password'?'autocomplete="new-password"':'')+' value="'+esc(value)+'">';
      return '<div class="field '+(f.type==='checkbox'?'check-field':'')+'"><label for="'+id+'">'+esc(f.label)+'</label>'+input+'</div>';
    }).join('');
    let listing='';
    const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
    if(mission.id==='booking') listing='<h3>予約一覧</h3>'+(state.rows||[]).map(r=>'<div class="test-item"><strong>'+esc(r.title)+'</strong><p>'+esc(r.date)+' / 会議室'+esc(r.room)+' / '+clock(r.start)+'〜'+clock(r.end)+' / '+r.people+'人 / '+(r.cancelled?'キャンセル済み':'予約中')+'</p>'+(!r.cancelled?scenarioButton('cancel:'+r.id,'キャンセル'):'')+'</div>').join('');
    if(mission.id==='signup') listing='<h3>登録済みメール</h3><ul>'+(state.members||['member@example.com']).map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul>';
    if(mission.id==='search') listing='<section aria-label="検索結果"><h3>検索結果'+(state.results?'：'+state.results.length+'件':'')+'</h3>'+(state.results?(state.results.length?productTable(state.results):'<p>該当する商品はありません（0件）。</p>'):'<p>条件を指定して検索してください。</p>')+'</section><details><summary>商品マスター（期待結果の確認用）</summary>'+productTable(mission.catalog)+'</details>';
    if(mission.id==='expense') listing='<h3>申請一覧</h3><p class="micro">更新は現在のフォーム内容を使用します。操作ロールも切り替えて確認できます。</p>'+(state.rows||[]).map(r=>'<div class="test-item"><strong>#'+r.id+' '+esc(r.title)+'</strong><p>'+esc(r.status)+' / 税抜 '+yen(r.amount)+' / 税 '+yen(r.tax)+' / 税込 '+yen(r.total)+'</p><div class="scenario-actions">'+scenarioButton('approve:'+r.id,'承認')+scenarioButton('update:'+r.id,'フォーム内容で更新')+scenarioButton('withdraw:'+r.id,'取り下げ')+'</div></div>').join('');
    return '<div class="mock-browser"><div class="browser-bar"><i class="browser-dot"></i><i class="browser-dot"></i><i class="browser-dot"></i><span class="browser-url">'+esc(mission.url)+'</span></div><div class="store-banner"><small>'+esc(mission.brand)+'</small>'+esc(mission.title)+'</div><div class="store-content"><div class="form-grid">'+fields+'</div>'+mission.actions.map(([action,label])=>'<button class="mock-button" type="button" data-action="scenario" data-operation="'+action+'">'+label+'</button>').join('')+'<div class="lab-result '+esc(data.resultType)+'" role="status">'+esc(data.lastResult||'入力を変えながら動作を確認してください。')+'</div>'+listing+'<div class="divider"></div><button class="btn btn-outline btn-sm" type="button" data-action="reset-simulation">模擬データを初期化</button></div></div>';
  }
  function executeScenario(operation) {
    if(!mission || (!EXPLORATORY&&!data.cases.length))return;
    const outcome=mission.evaluate(data.mock,operation,data.scenarioState||{});
    if(mission.detect)mission.detect(data.mock,operation,outcome);
    (outcome.defects||[]).forEach(markDefect);
    if(outcome.state)data.scenarioState=outcome.state;
    data.lastResult=outcome.message;data.resultType=outcome.type;
    const inputs=mission.fields.filter(f=>f.type!=='password').map(f=>f.label+': '+(data.mock[f.key]||'未入力')).join(' / ');
    const labels={reserve:'予約',register:'会員登録',search:'検索',submit:'申請',cancel:'キャンセル',approve:'承認',update:'更新',withdraw:'取り下げ'};
    const [verb,id]=operation.split(':');
    logAction((labels[verb]||verb)+(id?' #'+id:''),inputs+' / '+outcome.message);
    render();showToast('操作と結果を記録しました');
  }
  function scoreMeter(label,value,max) {
    return '<div class="score-meter"><div class="row-between"><span>'+label+'</span><span>'+value+' / '+max+'</span></div><div class="progress-track">' +
      '<div class="progress-fill" style="width:'+Math.round(value/max*100)+'%"></div></div></div>';
  }
  const CHECKOUT_FEEDBACK = [
    {id:"shipping",spec:"FR-03",title:"送料無料の境界値を誤判定する",reproduce:"数量を2個にして「計算結果を記録」を押す。",expected:"小計が5,000円なので送料は0円。",actual:"小計5,000円でも送料500円が加算される。"},
    {id:"discount",spec:"FR-04",title:"クーポン割引に送料まで含まれる",reproduce:"数量1個、クーポンSAVE10で計算する。",expected:"商品小計2,500円の10%にあたる250円を割り引く。",actual:"送料500円も含む3,000円の10%＝300円が割り引かれる。"},
    {id:"quantity",spec:"FR-01",title:"数量0個の注文を受け付ける",reproduce:"数量0個、正しいメールアドレスで注文を確定する。",expected:"数量は1〜10の整数に限定され、0個はエラーになる。",actual:"数量0個でも注文が確定してしまう。"},
    {id:"email",spec:"FR-05",title:"不正なメール形式でも注文できる",reproduce:"数量1個、メールに「invalid-address」を入力して確定する。",expected:"@やドメインのないメールアドレスはエラーになる。",actual:"メール形式を確認せず注文を受け付ける。"},
    {id:"memo",spec:"FR-06",title:"81文字以上の備考を受け付ける",reproduce:"備考を81文字にし、正しい数量とメールで注文を確定する。",expected:"備考は最大80文字なので注文エラーになる。",actual:"81文字以上でも注文が確定してしまう。"}
  ];
  function defectFeedback() { return mission ? mission.feedback || [] : CHECKOUT_FEEDBACK; }
  function feedbackResult() {
    if(!data.reviewUnlocked)return '<section class="panel answer-gate"><h3>修行の答え合わせ</h3>'+
      '<p>発見できた不具合と見逃した不具合の内容を、仕様・再現手順・期待結果・実際の結果で確認できます。</p>'+
      '<button class="btn btn-dark" type="button" data-action="reveal-feedback" '+(data.reports.length?'':'disabled')+'>答え合わせを開く →</button>'+
      (data.reports.length?'':'<p class="micro">まず不具合報告を1件登録すると解放されます。</p>')+'</section>';
    const found=observed();
    return '<section class="panel answer-panel" aria-labelledby="answer-title"><div class="panel-title"><h3 id="answer-title">修行の答え合わせ</h3><span class="pill">'+found.size+' / '+DEFECTS.length+' 件観測</span></div>'+
      '<p>これは演習アプリに意図的に仕込まれた不具合の解説です。操作による観測と報告の内容は別々に確認してください。</p>'+
      '<div class="answer-list">'+defectFeedback().map(g=>{
        const seen=found.has(g.id);
        const reported=data.reports.some(r=>r.accepted&&r.category===g.id);
        return '<article class="answer-item"><div class="item-top"><strong>'+esc(g.title)+'</strong><span class="pill '+(seen?'':'gray')+'">'+(reported?'報告受理':seen?'操作で観測':'未観測')+'</span></div>'+
          '<div class="micro">'+esc(g.spec)+' · '+esc(nameOf(g.id))+'</div>'+
          '<p><b>再現手順：</b>'+esc(g.reproduce)+'</p><p><b>期待結果：</b>'+esc(g.expected)+'</p><p><b>実際の結果：</b>'+esc(g.actual)+'</p></article>';
      }).join('')+'</div><p class="micro">※AIによる文章評価はありません。「報告受理」は、該当観点の不具合が操作時に検出されたことを意味します。</p></section>';
  }
  function reportPage() {
    const s = score();
    const accepted = data.reports.filter(r=>r.accepted);
    const list = !data.reports.length
      ? '<div class="empty-state"><span class="empty-icon">▤</span>まだ報告がありません。<br>模擬アプリで確認した事象を報告しましょう。</div>'
      : '<div class="report-list">'+data.reports.slice().reverse().map(r =>
        '<div class="report-item"><div class="item-top"><div><span class="micro">'+esc(nameOf(r.category))+' · '+esc(fmtDate(r.at))+'</span><br><strong>'+esc(r.title)+'</strong></div>' +
        '<span class="pill '+(r.accepted?'':'gray')+'">'+(r.accepted?'観測と一致':'未受理')+'</span></div>' +
        '<p><b>再現手順：</b>'+esc(r.steps)+'</p><p><b>期待：</b>'+esc(r.expected)+'</p><p><b>実際：</b>'+esc(r.actual)+'</p>'+
        (r.accepted&&defectFeedback().some(g=>g.id===r.category)?
          '<div class="report-evidence"><strong>照合結果：'+esc(defectFeedback().find(g=>g.id===r.category).title)+'</strong>'+
          '<p>仕様：'+esc(defectFeedback().find(g=>g.id===r.category).expected)+'</p>'+
          '<p>実際：'+esc(defectFeedback().find(g=>g.id===r.category).actual)+'</p></div>':
          '<p class="micro">操作の観測記録と一致していません。再現操作と観点を見直してください。</p>')+
        '</div>').join("")+'</div>';
    return '<div class="layout-aside"><div><section class="panel"><div class="panel-title"><h3>不具合報告を作成</h3><span class="pill">BUG REPORT</span></div>' +
      '<p>観測した事実を元に、誰でも再現できるように記述しましょう。報告に正解候補は表示されません。</p>' +
      '<form id="report-form"><div class="field"><label for="report-title">タイトル *</label><input id="report-title" name="title" maxlength="120" required placeholder="例：境界値のときに結果が仕様と異なる"></div>' +
      '<div class="field"><label for="report-category">対象の観点 *</label><select id="report-category" name="category" required>'+categoryOptions("観点を選択")+'</select></div>' +
      '<div class="field"><label for="report-steps">再現手順 *</label><textarea id="report-steps" name="steps" maxlength="1500" required placeholder="1. 模擬アプリを開く&#10;2. 入力値と操作を記載する&#10;3. 結果を確認する"></textarea></div>' +
      '<div class="field"><label for="report-expected">期待される結果 *</label><textarea id="report-expected" name="expected" maxlength="1000" required placeholder="仕様上はどうなるべきか"></textarea></div>' +
      '<div class="field"><label for="report-actual">実際に発生した結果 *</label><textarea id="report-actual" name="actual" maxlength="1000" required placeholder="実際に画面に何が表示されたか"></textarea></div>' +
      '<button class="btn btn-dark w-full" type="submit">報告を登録して照合 →</button></form></section>' +
      '<section class="panel"><div class="panel-title"><h3>提出した不具合報告</h3><span class="small-count">'+accepted.length+' 件受理</span></div>'+list+'</section>' +
      feedbackResult()+nextActions(2,null)+'</div><aside class="aside-stack"><section class="panel"><h3>今回の修行スコア</h3>' +
      '<div class="score-ring" style="--score:'+s.total+'%"><div class="score-inner"><strong>'+s.total+'</strong><span>/ 100 POINTS</span></div></div>' +
      '<p class="right" style="text-align:center"><span class="pill">'+progression()+'</span></p>' +
      (EXPLORATORY?"":scoreMeter("設計した観点",s.design,30))+scoreMeter("観測した不具合",s.execute,EXPLORATORY?50:40)+scoreMeter("受理された報告",s.report,EXPLORATORY?50:30) +
      '<div class="divider"></div><p class="micro">自動判定は「操作で不具合が再現されたか」と「対象観点が一致するか」のみ確認します。文章の正しさは採点しません。</p></section>' +
      '<div class="help-panel"><h3>報告をより良くするには</h3><ul><li>数値を曖昧にせず明記する</li><li>期待結果と実際の結果を分ける</li><li>再現可能な手順を番号付きで書く</li><li>仕様書の該当条件と結びつける</li></ul></div></aside></div>';
  }
  function recordsPage() {
    const s=score();
    const categorySet=new Set(data.cases.map(c=>c.category));
    return '<div class="eyebrow">YOUR LEARNING RECORD</div><h1 class="page-title">修行の記録</h1>' +
      '<p class="page-lead">自分の成長の跡を、振り返ろう。すべての記録はこのブラウザに保存されています。</p>' +
      '<div class="mode-switch"><a class="btn '+(EXPLORATORY?"btn-outline":"btn-dark")+'" href="'+esc(missionUrl(missionId,false))+'">テスト設計型</a><a class="btn '+(EXPLORATORY?"btn-dark":"btn-outline")+'" href="'+esc(missionUrl(missionId,true))+'">探索的テスト</a></div>' +
      cardStats()+'<div class="section-head"><h2>'+(EXPLORATORY?"探索的テスト":"テスト設計型")+' · '+esc(missionTitle)+' の進捗</h2><span class="pill">'+progression()+'</span></div>' +
      '<div class="record-grid"><section class="record-card"><h3>スキルスコア</h3>' +
      (EXPLORATORY?"":scoreMeter("テスト設計",s.design,30))+scoreMeter("実機検証",s.execute,EXPLORATORY?50:40)+scoreMeter("不具合報告",s.report,EXPLORATORY?50:30) +
      '<p>合計 <strong>'+s.total+' / 100点</strong></p><button class="btn btn-dark" data-action="start">修行に戻る →</button>' +
      (data.reviewUnlocked?'<button class="btn btn-outline mt-12" data-action="view-feedback">答え合わせを見直す →</button>':'')+'</section>' +
      '<section class="record-card"><h3>修行ログ</h3><ul class="record-list">' +
      (EXPLORATORY ? '<li>探索メモ：<b>'+data.notes.length+'件</b></li>' :
      '<li>作成したテストケース：<b>'+data.cases.length+'件</b></li><li>テスト設計の観点：<b>'+categorySet.size+'種類</b></li>') +
      '<li>アプリ操作：<b>'+data.logs.length+'回</b></li><li>確認した不具合：<b>'+observed().size+'種類</b></li>' +
      '<li>不具合報告：<b>'+data.reports.length+'件</b></li><li>受理された報告：<b>'+data.reports.filter(r=>r.accepted).length+'件</b></li>' +
      '</ul><div class="divider"></div><div class="actions"><button class="btn btn-outline btn-sm" data-action="export">記録をJSONで保存 ↓</button>' +
      '<button class="btn btn-danger btn-sm" data-action="reset">このアプリ・モードの記録をリセット</button></div></section></div>' +
      '<div class="alert info mt-20">このアプリにログインやクラウド同期はありません。ブラウザのデータ消去や端末変更で記録が失われます。必要に応じてJSONを書き出してください。</div>';
  }
  function render() {
    main.innerHTML = view === "dashboard" ? dashboard() : view === "records" ? recordsPage() : dojo();
    document.getElementById("breadcrumb").textContent =
      view === "dashboard" ? "修行" : view === "records" ? "修行の記録" : missionTitle;
    document.querySelectorAll(".nav-link").forEach(item =>
      item.classList.toggle("active",(view === "dojo" ? "dashboard" : view) === item.getAttribute("data-nav")));
    const gallery=document.getElementById("mission-gallery");
    if(gallery) {
      const tile=gallery.querySelector('[aria-current="true"]');
      if(tile) gallery.scrollLeft=Math.max(0,tile.offsetLeft-gallery.offsetLeft-12);
    }
    save();
  }
  function toView(next) {
    view = next === "records" ? "records" : next === "dojo" ? "dojo" : "dashboard";
    render();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function toStep(n) {
    if (!Number.isInteger(n)||n<0||n>3) return;
    if (EXPLORATORY && n === 1) return;
    if (!EXPLORATORY && n>=2&&!data.cases.length) {showToast("先にテストケースを1件以上登録してください");return;}
    view="dojo";step=n;data.progressed=Math.max(data.progressed,n);
    render();window.scrollTo({top:0,behavior:"smooth"});
  }
  function registerNote(form) {
    if(!EXPLORATORY)return;
    const content=String(new FormData(form).get("content")||"").trim();
    if(content.length<3){showToast("3文字以上入力してください");return;}
    data.notes.push({at:new Date().toISOString(),content:content.slice(0,1000)});
    data.notes=data.notes.slice(-100);render();showToast("探索メモを保存しました");
  }
  function registerCase(form) {
    const f=new FormData(form);
    const c={
      id:String(Date.now())+"-"+Math.random().toString(16).slice(2),
      title:String(f.get("title")||"").trim(),category:String(f.get("category")||""),
      precondition:String(f.get("precondition")||"").trim(),
      steps:String(f.get("steps")||"").trim(),expected:String(f.get("expected")||"").trim()
    };
    if (c.title.length<3||c.steps.length<4||c.expected.length<4||!CATEGORIES.some(x=>x.id===c.category)) {
      showToast("ケース名・観点・手順・期待結果を具体的に記入してください");return;
    }
    if (data.cases.length>=100){showToast("テストケースは最大100件までです");return;}
    data.cases.push(c);render();showToast("テストケースを登録しました");
  }
  function syncMock(target) {
    const key=target.getAttribute("data-mock");
    if (!Object.prototype.hasOwnProperty.call(data.mock,key)) return;
    data.mock[key]=target.type === "checkbox" ? (target.checked ? "yes" : "") : target.value;
    if (mission) { save(); return; }
    const t=totals();
    [["t-subtotal",yen(t.subtotal)],["t-discount","−"+yen(t.discount)],
      ["t-shipping",yen(t.shipping)],["t-total",yen(t.total)],
      ["memo-count",String(data.mock.memo.length)]].forEach(([id,value])=>{
        const el=document.getElementById(id);if(el)el.textContent=value;
      });
    save();
  }
  function sampleDescription(t) {
    return "数量 "+escBare(data.mock.quantity)+
      " / クーポン "+(data.mock.coupon||"なし")+
      " / メール "+(data.mock.email||"空欄")+
      " / 備考 "+data.mock.memo.length+"文字"+
      " / 小計 "+yen(t.subtotal)+ "・割引 "+yen(t.discount)+
      "・送料 "+yen(t.shipping)+"・合計 "+yen(t.total);
  }
  function escBare(s) { return String(s).slice(0,120); }
  function logAction(action,detail) {
    data.logs.push({at:new Date().toISOString(),action,detail});
    data.logs=data.logs.slice(-100);
  }
  function markDefect(id) {
    if (DEFECTS.includes(id) && !data.observed.includes(id)) data.observed.push(id);
  }
  function detectCalculations(t) {
    if (t.qty===2) markDefect("shipping");
    if (t.coupon==="SAVE10" && t.shipping>0 && t.qty>=0) markDefect("discount");
  }
  function calculate() {
    const t=totals();
    if (!Number.isFinite(Number(data.mock.quantity)) || data.mock.quantity.trim()==="") {
      data.lastResult="購入数量を入力してください。";data.resultType="error";
      logAction("計算の確認","数量未入力のため記録できませんでした");
    } else {
      detectCalculations(t);
      data.lastResult="計算結果を操作ログに記録しました。仕様書と比較してください。";
      data.resultType="success";
      logAction("計算の確認",sampleDescription(t));
    }
    render();showToast("計算結果を記録しました");
  }
  function validExpectedEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
  function order() {
    const t=totals();
    const invalidNumber = data.mock.quantity.trim()==="" || !Number.isInteger(t.qty) || t.qty<0 || t.qty>10;
    const invalidBlankMail = !data.mock.email.trim();
    if (invalidNumber || invalidBlankMail) {
      const reason=invalidNumber ? "数量の入力内容を確認してください。" : "メールアドレスを入力してください。";
      data.lastResult="注文エラー：" + reason;data.resultType="error";
      logAction("注文を確定（エラー）",sampleDescription(t)+" / "+reason);
      detectCalculations(t);
    } else {
      // Deliberate training defects: quantity 0, invalid e-mail and memo >80 are accepted.
      data.orderCount++;
      data.lastResult="注文が確定しました（注文番号 DEMO-"+String(data.orderCount).padStart(4,"0")+"）。合計 "+yen(t.total)+"。";
      data.resultType="success";
      logAction("注文を確定（成功）",sampleDescription(t)+" / 注文受付");
      detectCalculations(t);
      if (t.qty===0) markDefect("quantity");
      if (!validExpectedEmail(data.mock.email)) markDefect("email");
      if (data.mock.memo.length>80) markDefect("memo");
    }
    render();showToast("注文の動作を操作ログに記録しました");
  }
  function registerReport(form) {
    const f=new FormData(form);
    const r={id:String(Date.now())+"-"+Math.random().toString(16).slice(2),
      category:String(f.get("category")||""),title:String(f.get("title")||"").trim(),
      steps:String(f.get("steps")||"").trim(),expected:String(f.get("expected")||"").trim(),
      actual:String(f.get("actual")||"").trim(),at:new Date().toISOString(),accepted:false};
    if (!CATEGORIES.some(x=>x.id===r.category)||r.title.length<4||r.steps.length<10||r.expected.length<5||r.actual.length<5) {
      showToast("再現手順・期待結果・実際の結果を詳しく記述してください");return;
    }
    if(data.reports.length>=100){showToast("報告は最大100件までです");return;}
    if (data.reports.some(p=>p.accepted && p.category===r.category)) {
      showToast("この観点の不具合報告はすでに受理されています");return;
    }
    r.accepted=observed().has(r.category);
    data.reports.push(r);
    render();
    showToast(r.accepted ? "報告を受理しました！操作の観測記録と一致しました。" :
      "報告を保存しました。該当観点の操作・再現を再確認してください。");
  }
  function exportData() {
    const payload=JSON.stringify({app:"QA Dojo",version:3,mission:missionId,mode:EXPLORATORY?"explore":"classic",exportedAt:new Date().toISOString(),training:mission && mission.id==="signup" ? {...data,mock:{...data.mock,password:"",confirm:""}} : data},null,2);
    const url=URL.createObjectURL(new Blob([payload],{type:"application/json"}));
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download="qa-dojo-"+(EXPLORATORY?"explore":"design")+"-"+missionId+"-training.json";
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    showToast("修行の記録を書き出しました");
  }
  document.addEventListener("change",e => {
    const mock=e.target.closest("[data-mock]");if(mock)syncMock(mock);
  });
  document.addEventListener("input",e => {
    const mock=e.target.closest("[data-mock]");if(mock)syncMock(mock);
  });
  document.addEventListener("submit",e => {
    if (e.target.id==="case-form"){e.preventDefault();registerCase(e.target);}
    if (e.target.id==="note-form"){e.preventDefault();registerNote(e.target);}
    if (e.target.id==="report-form"){e.preventDefault();registerReport(e.target);}
  });
  document.addEventListener("click",e => {
    const navigation=e.target.closest("[data-nav]");
    if(navigation){e.preventDefault();toView(navigation.getAttribute("data-nav"));return;}
    const actionEl=e.target.closest("[data-action]");
    if(!actionEl) return;
    e.preventDefault();
    switch(actionEl.getAttribute("data-action")){
      case "gallery-prev":
      case "gallery-next": {
        const gallery=document.getElementById("mission-gallery");
        if(gallery) gallery.scrollBy({left:(actionEl.getAttribute("data-action")==="gallery-next"?1:-1)*gallery.clientWidth*.85,behavior:"smooth"});
        break;
      }
      case "scenario":executeScenario(actionEl.getAttribute("data-operation"));break;
      case "reset-simulation":
        if(window.confirm("模擬アプリの入力と登録データを初期状態に戻しますか？学習記録は残ります。")){
          data.mock={...mission.initial};data.scenarioState={};data.lastResult="";data.resultType="";
          logAction("模擬データ初期化","入力と登録データを初期状態に戻しました");render();
        }break;
      case "start":toStep(data.progressed>0?Math.min(3,data.progressed):0);break;
      case "reveal-feedback":
        if(data.reports.length) {data.reviewUnlocked=true;render();showToast("不具合の解説を表示しました");}
        break;
      case "view-feedback":toStep(3);break;
      case "step":toStep(Number(actionEl.getAttribute("data-step")));break;
      case "remove-case":{
        const id=actionEl.getAttribute("data-id");
        data.cases=data.cases.filter(c=>c.id!==id);
        if(!EXPLORATORY && !data.cases.length && step>=2)step=1;
        render();showToast("テストケースを削除しました");break;
      }
      case "calculate":calculate();break;
      case "order":order();break;
      case "clear-logs":
        if(window.confirm("操作ログと観測記録を消去しますか？受理済み報告は残ります。")){
          data.logs=[];data.observed=[];data.lastResult="";data.resultType="";
          render();showToast("操作ログを消去しました");
        }break;
      case "export":exportData();break;
      case "reset":
        if(window.confirm("このアプリの現在のモードの記録を削除しますか？他のアプリやモードの記録は消えません。この操作は取り消せません。")){
          data=blank();view="dashboard";step=0;render();showToast("修行の記録をリセットしました");
        }break;
    }
  });
  render();
})();

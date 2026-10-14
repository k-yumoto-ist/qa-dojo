/* Training apps: deliberate defects live in evaluate(), separate from the specification. */
window.QA_SCENARIOS = (() => {
  "use strict";
  const spec = rows => rows.map(([title, body], i) => ({id:`FR-0${i+1}`, title, body}));
  const categories = rows => [...rows.map(([id,name])=>({id,name})), {id:"other",name:"その他"}];
  const field = (key,label,type="text",options) => ({key,label,type,options});
  const feedback = rows => rows.map(([id,title,spec,reproduce,expected,actual]) => ({id,title,spec,reproduce,expected,actual}));
  const result = (message, defects=[], state, type="success") => ({message,defects,state,type});
  const error = message => result(message,[],undefined,"error");
  const day = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T00:00:00Z")) && new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
  const catalog = [
    {id:"P01",name:"リネンノート",category:"文具",price:500,stock:12},
    {id:"P02",name:"ウッドペン",category:"文具",price:1000,stock:0},
    {id:"P03",name:"トラベルマグ",category:"生活雑貨",price:1500,stock:8},
    {id:"P04",name:"デスクライト",category:"生活雑貨",price:3000,stock:3},
    {id:"P05",name:"キャンバスバッグ",category:"生活雑貨",price:2000,stock:0},
    {id:"P06",name:"リングノート",category:"文具",price:1000,stock:6}
  ];
  return [
    {
      id:"booking", title:"会議室予約", level:"02", brand:"ROOM RESERVE", url:"demo.rooms.test / reservations",
      description:"日時の境界・人数・重複予約を、登録とキャンセルで検証する。", time:"30〜45分",
      categories:categories([["duration","予約時間"],["capacity","定員"],["overlap","重複予約"],["cancel","キャンセルと再予約"],["title","予約名・文字数"]]),
      feedback:feedback([
        ["duration","120分ちょうどの予約が拒否される","FR-02","10:00〜12:00（120分）で予約する。","30〜120分は予約可能。","上限の120分ちょうどをエラーとして拒否する。"],
        ["capacity","定員を1人超えて予約できる","FR-03","会議室A、利用人数7人で予約する。","定員6人を超えているため拒否する。","7人でも予約が登録されてしまう。"],
        ["overlap","前の予約の終了時刻に開始しても予約できない","FR-04","10:00〜11:00の予約を登録後、同じ部屋に11:00〜12:00を登録する。","時間が重ならないので後続の予約を受け付ける。","終了時刻と開始時刻が同じだけで重複として拒否する。"],
        ["cancel","キャンセル後の時間帯を再予約できない","FR-05","予約を登録してキャンセルし、同じ時間帯で再度予約する。","キャンセル済みの枠は再予約できる。","キャンセル済みの枠が予約済み扱いになり再予約できない。"],
        ["title","31文字以上の予約名を受け付ける","FR-06","予約名を31文字にして登録する。","予約名は最大30文字なので登録を拒否する。","31文字以上でも予約が登録される。"]
      ]),
      specifications:spec([
        ["予約日と時間","予約日は2026-11-01〜2026-11-30（両端含む）。09:00〜18:00の範囲で30分刻み、開始より終了が後であること。"],
        ["利用時間","予約時間は30〜120分まで（両端含む）。"],
        ["会議室と定員","会議室Aの定員は6人、会議室Bは12人。利用人数は1人〜定員の整数。"],
        ["重複予約","同じ日・会議室の有効な予約と時間が重なる場合は登録不可。既存予約の終了時刻と新規予約の開始時刻が同じなら登録可能。"],
        ["キャンセル","キャンセルした予約は一覧に「キャンセル済み」と表示し、その時間帯を再予約できる。"],
        ["予約名","前後の空白を除いた予約名が1〜30文字であること。文字数はJavaScriptのlengthで数える。"],
        ["初期データ","初期状態は予約なし。日時は演習用の固定日で、今日の日付には依存しない。予約の追加とキャンセルはこの演習内だけに反映される。"]
      ]),
      initial:{date:"2026-11-10",start:"10:00",end:"11:00",room:"A",people:"3",title:"チーム定例"},
      fields:[field("date","予約日","date"),field("room","会議室","select",[["A","会議室A（6人）"],["B","会議室B（12人）"]]),field("start","開始時刻","time"),field("end","終了時刻","time"),field("people","利用人数","number"),field("title","予約名")],
      actions:[["reserve","予約する"]],
      evaluate(m, action, state) {
        const rows=(state.rows||[]).map(r=>({...r}));
        if(action.startsWith("cancel:")) {
          const row=rows.find(r=>String(r.id)===action.slice(7));
          if(!row || row.cancelled)return error("キャンセル対象の予約がありません。");
          row.cancelled=true;
          return result("予約をキャンセルしました。",[],{...state,rows});
        }
        if(action!=="reserve")return error("操作を選んでください。");
        const minutes=s=>/^\d{2}:\d{2}$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
        const start=minutes(m.start),end=minutes(m.end),duration=end-start,n=Number(m.people),cap=m.room==="A"?6:12;
        if(!day(m.date)||m.date<"2026-11-01"||m.date>"2026-11-30"||!Number.isFinite(start)||!Number.isFinite(end)||start<540||end>1080||start%30||end%30||duration<30||duration>120)return error("日付・営業時間・予約時間を確認してください。");
        if(!["A","B"].includes(m.room)||!Number.isInteger(n)||n<1||n>cap+1)return error("会議室・人数を確認してください。"); // deliberate: capacity + 1
        if(!m.title.trim())return error("予約名を入力してください。");
        const same=rows.filter(r=>r.date===m.date&&r.room===m.room);
        if(same.some(r=>!r.cancelled&&start<r.end&&end>r.start))return error("この時間帯は予約済みです。");
        if(same.some(r=>r.cancelled&&start<r.end&&end>r.start))return result("この時間帯は予約済みです。",["cancel"],undefined,"error"); // deliberate: cancelled reservations still block
        if(same.some(r=>!r.cancelled&&start<=r.end&&end>=r.start))return result("この時間帯は予約済みです。",same.some(r=>!r.cancelled&&(start===r.end||end===r.start))?["overlap"]:[],undefined,"error");
        if(duration===120)return result("予約時間を確認してください。",["duration"],undefined,"error"); // deliberate: exact upper boundary rejected
        rows.push({id:(state.nextId||1),date:m.date,room:m.room,start,end,title:m.title.trim(),people:n,cancelled:false});
        return result("予約を登録しました。",[...(n>cap?["capacity"]:[]),...(m.title.trim().length>30?["title"]:[])],{rows,nextId:(state.nextId||1)+1});
      }
    },
    {
      id:"signup",title:"会員登録",level:"03",brand:"MEMBER CLUB",url:"demo.members.test / signup",
      description:"入力検証・年齢条件・パスワード一致・同意と重複登録を確認する。",time:"25〜40分",
      categories:categories([["password","パスワード強度"],["confirm","確認入力"],["age","年齢制限"],["consent","利用規約への同意"],["duplicate","重複登録"]]),
      feedback:feedback([
        ["password","英数字を混在させなくても登録できる","FR-03","パスワードと確認用に「abcdefgh」を入力して会員登録する。","8〜32文字かつ英字・数字それぞれ1文字以上が必要。","英字のみのパスワードでも登録される。"],
        ["confirm","確認用パスワードが違っても登録できる","FR-04","パスワード「Test1234」、確認用「Test1235」で登録する。","確認入力と本パスワードが完全一致しない場合はエラー。","不一致でも登録される。"],
        ["age","17歳でも登録できる","FR-05","年齢を17にして登録する。","18〜100歳の整数のみ登録可能。","17歳でも登録される。"],
        ["consent","利用規約に同意しなくても登録できる","FR-06","利用規約のチェックを外して登録する。","同意チェックがない場合は登録を拒否する。","未同意でも登録が完了する。"],
        ["duplicate","メールアドレスの大小文字違いで重複登録できる","FR-07","初期登録済みのmember@example.comをMEMBER@example.comにして登録する。","メールアドレスの大小文字を区別せず重複登録を拒否する。","大文字・小文字が異なると別メール扱いで登録される。"]
      ]),
      specifications:spec([
        ["表示名","前後の空白を除いて1〜20文字。文字数はJavaScriptのlengthで数える。"],
        ["メール","メールはlocal@domain.tldの形式で必須。前後の空白を除去して登録する。"],
        ["パスワード","8〜32文字で、半角英字と半角数字をそれぞれ1文字以上含むこと。"],
        ["確認入力","確認用パスワードはパスワードと完全一致すること。"],
        ["年齢","年齢は18〜100歳の整数に限る。"],
        ["規約同意","利用規約への同意にチェックした場合だけ登録できる。"],
        ["登録済みメール","登録済みのメールは大文字・小文字を区別せず重複登録不可。初期登録済みメールはmember@example.com。登録に成功したメールも以後重複扱い。パスワードは保存・ログ出力しない。"]
      ]),
      initial:{name:"テスト太郎",email:"new@example.com",password:"Test1234",confirm:"Test1234",age:"20",consent:"yes"},
      fields:[field("name","表示名"),field("email","メールアドレス"),field("password","パスワード","password"),field("confirm","確認用パスワード","password"),field("age","年齢","number"),field("consent","利用規約に同意する","checkbox")],
      actions:[["register","会員登録する"]],
      evaluate(m,action,state) {
        if(action!=="register")return error("操作を選んでください。");
        const name=m.name.trim(),email=m.email.trim(),n=Number(m.age),members=state.members||["member@example.com"];
        if(!name||name.length>20||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return error("表示名またはメールアドレスを確認してください。");
        if(m.password.length<8||m.password.length>32)return error("パスワードは8〜32文字で入力してください。");
        if(!Number.isInteger(n)||n<17||n>100)return error("年齢の入力内容を確認してください。");
        if(members.includes(email))return error("このメールアドレスは登録済みです。");
        const defects=[];
        if(!/[a-zA-Z]/.test(m.password)||!/[0-9]/.test(m.password))defects.push("password");
        if(m.password!==m.confirm)defects.push("confirm");
        if(n===17)defects.push("age");
        if(m.consent!=="yes")defects.push("consent");
        if(members.some(e=>e.toLowerCase()===email.toLowerCase()))defects.push("duplicate");
        return result(`${name}さんの登録が完了しました。メール：${email}`,defects,{members:[...members,email]});
      }
    },
    {
      id:"search",title:"商品検索・絞り込み",level:"04",brand:"LIFE STORE",url:"demo.life-store.test / products",
      description:"複合条件・価格の境界・在庫・並び順を検索結果と照合する。",time:"25〜40分",
      categories:categories([["min","最低価格"],["max","最高価格"],["stock","在庫条件"],["combine","複合条件"],["sort","並び替え"]]),
      feedback:feedback([
        ["min","最低価格と同額の商品が検索から漏れる","FR-04","最低価格500円として検索する。","最低価格以上を含め、500円の商品も表示する。","最低価格と同額の商品が表示されない。"],
        ["max","最高価格と同額の商品が検索から漏れる","FR-04","最高価格1,000円として検索する。","最高価格以下を含め、1,000円の商品も表示する。","最高価格と同額の商品が表示されない。"],
        ["stock","在庫なしの商品が在庫あり検索に混ざる","FR-05","「在庫ありのみ」をチェックして検索する。","在庫が1個以上ある商品だけを表示する。","在庫0個の商品も結果に含まれる。"],
        ["combine","キーワードと分類がANDではなくORになる","FR-06","キーワード「ノート」、分類「生活雑貨」で検索する。","双方の条件を満たす商品だけを表示（該当0件）。","どちらか一方に合えば結果に表示される。"],
        ["sort","価格が高い順でも安い順に並ぶ","FR-07","並び順「価格が高い順」で検索する。","価格の降順で並び、同額では商品IDの昇順。","常に価格の昇順で表示される。"]
      ]),
      specifications:spec([
        ["商品データ","商品マスターは画面の「商品マスター」で確認可能。商品ID・名称・分類・税込価格・在庫数は固定。"],
        ["キーワード","前後の空白を除き、商品名の部分一致で検索。空欄ならキーワードによる絞り込みなし。"],
        ["分類","すべて・文具・生活雑貨から選択。指定分類の商品だけを表示。"],
        ["価格帯","最低・最高価格は任意の0以上の整数（円）。最低価格以上、最高価格以下を含む。最低＞最高や不正値ならエラー表示し、結果は更新しない。"],
        ["在庫","在庫ありのみにチェックした場合は在庫1以上だけ表示。未選択なら在庫0も含む。"],
        ["複合条件","キーワード・分類・価格帯・在庫はすべてAND条件として適用。結果がないときは0件と表示。"],
        ["並び順","価格が安い順・高い順を選択できる。同価格は商品IDの昇順。検索ボタンを押したときに条件と並び順を適用する。"]
      ]),
      catalog,
      initial:{keyword:"",category:"all",min:"",max:"",stock:"",sort:"asc"},
      fields:[field("keyword","キーワード"),field("category","分類","select",[["all","すべて"],["文具","文具"],["生活雑貨","生活雑貨"]]),field("min","最低価格（円）","number"),field("max","最高価格（円）","number"),field("stock","在庫ありのみ","checkbox"),field("sort","並び順","select",[["asc","価格が安い順"],["desc","価格が高い順"]])],
      actions:[["search","検索する"]],
      evaluate(m,action,state) {
        if(action!=="search")return error("操作を選んでください。");
        const lo=m.min.trim()===""?null:Number(m.min),hi=m.max.trim()===""?null:Number(m.max),q=m.keyword.trim();
        if([lo,hi].some(v=>v!==null&&(!Number.isInteger(v)||v<0))||(lo!==null&&hi!==null&&lo>hi))return error("価格帯は0以上の整数で、最低価格≦最高価格にしてください。");
        const match=p=> (!q||p.name.includes(q))&&(m.category==="all"||p.category===m.category);
        const actualMatch=p=> q&&m.category!=="all" ? p.name.includes(q)||p.category===m.category : match(p); // deliberate OR
        const prices=p=>(lo===null||p.price>lo)&&(hi===null||p.price<hi); // deliberate exclusive bounds
        const rows=catalog.filter(p=>actualMatch(p)&&prices(p)); // deliberate: ignores stock
        rows.sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id)); // deliberate: descending ignored
        const defects=[];
        if(lo!==null&&catalog.some(p=>match(p)&&(m.stock!=="yes"||p.stock>0)&&p.price===lo&&(hi===null||p.price<=hi)))defects.push("min");
        if(hi!==null&&catalog.some(p=>match(p)&&(m.stock!=="yes"||p.stock>0)&&p.price===hi&&(lo===null||p.price>=lo)))defects.push("max");
        if(m.stock==="yes"&&rows.some(p=>p.stock===0))defects.push("stock");
        if(q&&m.category!=="all"&&rows.some(p=>!match(p)))defects.push("combine");
        if(m.sort==="desc"&&new Set(rows.map(p=>p.price)).size>1)defects.push("sort");
        return result(`検索結果：${rows.length}件`,defects,{...state,results:rows});
      }
    },
    {
      id:"expense",title:"経費申請・承認",level:"05",brand:"EXPENSE FLOW",url:"demo.expenses.test / claims",
      description:"金額計算・添付条件・ロール権限・承認後の状態遷移を確かめる。",time:"35〜50分",
      categories:categories([["tax","税額・端数"],["receipt","領収書条件"],["role","承認権限"],["edit","承認後の編集"],["withdraw","承認後の取り下げ"]]),
      feedback:feedback([
        ["tax","消費税の端数が切り捨てではなく四捨五入になる","FR-02","税抜15円、税率10%で新規申請する。","消費税1.5円は切り捨てて1円。","四捨五入により消費税が2円になる。"],
        ["receipt","税抜10,000円ちょうどで領収書なしの申請が通る","FR-03","税抜10,000円、「領収書あり」をオフにして申請する。","10,000円以上は領収書必須なので拒否する。","10,000円ちょうどは領収書なしでも申請が通る。"],
        ["role","本人ロールでも自分の経費を承認できる","FR-05","本人ロールで新規申請を作り、同じロールで承認する。","承認者だけが承認できる。","本人でも申請を承認できる。"],
        ["edit","承認済みの申請を更新できる","FR-06","新規申請を作成・承認した後、本人ロールでフォームを変更して更新する。","承認済みの経費は更新不可。","承認済みでも金額・件名などを更新できる。"],
        ["withdraw","承認済みの申請を取り下げられる","FR-07","新規申請を作成・承認した後、本人ロールで取り下げる。","承認済みの経費は取り下げ不可。","承認済みでも取り下げできる。"]
      ]),
      specifications:spec([
        ["入力","件名は前後の空白を除いて1〜40文字。税抜金額は1〜100,000円の整数、税率は10%または8%。"],
        ["税額","消費税は税抜金額×税率の1円未満を切り捨て。税込金額は税抜金額＋消費税。"],
        ["領収書","税抜金額10,000円以上では領収書が必須。演習では「領収書あり」のチェックで添付を模擬する。"],
        ["申請","新規申請すると一覧に「申請中」で追加。入力条件を満たさない場合は追加しない。"],
        ["ロールと承認","操作ロールは本人・承認者を切替可能。承認者だけが申請中の経費を承認できる。本人には承認権限がない。"],
        ["更新","本人だけが申請中の経費を現在のフォーム内容で更新可能。承認済みの経費はどのロールでも更新不可。更新時も新規と同じ入力条件を適用。"],
        ["取り下げ","本人だけが申請中の経費を取り下げられる。承認済み・取り下げ済みは取り下げ不可。取り下げ済みの更新・承認も不可。初期状態は申請なし。"]
      ]),
      initial:{title:"出張交通費",amount:"1200",rate:"10",receipt:"yes",role:"self"},
      fields:[field("title","件名"),field("amount","税抜金額（円）","number"),field("rate","税率","select",[["10","10%"],["8","8%"]]),field("receipt","領収書あり（模擬添付）","checkbox"),field("role","操作ロール","select",[["self","本人"],["approver","承認者"]])],
      actions:[["submit","新規申請する"]],
      evaluate(m,action,state) {
        const rows=(state.rows||[]).map(r=>({...r})),[verb,id]=action.split(":"),row=rows.find(r=>String(r.id)===id);
        if(verb==="approve") {
          if(!row||row.status!=="申請中")return error("申請中の経費だけ承認できます。");
          row.status="承認済み";
          return result("承認しました。",m.role==="self"?["role"]:[],{...state,rows});
        }
        if(verb==="withdraw") {
          if(!row||row.status==="取り下げ済み"||m.role!=="self")return error("本人だけが有効な申請を取り下げられます。");
          const defects=row.status==="承認済み"?["withdraw"]:[];
          row.status="取り下げ済み";
          return result("取り下げました。",defects,{...state,rows});
        }
        if(!["submit","update"].includes(verb))return error("操作を選んでください。");
        if(verb==="update"&&(!row||row.status==="取り下げ済み"||m.role!=="self"))return error("本人だけが有効な申請を更新できます。");
        const n=Number(m.amount),rate=Number(m.rate);
        if(!m.title.trim()||m.title.trim().length>40||!Number.isInteger(n)||n<1||n>100000||![8,10].includes(rate))return error("件名・税抜金額・税率を確認してください。");
        if(n>10000&&m.receipt!=="yes")return error("領収書を添付してください。"); // deliberate: exclusive threshold
        const tax=Math.round(n*rate/100),defects=[]; // deliberate: rounding
        if(tax!==Math.floor(n*rate/100))defects.push("tax");
        if(n===10000&&m.receipt!=="yes")defects.push("receipt");
        const values={title:m.title.trim(),amount:n,tax,total:n+tax};
        if(verb==="update") {
          if(row.status==="承認済み")defects.push("edit");
          Object.assign(row,values);
        } else rows.push({id:state.nextId||1,...values,status:"申請中"});
        return result(verb==="update"?"申請内容を更新しました。":"申請を登録しました。",defects,{rows,nextId:verb==="submit"?(state.nextId||1)+1:state.nextId});
      }
    }
  ];
})();

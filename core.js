/* My Study OS: deterministic data logic, no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StudyCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const VERSION = 1;
  const SUBJECTS = [
    { name: '数学ⅠA', short: '数ⅠA', color: '#8b9fff' },
    { name: '数学ⅡBC', short: '数ⅡBC', color: '#aa92ff' },
    { name: '英語', short: '英語', color: '#4edbb1' },
    { name: '国語', short: '国語', color: '#f2bb72' },
    { name: '物理基礎', short: '物基', color: '#72c4fa' },
    { name: '化学基礎', short: '化基', color: '#fb94a3' },
    { name: '公共・政治経済', short: '公共政経', color: '#f5d572' },
    { name: '情報Ⅰ', short: '情報', color: '#8ce2dc' }
  ];
  const subjectNames = SUBJECTS.map(x => x.name);
  const seed = [
    ['数学ⅠA', '入門問題精講 IA'], ['数学ⅠA', '解法のエウレカ IA'],
    ['数学ⅡBC', '入門問題精講 IIBC'], ['数学ⅡBC', '解法のエウレカ IIB＋ベクトル'],
    ['英語', 'ターゲット1900'], ['英語', 'The Rules 2'],
    ['英語', '英文法ポラリス1'], ['英語', '英文解釈ポラリス1'],
    ['国語', '現代文アクセス 基本編'], ['物理基礎', '短期攻略 物理基礎'],
    ['化学基礎', 'きめる！ 化学基礎'], ['公共・政治経済', '蔭山の公共・政治経済'],
    ['情報Ⅰ', '7日で完成 情報Ⅰ']
  ];
  function uid() { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function todayTokyo(date = new Date()) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone:'Asia/Tokyo', year:'numeric',month:'2-digit',day:'2-digit' }).format(date);
  }
  function shiftDate(iso, days) {
    const [y,m,d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
  }
  function defaultState() {
    return {
      version: VERSION,
      settings: { name: 'MY STUDY OS', goal:'2027 横浜市立大学 データサイエンス学部', examDate:'2027-02-25', dailyMinutes:300, memo:'10月末まで二次数英を軸に、11月から共テ演習へつなぐ。' },
      materials: seed.map(([subject, title]) => ({id:uid(), subject, title, status:'未確認', doneUnits:null, totalUnits:null, nextStep:'', note:''})),
      tasks: [], logs: [], notes: [], createdAt:new Date().toISOString()
    };
  }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }
  function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)); }
  function clamp(v, min, max) { const n = Number(v); return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)); }
  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !raw.settings || !Array.isArray(raw.materials) || !Array.isArray(raw.tasks) || !Array.isArray(raw.logs)) throw Error('MY STUDY OS形式のJSONではありません。');
    if (raw.materials.length > 500 || raw.tasks.length > 5000 || raw.logs.length > 15000) throw Error('インポートするデータが大きすぎます。');
    const base = defaultState();
    base.settings = {
      name: String(raw.settings.name || base.settings.name).slice(0,80),
      goal: String(raw.settings.goal || base.settings.goal).slice(0,200),
      examDate:validDate(raw.settings.examDate) ? raw.settings.examDate : base.settings.examDate,
      dailyMinutes:clamp(raw.settings.dailyMinutes,30,720),
      memo:String(raw.settings.memo || '').slice(0,800)
    };
    const ids = new Set();
    base.materials = raw.materials.filter(m => m && subjectNames.includes(m.subject)).map(m => {
      let id=String(m.id||uid()); if(ids.has(id)) id=uid(); ids.add(id);
      const total = m.totalUnits === null || m.totalUnits === undefined || m.totalUnits === '' ? null : clamp(m.totalUnits,1,100000);
      const done = m.doneUnits === null || m.doneUnits === undefined || m.doneUnits === '' || total === null ? null : clamp(m.doneUnits,0,total);
      return {id,subject:m.subject,title:String(m.title||'無題').slice(0,120),status:['未確認','取り組み中','保留','完了'].includes(m.status)?m.status:'未確認', doneUnits:done,totalUnits:total,nextStep:String(m.nextStep||'').slice(0,200),note:String(m.note||'').slice(0,600)};
    });
    const taskIds=new Set();
    base.tasks = raw.tasks.filter(t=>t && validDate(t.date) && subjectNames.includes(t.subject)).map(t=>{
      let id=String(t.id||uid());if(taskIds.has(id)) id=uid(); taskIds.add(id);
      return {id,date:t.date,subject:t.subject,title:String(t.title||'学習').slice(0,200), minutes:clamp(t.minutes,5,360),status:t.status==='done'?'done':'pending',reason:String(t.reason||'').slice(0,400), materialId:ids.has(t.materialId)?String(t.materialId):null, completedAt:t.status==='done'?String(t.completedAt||''):''};
    });
    base.logs = raw.logs.filter(l=>l && validDate(l.date) && subjectNames.includes(l.subject)).map(l=>({id:String(l.id||uid()), date:l.date,subject:l.subject,minutes:clamp(l.minutes,1,720),title:String(l.title||'学習').slice(0,200),note:String(l.note||'').slice(0,1000),taskId:taskIds.has(l.taskId)?String(l.taskId):null, createdAt:String(l.createdAt||'')}));
    base.createdAt=String(raw.createdAt||new Date().toISOString());
    return base;
  }
  function addTask(state, data) {
    if (!subjectNames.includes(data.subject) || !validDate(data.date) || !String(data.title||'').trim()) throw Error('科目・日付・内容を確認してください。');
    const next = clone(state);
    next.tasks.push({id:uid(),date:data.date,subject:data.subject,title:String(data.title).trim().slice(0,200),minutes:clamp(data.minutes,5,360),status:'pending',reason:String(data.reason||'').slice(0,400),materialId:data.materialId||null,completedAt:''});
    return next;
  }
  function recordSession(state, data) {
    if (!subjectNames.includes(data.subject) || !validDate(data.date) || !String(data.title||'').trim() || !(Number(data.minutes)>0)) throw Error('記録の内容を確認してください。');
    const next = clone(state);
    const task = data.taskId ? next.tasks.find(t=>t.id===data.taskId) : null;
    if (data.taskId && !task) throw Error('選択したタスクが見つかりません。');
    if (data.markDone && task && task.status==='done') throw Error('完了済みのタスクです。');
    next.logs.push({id:uid(),date:data.date,subject:data.subject,title:String(data.title).trim().slice(0,200),minutes:clamp(data.minutes,1,720),note:String(data.note||'').slice(0,1000),taskId:task?task.id:null,createdAt:new Date().toISOString()});
    if (data.markDone && task){task.status='done';task.completedAt=new Date().toISOString();}
    return next;
  }
  function weekStats(state, today) {
    const since=shiftDate(today,-6); const logs=state.logs.filter(l=>l.date>=since && l.date<=today);
    const totals=Object.fromEntries(subjectNames.map(s=>[s,0])); const days=Array.from({length:7},(_,i)=>({date:shiftDate(since,i),minutes:0}));
    logs.forEach(l=>{ totals[l.subject]+=l.minutes; const day=days.find(d=>d.date===l.date); if(day)day.minutes+=l.minutes; });
    return {totalMinutes:logs.reduce((a,l)=>a+l.minutes,0),activeDays:days.filter(d=>d.minutes>0).length,days,totals,logCount:logs.length};
  }
  function phaseFor(date) { return date < '2026-11-01'?'二次形成期':'共テ演習期'; }
  function planToday(state,date=todayTokyo()) {
    const phase=phaseFor(date);
    const recorded=state.logs.filter(l=>l.date===date).reduce((sum,l)=>sum+l.minutes,0);
    const budget=Math.max(0,clamp(state.settings.dailyMinutes,30,720)-recorded);
    if(budget<10)return {source:'rule',phase,overview:'今日の設定時間は記録済みです。必要なら設定の1日配分を見直してください。',actions:[]};
    const rotation=['国語','物理基礎','化学基礎','公共・政治経済','情報Ⅰ'];
    const dayNum=Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
    const rot=rotation[((dayNum%rotation.length)+rotation.length)%rotation.length];
    const subjects=phase==='二次形成期'?['数学ⅠA','数学ⅡBC','英語',rot]:[rot,rotation[(rotation.indexOf(rot)+1)%5],'数学ⅡBC','英語'];
    const weights=phase==='二次形成期'?[0.34,0.32,0.20,0.14]:[0.29,0.26,0.24,0.21];
    const count=budget<100?2:budget<170?3:4; const subset=subjects.slice(0,count);
    let remaining=budget;
    const minutes=subset.map((_,i)=>{
      if(i===count-1)return remaining;
      const w=weights[i]/weights.slice(0,count).reduce((a,b)=>a+b,0);
      const amt=Math.max(10,Math.round(budget*w/10)*10);
      const safe=Math.min(amt,remaining-(count-i-1)*10);
      remaining-=safe;return safe;
    });
    const actions=subset.map((subject,i)=>{
      const active=state.materials.find(m=>m.subject===subject && m.status==='取り組み中');
      const title=active ? (active.nextStep ? active.nextStep : `${active.title}：次の範囲を演習`) : `${subject}：現在の教材と進捗を確認し、次の範囲を演習`;
      const reason=i<3&&phase==='二次形成期'?'二次数学・英語を優先':phase==='共テ演習期'?'共テ科目をローテーション':'共テ科目の準備を維持';
      return {subject,title,minutes:minutes[i],materialId:active?active.id:null,reason};
    });
    return {source:'rule',phase,overview:'固定予定を自動参照できないため、時期と設定した時間から作った仮配分です。学校・塾の予定を踏まえて調整してください。',actions};
  }
  function adoptPlan(state, date, actions) {
    if(!validDate(date) || !Array.isArray(actions) || !actions.length || actions.length>8) throw Error('採用できる計画がありません。');
    const next=clone(state);next.tasks=next.tasks.filter(t=>!(t.date===date&&t.status==='pending'));
    actions.forEach(a=>{
      if(!subjectNames.includes(a.subject)||!String(a.title||'').trim())throw Error('計画に無効なタスクがあります。');
      next.tasks.push({id:uid(),date,subject:a.subject,title:String(a.title).slice(0,200),minutes:clamp(a.minutes,5,360),status:'pending',reason:String(a.reason||'').slice(0,400),materialId:next.materials.some(m=>m.id===a.materialId)?a.materialId:null,completedAt:''});
    });
    return next;
  }
  return {VERSION,SUBJECTS,subjectNames,defaultState,normalizeState,todayTokyo,shiftDate,addTask,recordSession,weekStats,phaseFor,planToday,adoptPlan,uid,clamp};
});

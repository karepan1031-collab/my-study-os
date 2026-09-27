/* UI: all state changes are explicit and saved once per confirmed operation. */
(() => {
  'use strict';
  const Core=window.StudyCore;
  const $=id=>document.getElementById(id);
  const storeKey='my-study-os-v1';
  let state;
  let storageOk=true;
  try { const saved=localStorage.getItem(storeKey);state=saved?Core.normalizeState(JSON.parse(saved)):Core.defaultState(); }
  catch(err){console.warn('Storage:',err);state=Core.defaultState();storageOk=false;}
  let today=Core.todayTokyo();
  let selectedTab='today', proposedPlan=null, aiReady=false;
  let timerMode='focus', timerRemain=3000, timerEnd=0, timerTicker=null;
  let toastTimeout=null;
  const subject=key=>Core.SUBJECTS.find(s=>s.name===key)||Core.SUBJECTS[0];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=mins=>mins>=60?`${Math.floor(mins/60)}時間${mins%60?`${mins%60}分`:''}`:`${mins}分`;
  const shortDate=iso=>`${Number(iso.slice(5,7))}/${Number(iso.slice(8,10))}`;
  const weekdays=['日','月','火','水','木','金','土'];
  function dateLabel(iso){const [y,m,d]=iso.split('-').map(Number);return `${m}月${d}日（${weekdays[new Date(Date.UTC(y,m-1,d)).getUTCDay()]}）`;}
  function toast(message,error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),4600);}
  function commit(next,message){try{localStorage.setItem(storeKey,JSON.stringify(next));storageOk=true;}catch(err){storageOk=false;toast('保存できませんでした。データをバックアップしてストレージ設定を確認してください。',true);return false;}state=next;render();if(message)toast(message);return true;}
  function initialStorage(){try{if(!localStorage.getItem(storeKey))localStorage.setItem(storeKey,JSON.stringify(state));}catch(_err){storageOk=false;}if(!storageOk)setTimeout(()=>toast('このブラウザでは自動保存できません。通常モードで開いてください。',true),400);}
  function chooseTab(tab){if(!['today','materials','analysis','settings'].includes(tab))return;selectedTab=tab;document.querySelectorAll('.tab-page').forEach(el=>el.hidden=el.id!==`tab-${tab}`);document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));$('breadcrumb-current').textContent=({today:'今日の勉強',materials:'教材・進捗',analysis:'学習の記録',settings:'設定・バックアップ'})[tab];window.scrollTo({top:0,behavior:'smooth'});if(tab==='settings')renderSettings();}
  function render(){renderToday();renderMaterials();renderAnalysis();if(selectedTab==='settings')renderSettings();}
  function renderToday(){
    $('today-date').textContent=dateLabel(today);$('phase-name').textContent=Core.phaseFor(today);$('phase-note').textContent=Core.phaseFor(today)==='二次形成期'?'数学・英語を軸に進める':'共テ過去問演習へ接続';
    const tasks=state.tasks.filter(t=>t.date===today).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done'));
    const pending=tasks.filter(t=>t.status!=='done');const completed=tasks.length-pending.length;
    const todayLogs=state.logs.filter(l=>l.date===today);const todayMinutes=todayLogs.reduce((a,b)=>a+b.minutes,0);
    const week=Core.weekStats(state,today);
    $('today-minutes').innerHTML=todayLogs.length?`${fmt(todayMinutes)}`:'未記録';
    $('pending-count').textContent=tasks.length?`${pending.length}件`:'—';
    $('task-progress').textContent=tasks.length?`${completed} / ${tasks.length} 件を完了`:'計画を作ると表示されます';
    $('week-hours').textContent=week.logCount?fmt(week.totalMinutes):'未記録';
    $('week-days').textContent=week.logCount?`記録のある日 ${week.activeDays}/7 日`:'まだ記録がありません';
    const diff=Math.round((Date.parse(`${state.settings.examDate}T00:00:00Z`)-Date.parse(`${today}T00:00:00Z`))/86400000);
    $('exam-days').textContent=diff>=0?`${diff}日`:`${-diff}日経過`;
    $('exam-label').textContent=`設定日 ${state.settings.examDate}`;$('target-date').textContent=state.settings.examDate.replaceAll('-','.');
    $('task-empty').hidden=tasks.length>0;
    $('next-task').hidden=!pending.length;
    if(pending.length){const t=pending[0];$('next-task').innerHTML=`<div class="next-label">NEXT ACTION ・ 次の1つ</div><div class="next-heading"><strong>${esc(t.title)}</strong><span class="pill" style="background:${subject(t.subject).color}26;color:${subject(t.subject).color}">${esc(t.subject)}</span></div><p>予定 ${fmt(t.minutes)}${t.reason?` ・ ${esc(t.reason)}`:''}</p><button class="btn primary" style="margin-top:12px" data-report-task="${esc(t.id)}">結果を報告する →</button>`;}
    $('task-list').innerHTML=tasks.map(t=>`<div class="task-row ${t.status==='done'?'done':''}" style="--subject:${subject(t.subject).color}"><div class="task-bullet"></div><div class="task-info"><strong>${esc(t.title)}</strong><div class="task-meta"><span>${esc(t.subject)}</span><span>・</span><span>予定 ${fmt(t.minutes)}</span>${t.status==='done'?'<span>・ 完了</span>':''}</div></div><div class="task-row-actions">${t.status==='done'?'<span class="pill" style="color:#8de0be;background:#205342">完了</span>':`<button class="tiny-btn" data-report-task="${esc(t.id)}">報告</button><button class="tiny-btn remove" data-remove-task="${esc(t.id)}" aria-label="タスク削除">×</button>`}</div></div>`).join('');
    const last=state.logs.slice(-4).reverse();$('recent-logs').innerHTML=last.length?last.map(logHtml).join(''):'<div class="no-record">まだ学習記録はありません。</div>';
  }
  function logHtml(l){return `<div class="log-item" style="--subject:${subject(l.subject).color}"><div class="log-dot"></div><div><strong>${esc(l.title)}</strong><small>${esc(l.subject)} ・ ${shortDate(l.date)}${l.note?` ・ ${esc(l.note)}`:''}</small></div><span class="log-min">${fmt(l.minutes)}</span></div>`;}
  function renderMaterials(){
    const filter=$('subject-filter').value||'all';const found=state.materials.filter(m=>filter==='all'||m.subject===filter);
    $('materials-count').textContent=`${found.length} 教材 ・ 進捗は手動確認`; $('material-grid').innerHTML=found.length?found.map(m=>{
      const percentage=m.totalUnits!==null&&m.doneUnits!==null?Math.round(m.doneUnits/m.totalUnits*100):null;
      const statusColor=({未確認:'#889aaf',取り組み中:'#55dcb8',保留:'#f6cb89',完了:'#94c0f8'})[m.status];
      return `<div class="material-card"><div class="material-top"><span class="pill" style="background:${subject(m.subject).color}20;color:${subject(m.subject).color}">${esc(m.subject)}</span><span class="pill" style="background:${statusColor}20;color:${statusColor}">${esc(m.status)}</span></div><h3>${esc(m.title)}</h3><p class="note">${m.nextStep?`次：${esc(m.nextStep)}`:'次の行動は未入力'}</p><div class="material-stats"><span>単位の進捗</span><span>${percentage===null?'未入力':`${m.doneUnits} / ${m.totalUnits}（${percentage}%）`}</span></div><div class="progress-track"><div class="progress-fill" style="width:${percentage===null?0:percentage}%"></div></div><div class="material-foot"><span class="muted">${m.note?esc(m.note.slice(0,40)):'現在位置を入力すると計画に反映'}</span><button data-edit-material="${esc(m.id)}">編集 →</button></div></div>`;
    }).join(''):'<div class="panel no-record">この科目の教材はまだ登録されていません。</div>';
  }
  function renderAnalysis(){
    const week=Core.weekStats(state,today);const maxDay=Math.max(...week.days.map(d=>d.minutes),30);
    $('daily-chart').innerHTML=week.days.map(d=>`<div class="daily-col"><div class="bar-space"><div class="daily-bar" style="height:${d.minutes?Math.max(3,100*d.minutes/maxDay):0}%"></div></div><strong>${d.minutes?fmt(d.minutes):'—'}</strong><small>${shortDate(d.date)}</small></div>`).join('');
    const maxSubject=Math.max(...Object.values(week.totals),1);
    $('subject-bars').innerHTML=Core.SUBJECTS.map(s=>`<div class="subject-row" style="--subject:${s.color}"><div><strong>${esc(s.name)}</strong><small>${week.totals[s.name]?fmt(week.totals[s.name]):'未記録'}</small></div><div class="subject-track"><div class="subject-fill" style="width:${week.totals[s.name]/maxSubject*100}%"></div></div></div>`).join('');
    $('log-count').textContent=`${state.logs.length} 件`;
    $('all-logs').innerHTML=state.logs.length?state.logs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(logHtml).join(''):'<div class="no-record">学習結果を記録するとここに表示されます。</div>';
  }
  function renderSettings(){
    $('setting-name').value=state.settings.name;$('setting-goal').value=state.settings.goal;$('setting-date').value=state.settings.examDate;$('setting-minutes').value=state.settings.dailyMinutes;$('setting-memo').value=state.settings.memo;
  }
  function fillSubjects(){const options=Core.SUBJECTS.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');['task-subject','material-subject','session-subject'].forEach(id=>$(id).innerHTML=options);$('subject-filter').insertAdjacentHTML('beforeend',options);}
  function openModal(id){$(id).showModal();}
  function closeModal(dialog){dialog.close();}
  function openTask(){ $('task-form').reset();$('task-date').value=today;$('task-minutes').value=50;openModal('task-dialog');$('task-title').focus();}
  function openMaterial(id=null){$('material-form').reset();const m=id?state.materials.find(m=>m.id===id):null;
    $('material-dialog-title').textContent=m?'教材の状態を編集':'教材を追加';$('material-id').value=m?.id||'';$('material-subject').value=m?.subject||Core.subjectNames[0];$('material-title').value=m?.title||'';$('material-status').value=m?.status||'未確認';$('material-done').value=m?.doneUnits??'';$('material-total').value=m?.totalUnits??'';$('material-next').value=m?.nextStep||'';$('material-note').value=m?.note||'';$('delete-material-btn').hidden=!m;openModal('material-dialog');}
  function openSession(taskId=null){$('session-form').reset();const task=taskId?state.tasks.find(t=>t.id===taskId):null;
    $('session-task-id').value=task?.id||'';$('session-subject').value=task?.subject||Core.subjectNames[0];$('session-title').value=task?.title||'';$('session-date').value=today;$('session-minutes').value=task?.minutes||50;$('session-done-wrap').hidden=!task;$('session-done').checked=!!task;openModal('session-dialog');}
  function planPreview(plan){
    proposedPlan=JSON.parse(JSON.stringify(plan));$('plan-panel').hidden=false;$('plan-source').textContent=plan.source==='gpt'?'GPT PLAN ・ AI提案':'LOCAL PLAN ・ ルールベース仮配分';$('plan-overview').textContent=plan.overview||'';$('plan-risk').textContent=plan.risk||'';$('plan-risk').hidden=!plan.risk;
    $('plan-actions').innerHTML=proposedPlan.actions.map((a,i)=>`<div class="plan-item"><div class="task-bullet" style="background:${subject(a.subject).color};margin-top:6px"></div><div class="plan-item-info"><small>${esc(a.subject)}${a.reason?` ・ ${esc(a.reason)}`:''}</small><input aria-label="${esc(a.subject)}の提案タスク" data-plan-title="${i}" value="${esc(a.title)}" maxlength="200" style="margin-top:7px"></div><div class="plan-time"><input aria-label="予定分数" type="number" min="5" max="360" data-plan-minutes="${i}" value="${a.minutes}"><small>分</small></div></div>`).join(''); updatePlanTotal();$('adopt-plan-btn').disabled=!proposedPlan.actions.length;$('plan-panel').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function updatePlanTotal(){if(proposedPlan)$('plan-total').textContent=`予定合計 ${fmt(proposedPlan.actions.reduce((s,a)=>s+(Number(a.minutes)||0),0))} / 設定 ${fmt(state.settings.dailyMinutes)}`;}
  async function generatePlan(){
    const spent=state.logs.filter(l=>l.date===today).reduce((sum,l)=>sum+l.minutes,0);
    if(spent>=state.settings.dailyMinutes){planPreview(Core.planToday(state,today));return;}
    const buttons=[$('make-plan-btn'),$('ai-plan-btn'),$('empty-plan-btn')];buttons.forEach(b=>{b.disabled=true;b.dataset.prev=b.textContent;b.textContent='提案を作成中…';});
    try{
      if(!aiReady){const draft=Core.planToday(state,today);planPreview(draft);toast('API未接続のため、仮配分を表示しています。');return;}
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),40000);
      try{
        const response=await fetch('/api/ai/plan',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({date:today,settings:state.settings,materials:state.materials,tasks:state.tasks.filter(t=>t.date===today),logs:state.logs.slice(-45).map(l=>({date:l.date,subject:l.subject,minutes:l.minutes,note:l.note.slice(0,180)}))})});
        const data=await response.json();if(!response.ok)throw Error(data.error||'APIエラー');planPreview(data);
      }finally{clearTimeout(timeout);}
    }catch(err){toast(`${err.name==='AbortError'?'AIとの通信が時間切れになりました':err.message}。仮配分を表示します。`,true);planPreview(Core.planToday(state,today));}
    finally{buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.prev;});}
  }
  async function health(){try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),2500);let res;try{res=await fetch('/api/health',{signal:controller.signal});}finally{clearTimeout(timeout);}const data=await res.json();aiReady=!!(res.ok&&data.available);}catch(_err){aiReady=false;} $('ai-status').textContent=aiReady?'GPT接続済み':'仮配分モード';$('ai-description').textContent=aiReady?'最新の教材・予定・学習記録をもとに、GPTが今日の計画を提案します。':'AIのAPIキーは未設定です。現在は、時期別の固定ルールと設定時間から仮配分を作れます。';}
  function updateTimer(){const total=timerMode==='focus'?3000:600;const min=Math.floor(timerRemain/60),sec=timerRemain%60;$('timer-display').textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;$('timer-kind').textContent=timerMode==='focus'?'FOCUS':'BREAK';$('timer-hint').textContent=timerMode==='focus'?'集中モード':'休憩モード';$('timer-ring').style.setProperty('--timer-progress',`${(total-timerRemain)/total*100}%`);$('timer-start').textContent=timerTicker?'一時停止':'開始';document.querySelectorAll('[data-timer]').forEach(b=>b.classList.toggle('active',b.dataset.timer===timerMode));}
  function pauseTimer(){if(timerTicker){clearInterval(timerTicker);timerTicker=null;timerRemain=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));}updateTimer();}
  function timerTick(){timerRemain=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));if(timerRemain===0){pauseTimer();toast(timerMode==='focus'?'集中時間が終了。実績は確認してから記録してください。':'休憩が終了。次の学習を始めましょう。');}updateTimer();}
  function timerAction(){if(timerTicker){pauseTimer();return;}if(timerRemain<=0)timerRemain=timerMode==='focus'?3000:600;timerEnd=Date.now()+timerRemain*1000;timerTicker=setInterval(timerTick,200);updateTimer();}
  function resetTimer(mode=timerMode){pauseTimer();timerMode=mode;timerRemain=mode==='focus'?3000:600;updateTimer();}
  function listeners(){
    document.addEventListener('click',e=>{
      const tab=e.target.closest('[data-tab]');if(tab){chooseTab(tab.dataset.tab);return;}
      const close=e.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
      const report=e.target.closest('[data-report-task]');if(report){openSession(report.dataset.reportTask);return;}
      const remove=e.target.closest('[data-remove-task]');if(remove){const task=state.tasks.find(t=>t.id===remove.dataset.removeTask);if(task&&task.status!=='done'&&confirm(`「${task.title}」を予定から削除しますか？`)){const next=Core.normalizeState(state);next.tasks=next.tasks.filter(t=>t.id!==task.id);commit(next,'未完了タスクを削除しました。');}return;}
      const edit=e.target.closest('[data-edit-material]');if(edit){openMaterial(edit.dataset.editMaterial);return;}
    });
    $('add-task-btn').addEventListener('click',openTask);
    $('add-material-btn').addEventListener('click',()=>openMaterial());
    $('record-session-btn').addEventListener('click',()=>openSession());
    $('analysis-record-btn').addEventListener('click',()=>openSession());
    [$('make-plan-btn'),$('ai-plan-btn'),$('empty-plan-btn')].forEach(b=>b.addEventListener('click',generatePlan));
    $('close-plan-btn').addEventListener('click',()=>{$('plan-panel').hidden=true;proposedPlan=null;});
    $('plan-actions').addEventListener('input',e=>{if(!proposedPlan)return;const title=e.target.dataset.planTitle;const mins=e.target.dataset.planMinutes;if(title!==undefined)proposedPlan.actions[Number(title)].title=e.target.value;if(mins!==undefined)proposedPlan.actions[Number(mins)].minutes=Number(e.target.value)||0;updatePlanTotal();});
    $('adopt-plan-btn').addEventListener('click',()=>{
      if(!proposedPlan)return;
      const total=proposedPlan.actions.reduce((sum,a)=>sum+a.minutes,0);
      const spent=state.logs.filter(l=>l.date===today).reduce((sum,l)=>sum+l.minutes,0);
      if(!proposedPlan.actions.length)return toast('採用できる追加タスクはありません。',true);
      if(total+spent>state.settings.dailyMinutes)return toast('提案の合計時間が設定した1日の配分を超えています。',true);
      if(proposedPlan.actions.some(a=>a.minutes<5||a.minutes>360||!a.title.trim()))return toast('タスク名と時間を確認してください。',true);
      const pending=state.tasks.filter(t=>t.date===today&&t.status==='pending').length;
      if(pending&&!confirm(`今日の未完了タスク ${pending} 件をこの計画で置き換えますか？\n完了済みタスクと学習記録は残ります。`))return;
      try{if(commit(Core.adoptPlan(state,today,proposedPlan.actions),'計画を採用しました。次の1つに集中しよう。')){$('plan-panel').hidden=true;proposedPlan=null;}}catch(err){toast(err.message,true);}
    });
    $('task-form').addEventListener('submit',e=>{e.preventDefault();try{const next=Core.addTask(state,{subject:$('task-subject').value,title:$('task-title').value,date:$('task-date').value,minutes:Number($('task-minutes').value)});if(commit(next,'タスクを追加しました。'))closeModal($('task-dialog'));}catch(err){toast(err.message,true);}});
    $('material-form').addEventListener('submit',e=>{
      e.preventDefault();const doneRaw=$('material-done').value,totalRaw=$('material-total').value;
      if((doneRaw==='')!==(totalRaw===''))return toast('進捗を入れる場合は、完了数と全体数の両方を入力してください。',true);
      if(doneRaw!==''&&Number(doneRaw)>Number(totalRaw))return toast('完了数は全体数以下にしてください。',true);
      const item={id:$('material-id').value||Core.uid(),subject:$('material-subject').value,title:$('material-title').value.trim(),status:$('material-status').value,doneUnits:doneRaw===''?null:Number(doneRaw),totalUnits:totalRaw===''?null:Number(totalRaw),nextStep:$('material-next').value.trim(),note:$('material-note').value.trim()};
      if(!item.title)return toast('教材名を入力してください。',true);
      const next=Core.normalizeState(state);const i=next.materials.findIndex(m=>m.id===item.id);if(i<0)next.materials.push(item);else next.materials[i]=item;
      if(commit(next,'教材の状態を保存しました。'))closeModal($('material-dialog'));
    });
    $('delete-material-btn').addEventListener('click',()=>{const id=$('material-id').value;const m=state.materials.find(m=>m.id===id);if(!m||!confirm(`教材「${m.title}」を削除しますか？\nこの教材に紐づく予定は残ります。`))return;const next=Core.normalizeState(state);next.materials=next.materials.filter(x=>x.id!==id);next.tasks.forEach(t=>{if(t.materialId===id)t.materialId=null;});if(commit(next,'教材を削除しました。'))closeModal($('material-dialog'));});
    $('session-form').addEventListener('submit',e=>{e.preventDefault();try{
      const next=Core.recordSession(state,{taskId:$('session-task-id').value||null,subject:$('session-subject').value,title:$('session-title').value,date:$('session-date').value,minutes:Number($('session-minutes').value),note:$('session-note').value,markDone:$('session-done').checked});if(commit(next,'学習結果を記録しました。'))closeModal($('session-dialog'));
    }catch(err){toast(err.message,true);}});
    $('subject-filter').addEventListener('change',renderMaterials);
    $('settings-form').addEventListener('submit',e=>{e.preventDefault();const next=Core.normalizeState(state);next.settings={name:$('setting-name').value.trim(),goal:$('setting-goal').value.trim(),examDate:$('setting-date').value,dailyMinutes:Number($('setting-minutes').value),memo:$('setting-memo').value.trim()};if(next.settings.dailyMinutes<30||next.settings.dailyMinutes>720)return toast('1日の時間は30～720分で設定してください。',true);commit(next,'設定を保存しました。');});
    $('export-btn').addEventListener('click',()=>{const json=JSON.stringify(state,null,2),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`my-study-os-${today}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('バックアップファイルを作成しました。');});
    $('import-btn').addEventListener('click',()=>$('import-file').click());
    $('import-file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>3e6)return toast('ファイルが大きすぎます。',true);try{const imported=Core.normalizeState(JSON.parse(await file.text()));if(confirm('この端末にある現在の記録を、読み込んだバックアップで置き換えますか？')){commit(imported,'バックアップを読み込みました。');}}catch(err){toast(`読込失敗：${err.message}`,true);}});
    $('reset-btn').addEventListener('click',()=>{if(confirm('この端末にあるすべての学習記録を初期化します。バックアップ済みですか？')&&confirm('本当に初期化しますか？'))commit(Core.defaultState(),'初期化しました。');});
    $('timer-start').addEventListener('click',timerAction);$('timer-reset').addEventListener('click',()=>resetTimer());document.querySelectorAll('[data-timer]').forEach(b=>b.addEventListener('click',()=>resetTimer(b.dataset.timer)));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)return;const current=Core.todayTokyo();if(current!==today){today=current;proposedPlan=null;$('plan-panel').hidden=true;render();toast('日付が変わりました。今日の予定を確認してください。');}if(timerTicker)timerTick();});
  }
  fillSubjects();listeners();initialStorage();render();updateTimer();health();
})();

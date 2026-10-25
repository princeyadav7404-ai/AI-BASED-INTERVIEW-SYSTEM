/* ============================================================
   AI Interview Prep — Application Logic
   When the site is opened through the backend (npm start) and an
   API key is configured, answers, questions, follow-ups, model
   answers, resume questions and the chat coach use real AI
   (Claude Haiku 5.5) through the /api endpoints in server.mjs.
   Without the backend (e.g. Live Server / file://) every feature
   falls back to the built-in demo engine below.
   ============================================================ */

(function(){
"use strict";

/* ---------------------------------------------------------
   Utilities
--------------------------------------------------------- */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
const clamp = (v,min,max) => Math.max(min, Math.min(max, v));
const rand  = (min,max) => Math.random()*(max-min)+min;
const pick  = (arr,n) => { const c=[...arr]; const out=[]; while(c.length && out.length<n){ out.push(c.splice(Math.floor(Math.random()*c.length),1)[0]); } return out; };
const todayStr = () => new Date().toISOString().slice(0,10);

function toast(msg, type="info"){
  const wrap = $("#toast-wrap");
  const el = document.createElement("div");
  el.className = `toast glass ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateX(20px)"; setTimeout(()=>el.remove(),250); }, 3200);
}

// Escape text before putting it into innerHTML (AI and user text are never trusted as HTML)
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------------------------------------------------------
   AI connection (backend in server.mjs)
--------------------------------------------------------- */
const AI = { online:false };

async function aiPost(path, body, timeoutMs=90000){
  const ctrl = new AbortController();
  const timer = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(path, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body), signal:ctrl.signal });
    let data = {};
    try{ data = await res.json(); }catch(e){}
    if(!res.ok) throw new Error(data.error || `AI request failed (${res.status}).`);
    return data;
  }catch(e){
    if(e.name==="AbortError") throw new Error("The AI took too long to respond.");
    if(e instanceof TypeError) throw new Error("Could not reach the AI server.");
    throw e;
  }finally{ clearTimeout(timer); }
}

function setAIBadge(online, title){
  const badge = $("#ai-badge");
  badge.classList.toggle("on", online);
  badge.classList.toggle("off", !online);
  $("#ai-badge-text").textContent = online ? "AI Live" : "Demo Mode";
  badge.title = title;
}

async function checkAI(){
  AI.online = false;
  const startHint = "Demo mode — start the site with 'npm start' to use live AI.";
  if(location.protocol === "file:"){
    setAIBadge(false, startHint);
  } else {
    try{
      const res = await fetch("/api/health", { cache:"no-store" });
      const data = res.ok ? await res.json() : {};
      AI.online = !!data.ai;
      setAIBadge(AI.online, AI.online ? "Live AI feedback is on." : (data.ok ? "Demo mode — add ANTHROPIC_API_KEY to the .env file and restart the server." : startHint));
    }catch(e){
      setAIBadge(false, startHint);
    }
  }
  $("#btn-model-answer").classList.toggle("hidden", !AI.online);
}

/* ---------------------------------------------------------
   Persistent Stats (localStorage)
--------------------------------------------------------- */
const STATS_KEY = "aiip_stats_v1";
function getStats(){
  try{
    const raw = localStorage.getItem(STATS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {
    interviews:0, questionsAnswered:0, scoreSum:0, scoreCount:0, practiceMinutes:0,
    history:[], bookmarks:[], badges:{}, weeklyGoal:{target:5,completed:0}, practiceDays:[]
  };
}
function saveStats(s){ try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch(e){} }
let STATS = getStats();

/* ---------------------------------------------------------
   View Router
--------------------------------------------------------- */
function showView(id, opts={}){
  $$(".view").forEach(v => v.classList.remove("active"));
  const target = $("#view-"+id);
  if(!target){ return; }
  target.classList.add("active");
  $$(".nav-links button[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view===id));
  window.scrollTo({top:0, behavior:"instant" in window ? "instant":"auto"});
  $("#nav-links").classList.remove("mobile-open");

  if(id==="questionbank") renderQuestionBank();
  if(id==="dashboard") renderDashboard();
  if(id==="resources") {} // static, rendered once on load
  if(id==="mock-setup") updateSetupSummary();

  if(opts.anchor){
    setTimeout(()=>{ const a = document.getElementById(opts.anchor); if(a) a.scrollIntoView({behavior:"smooth"}); }, 60);
  }
}

document.addEventListener("click", (e)=>{
  const viewBtn = e.target.closest("[data-view]");
  if(viewBtn){
    showView(viewBtn.dataset.view);
    return;
  }
  const anchorBtn = e.target.closest("[data-anchor]");
  if(anchorBtn){
    showView("home", {anchor:anchorBtn.dataset.anchor});
    return;
  }
  const chatOpenBtn = e.target.closest("[data-open-chat]");
  if(chatOpenBtn){ openChat(); }
});

$("#nav-toggle").addEventListener("click", ()=> $("#nav-links").classList.toggle("mobile-open"));

/* ---------------------------------------------------------
   Home: animated counters
--------------------------------------------------------- */
function animateCounters(){
  $$(".stat-num[data-count]").forEach(el=>{
    const target = parseInt(el.dataset.count,10);
    const suffix = el.dataset.suffix || "";
    let cur = 0;
    const step = Math.max(1, Math.round(target/60));
    const tick = ()=>{
      cur = Math.min(target, cur+step);
      el.textContent = cur.toLocaleString() + suffix;
      if(cur<target) requestAnimationFrame(tick);
    };
    tick();
  });
}
window.addEventListener("load", animateCounters);

/* ---------------------------------------------------------
   Mock Interview Setup
--------------------------------------------------------- */
const setupState = { type:null, difficulty:null, experience:null, role:null };

function initSetupForm(){
  const roleSelect = $("#setup-role");
  roleSelect.innerHTML = `<option value="">Select a job role…</option>` +
    JOB_ROLES.map(r=>`<option value="${r}">${r}</option>`).join("");
  roleSelect.addEventListener("change", ()=>{ setupState.role = roleSelect.value || null; updateSetupSummary(); });

  $$("#view-mock-setup .option-grid").forEach(group=>{
    group.addEventListener("click",(e)=>{
      const pill = e.target.closest(".option-pill");
      if(!pill) return;
      $$(".option-pill", group).forEach(p=>p.classList.remove("selected"));
      pill.classList.add("selected");
      setupState[group.dataset.group] = pill.dataset.value;
      updateSetupSummary();
    });
  });
}

function updateSetupSummary(){
  const box = $("#setup-summary");
  const {type,difficulty,experience,role} = setupState;
  const ready = type && difficulty && experience && role;
  $("#btn-start-interview").disabled = !ready;
  if(!ready){
    box.innerHTML = "Select an interview type, difficulty, experience level and role to begin.";
    return;
  }
  box.innerHTML = `You're about to start a <b>${difficulty}</b> <b>${type}</b> interview for a <b>${role}</b> role (<b>${experience}</b> experience). The AI will ask you <b>5 questions</b> with a 90-second timer each.`;
}

$("#btn-start-interview").addEventListener("click", ()=>{
  const btn = $("#btn-start-interview");
  if(btn.disabled || btn.classList.contains("is-loading")) return;
  startMockInterview();
});

/* ---------------------------------------------------------
   Interview Session Engine
--------------------------------------------------------- */
const session = {
  id:0, questions: [], followFlags: [], index:0, total:0, scoresList: [], tentative:null, feedback:null, lastAnswer:"",
  followUpsUsed:0, ctx:{}, timerId:null, timeLeft:0, startedAt:0, mode:"mock", label:""
};
const MAX_FOLLOWUPS = 2;

async function startMockInterview(){
  const company = $("#setup-company").value.trim();
  const ctx = { type:setupState.type, difficulty:setupState.difficulty, experience:setupState.experience, role:setupState.role, company };
  const meta = { mode:"mock", label:`${setupState.type} · ${setupState.difficulty}${company ? " · "+company : ""}`, side:{type:setupState.type, diff:setupState.difficulty}, ctx };

  if(AI.online){
    const btn = $("#btn-start-interview");
    btn.classList.add("is-loading");
    btn.textContent = "AI is preparing your questions…";
    try{
      const data = await aiPost("/api/questions", { ...ctx, count:5 });
      const qs = (data.questions || []).map(q => q.text).filter(Boolean);
      if(qs.length){ beginSession(qs, meta); return; }
    }catch(e){
      toast(e.message + " Using built-in questions instead.", "info");
    }finally{
      btn.classList.remove("is-loading");
      btn.textContent = "Start AI Interview";
    }
  }
  const pool = INTERVIEW_QUESTION_SETS[setupState.type] || INTERVIEW_QUESTION_SETS.HR;
  beginSession(pick(pool, Math.min(5, pool.length)), meta);
}

function startQuickPractice(questionText, categoryLabel){
  beginSession([questionText], {mode:"quick", label:categoryLabel||"Quick Practice", side:{type:categoryLabel||"Practice", diff:"—"}, ctx:{type:categoryLabel||"General"}});
}

function beginSession(questions, meta){
  session.id++;
  session.questions = questions;
  session.followFlags = questions.map(()=>false);
  session.index = 0;
  session.total = questions.length;
  session.scoresList = [];
  session.tentative = null;
  session.feedback = null;
  session.followUpsUsed = 0;
  session.ctx = meta.ctx || {};
  session.aiUsed = false;
  session.mode = meta.mode;
  session.label = meta.label;
  session.startedAt = Date.now();
  $("#side-type").textContent = meta.side.type;
  $("#side-diff").textContent = meta.side.diff;
  $("#q-total").textContent = session.total;
  showView("interview");
  renderQuestionStage();
}

function renderQuestionStage(){
  clearTimer();
  $("#stage-question").classList.remove("hidden");
  $("#stage-analyzing").classList.add("hidden");
  $("#stage-analysis").classList.add("hidden");
  $("#stage-feedback").classList.add("hidden");

  $("#current-question").textContent = session.questions[session.index];
  $("#answer-input").value = "";
  $("#q-current").textContent = session.index+1;
  const pct = Math.round(((session.index+1)/session.total)*100);
  $("#q-progress-fill").style.width = pct+"%";
  $("#q-percent").textContent = pct+"%";
  stopRecordingUI();
  startTimer(90);
}

function startTimer(seconds){
  session.timeLeft = seconds;
  updateTimerDisplay();
  session.timerId = setInterval(()=>{
    session.timeLeft--;
    updateTimerDisplay();
    if(session.timeLeft<=0){
      clearTimer();
      toast("Time's up! Auto-submitting your answer.", "info");
      submitAnswer(true);
    }
  }, 1000);
}
function clearTimer(){ if(session.timerId){ clearInterval(session.timerId); session.timerId=null; } }
function updateTimerDisplay(){
  const m = String(Math.max(0,Math.floor(session.timeLeft/60))).padStart(2,"0");
  const s = String(Math.max(0,session.timeLeft%60)).padStart(2,"0");
  const el = $("#timer-display");
  el.textContent = `${m}:${s}`;
  el.style.color = session.timeLeft<=10 ? "var(--red)" : "var(--cyan)";
}

/* ----- Mic / speech simulation ----- */
let recognizing = false;
let recognition = null;
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

$("#btn-mic").addEventListener("click", ()=>{
  if(recognizing){ stopRecordingUI(); if(recognition) recognition.stop(); return; }
  startRecordingUI();
  if(SpeechRecognitionAPI){
    try{
      recognition = new SpeechRecognitionAPI();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = true;
      recognition.onresult = (ev)=>{
        let text = "";
        for(let i=ev.resultIndex;i<ev.results.length;i++){ text += ev.results[i][0].transcript; }
        const ta = $("#answer-input");
        ta.value = (ta.value ? ta.value+" " : "") + text.trim();
      };
      recognition.onerror = ()=> stopRecordingUI();
      recognition.onend = ()=> stopRecordingUI();
      recognition.start();
    }catch(e){ simulateDictation(); }
  } else {
    simulateDictation();
  }
});
function startRecordingUI(){
  recognizing = true;
  $("#btn-mic").classList.add("recording");
  $("#btn-mic").textContent = "⏹️";
  $("#rec-indicator").classList.remove("hidden");
}
function stopRecordingUI(){
  recognizing = false;
  $("#btn-mic").classList.remove("recording");
  $("#btn-mic").textContent = "🎙️";
  $("#rec-indicator").classList.add("hidden");
}
function simulateDictation(){
  const demoLines = [
    "I have a strong foundation in problem solving and enjoy working in collaborative teams.",
    "In my last project I took ownership of a key module and delivered it ahead of schedule.",
    "I believe my communication skills and technical background make me a strong fit for this role.",
  ];
  setTimeout(()=>{
    if(!recognizing) return;
    const ta = $("#answer-input");
    ta.value = (ta.value ? ta.value+" " : "") + demoLines[Math.floor(Math.random()*demoLines.length)];
    stopRecordingUI();
  }, 2200);
}

/* ----- Submit / Skip ----- */
$("#btn-submit-answer").addEventListener("click", ()=> submitAnswer(false));
$("#btn-skip").addEventListener("click", ()=> submitAnswer(true, true));

function submitAnswer(timedOutOrEmpty, isSkip=false){
  clearTimer();
  const answer = $("#answer-input").value.trim();
  if(!answer && !timedOutOrEmpty){ toast("Please type or record an answer first.", "info"); startTimer(session.timeLeft||1); return; }

  $("#stage-question").classList.add("hidden");
  $("#stage-analyzing").classList.remove("hidden");

  const evalAnswer = isSkip ? "" : answer;
  const question = session.questions[session.index];
  const sid = session.id, idx = session.index, started = Date.now();
  (async ()=>{
    let result = null;
    if(AI.online){
      try{
        result = await aiPost("/api/evaluate", { question, answer:evalAnswer, ...session.ctx });
        result.ai = true;
      }catch(e){
        toast(e.message + " Showing demo scoring instead.", "info");
      }
    }
    if(!result){
      await new Promise(r => setTimeout(r, Math.max(0, 1100 - (Date.now()-started))));
      result = { scores: computeScores(evalAnswer, session.ctx.type), ai:false };
    }
    if(sid !== session.id || idx !== session.index) return; // user left this question meanwhile
    session.tentative = result.scores;
    session.feedback = result;
    session.lastAnswer = evalAnswer;
    renderAnalysis(result.scores);
    $("#stage-analyzing").classList.add("hidden");
    $("#stage-analysis").classList.remove("hidden");
  })();
}

/* ----- Scoring ----- */
function computeScores(answerText, qType){
  const words = answerText.split(/\s+/).filter(Boolean);
  const wc = words.length;
  if(wc===0){
    return {communication:38,relevance:35,confidence:32,technical:34,grammar:40,overall:36};
  }
  const base = clamp(52 + wc*1.4, 45, 94);
  const communication = Math.round(clamp(base + rand(-8,8), 40, 98));
  const relevance      = Math.round(clamp(base + rand(-6,10), 40, 98));
  const confidence      = Math.round(clamp(base + rand(-12,6), 35, 96));
  const technical       = Math.round(clamp((qType==="Technical" ? base+rand(-4,10) : base-8+rand(-8,10)), 30, 97));
  const grammar          = Math.round(clamp(base + rand(-6,10), 45, 98));
  const overall = Math.round((communication+relevance+confidence+technical+grammar)/5);
  return {communication,relevance,confidence,technical,grammar,overall};
}

const RING_METRICS = [
  {key:"communication", label:"Communication", color:"#3b82f6"},
  {key:"relevance",     label:"Relevance",      color:"#22d3ee"},
  {key:"confidence",    label:"Confidence",     color:"#8b5cf6"},
  {key:"technical",     label:"Technical Knowledge", color:"#34d399"},
  {key:"grammar",       label:"Grammar",        color:"#fbbf24"},
];

function ringSVG(percent, color){
  const r = 40, c = 2*Math.PI*r;
  const offset = c*(1-percent/100);
  return `<div class="ring-wrap">
    <svg viewBox="0 0 100 100" width="96" height="96">
      <circle class="ring-bg" cx="50" cy="50" r="${r}"></circle>
      <circle class="ring-fg" cx="50" cy="50" r="${r}" stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-target="${offset}"></circle>
    </svg>
    <div class="ring-value">${percent}%</div>
  </div>`;
}

function renderAnalysis(scores){
  $("#overall-score").textContent = `${scores.overall}/100`;
  const grid = $("#score-ring-grid");
  grid.innerHTML = RING_METRICS.map(m=>`
    <div class="ring-card">
      ${ringSVG(scores[m.key], m.color)}
      <div class="ring-label">${m.label}</div>
    </div>`).join("");
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      $$(".ring-fg", grid).forEach(c=> c.style.strokeDashoffset = c.dataset.target);
    }, 50);
  });
}

$("#btn-see-feedback").addEventListener("click", ()=>{
  $("#stage-analysis").classList.add("hidden");
  $("#stage-feedback").classList.remove("hidden");
  renderFeedback();
});

const GOOD_POOL = ["Clear introduction","Good explanation of key points","Relevant examples used","Confident tone throughout","Well-structured response","Good use of specific details","Maintained a logical flow","Answered directly and concisely"];
const IMPROVE_POOL = ["Reduce unnecessary pauses","Give more specific examples","Improve answer structure","Avoid filler words like ‘um’ and ‘like’","Try to be more concise","Elaborate more on the outcome or result","Speak a little slower for clarity","Add a stronger closing statement"];
const SUGGESTIONS = [
  "Try structuring your answer using the STAR method (Situation, Task, Action, Result) for more clarity.",
  "Consider quantifying your achievements with numbers or metrics to strengthen your answer.",
  "Practice condensing your answer to under two minutes while keeping the key details.",
  "Focus on connecting your answer back to the specific role you're applying for.",
  "Slow down slightly and pause briefly between key points to sound more confident.",
];

function renderFeedback(){
  const fb = session.feedback || {};
  const good = fb.ai && fb.good && fb.good.length ? fb.good : pick(GOOD_POOL,3);
  const improve = fb.ai && fb.improve && fb.improve.length ? fb.improve : pick(IMPROVE_POOL,3);
  $("#feedback-good").innerHTML = good.map(t=>`<li>${esc(t)}</li>`).join("");
  $("#feedback-improve").innerHTML = improve.map(t=>`<li>${esc(t)}</li>`).join("");
  $("#feedback-suggestion").textContent = (fb.ai && fb.suggestion) || pick(SUGGESTIONS,1)[0];

  // AI follow-up question (mock interviews only, max 2 per interview, no follow-up on a follow-up)
  const canFollow = !!(fb.ai && fb.followUp && session.mode==="mock" && session.followUpsUsed < MAX_FOLLOWUPS && !session.followFlags[session.index]);
  $("#followup-box").classList.toggle("hidden", !canFollow);
  if(canFollow) $("#followup-text").textContent = fb.followUp;

  // Model answer resets for every new feedback screen
  const box = $("#model-answer-box");
  box.classList.add("hidden");
  box.innerHTML = "";
  $("#btn-model-answer").classList.toggle("hidden", !AI.online);

  const isLast = session.index === session.total-1;
  $("#btn-next-question").textContent = isLast ? "View Result →" : "Next Question →";
}

$("#btn-followup").addEventListener("click", ()=>{
  const q = session.feedback && session.feedback.followUp;
  if(!q || session.followUpsUsed >= MAX_FOLLOWUPS) return;
  session.questions.splice(session.index+1, 0, q);
  session.followFlags.splice(session.index+1, 0, true);
  session.total = session.questions.length;
  session.followUpsUsed++;
  $("#q-total").textContent = session.total;
  $("#followup-box").classList.add("hidden");
  $("#btn-next-question").textContent = "Next Question →";
  toast("Follow-up added as your next question.", "success");
});

$("#btn-model-answer").addEventListener("click", async ()=>{
  const btn = $("#btn-model-answer");
  if(btn.classList.contains("is-loading")) return;
  if(!AI.online){ toast("Model answers need the live AI. Start the site with 'npm start'.", "info"); return; }
  const sid = session.id, idx = session.index;
  btn.classList.add("is-loading");
  try{
    const data = await aiPost("/api/model-answer", { question:session.questions[idx], answer:session.lastAnswer, role:session.ctx.role, type:session.ctx.type });
    if(sid !== session.id || idx !== session.index) return;
    const box = $("#model-answer-box");
    box.innerHTML = `<strong>✨ A Stronger Answer</strong><p style="margin:8px 0 0;">${esc(data.answer)}</p>` +
      (data.changes && data.changes.length ? `<div class="small text-muted" style="margin-top:12px;font-weight:600;">What was improved</div><ul>${data.changes.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>` : "");
    box.classList.remove("hidden");
  }catch(e){
    toast(e.message, "info");
  }finally{
    btn.classList.remove("is-loading");
  }
});

$("#btn-retry-question").addEventListener("click", ()=>{
  session.tentative = null;
  renderQuestionStage();
});

$("#btn-next-question").addEventListener("click", ()=>{
  if(session.feedback && session.feedback.ai) session.aiUsed = true;
  session.scoresList.push(session.tentative);
  session.tentative = null;
  if(session.index === session.total-1){
    finishInterview();
  } else {
    session.index++;
    renderQuestionStage();
  }
});

/* ---------------------------------------------------------
   Finish Interview -> Save Stats -> Result Page
--------------------------------------------------------- */
function finishInterview(){
  const list = session.scoresList;
  const avgOf = key => Math.round(list.reduce((a,s)=>a+s[key],0)/list.length);
  const agg = {
    communication: avgOf("communication"), relevance: avgOf("relevance"),
    confidence: avgOf("confidence"), technical: avgOf("technical"), grammar: avgOf("grammar"),
  };
  agg.overall = Math.round((agg.communication+agg.relevance+agg.confidence+agg.technical+agg.grammar)/5);

  if(session.mode==="mock"){
    STATS.interviews += 1;
    STATS.weeklyGoal.completed = Math.min(STATS.weeklyGoal.target, STATS.weeklyGoal.completed+1);
  }
  STATS.questionsAnswered += list.length;
  list.forEach(s=>{ STATS.scoreSum += s.overall; STATS.scoreCount += 1; });
  const minutes = Math.max(1, Math.round((Date.now()-session.startedAt)/60000));
  STATS.practiceMinutes += minutes;
  if(!STATS.practiceDays.includes(todayStr())) STATS.practiceDays.push(todayStr());
  STATS.history.push({ date: todayStr(), ...agg });
  if(STATS.history.length>12) STATS.history = STATS.history.slice(-12);

  evaluateBadges(agg);
  saveStats(STATS);

  renderResultPage(agg);
  showView("result");
}

function evaluateBadges(agg){
  if(STATS.interviews>=1) STATS.badges.first = true;
  if(STATS.questionsAnswered>=10) STATS.badges.ten_q = true;
  if(STATS.practiceDays.length>=7) STATS.badges.streak = true;
  if(setupState.type==="Technical" && agg.technical>=85){
    STATS._techHighCount = (STATS._techHighCount||0)+1;
    if(STATS._techHighCount>=3) STATS.badges.technical = true;
  }
  const readiness = computeReadiness();
  if(readiness>=90) STATS.badges.ready = true;
}

function computeReadiness(){
  if(STATS.interviews===0) return 72;
  const avg = STATS.scoreCount ? STATS.scoreSum/STATS.scoreCount : 0;
  const badgeCount = Object.keys(STATS.badges).length;
  const val = avg*0.6 + Math.min(STATS.interviews/10,1)*100*0.25 + Math.min(badgeCount/5,1)*100*0.15;
  return Math.round(clamp(val,0,100));
}

function renderResultPage(agg){
  $("#result-overall").textContent = `${agg.overall}/100`;
  const rows = [
    ["Communication", agg.communication],
    ["Confidence", agg.confidence],
    ["Relevance", agg.relevance],
    ["Technical Knowledge", agg.technical],
    ["Grammar", agg.grammar],
  ];
  $("#result-table-body").innerHTML = rows.map(([label,score])=>`
    <tr><td>${label}</td><td>${score}%
      <span class="result-bar-track"><span class="result-bar-fill" style="width:${score}%"></span></span>
    </td></tr>`).join("");

  const lowest = rows.reduce((a,b)=> b[1]<a[1] ? b : a);
  $("#result-summary").textContent = `You scored ${agg.overall}/100 overall in this ${session.label} session. Your strongest area was ${rows.reduce((a,b)=>b[1]>a[1]?b:a)[0].toLowerCase()}, while ${lowest[0].toLowerCase()} could use more focused practice. Keep practicing consistently to build interview readiness.`;

  window._lastResult = { agg, rows, label: session.label, date: new Date().toLocaleString(), ai: !!session.aiUsed };
}

$("#btn-download-report").addEventListener("click", ()=>{
  const r = window._lastResult;
  if(!r){ toast("Complete an interview first.", "info"); return; }
  const lines = [
    "AI-BASED INTERVIEW PREPARATION SYSTEM",
    "Interview Report",
    "================================",
    `Session: ${r.label}`,
    `Date: ${r.date}`,
    "",
    `Overall Score: ${r.agg.overall}/100`,
    "",
    "Skill Breakdown:",
    ...r.rows.map(([k,v])=>` - ${k}: ${v}%`),
    "",
    "AI Performance Summary:",
    $("#result-summary").textContent,
    "",
    "Recommended Next Steps:",
    " - Practice technical questions",
    " - Improve answer structure using the STAR method",
    " - Practice speaking clearly and at a steady pace",
    " - Complete another mock interview this week",
    "",
    r.ai ? "Generated by AI Interview Prep (AI-evaluated report)" : "Generated by AI Interview Prep (demo report)",
  ];
  const blob = new Blob([lines.join("\n")], {type:"text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "interview-report.txt";
  a.click();
  toast("Report downloaded.", "success");
});

/* ---------------------------------------------------------
   Question Bank
--------------------------------------------------------- */
const qbState = { search:"", category:"All", difficulty:"All" };
const QB_CATEGORIES = ["All","HR","Technical","Behavioral","Situational","Communication","Aptitude"];
const QB_DIFFICULTIES = ["All","Beginner","Intermediate","Advanced"];

function initQuestionBankChips(){
  $("#qb-category-chips").innerHTML = QB_CATEGORIES.map(c=>`<button class="chip ${c===qbState.category?"active":""}" data-cat="${c}">${c}</button>`).join("");
  $("#qb-difficulty-chips").innerHTML = QB_DIFFICULTIES.map(d=>`<button class="chip ${d===qbState.difficulty?"active":""}" data-diff="${d}">${d}</button>`).join("");

  $("#qb-category-chips").addEventListener("click",(e)=>{
    const b = e.target.closest(".chip"); if(!b) return;
    qbState.category = b.dataset.cat;
    $$(".chip",$("#qb-category-chips")).forEach(c=>c.classList.toggle("active", c===b));
    renderQuestionBank();
  });
  $("#qb-difficulty-chips").addEventListener("click",(e)=>{
    const b = e.target.closest(".chip"); if(!b) return;
    qbState.difficulty = b.dataset.diff;
    $$(".chip",$("#qb-difficulty-chips")).forEach(c=>c.classList.toggle("active", c===b));
    renderQuestionBank();
  });
  $("#qb-search").addEventListener("input", (e)=>{ qbState.search = e.target.value.toLowerCase(); renderQuestionBank(); });
}

function renderQuestionBank(){
  const list = QUESTION_BANK.filter(q=>{
    if(qbState.category!=="All" && q.category!==qbState.category) return false;
    if(qbState.difficulty!=="All" && q.difficulty!==qbState.difficulty) return false;
    if(qbState.search && !q.text.toLowerCase().includes(qbState.search)) return false;
    return true;
  });
  const grid = $("#qb-grid");
  if(list.length===0){
    grid.innerHTML = `<div class="empty-state">No questions match your filters. Try a different search or category.</div>`;
    return;
  }
  grid.innerHTML = list.map(q=>{
    const bookmarked = STATS.bookmarks.includes(q.id);
    return `<div class="qb-card glass">
      <div class="tags"><span class="tag">${q.category}</span><span class="tag diff-${q.difficulty}">${q.difficulty}</span></div>
      <p>${q.text}</p>
      <div class="qb-card-actions">
        <button class="btn btn-outline btn-sm" data-practice="${q.id}">Practice</button>
        <button class="bookmark-btn ${bookmarked?"active":""}" data-bookmark="${q.id}">${bookmarked?"★":"☆"}</button>
      </div>
    </div>`;
  }).join("");
}

$("#qb-grid").addEventListener("click",(e)=>{
  const pBtn = e.target.closest("[data-practice]");
  if(pBtn){
    const q = QUESTION_BANK.find(x=>x.id===+pBtn.dataset.practice);
    if(q) startQuickPractice(q.text, q.category);
    return;
  }
  const bBtn = e.target.closest("[data-bookmark]");
  if(bBtn){
    const id = +bBtn.dataset.bookmark;
    const idx = STATS.bookmarks.indexOf(id);
    if(idx>-1) STATS.bookmarks.splice(idx,1); else STATS.bookmarks.push(id);
    saveStats(STATS);
    renderQuestionBank();
  }
});

/* ---------------------------------------------------------
   Dashboard
--------------------------------------------------------- */
const DEMO_HISTORY = [
  {date:"Demo-1", communication:62, relevance:65, confidence:58, technical:60, grammar:66, overall:62},
  {date:"Demo-2", communication:68, relevance:70, confidence:63, technical:64, grammar:70, overall:67},
  {date:"Demo-3", communication:74, relevance:75, confidence:69, technical:70, grammar:75, overall:72},
  {date:"Demo-4", communication:79, relevance:80, confidence:74, technical:76, grammar:80, overall:78},
  {date:"Demo-5", communication:85, relevance:88, confidence:80, technical:82, grammar:86, overall:84},
];

function renderDashboard(){
  const avg = STATS.scoreCount ? Math.round(STATS.scoreSum/STATS.scoreCount) : 0;
  $("#dash-interviews").textContent = STATS.interviews;
  $("#dash-questions").textContent = STATS.questionsAnswered;
  $("#dash-avg").textContent = avg;
  $("#dash-time").textContent = STATS.practiceMinutes+"m";
  const history = STATS.history.length ? STATS.history : DEMO_HISTORY;
  const improve = history.length>=2 ? Math.max(0, history[history.length-1].overall - history[0].overall) : 0;
  $("#dash-improve").textContent = improve+"%";

  drawPerfChart(history);

  const readiness = computeReadiness();
  $("#readiness-value").textContent = readiness+"%";
  const r=52, c=2*Math.PI*r;
  const fg = $("#readiness-ring-fg");
  fg.setAttribute("stroke-dasharray", c);
  fg.style.strokeDashoffset = c;
  requestAnimationFrame(()=> setTimeout(()=>{ fg.style.transition="stroke-dashoffset 1s ease"; fg.style.strokeDashoffset = c*(1-readiness/100); },50));

  $("#wg-target").textContent = `${STATS.weeklyGoal.target} Interviews`;
  $("#wg-progress").textContent = `${STATS.weeklyGoal.completed} / ${STATS.weeklyGoal.target}`;
  $("#wg-fill").style.width = Math.round((STATS.weeklyGoal.completed/STATS.weeklyGoal.target)*100)+"%";

  const lowestKey = ["communication","relevance","confidence","technical","grammar"].reduce((a,b)=>{
    const last = history[history.length-1];
    return last[b] < last[a] ? b : a;
  }, "communication");
  const labelMap = {communication:"communication",relevance:"answer relevance",confidence:"confidence",technical:"technical knowledge",grammar:"grammar"};
  $("#recommend-box").textContent = STATS.interviews===0
    ? "Complete your first mock interview to unlock personalized recommendations."
    : `Your ${labelMap[lowestKey]} score has room to grow. Practice more ${lowestKey==="technical"?"technical":"behavioral"} questions to improve further.`;

  renderBadges();
}

function drawPerfChart(history){
  const svg = $("#perf-chart");
  const W=560,H=220,pad=30;
  const metrics = RING_METRICS.map(m=>m.key);
  const colors = RING_METRICS.map(m=>m.color);
  const n = history.length;
  const xFor = i => pad + (i*(W-2*pad))/Math.max(1,n-1);
  const yFor = v => H-pad - (v/100)*(H-2*pad);

  let svgHtml = `<line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="rgba(255,255,255,.15)"/>`;
  [0,25,50,75,100].forEach(g=>{
    svgHtml += `<line x1="${pad}" y1="${yFor(g)}" x2="${W-pad}" y2="${yFor(g)}" stroke="rgba(255,255,255,.06)"/>`;
  });

  metrics.forEach((key,mi)=>{
    const points = history.map((h,i)=>`${xFor(i)},${yFor(h[key])}`).join(" ");
    svgHtml += `<polyline points="${points}" fill="none" stroke="${colors[mi]}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
    history.forEach((h,i)=>{ svgHtml += `<circle cx="${xFor(i)}" cy="${yFor(h[key])}" r="3" fill="${colors[mi]}"/>`; });
  });

  svg.innerHTML = svgHtml;
  $("#perf-legend").innerHTML = RING_METRICS.map(m=>`<span><span class="legend-dot" style="background:${m.color}"></span>${m.label}</span>`).join("");
}

function renderBadges(){
  $("#badge-grid").innerHTML = BADGES.map(b=>{
    const unlocked = !!STATS.badges[b.id];
    return `<div class="badge-item glass ${unlocked?"unlocked":""}">
      <div class="ic">${b.icon}</div>
      <div class="nm">${b.name}</div>
    </div>`;
  }).join("");
}

/* ---------------------------------------------------------
   Resume-Based Preparation
--------------------------------------------------------- */
let resumeState = { skills: [], payload: null };
const MAX_RESUME_BYTES = 8 * 1024 * 1024;

function initResume(){
  const drop = $("#resume-drop");
  const fileInput = $("#resume-file");
  drop.addEventListener("click", ()=> fileInput.click());
  ["dragover","dragenter"].forEach(evt=> drop.addEventListener(evt,(e)=>{ e.preventDefault(); drop.classList.add("dragover"); }));
  ["dragleave","drop"].forEach(evt=> drop.addEventListener(evt,(e)=>{ e.preventDefault(); drop.classList.remove("dragover"); }));
  drop.addEventListener("drop",(e)=>{
    if(e.dataTransfer.files.length){ fileInput.files = e.dataTransfer.files; handleResumeFile(e.dataTransfer.files[0]); }
  });
  fileInput.addEventListener("change", ()=>{ if(fileInput.files[0]) handleResumeFile(fileInput.files[0]); });
}

function handleResumeFile(file){
  $("#resume-file-info").innerHTML = `<div class="resume-file-chip">📎 ${esc(file.name)} <span class="text-muted">(${Math.round(file.size/1024)} KB)</span></div>`;
  resumeState.payload = null;
  $("#resume-questions").innerHTML = "";
  const isPdf = file.type==="application/pdf" || /\.pdf$/i.test(file.name);
  const isTxt = file.type==="text/plain" || /\.txt$/i.test(file.name);

  if(AI.online && (isPdf || isTxt)){
    if(file.size > MAX_RESUME_BYTES){ toast("This file is too large. Please upload a resume under 8 MB.", "info"); return; }
    const reader = new FileReader();
    reader.onload = ()=>{
      resumeState.payload = isPdf ? { pdfBase64: String(reader.result).split(",")[1] || "" } : { text: String(reader.result) };
      $("#resume-detected").classList.remove("hidden");
      $("#resume-skill-chips").innerHTML = `<span class="skill-chip">Ready — the AI will read your resume</span>`;
      $("#btn-generate-resume-q").disabled = false;
    };
    reader.onerror = ()=> toast("Could not read this file.", "info");
    isPdf ? reader.readAsDataURL(file) : reader.readAsText(file);
    return;
  }

  if(isTxt){
    const reader = new FileReader();
    reader.onload = ()=> detectSkills(reader.result.toLowerCase());
    reader.readAsText(file);
  } else {
    toast("Demo mode: showing sample detected skills for this file type.", "info");
    detectSkills("python machine learning sql web technologies");
  }
}

function detectSkills(text){
  const matched = Object.keys(SKILL_QUESTION_MAP).filter(skill => text.includes(skill));
  resumeState.skills = matched.length ? matched : ["python","sql"];
  $("#resume-detected").classList.remove("hidden");
  $("#resume-skill-chips").innerHTML = resumeState.skills.map(s=>`<span class="skill-chip">${s.replace(/\b\w/g,c=>c.toUpperCase())}</span>`).join("");
  $("#btn-generate-resume-q").disabled = false;
}

function renderResumeQuestions(list){
  $("#resume-questions").innerHTML = list.map(q=>`
    <div class="feature-card glass">
      <div class="tags" style="margin-bottom:10px;"><span class="tag">${esc(q.skill.replace(/\b\w/g,c=>c.toUpperCase()))}</span><span class="tag diff-Intermediate">Personalized</span></div>
      <p style="color:var(--text-0);font-weight:500;">${esc(q.text)}</p>
      <button class="btn btn-outline btn-sm mt-10" data-practice-text="${encodeURIComponent(q.text)}" data-practice-label="${esc(q.skill)}">Practice</button>
    </div>`).join("") || `<div class="empty-state">No skills detected. Try uploading a resume with more detail.</div>`;
}

$("#btn-generate-resume-q").addEventListener("click", async ()=>{
  const btn = $("#btn-generate-resume-q");
  if(btn.classList.contains("is-loading")) return;
  if(AI.online && resumeState.payload){
    btn.classList.add("is-loading");
    try{
      const data = await aiPost("/api/resume", resumeState.payload, 120000);
      const skills = data.skills || [];
      const list = (data.questions || []).filter(q=>q && q.text).map(q=>({text:q.text, skill:q.skill || "Resume"}));
      $("#resume-skill-chips").innerHTML = skills.map(s=>`<span class="skill-chip">${esc(s)}</span>`).join("") || `<span class="skill-chip">No skills found</span>`;
      renderResumeQuestions(list);
      toast(list.length ? "AI generated questions from your resume." : "This file doesn't look like a resume.", list.length ? "success" : "info");
      btn.classList.remove("is-loading");
      return;
    }catch(e){
      btn.classList.remove("is-loading");
      toast(e.message + " Using built-in skill matching instead.", "info");
      // Fall back to the local keyword matcher
      detectSkills(resumeState.payload.text ? resumeState.payload.text.toLowerCase() : "python machine learning sql web technologies");
    }
  }
  const qs = [];
  resumeState.skills.forEach(s => { (SKILL_QUESTION_MAP[s]||[]).forEach(q=> qs.push({text:q, skill:s})); });
  renderResumeQuestions(qs.slice(0,8));
  toast("Personalized questions generated from your resume.", "success");
});

document.addEventListener("click",(e)=>{
  const btn = e.target.closest("[data-practice-text]");
  if(btn){ startQuickPractice(decodeURIComponent(btn.dataset.practiceText), btn.dataset.practiceLabel); }
});

/* ---------------------------------------------------------
   AI Question Generator
--------------------------------------------------------- */
function genTemplates(role, company, skill){
  return [
    `Tell me about your experience relevant to the ${role} role.`,
    company ? `Why do you want to work at ${company}?` : `Why does this role interest you?`,
    skill ? `Walk me through a project where you used ${skill}.` : `Walk me through a recent project you're proud of.`,
    `What challenges do you expect in a ${role} position, and how would you handle them?`,
    `How do you stay updated with trends relevant to ${role}?`,
  ];
}

function renderGenerated(questions, difficulty){
  $("#generator-results").innerHTML = questions.map(q=>`
    <div class="feature-card glass">
      <div class="tags" style="margin-bottom:10px;"><span class="tag diff-${esc(difficulty)}">${esc(difficulty)}</span><span class="tag">${esc(q.cat)}</span></div>
      <p style="color:var(--text-0);font-weight:500;">${esc(q.text)}</p>
      <button class="btn btn-outline btn-sm mt-10" data-practice-text="${encodeURIComponent(q.text)}" data-practice-label="${esc(q.cat)}">Practice</button>
    </div>`).join("");
}

$("#btn-generate-questions").addEventListener("click", async ()=>{
  const btn = $("#btn-generate-questions");
  if(btn.classList.contains("is-loading")) return;
  const role = $("#gen-role").value.trim();
  const company = $("#gen-company").value.trim();
  const experience = $("#gen-experience").value;
  const difficulty = $("#gen-difficulty").value;
  const skills = $("#gen-skills").value.split(",").map(s=>s.trim()).filter(Boolean);

  if(!role){ toast("Please enter a job role.", "info"); return; }

  if(AI.online){
    btn.classList.add("is-loading");
    try{
      const data = await aiPost("/api/questions", { type:"Mixed: role-specific, technical and behavioral", role, company, experience, difficulty, skills, count:8 });
      const list = (data.questions || []).filter(q=>q && q.text).map(q=>({text:q.text, cat:q.category || "Role-Specific"}));
      if(list.length){
        renderGenerated(list, difficulty);
        toast(`AI generated ${list.length} questions for ${role}.`, "success");
        return;
      }
    }catch(e){
      toast(e.message + " Using built-in templates instead.", "info");
    }finally{
      btn.classList.remove("is-loading");
    }
  }

  let questions = [];
  genTemplates(role, company, skills[0]).forEach(q=> questions.push({text:q, cat:"Role-Specific"}));
  skills.forEach(s=>{
    const key = s.toLowerCase();
    const matched = Object.keys(SKILL_QUESTION_MAP).find(k=> key.includes(k) || k.includes(key));
    if(matched) SKILL_QUESTION_MAP[matched].forEach(q=> questions.push({text:q, cat:s}));
  });
  questions = questions.slice(0,8);
  renderGenerated(questions, difficulty);
  toast(`Generated ${questions.length} questions for ${role}.`, "success");
});

/* ---------------------------------------------------------
   Resources
--------------------------------------------------------- */
const RESOURCE_DETAILS = {
  "Interview Tips": "Research the company beforehand, prepare 3-4 strong stories from your experience, arrive (or log in) early, and ask thoughtful questions at the end. Confidence comes from preparation, not memorization.",
  "Resume Tips": "Keep it to one page, lead with impact using numbers, tailor keywords to the job description, and remove outdated or irrelevant experience. Proofread twice.",
  "Communication Skills": "Structure your answers before speaking, use simple language, pause instead of using filler words, and check for understanding by summarizing key points.",
  "Body Language": "Maintain steady eye contact (or camera contact on video calls), sit upright, keep hands visible, and smile naturally to appear approachable and confident.",
  "Common HR Questions": "Prepare answers for: Tell me about yourself, Why should we hire you, Strengths & weaknesses, Where do you see yourself in 5 years, and Why do you want this job.",
  "Technical Interview Tips": "Think out loud, clarify requirements before coding, discuss time/space complexity, and test your solution with edge cases before declaring it done.",
  "STAR Method": "Situation: set the context. Task: explain your responsibility. Action: describe what you specifically did. Result: share the measurable outcome.",
  "Salary Negotiation Basics": "Research market rates beforehand, let the employer share a number first when possible, negotiate the total package (not just base pay), and stay polite and confident.",
};

function renderResources(){
  $("#resources-grid").innerHTML = RESOURCES.map(r=>`
    <div class="resource-card glass" data-resource="${r.title}">
      <div class="resource-icon">${r.icon}</div>
      <h3>${r.title}</h3>
      <p class="mb-0">${r.desc}</p>
    </div>`).join("");
}
$("#resources-grid").addEventListener("click",(e)=>{
  const card = e.target.closest("[data-resource]");
  if(!card) return;
  const title = card.dataset.resource;
  const r = RESOURCES.find(x=>x.title===title);
  $("#resource-modal-icon").textContent = r.icon;
  $("#resource-modal-title").textContent = r.title;
  $("#resource-modal-body").textContent = RESOURCE_DETAILS[title] || r.desc;
  $("#resource-modal").classList.add("open");
});
$("#resource-close").addEventListener("click", ()=> $("#resource-modal").classList.remove("open"));
$("#resource-modal").addEventListener("click",(e)=>{ if(e.target.id==="resource-modal") $("#resource-modal").classList.remove("open"); });

/* ---------------------------------------------------------
   About / Technology cards
--------------------------------------------------------- */
const TECH_ITEMS = [
  {icon:"🧠", title:"Artificial Intelligence", desc:"Drives the interview question flow and adaptive difficulty."},
  {icon:"🗣️", title:"Natural Language Processing", desc:"Analyzes answer content for relevance and structure."},
  {icon:"🎙️", title:"Speech Recognition", desc:"Converts spoken answers into text for evaluation."},
  {icon:"📈", title:"Machine Learning", desc:"Powers scoring models for communication and confidence."},
  {icon:"🌐", title:"Web Technologies", desc:"HTML5, CSS3 and JavaScript deliver a responsive experience."},
  {icon:"📊", title:"Data Analytics", desc:"Tracks performance trends across every practice session."},
];
function renderTechGrid(){
  $("#tech-grid").innerHTML = TECH_ITEMS.map(t=>`
    <div class="tech-card glass">
      <div class="tech-icon">${t.icon}</div>
      <h3>${t.title}</h3>
      <p class="mb-0">${t.desc}</p>
    </div>`).join("");
}

/* ---------------------------------------------------------
   AI Chat Assistant
--------------------------------------------------------- */
let chatInitialized = false;
function openChat(){
  $("#chat-panel").classList.add("open");
  if(!chatInitialized){
    chatInitialized = true;
    appendChat("bot", AI.online
      ? "Hi! I'm your AI assistant. Ask me anything — interview prep, studies, coding, general questions — or pick an option below."
      : "Hi! I'm your AI Interview Coach. What would you like to practice today?");
    appendChatOptions(["Practice HR Questions","Improve My Answer","Give Me Interview Tips","Explain STAR Method","Generate Questions"]);
  }
}
$("#chat-fab").addEventListener("click", ()=>{
  const panel = $("#chat-panel");
  panel.classList.contains("open") ? panel.classList.remove("open") : openChat();
});
$("#chat-close").addEventListener("click", ()=> $("#chat-panel").classList.remove("open"));

function appendChat(who, text){
  const body = $("#chat-body");
  const el = document.createElement("div");
  el.className = "chat-bubble" + (who==="me" ? " me" : "");
  el.textContent = text;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
}
function appendChatOptions(options){
  const body = $("#chat-body");
  const wrap = document.createElement("div");
  wrap.className = "chat-options";
  options.forEach(o=>{
    const b = document.createElement("button");
    b.className = "chat-opt-btn";
    b.textContent = o;
    b.addEventListener("click", ()=> handleChatChoice(o));
    wrap.appendChild(b);
  });
  body.appendChild(wrap);
  body.scrollTop = body.scrollHeight;
}
function showTyping(){
  const body = $("#chat-body");
  const el = document.createElement("div");
  el.className = "chat-bubble";
  el.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  body.appendChild(el);
  body.scrollTop = body.scrollHeight;
  return el;
}
function botTyping(cb){
  const el = showTyping();
  setTimeout(()=>{ el.remove(); cb(); }, 650);
}

const chatHistory = [];
let chatBusy = false;
function chatStats(){
  const last = STATS.history[STATS.history.length-1];
  const keys = ["communication","relevance","confidence","technical","grammar"];
  return {
    interviews: STATS.interviews,
    questionsAnswered: STATS.questionsAnswered,
    avgScore: STATS.scoreCount ? Math.round(STATS.scoreSum/STATS.scoreCount) : 0,
    lastScores: last ? Object.fromEntries(keys.map(k=>[k, last[k]])) : null,
    weakest: last ? keys.reduce((a,b)=> last[b] < last[a] ? b : a) : null,
  };
}

function handleChatChoice(choice){
  appendChat("me", choice);
  botTyping(()=>{
    switch(choice){
      case "Practice HR Questions":
        appendChat("bot", "Great choice! Opening the Question Bank filtered to HR questions.");
        showView("questionbank"); qbState.category="HR"; renderQuestionBank();
        setTimeout(()=>{ $("#qb-category-chips [data-cat='HR']")?.click(); }, 50);
        break;
      case "Improve My Answer":
        appendChat("bot", "Start a mock interview and after each answer I'll show you a detailed AI feedback card with what went well and what to improve.");
        appendChatOptions(["Start Mock Interview"]);
        break;
      case "Start Mock Interview":
        showView("mock-setup");
        break;
      case "Give Me Interview Tips":
        appendChat("bot", "Tip: Research the company, prepare 3-4 strong stories from your experience, and always ask a thoughtful question at the end. Check the Resources tab for more!");
        break;
      case "Explain STAR Method":
        appendChat("bot", "STAR = Situation, Task, Action, Result. Set the context, explain your responsibility, describe what you did, then share the measurable outcome. It keeps behavioral answers focused.");
        break;
      case "Generate Questions":
        appendChat("bot", "Opening the AI Question Generator for you.");
        showView("generator");
        break;
      default:
        appendChat("bot", "Got it! Let me know if you'd like tips, a mock interview, or generated questions.");
    }
  });
}

$("#chat-send").addEventListener("click", sendChatMessage);
$("#chat-input").addEventListener("keydown",(e)=>{ if(e.key==="Enter") sendChatMessage(); });
function sendChatMessage(){
  const input = $("#chat-input");
  const text = input.value.trim();
  if(!text || chatBusy) return;
  appendChat("me", text);
  input.value = "";
  if(AI.online){
    chatBusy = true;
    chatHistory.push({ role:"user", content:text });
    const typing = showTyping();
    aiPost("/api/chat", { messages:chatHistory, stats:chatStats() })
      .then(data=>{
        chatHistory.push({ role:"assistant", content:data.reply });
        appendChat("bot", data.reply);
      })
      .catch(e=>{
        chatHistory.pop();
        appendChat("bot", "Sorry, I couldn't answer that right now. " + e.message);
      })
      .finally(()=>{ typing.remove(); chatBusy = false; });
    return;
  }
  botTyping(()=>{
    const lower = text.toLowerCase();
    let reply = "I'm a demo AI coach for this project — try one of the quick options above, or ask about STAR method, interview tips, or mock interviews.";
    if(lower.includes("star")) reply = "STAR = Situation, Task, Action, Result — a simple structure for behavioral answers.";
    else if(lower.includes("tip")) reply = "Prepare specific examples, keep answers under 2 minutes, and always ask a question at the end.";
    else if(lower.includes("mock") || lower.includes("interview")) reply = "You can start a full mock interview from the Mock Interview tab — I'll score your answers instantly.";
    else if(lower.includes("resume")) reply = "Try 'Practice From My Resume' to get questions generated from your own skills and projects.";
    appendChat("bot", reply);
  });
}

/* ---------------------------------------------------------
   Auth Modal (demo, client-side only)
--------------------------------------------------------- */
const USER_KEY = "aiip_user_v1";
function getUser(){ try{ return JSON.parse(localStorage.getItem(USER_KEY)); }catch(e){ return null; } }
function setUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); refreshAuthUI(); }
function refreshAuthUI(){
  const u = getUser();
  if(u){
    $("#btn-login").style.display = "inline-flex";
    $("#btn-login-open").style.display = "none";
    $("#nav-username").textContent = u.name.split(" ")[0];
  } else {
    $("#btn-login").style.display = "none";
    $("#btn-login-open").style.display = "inline-flex";
  }
}

$("#btn-login-open").addEventListener("click", ()=> $("#auth-modal").classList.add("open"));
$("#btn-login").addEventListener("click", ()=>{
  if(confirm("Log out of your demo account?")){ localStorage.removeItem(USER_KEY); refreshAuthUI(); toast("Logged out.", "info"); }
});
$("#auth-close").addEventListener("click", ()=> $("#auth-modal").classList.remove("open"));
$("#auth-modal").addEventListener("click",(e)=>{ if(e.target.id==="auth-modal") $("#auth-modal").classList.remove("open"); });

$$(".auth-tabs button").forEach(tab=>{
  tab.addEventListener("click", ()=>{
    $$(".auth-tabs button").forEach(b=>b.classList.remove("active"));
    tab.classList.add("active");
    $$(".auth-form").forEach(f=>f.classList.remove("active"));
    $("#form-"+tab.dataset.tab).classList.add("active");
  });
});

$("#form-login").addEventListener("submit",(e)=>{
  e.preventDefault();
  const email = $("#form-login input[type=email]").value;
  setUser({ name: email.split("@")[0] || "Candidate", email });
  $("#auth-modal").classList.remove("open");
  toast("Welcome back!", "success");
});
$("#form-signup").addEventListener("submit",(e)=>{
  e.preventDefault();
  const inputs = $$("#form-signup input");
  const [name, email, pass, confirm] = inputs.map(i=>i.value);
  if(pass !== confirm){ toast("Passwords do not match.", "info"); return; }
  setUser({ name: name || "Candidate", email });
  $("#auth-modal").classList.remove("open");
  toast("Account created — welcome!", "success");
});
$("#google-btn").addEventListener("click", ()=>{
  setUser({ name:"Google User", email:"demo@gmail.com" });
  $("#auth-modal").classList.remove("open");
  toast("Signed in with Google (demo).", "success");
});
$("#forgot-link").addEventListener("click",(e)=>{
  e.preventDefault();
  toast("Password reset link sent (demo).", "info");
});

/* ---------------------------------------------------------
   Init
--------------------------------------------------------- */
function init(){
  initSetupForm();
  initQuestionBankChips();
  initResume();
  renderResources();
  renderTechGrid();
  refreshAuthUI();
  showView("home");
  checkAI();
}
document.addEventListener("DOMContentLoaded", init);

})();

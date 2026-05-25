// Engine + Router + Init
const Engine = (() => {
  let curLesson = null, stepIdx = 0, current = null;
  let xpGained = 0, mistakes = 0, comboMax = 0, combo = 0, startedAt = 0;

  function start(lessonId) {
    const d = State.get();
    State.tickHp();
    if (d.hp <= 0) {
      UI.modal(`<span class="em">💔</span><h3>Жүрек бітті!</h3><p>Дүкеннен қайта толтыр немесе 30 мин күт.</p><button class="cont-btn" onclick="Router.go('shop')">Дүкенге</button>`);
      return;
    }
    const lesson = LESSON_BY_ID[lessonId];
    if (!lesson) return;
    curLesson = lesson; stepIdx = 0; xpGained = 0; mistakes = 0; combo = 0; comboMax = 0; startedAt = Date.now();
    UI.show('lessonScreen');
    renderStep();
  }

  function renderStep() {
    const host = document.getElementById('lessonContent');
    const step = curLesson.steps[stepIdx];
    current = Games.make(step);
    current.render(host);
    const pct = (stepIdx / curLesson.steps.length) * 100;
    document.getElementById('lpFill').style.width = pct + '%';
    document.getElementById('lxpBadge').textContent = `+${xpGained} XP`;
    document.getElementById('lhpView').textContent = '❤️' + State.get().hp;
    const btn = document.getElementById('checkBtn');
    btn.textContent = 'Тексеру'; btn.disabled = true;
    document.getElementById('feedback').className = 'feedback';
    btn.onclick = onCheck;
    checkBtnState();
  }

  function checkBtnState() {
    const btn = document.getElementById('checkBtn');
    if (!current) return;
    btn.disabled = !current.hasAnswer();
  }

  let waitingNext = false, canRetry = false;
  function onCheck() {
    if (waitingNext) { next(); return; }
    if (canRetry) { canRetry = false; renderStep(); return; }
    if (!current || !current.hasAnswer()) return;
    const res = current.check();
    const fb = document.getElementById('feedback');
    const btn = document.getElementById('checkBtn');
    if (res.ok) {
      combo++; comboMax = Math.max(comboMax, combo);
      const base = 5; const bonus = combo >= 3 ? Math.floor(combo / 2) : 0;
      const gained = base + bonus;
      xpGained += gained;
      Audio.correct();
      fb.className = 'feedback ok';
      fb.innerHTML = `✅ Дұрыс! +${gained} XP${combo>=3?' 🔥 '+combo+'x':''}`;
      if (combo >= 5) Achv.unlock('combo5');
      waitingNext = true;
      btn.textContent = 'Жалғастыру →'; btn.disabled = false;
    } else {
      combo = 0; mistakes++;
      State.loseHp();
      Audio.wrong();
      const expl = curLesson.steps[stepIdx].expl || curLesson.tip || 'Қайтадан жақсылап ойлап көр!';
      fb.className = 'feedback no';
      fb.innerHTML = `❌ Қате — жүрек минус.<br><span style="font-size:12px;font-weight:600">💡 ${expl}</span>`;
      document.getElementById('lessonContent').classList.add('shake');
      setTimeout(() => document.getElementById('lessonContent').classList.remove('shake'), 320);
      document.getElementById('lhpView').textContent = '❤️' + State.get().hp;
      UI.renderHud();
      if (State.get().hp <= 0) { setTimeout(() => failOut(), 700); return; }
      canRetry = true;
      btn.textContent = '🔄 Қайта көру'; btn.disabled = false;
      return;
    }
    document.getElementById('lhpView').textContent = '❤️' + State.get().hp;
    document.getElementById('lxpBadge').textContent = `+${xpGained} XP`;
    UI.renderHud();
  }

  function next() {
    waitingNext = false;
    stepIdx++;
    if (stepIdx >= curLesson.steps.length) finish();
    else renderStep();
  }

  function failOut() {
    UI.modal(`<span class="em">💔</span><h3>Жүрек қалмады</h3><p>Кейінірек жалғастыр немесе дүкеннен сатып ал.</p>
      <button class="cont-btn" onclick="Router.go('home');UI.closeModal()">Басты бет</button>`);
  }

  function finish() {
    const dur = (Date.now() - startedAt) / 1000;
    const perfect = mistakes === 0;
    const speed = dur < 60;
    let bonus = 0;
    if (perfect) { bonus += 15; Achv.unlock('perfect'); }
    if (speed)   { bonus += 5;  Achv.unlock('speed'); }
    const totalXp = xpGained + bonus + (curLesson.xp || 10);
    State.addXp(totalXp);
    const stars = perfect ? 3 : (mistakes <= 1 ? 2 : 1);
    State.completeLesson(curLesson.id, stars, totalXp);
    // module-completion achievements
    const mod = MOD_BY_ID[curLesson._modId];
    if (mod.lessons.every(l => State.get().completed[l.id])) {
      const map = { budget:'budgetMaster', saving:'saverPro', invest:'investor', credit:'creditWise', insure:'protected' };
      if (map[mod.id]) Achv.unlock(map[mod.id]);
    }
    Audio.chest();
    UI.confetti();

    document.getElementById('winXP').textContent = totalXp;
    document.getElementById('winTip').textContent = curLesson.tip || '';
    document.getElementById('comboInfo').innerHTML =
      `${perfect ? '✨ Қатесіз +15' : ''} ${speed ? ' ⚡ Жылдам +5' : ''} ${comboMax>=3 ? ' 🔥 Combo '+comboMax+'x' : ''}`;
    const sr = document.getElementById('starsRow'); sr.innerHTML = '';
    for (let i=0;i<3;i++) { const s=document.createElement('span'); s.className='star'+(i<stars?' on':''); s.textContent='⭐'; sr.appendChild(s); }
    UI.show('winScreen');
    UI.renderHud();
  }

  return { start, checkBtnState };
})();

// ---------- Router & Renderers ----------
const Router = (() => {
  let curMod = null;

  function renderHome() {
    UI.renderHud();
    const d = State.get();
    // continue button → first not-done lesson in first unlocked module
    let nextLes = null, nextMod = null;
    for (const m of MODULES) {
      if (!d.unlockedMods.includes(m.id)) continue;
      for (const l of m.lessons) {
        if (!d.completed[l.id]) { nextLes = l; nextMod = m; break; }
      }
      if (nextLes) break;
    }
    document.getElementById('heroT').textContent = nextLes ? `Келесі: ${nextLes.name}` : 'Барлығын бітірдің! 🏆';

    // module strip
    const ms = document.getElementById('modScroll'); ms.innerHTML = '';
    MODULES.forEach(m => {
      const unlocked = d.unlockedMods.includes(m.id);
      const done = m.lessons.length && m.lessons.every(l => d.completed[l.id]);
      const doneCount = m.lessons.filter(l => d.completed[l.id]).length;
      const prog = Math.round(doneCount / m.lessons.length * 100);
      const cls = !unlocked ? 'locked' : done ? 'done' : (doneCount>0?'curr':'');
      const el = document.createElement('div');
      el.className = `mod-mini ${cls}`;
      el.innerHTML = `<div class="mod-mini-icon">${m.icon}</div>
        <div class="mod-mini-title">${m.title}</div>
        <div class="mod-mini-prog"><div class="mod-mini-fill" style="width:${prog}%;background:${m.color}"></div></div>
        <div class="mod-mini-label">${unlocked ? doneCount+'/'+m.lessons.length : '🔒 Lv·'+(MODULES.indexOf(m)+1)}</div>`;
      el.onclick = () => unlocked ? openModule(m.id) : UI.toast('🔒 Бұл модуль әлі жабық', 'b');
      ms.appendChild(el);
    });

    // path = first unlocked module's lessons
    const targetMod = nextMod || MODULES[0];
    const pw = document.getElementById('pathWrap'); pw.innerHTML = '';
    targetMod.lessons.forEach((l, i) => {
      const isDone = !!d.completed[l.id];
      const isCurr = !isDone && targetMod.lessons.slice(0, i).every(x => d.completed[x.id]);
      const locked = !isDone && !isCurr;
      const node = document.createElement('div'); node.className = 'path-node';
      node.innerHTML = `
        <div class="path-circle ${isDone?'done':isCurr?'curr':'locked'}">${isDone?'✓':l.icon}</div>
        <div class="path-info ${isCurr?'curr':''}">
          <div class="path-info-t">${l.name}</div>
          <div class="path-info-s">${l.type} · +${l.xp} XP</div>
        </div>`;
      if (!locked) {
        node.querySelector('.path-circle').onclick = () => Engine.start(l.id);
        node.querySelector('.path-info').onclick = () => Engine.start(l.id);
      }
      pw.appendChild(node);
      if (i < targetMod.lessons.length - 1) {
        const c = document.createElement('div'); c.className = 'path-connector'; pw.appendChild(c);
      }
    });

    // daily
    const today = new Date().toISOString().slice(0,10);
    const doneToday = d.dailyDone === today;
    document.getElementById('dailySub').textContent = doneToday ? '✅ Бүгін орындалды!' : 'Кез келген сабақтан +10 XP бонус';

    // achievements count
    const total = Achv.list().length;
    const got = Object.keys(d.achievements).length;
    document.getElementById('achCount').textContent = `${got}/${total}`;
    document.getElementById('rankInfo').textContent = State.rank();
  }

  function openModule(id) {
    curMod = MOD_BY_ID[id]; if (!curMod) return;
    document.getElementById('mdTitle').textContent = curMod.title;
    document.getElementById('mdSub').textContent = curMod.sub;
    const d = State.get();
    const g = document.getElementById('lessonGrid'); g.innerHTML = '';
    curMod.lessons.forEach((l, i) => {
      const done = !!d.completed[l.id];
      const curr = !done && curMod.lessons.slice(0,i).every(x => d.completed[x.id]);
      const locked = !done && !curr;
      const card = document.createElement('div');
      card.className = 'les-card ' + (done?'done':curr?'curr':'locked');
      card.innerHTML = `
        <div class="les-card-top">
          <div class="les-num ${done?'done':curr?'curr':'locked'}">${i+1}</div>
          <div class="les-type-pill">${l.type}</div>
        </div>
        <div class="les-icon">${l.icon}</div>
        <div class="les-name">${l.name}</div>
        <div class="les-xp">+${l.xp} XP ${done?'⭐'.repeat(d.completed[l.id].stars):''}</div>`;
      if (!locked) card.onclick = () => Engine.start(l.id);
      g.appendChild(card);
    });
    UI.show('moduleScreen');
  }

  function renderProfile() {
    const d = State.get(), t = State.levelInfo();
    document.getElementById('profAvatar').textContent = d.settings.avatar;
    document.getElementById('profLvl').textContent = t.lvl;
    document.getElementById('profRank').textContent = State.rank();
    document.getElementById('profXP').textContent = t.rem;
    document.getElementById('profXPNext').textContent = t.need;
    document.getElementById('profFill').style.width = (t.rem / t.need * 100) + '%';
    document.getElementById('stStreak').textContent = d.streak;
    document.getElementById('stXP').textContent = d.xp;
    document.getElementById('stLessons').textContent = d.totalLessons;
    document.getElementById('stAch').textContent = Object.keys(d.achievements).length;
    const ar = document.getElementById('avatarRow'); ar.innerHTML = '';
    ['🦉','🦊','🐯','🦁','🐲'].forEach(a => {
      const b = document.createElement('button');
      const unl = d.unlockedAvatars.includes(a);
      b.className = 'av-pick' + (a===d.settings.avatar?' sel':'') + (unl?'':' locked');
      b.textContent = unl ? a : '🔒';
      b.onclick = () => { if (unl) { State.setAvatar(a); renderProfile(); UI.renderHud(); } else UI.toast('Деңгейді өсір!','b'); };
      ar.appendChild(b);
    });
    document.getElementById('darkToggle').checked = !!d.settings.dark;
    document.getElementById('soundToggle').checked = !!d.settings.sound;
    UI.show('profileScreen');
  }

  function renderShop() {
    const d = State.get();
    document.getElementById('shopXP').textContent = d.xp;
    const items = [
      { id:'h1', em:'❤️', t:'+1 жүрек', d:'Бір жүрек қос', cost:30, act:()=>State.addHp(1) },
      { id:'hf', em:'💖', t:'Толық жүрек', d:'Бәрін толтыр', cost:80, act:()=>State.addHp(5) },
      { id:'sx', em:'⭐', t:'2x XP (1 сабақ)', d:'Көп бонус ал', cost:60, act:()=>{ d.boost=Date.now()+30*60*1000; State.save(); } },
      { id:'sk', em:'🔥', t:'Streak қалқан', d:'1 күн қорға', cost:100, act:()=>UI.toast('Streak қорғалды!','g') },
    ];
    const g = document.getElementById('shopGrid'); g.innerHTML = '';
    items.forEach(it => {
      const c = document.createElement('div'); c.className='shop-it';
      const dis = d.xp < it.cost;
      c.innerHTML = `<div class="shop-em">${it.em}</div><div class="shop-t">${it.t}</div><div class="shop-d">${it.d}</div>
        <button class="shop-buy" ${dis?'disabled':''}>${it.cost} XP</button>`;
      c.querySelector('button').onclick = () => {
        if (d.xp < it.cost) return;
        d.xp -= it.cost; it.act(); State.save();
        UI.toast('Сатып алынды ✅','g'); Audio.chest();
        renderShop(); UI.renderHud();
      };
      g.appendChild(c);
    });
    UI.show('shopScreen');
  }

  function renderAch() {
    const d = State.get();
    const g = document.getElementById('achGrid'); g.innerHTML = '';
    Achv.list().forEach(a => {
      const on = !!d.achievements[a.id];
      const c = document.createElement('div'); c.className = 'ach-it' + (on?' on':'');
      c.innerHTML = `<div class="ach-em">${a.em}</div><div class="ach-t">${a.t}</div><div class="ach-d">${a.d}</div>`;
      g.appendChild(c);
    });
    UI.show('achScreen');
  }

  function renderLB() {
    const d = State.get();
    const fake = [
      {n:'Aibek',xp:2400},{n:'Dana',xp:2100},{n:'Nurlan',xp:1850},{n:'Aigerim',xp:1600},
      {n:'Aslan',xp:1200},{n:'Madi',xp:900},{n:'Sen',xp:d.weeklyXp,me:true},{n:'Eldar',xp:400},{n:'Sara',xp:200},
    ].sort((a,b)=>b.xp-a.xp);
    const list = document.getElementById('lbList'); list.innerHTML = '';
    fake.forEach((r,i) => {
      const el = document.createElement('div'); el.className = 'lb-row' + (r.me?' me':'');
      el.innerHTML = `<div class="lb-rank">${i<3?['🥇','🥈','🥉'][i]:i+1}</div>
        <div class="lb-name">${r.n}</div><div class="lb-xp">⭐ ${r.xp}</div>`;
      list.appendChild(el);
    });
    UI.show('lbScreen');
  }

  function go(target) {
    switch (target) {
      case 'home': renderHome(); break;
      case 'module': curMod ? openModule(curMod.id) : renderHome(); break;
      case 'profile': renderProfile(); break;
      case 'shop': renderShop(); break;
      case 'achievements': renderAch(); break;
      case 'leaderboard': renderLB(); break;
      case 'daily': startDaily(); break;
      case 'continue': continueLearning(); break;
      case 'sound': toggleSound(); break;
      case 'reset':
        if (confirm('Прогресс мүлдем өшіріледі. Сенімдісің бе?')) { State.reset(); renderHome(); UI.renderHud(); }
        break;
    }
  }

  function continueLearning() {
    const d = State.get();
    for (const m of MODULES) {
      if (!d.unlockedMods.includes(m.id)) continue;
      for (const l of m.lessons) if (!d.completed[l.id]) return Engine.start(l.id);
    }
    UI.toast('Барлық сабақ аяқталды!', 'g');
  }

  function startDaily() {
    const d = State.get();
    const today = new Date().toISOString().slice(0,10);
    if (d.dailyDone === today) { UI.toast('Бүгін орындалған ✅','g'); return; }
    // pick a random available lesson
    const pool = []; MODULES.forEach(m => d.unlockedMods.includes(m.id) && m.lessons.forEach(l => pool.push(l)));
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random()*pool.length)];
    d.dailyDone = today; State.save();
    UI.toast('🎯 Күнделікті челлендж!','b');
    Engine.start(pick.id);
  }

  function toggleSound() {
    const d = State.get();
    State.setSetting('sound', !d.settings.sound);
    Audio.setMuted(!d.settings.sound);
    UI.renderHud();
  }

  return { go, renderHome, openModule };
})();

// ---------- Init ----------
window.addEventListener('DOMContentLoaded', () => {
  const d = State.get();
  Audio.setMuted(!d.settings.sound);
  document.body.classList.toggle('dark', !!d.settings.dark);

  // delegate actions
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]');
    if (a) { Router.go(a.dataset.act); }
  });
  // settings toggles (rebound after profile render but also wire generally)
  document.addEventListener('change', e => {
    if (e.target.id === 'darkToggle') {
      State.setSetting('dark', e.target.checked);
      document.body.classList.toggle('dark', e.target.checked);
    }
    if (e.target.id === 'soundToggle') {
      State.setSetting('sound', e.target.checked);
      Audio.setMuted(!e.target.checked);
      UI.renderHud();
    }
  });

  Router.renderHome();
});

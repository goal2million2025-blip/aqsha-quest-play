// Reusable mini-game engine. Each game returns:
//   { render(host), check() -> {ok, partial?}, hasAnswer() -> bool, auto?: bool }
const Games = (() => {

  // ---------- Visual quiz (1 correct) ----------
  function quiz(step) {
    let sel = null, done = false;
    const html = `
      <div class="lcard">
        <div class="ltype">${step.label || 'СҰРАҚ'}</div>
        <div class="lq">${step.q}</div>
        <div class="lhint">${step.hint || 'Бір дұрыс жауапты таңда'}</div>
        <div class="vquiz">${step.opts.map((o,i)=>`
          <button class="vopt" data-i="${i}">
            ${o.icon ? `<span class="vopt-icon">${o.icon}</span>` : ''}
            <span class="vopt-txt">${o.txt}</span>
          </button>`).join('')}
        </div>
      </div>`;
    return {
      render(host){
        host.innerHTML = html;
        host.querySelectorAll('.vopt').forEach(b => b.onclick = () => {
          if (done) return;
          host.querySelectorAll('.vopt').forEach(x => x.classList.remove('sel'));
          b.classList.add('sel'); sel = +b.dataset.i; Audio.tap();
          Engine.checkBtnState();
        });
      },
      hasAnswer:()=>sel!==null,
      check(){
        done = true;
        const host = document.getElementById('lessonContent');
        const ok = step.opts[sel].correct;
        host.querySelectorAll('.vopt').forEach((b,i)=>{
          if (step.opts[i].correct) b.classList.add('correct');
          else if (i===sel) b.classList.add('wrong');
          b.style.pointerEvents = 'none';
        });
        return { ok };
      }
    };
  }

  // ---------- Swipe (needs vs wants etc) ----------
  function swipe(step) {
    let idx = 0, correct = 0, done = false;
    const cards = step.cards;
    const advance = (host, ans) => {
      if (done) return;
      const card = host.querySelector('.swipe-card');
      const want = cards[idx].answer;
      if (ans === want) { correct++; Audio.correct(); }
      else { Audio.wrong(); }
      card.style.transform = `translateX(${ans==='yes'?400:-400}px) rotate(${ans==='yes'?15:-15}deg)`;
      card.style.opacity = '0';
      setTimeout(() => {
        idx++;
        if (idx >= cards.length) { done = true; Engine.checkBtnState(); }
        else render(host);
      }, 240);
    };
    const render = (host) => {
      const c = cards[idx];
      host.querySelector('.swipe-wrap').innerHTML = `
        <div class="swipe-card">
          <div class="swipe-em">${c.em}</div>
          <div class="swipe-t">${c.t}</div>
          ${c.s?`<div class="swipe-s">${c.s}</div>`:''}
        </div>`;
      const card = host.querySelector('.swipe-card');
      let sx=null,dx=0;
      card.onpointerdown = e => { sx=e.clientX; card.setPointerCapture(e.pointerId); };
      card.onpointermove = e => {
        if (sx===null) return;
        dx = e.clientX-sx;
        card.style.transform = `translateX(${dx}px) rotate(${dx/15}deg)`;
      };
      card.onpointerup = () => {
        if (sx===null) return;
        if (dx>80) advance(host,'yes');
        else if (dx<-80) advance(host,'no');
        else card.style.transform='';
        sx=null;dx=0;
      };
    };
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">SWIPE</div>
            <div class="lq">${step.q}</div>
            <div class="lhint">${step.hint || 'Оңға — Иә, Солға — Жоқ'}</div>
            <div class="swipe-tags"><span class="tag-no">← ${step.no||'Жоқ'}</span><span class="tag-yes">${step.yes||'Иә'} →</span></div>
            <div class="swipe-wrap"></div>
            <div class="swipe-btns">
              <button class="sw-btn sw-no" data-a="no">✗</button>
              <button class="sw-btn sw-yes" data-a="yes">✓</button>
            </div>
          </div>`;
        host.querySelectorAll('.sw-btn').forEach(b => b.onclick = () => advance(host, b.dataset.a));
        render(host);
      },
      hasAnswer:()=>done,
      check(){ return { ok: correct >= Math.ceil(cards.length*0.7), partial: correct/cards.length }; },
      auto:true,
    };
  }

  // ---------- Fill blank (one slot, tap word bank) ----------
  function fill(step) {
    let chosen = null, done = false;
    const sentence = step.sentence.replace('___', `<span class="blank-slot" id="bSlot">___</span>`);
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">БОС ОРЫНДЫ ТОЛТЫР</div>
            <div class="lq">${step.q}</div>
            <div class="fblank-sentence">${sentence}</div>
            <div class="word-bank">${step.bank.map(w=>`<button class="word-chip" data-w="${w}">${w}</button>`).join('')}</div>
          </div>`;
        const slot = host.querySelector('#bSlot');
        host.querySelectorAll('.word-chip').forEach(c => c.onclick = () => {
          if (done) return;
          host.querySelectorAll('.word-chip').forEach(x=>x.classList.remove('used'));
          c.classList.add('used');
          chosen = c.dataset.w; slot.textContent = chosen; slot.classList.add('filled');
          Audio.tap();
          Engine.checkBtnState();
        });
      },
      hasAnswer:()=>chosen!==null,
      check(){ done=true; return { ok: chosen === step.answer }; }
    };
  }

  // ---------- Match pairs ----------
  function match(step) {
    let selT=null, selD=null, matched=0, mistakes=0;
    const pairs = step.pairs; // [[term,def], ...]
    const terms = pairs.map((p,i)=>({txt:p[0],i})).sort(()=>Math.random()-.5);
    const defs  = pairs.map((p,i)=>({txt:p[1],i})).sort(()=>Math.random()-.5);
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">СӘЙКЕСТЕНДІР</div>
            <div class="lq">${step.q}</div>
            <div class="match-cols">
              <div class="mcol">${terms.map(t=>`<button class="mterm" data-i="${t.i}">${t.txt}</button>`).join('')}</div>
              <div class="mcol">${defs.map(d=>`<button class="mdef" data-i="${d.i}">${d.txt}</button>`).join('')}</div>
            </div>
          </div>`;
        const check = () => {
          if (selT==null||selD==null) return;
          const tEl=host.querySelector(`.mterm[data-i="${selT}"]`), dEl=host.querySelector(`.mdef[data-i="${selD}"]`);
          if (selT===selD){
            tEl.classList.add('matched'); dEl.classList.add('matched');
            matched++; Audio.correct();
            if (matched===pairs.length) Engine.checkBtnState();
          } else {
            mistakes++; Audio.wrong();
            tEl.classList.add('shake'); dEl.classList.add('shake');
            setTimeout(()=>{ tEl.classList.remove('shake','sel'); dEl.classList.remove('shake','sel'); },300);
          }
          selT=selD=null;
        };
        host.querySelectorAll('.mterm').forEach(b => b.onclick = () => {
          host.querySelectorAll('.mterm').forEach(x=>x.classList.remove('sel'));
          b.classList.add('sel'); selT=+b.dataset.i; Audio.tap(); check();
        });
        host.querySelectorAll('.mdef').forEach(b => b.onclick = () => {
          host.querySelectorAll('.mdef').forEach(x=>x.classList.remove('sel'));
          b.classList.add('sel'); selD=+b.dataset.i; Audio.tap(); check();
        });
      },
      hasAnswer:()=>matched===pairs.length,
      check(){ return { ok: mistakes <= 1, partial: 1 - mistakes/(pairs.length*2) }; },
    };
  }

  // ---------- Drag-categorize ----------
  function dragCat(step) {
    const items = step.items.slice();
    let placed = 0, correct = 0;
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">САНАТТАРҒА БӨЛ</div>
            <div class="lq">${step.q}</div>
            <div class="dc-wrap">
              <div class="dc-bins">
                ${step.bins.map(b=>`<div class="dc-bin" data-bin="${b.id}"><div class="dc-bin-t">${b.t}</div></div>`).join('')}
              </div>
              <div class="dc-pool" id="dcPool">
                ${items.map((it,i)=>`<div class="dc-chip" draggable="true" data-i="${i}" data-bin="${it.bin}">${it.txt}</div>`).join('')}
              </div>
            </div>
          </div>`;
        let dragEl=null;
        host.querySelectorAll('.dc-chip').forEach(c => {
          c.ondragstart = e => { dragEl=c; e.dataTransfer.effectAllowed='move'; };
          // touch fallback
          c.onclick = () => {
            // tap = move to first empty bin? Instead show prompt: select bin
            if (c.classList.contains('placed-ok')||c.classList.contains('placed-bad')) return;
            const bins = step.bins.map(b=>b.t).join(' / ');
            const wantId = c.dataset.bin;
            // Cycle through bins on tap
            const cur = c.dataset.try || -1;
            const next = (+cur + 1) % step.bins.length;
            c.dataset.try = next;
            const targetBin = step.bins[next];
            host.querySelector(`.dc-bin[data-bin="${targetBin.id}"]`).appendChild(c);
            handleDrop(c, targetBin.id);
          };
        });
        const handleDrop = (chip, binId) => {
          const ok = chip.dataset.bin === binId;
          chip.classList.remove('placed-ok','placed-bad');
          chip.classList.add(ok?'placed-ok':'placed-bad');
          chip.draggable = false;
          if (chip.dataset.counted!=='1'){ placed++; chip.dataset.counted='1'; if (ok) correct++; }
          (ok?Audio.correct:Audio.wrong)();
          if (placed >= items.length) Engine.checkBtnState();
        };
        host.querySelectorAll('.dc-bin').forEach(bin => {
          bin.ondragover = e => { e.preventDefault(); bin.classList.add('over'); };
          bin.ondragleave = () => bin.classList.remove('over');
          bin.ondrop = e => {
            e.preventDefault(); bin.classList.remove('over');
            if (!dragEl) return;
            bin.appendChild(dragEl);
            handleDrop(dragEl, bin.dataset.bin);
            dragEl=null;
          };
        });
      },
      hasAnswer:()=>placed >= items.length,
      check(){ return { ok: correct === items.length, partial: correct/items.length }; }
    };
  }

  // ---------- Slider budget (50/30/20) ----------
  function sliders(step) {
    let done=false;
    const items = step.items; // [{id,label,icon,target}]
    const colors = ['#22c55e','#f59e0b','#3b82f6','#8b5cf6','#ef4444'];
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">БЮДЖЕТ ЖОСПАРЛА</div>
            <div class="lq">${step.q}</div>
            <div class="lhint">${step.hint||'Жалпы 100% болуы керек'}</div>
            <div class="budget-piechart">
              <div class="pie-wrap"><svg class="pie-svg" viewBox="0 0 36 36" id="pieSvg"></svg></div>
              <div class="pie-legend" id="pieLeg"></div>
            </div>
            <div class="budget-sliders" id="bs"></div>
            <div class="lhint" id="bsSum"></div>
          </div>`;
        const bs = host.querySelector('#bs');
        items.forEach((it,i) => {
          const row = document.createElement('div'); row.className='bslider-row';
          row.innerHTML = `<span style="font-size:18px">${it.icon}</span>
            <span class="bslider-label">${it.label}</span>
            <input type="range" class="bslider" min="0" max="100" value="${it.target}" data-i="${i}">
            <span class="bslider-val" id="bv${i}">${it.target}%</span>`;
          bs.appendChild(row);
        });
        const update = () => {
          const vals = items.map((_,i)=>+host.querySelector(`.bslider[data-i="${i}"]`).value);
          const total = vals.reduce((a,b)=>a+b,0);
          const svg = host.querySelector('#pieSvg');
          let off=25; let segs='';
          vals.forEach((v,i)=>{
            if (v<=0) return;
            const dash = total>0 ? (v/total)*100 : 0;
            segs += `<circle cx="18" cy="18" r="15.9" fill="transparent" stroke="${colors[i%colors.length]}" stroke-width="6" stroke-dasharray="${dash} ${100-dash}" stroke-dashoffset="${off}"/>`;
            off = (off - dash + 100) % 100;
          });
          svg.innerHTML = segs;
          const leg = host.querySelector('#pieLeg');
          leg.innerHTML = items.map((it,i)=>`<div class="pie-leg-item"><span class="pie-leg-dot" style="background:${colors[i%colors.length]}"></span>${it.label}: ${vals[i]}%</div>`).join('');
          host.querySelector('#bsSum').textContent = `Жалпы: ${total}% ${total===100?'✅':'(100% болуы керек)'}`;
          vals.forEach((v,i)=>host.querySelector(`#bv${i}`).textContent = v+'%');
          State._tmpVals = vals;
          Engine.checkBtnState();
        };
        host.querySelectorAll('.bslider').forEach(s => s.oninput = update);
        update();
      },
      hasAnswer(){ const v=State._tmpVals||[]; return v.reduce((a,b)=>a+b,0)===100; },
      check(){
        done=true;
        const v=State._tmpVals||[];
        let total=0;
        v.forEach((val,i)=>{ total += Math.abs(val - items[i].target); });
        return { ok: total <= (step.tolerance||10), partial: Math.max(0, 1 - total/100) };
      }
    };
  }

  // ---------- Tap fast (good items in time window) ----------
  function tapFast(step) {
    let score=0, mistakes=0, done=false, t0;
    const dur = step.duration||15;
    return {
      render(host){
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">ЖЫЛДАМ ТАП</div>
            <div class="lq">${step.q}</div>
            <div class="lhint">${step.hint||'Тек қажет нәрсеге бас!'}</div>
            <div class="tap-stage" id="tapStage">▶ Бастау</div>
            <div class="tap-info"><span id="tapTime">${dur}s</span><span id="tapScore">0 ұпай</span></div>
          </div>`;
        const stage=host.querySelector('#tapStage');
        let timer, interval, current;
        const spawn=()=>{
          current = step.items[Math.floor(Math.random()*step.items.length)];
          stage.innerHTML = `<div style="text-align:center"><div style="font-size:60px">${current.em}</div><div style="font-size:14px;font-weight:800">${current.t}</div></div>`;
        };
        const start=()=>{
          let left=dur; t0=Date.now();
          host.querySelector('#tapTime').textContent=left+'s';
          spawn();
          stage.onclick=()=>{
            if (current.good){ score++; Audio.correct(); }
            else { mistakes++; Audio.wrong(); }
            host.querySelector('#tapScore').textContent=score+' ұпай';
            spawn();
          };
          timer=setInterval(()=>{
            left--; host.querySelector('#tapTime').textContent=left+'s';
            if (left<=0){ clearInterval(timer); stage.onclick=null; done=true; stage.innerHTML='⏱ Аяқталды'; Engine.checkBtnState(); }
          },1000);
        };
        stage.onclick = start;
      },
      hasAnswer:()=>done,
      check(){ const need = step.target||5; return { ok: score>=need && mistakes<=2, partial: Math.min(1, score/need) }; }
    };
  }

  // ---------- Simulator (multi-step decisions) ----------
  function sim(step) {
    let i=0; let stats={...(step.start||{money:1000,happy:50,stress:0})};
    const scenes = step.scenes;
    let done=false;
    return {
      render(host){
        const draw = () => {
          const s = scenes[i];
          host.innerHTML = `
            <div class="lcard">
              <div class="ltype">СИМУЛЯТОР · ${i+1}/${scenes.length}</div>
              <div class="lq">${step.q}</div>
              <div class="sim-stat">
                <div class="sim-stat-it"><div class="sim-stat-v">💵${stats.money}</div><div class="sim-stat-l">Қалта</div></div>
                <div class="sim-stat-it"><div class="sim-stat-v">😊${stats.happy}</div><div class="sim-stat-l">Көңіл</div></div>
                <div class="sim-stat-it"><div class="sim-stat-v">😰${stats.stress}</div><div class="sim-stat-l">Стресс</div></div>
              </div>
              <div class="sim-scene">
                <span class="sim-scene-em">${s.em}</span>
                <div class="sim-scene-t">${s.t}</div>
              </div>
              <div class="sim-actions">
                ${s.actions.map((a,j)=>`<button class="sim-act" data-j="${j}">${a.txt}</button>`).join('')}
              </div>
            </div>`;
          host.querySelectorAll('.sim-act').forEach(b => b.onclick = () => {
            const a = s.actions[+b.dataset.j];
            stats.money += a.effect.money||0;
            stats.happy = Math.max(0, Math.min(100, stats.happy + (a.effect.happy||0)));
            stats.stress = Math.max(0, Math.min(100, stats.stress + (a.effect.stress||0)));
            (a.effect.money>=0?Audio.correct:Audio.tap)();
            i++;
            if (i>=scenes.length){ done=true; Engine.checkBtnState(); host.querySelector('.sim-actions').innerHTML='<div class="lhint">Барлық оқиға аяқталды. Қорытынды көру үшін «Жалғастыру».</div>'; }
            else draw();
          });
        };
        draw();
      },
      hasAnswer:()=>done,
      check(){
        const ok = stats.money >= (step.goal?.money||0) && stats.happy >= (step.goal?.happy||30) && stats.stress <= (step.goal?.stress||70);
        return { ok, partial: ok?1:0.5 };
      }
    };
  }

  // ---------- Sort/order (tap in order) ----------
  function order(step) {
    let picked = [], done = false;
    return {
      render(host){
        const items = step.items.map((t,i)=>({t,i})).sort(()=>Math.random()-.5);
        host.innerHTML = `
          <div class="lcard">
            <div class="ltype">РЕТТЕР</div>
            <div class="lq">${step.q}</div>
            <div class="lhint">${step.hint||'Дұрыс ретпен бас'}</div>
            <div class="dsort-list" id="orderPicked"></div>
            <div style="height:8px"></div>
            <div class="dsort-list" id="orderPool">
              ${items.map(it=>`<button class="dsort-item" data-i="${it.i}"><span class="dsort-handle">▦</span><span>${it.t}</span></button>`).join('')}
            </div>
          </div>`;
        host.querySelectorAll('#orderPool .dsort-item').forEach(b => b.onclick = () => {
          picked.push(+b.dataset.i);
          const lbl = picked.length;
          b.querySelector('.dsort-handle').textContent = lbl;
          b.disabled = true; b.style.opacity = .5;
          Audio.tap();
          if (picked.length===step.items.length){ done=true; Engine.checkBtnState(); }
        });
      },
      hasAnswer:()=>done,
      check(){
        let correct=0; picked.forEach((v,idx)=>{ if (v===idx) correct++; });
        return { ok: correct===step.items.length, partial: correct/step.items.length };
      }
    };
  }

  const TYPES = { quiz, swipe, fill, match, dragCat, sliders, tapFast, sim, order };
  return { make: step => TYPES[step.type](step) };
})();

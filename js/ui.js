const UI = (() => {
  const screens = ['homeScreen','moduleScreen','lessonScreen','winScreen','profileScreen','shopScreen','achScreen','lbScreen'];
  const show = id => {
    screens.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const toast = (msg, type = '') => {
    const w = document.getElementById('toastWrap');
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
    w.appendChild(t);
    setTimeout(() => { t.style.opacity = 0; t.style.transform = 'translateY(-10px)'; }, 1800);
    setTimeout(() => t.remove(), 2200);
  };
  const modal = (html, autoClose = 0) => {
    const bg = document.getElementById('modalBg');
    document.getElementById('modal').innerHTML = html;
    bg.classList.add('on');
    bg.onclick = e => { if (e.target === bg) bg.classList.remove('on'); };
    if (autoClose) setTimeout(() => bg.classList.remove('on'), autoClose);
  };
  const closeModal = () => document.getElementById('modalBg').classList.remove('on');

  // confetti
  const canvas = () => document.getElementById('confettiCanvas');
  const confetti = (count = 80) => {
    const c = canvas(), ctx = c.getContext('2d');
    c.width = innerWidth; c.height = innerHeight;
    const parts = Array.from({length:count}, () => ({
      x: innerWidth/2, y: innerHeight/3,
      vx: (Math.random()-.5)*10, vy: -Math.random()*10-3,
      g: 0.3, r: 4+Math.random()*4,
      color: ['#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#f97316'][Math.floor(Math.random()*6)],
      rot: Math.random()*Math.PI, vr: (Math.random()-.5)*.3,
    }));
    let frame = 0;
    const loop = () => {
      frame++;
      ctx.clearRect(0,0,c.width,c.height);
      parts.forEach(p => {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*1.5);
        ctx.restore();
      });
      if (frame < 110) requestAnimationFrame(loop);
      else ctx.clearRect(0,0,c.width,c.height);
    };
    loop();
  };

  const renderHud = () => {
    const d = State.get();
    State.tickHp();
    const t = State.levelInfo();
    document.getElementById('lvlNum').textContent = t.lvl;
    document.getElementById('sNum').textContent = d.streak;
    document.getElementById('xpNum').textContent = d.xp;
    document.getElementById('hpNum').textContent = d.hp;
    document.getElementById('soundBtn').textContent = d.settings.sound ? '🔊' : '🔇';
    document.body.classList.toggle('dark', !!d.settings.dark);
  };

  return { show, toast, modal, closeModal, confetti, renderHud };
})();

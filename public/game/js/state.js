// Persistent state — single source of truth
const KEY = 'aqshalingo_v1';
const DEFAULT = {
  xp: 0, level: 1, hp: 5, hpMax: 5, hpRefillAt: 0,
  streak: 0, lastDay: null,
  completed: {},        // lessonId -> {stars, best}
  unlockedMods: ['budget'],
  achievements: {},     // id -> true
  dailyDone: null,      // YYYY-MM-DD
  dailyXp: 0,
  weeklyXp: 0, weekStart: null,
  settings: { dark: false, sound: true, avatar: '🦉' },
  unlockedAvatars: ['🦉'],
  totalLessons: 0,
};
const State = (() => {
  let data;
  const load = () => {
    try { data = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { data = { ...DEFAULT }; }
    data.settings = { ...DEFAULT.settings, ...(data.settings || {}) };
  };
  const save = () => localStorage.setItem(KEY, JSON.stringify(data));
  load();

  const xpForLevel = l => 100 + (l - 1) * 75;
  const totalLevels = () => {
    let lvl = 1, rem = data.xp;
    while (rem >= xpForLevel(lvl)) { rem -= xpForLevel(lvl); lvl++; }
    return { lvl, rem, need: xpForLevel(lvl) };
  };
  const rankOf = lvl => lvl < 3 ? 'Bronze' : lvl < 6 ? 'Silver' : lvl < 10 ? 'Gold' : lvl < 15 ? 'Platinum' : 'Diamond';

  // Daily streak update on any earned xp
  const touchDay = () => {
    const today = new Date().toISOString().slice(0,10);
    if (data.lastDay === today) return;
    const y = new Date(Date.now() - 86400000).toISOString().slice(0,10);
    data.streak = data.lastDay === y ? (data.streak + 1) : 1;
    data.lastDay = today;
    if (data.streak === 7) Achv.unlock('streak7');
    if (data.streak === 30) Achv.unlock('streak30');
  };

  const checkWeek = () => {
    const now = Date.now();
    if (!data.weekStart || now - data.weekStart > 7 * 86400000) {
      data.weekStart = now; data.weeklyXp = 0;
    }
  };

  // Heart auto-refill: 1 heart per 30 min
  const tickHp = () => {
    if (data.hp >= data.hpMax) { data.hpRefillAt = 0; return; }
    const now = Date.now();
    if (!data.hpRefillAt) data.hpRefillAt = now + 30 * 60 * 1000;
    while (data.hp < data.hpMax && now >= data.hpRefillAt) {
      data.hp++;
      data.hpRefillAt = data.hp < data.hpMax ? data.hpRefillAt + 30 * 60 * 1000 : 0;
    }
  };

  return {
    get: () => data,
    save,
    addXp(n) {
      data.xp += n;
      data.dailyXp += n;
      checkWeek(); data.weeklyXp += n;
      touchDay();
      const before = data.level;
      const t = totalLevels();
      if (t.lvl > before) {
        data.level = t.lvl;
        UI.toast(`🎉 Level ${t.lvl}!`, 'g');
        Audio.levelUp();
        // unlock module per level
        const mods = ['budget','saving','invest','credit','insure'];
        const idx = Math.min(t.lvl - 1, mods.length - 1);
        for (let i = 0; i <= idx; i++) if (!data.unlockedMods.includes(mods[i])) data.unlockedMods.push(mods[i]);
        if (t.lvl >= 3 && !data.unlockedAvatars.includes('🦊')) data.unlockedAvatars.push('🦊');
        if (t.lvl >= 5 && !data.unlockedAvatars.includes('🐯')) data.unlockedAvatars.push('🐯');
        if (t.lvl >= 8 && !data.unlockedAvatars.includes('🦁')) data.unlockedAvatars.push('🦁');
        if (t.lvl >= 12 && !data.unlockedAvatars.includes('🐲')) data.unlockedAvatars.push('🐲');
      } else {
        data.level = t.lvl;
      }
      save();
    },
    loseHp() {
      tickHp();
      if (data.hp > 0) { data.hp--; Audio.heart(); }
      if (data.hp === 0 && !data.hpRefillAt) data.hpRefillAt = Date.now() + 30 * 60 * 1000;
      save();
    },
    addHp(n) { tickHp(); data.hp = Math.min(data.hpMax, data.hp + n); save(); },
    tickHp() { tickHp(); save(); },
    completeLesson(id, stars, gained) {
      const prev = data.completed[id];
      if (!prev) data.totalLessons++;
      data.completed[id] = { stars: Math.max(stars, prev?.stars || 0), best: Math.max(gained, prev?.best || 0) };
      if (data.totalLessons === 1) Achv.unlock('first');
      if (data.totalLessons >= 10) Achv.unlock('learner10');
      save();
    },
    unlockMod(id) { if (!data.unlockedMods.includes(id)) { data.unlockedMods.push(id); save(); } },
    setSetting(k, v) { data.settings[k] = v; save(); },
    setAvatar(a) { if (data.unlockedAvatars.includes(a)) { data.settings.avatar = a; save(); } },
    levelInfo: totalLevels,
    rank: () => rankOf(totalLevels().lvl),
    reset() { data = { ...DEFAULT }; save(); },
  };
})();

const Achv = (() => {
  const LIST = [
    { id: 'first',   em: '🥇', t: 'Алғашқы жеңіс',    d: '1-ші сабақты аяқта' },
    { id: 'learner10', em: '🎓', t: 'Студент', d: '10 сабақ' },
    { id: 'streak7', em: '🔥', t: '7 күн streak',     d: 'Күн сайын ойна' },
    { id: 'streak30', em: '💎', t: '30 күн streak',   d: 'Шынайы дисциплина' },
    { id: 'perfect', em: '✨', t: 'Қатесіз',          d: 'Сабақты қатесіз тапсыр' },
    { id: 'speed',   em: '⚡', t: 'Жылдам',           d: '60 сек ішінде сабақ' },
    { id: 'combo5',  em: '🎯', t: '5x Combo',         d: '5 жауап қатарынан' },
    { id: 'budgetMaster', em: '💰', t: 'Бюджет-Master',d: 'Бюджет модулін бітір' },
    { id: 'saverPro', em: '🏦', t: 'Жинақшы',         d: 'Жинақ модулін бітір' },
    { id: 'investor', em: '📈', t: 'Инвестор',        d: 'Инвестиция модулін бітір' },
    { id: 'creditWise', em: '💳', t: 'Несие-білгір',  d: 'Несие модулін бітір' },
    { id: 'protected', em: '🛡️', t: 'Қорғаулы',      d: 'Сақтандыру модулін бітір' },
  ];
  return {
    list: () => LIST,
    unlock(id) {
      const d = State.get();
      if (d.achievements[id]) return;
      d.achievements[id] = true;
      State.save();
      const a = LIST.find(x => x.id === id);
      if (a) UI.toast(`🏆 ${a.t}!`, 'g');
    },
  };
})();

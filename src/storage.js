export const STORAGE_KEY = 'typing-kingdom-v1';
export const defaults = () => ({ version: 1, name: 'Player', character: 'Mario', settings: { duration: 120, goal: 5, group: 0, sound: false, mode: 'outdoor', guided: true, durations: { outdoor: 120, underwater: 300, castle: 300, practice: 600 } }, course: { group: 0, goal: 5, graduated: false, pending: null }, results: [], certificates: [] });
export function loadProfile(storage) {
  const base = defaults();
  try {
    const p = JSON.parse(storage.getItem(STORAGE_KEY));
    if (!p || p.version !== 1) return base;
    if (typeof p.name === 'string' && p.name.trim()) base.name = p.name.slice(0, 24);
    if (['Mario', 'Luigi', 'Princess'].includes(p.character)) base.character = p.character;
    for (const [key, min, max] of [['duration', 1, 3600], ['goal', 1, 150], ['group', 0, 5]]) {
      const value = p.settings?.[key];
      if (Number.isInteger(value) && value >= min && value <= max) base.settings[key] = value;
    }
    base.settings.sound = p.settings?.sound === true;
    base.settings.guided = p.settings?.guided !== false;
    if (Object.hasOwn(base.settings.durations, p.settings?.mode)) base.settings.mode = p.settings.mode;
    for (const mode of Object.keys(base.settings.durations)) {
      const n = p.settings?.durations?.[mode];
      if (Number.isInteger(n) && n >= 1 && n <= 3600) base.settings.durations[mode] = n;
    }
    const c = p.course;
    if (c && Number.isInteger(c.group) && c.group >= 0 && c.group <= 5 && Number.isInteger(c.goal) && c.goal >= 5 && c.goal <= 50 && c.goal % 5 === 0 && (c.group === 5 || c.goal === 5)) {
      base.course = { group: c.group, goal: c.goal, graduated: c.graduated === true && c.group === 5 && c.goal === 50, pending: c.pending === `${c.group}:${c.goal}` ? c.pending : null };
      if (base.course.graduated) base.course.pending = null;
    }
    if (Array.isArray(p.certificates)) base.certificates = p.certificates.filter(c => c && ['outdoor', 'underwater', 'graduation'].includes(c.kind) && typeof c.name === 'string' && typeof c.date === 'string').filter((c,i,a) => a.findIndex(x => x.kind === c.kind) === i);
    if (Array.isArray(p.results)) base.results = p.results.filter(r => r && typeof r.passed === 'boolean' && ['outdoor','underwater','castle','practice'].includes(r.mode) && Number.isInteger(r.group) && r.group >= 0 && r.group <= 5 && Number.isFinite(r.goal) && r.goal >= 1 && r.goal <= 150 && typeof r.date === 'string' && ['correct', 'errors', 'wpm', 'accuracy', 'duration'].every(k => Number.isFinite(r[k]) && r[k] >= 0) && Number.isInteger(r.correct) && Number.isInteger(r.errors) && r.accuracy <= 100 && r.duration >= 1 && r.duration <= 3600).slice(-50);
  } catch { /* Unavailable or corrupt storage starts a usable session. */ }
  return base;
}
export function saveProfile(profile, storage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(profile)); return true; } catch { return false; }
}

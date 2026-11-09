export const courseMode = course => course.goal < 10 ? 'outdoor' : course.goal < 30 ? 'underwater' : 'castle';
export const coursePosition = course => `${course.group}:${course.goal}`;
export function recordResult(profile, result, date) {
  profile.results.push({ ...result, date });
  profile.results = profile.results.slice(-50);
  const c = profile.course;
  if (!result.guided || !result.passed || c.graduated || result.group !== c.group || result.goal !== c.goal || result.mode !== courseMode(c)) return;
  if (c.group === 5 && c.goal === 50) {
    c.graduated = true;
    c.pending = null;
    earn(profile, 'graduation', date);
  } else c.pending = coursePosition(c);
}
function earn(profile, kind, date) {
  if (!profile.certificates.some(c => c.kind === kind)) profile.certificates.push({ kind, date, name: profile.name });
}
export function advanceCourse(profile, date) {
  const c = profile.course;
  if (c.graduated || c.pending !== coursePosition(c)) return false;
  const before = courseMode(c);
  if (c.group < 5) c.group++; else c.goal += 5;
  c.pending = null;
  if (before !== courseMode(c)) earn(profile, before, date);
  return true;
}

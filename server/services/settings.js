// 教师设置（掌握程度标签、达标线、分组标准等）——全部可由老师修改
import { one, q } from '../db.js';
import { HttpError } from '../http.js';

export const DEFAULT_SETTINGS = {
  school_name: '',
  teacher_name: '',
  subject: '数学',
  passing: 50,                 // 达标分数线（%）
  near_pass_band: 15,          // 冲刺及格组：达标线以下多少个百分点以内
  mastery_levels: [            // 掌握程度（从高到低）
    { label: '优秀', min: 85 },
    { label: '良好', min: 70 },
    { label: '达标', min: 50 },
    { label: '需加强', min: 0 },
  ],
  topic_good: 70,              // 知识点掌握良好（%）
  topic_weak: 50,              // 知识点需要加强（低于 %）
  struggling_percent: 50,      // 学习困难：总分低于（%）
  struggling_topic: 40,        // 或任何知识点低于（%）
  stage_pass: 60,              // 练习关卡过关所需首次答对率（%）
  assessment_questions: 10,    // 王者认证题数
  attempt_policy: 'latest',    // 多次评估时用于统计的记录：latest / best / first
  boss_timer_default: false,   // Boss 计时默认关闭
  boss_timer_seconds: 90,
};

export function mergeSettings(saved) {
  const s = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  s.mastery_levels = (Array.isArray(s.mastery_levels) && s.mastery_levels.length ? s.mastery_levels : DEFAULT_SETTINGS.mastery_levels)
    .map(l => ({ label: String(l.label).slice(0, 12), min: Number(l.min) }))
    .sort((a, b) => b.min - a.min);
  return s;
}

export async function getTeacherSettings(teacherId) {
  if (!teacherId) return mergeSettings({});
  const r = await one('SELECT settings FROM teacher_settings WHERE teacher_id = $1', [teacherId]);
  return mergeSettings(r?.settings);
}

export function validateSettings(input) {
  const s = mergeSettings(input);
  const pct = (v, name) => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, `${name}必须在 0 到 100 之间`); return Math.round(n); };
  s.passing = pct(s.passing, '达标线');
  s.near_pass_band = pct(s.near_pass_band, '冲刺及格范围');
  s.topic_good = pct(s.topic_good, '知识点掌握良好标准');
  s.topic_weak = pct(s.topic_weak, '知识点需要加强标准');
  s.struggling_percent = pct(s.struggling_percent, '学习困难总分标准');
  s.struggling_topic = pct(s.struggling_topic, '学习困难知识点标准');
  s.stage_pass = pct(s.stage_pass, '关卡过关标准');
  s.assessment_questions = Math.max(4, Math.min(30, Math.round(Number(s.assessment_questions) || 10)));
  s.boss_timer_seconds = Math.max(30, Math.min(600, Math.round(Number(s.boss_timer_seconds) || 90)));
  s.boss_timer_default = !!s.boss_timer_default;
  if (!['latest', 'best', 'first'].includes(s.attempt_policy)) s.attempt_policy = 'latest';
  if (s.topic_weak > s.topic_good) throw new HttpError(400, '“需要加强”的标准不能高于“掌握良好”的标准');
  for (const l of s.mastery_levels) {
    if (!l.label) throw new HttpError(400, '掌握程度名称不能空白');
    l.min = pct(l.min, '掌握程度分数线');
  }
  if (!s.mastery_levels.some(l => l.min === 0)) throw new HttpError(400, '最低一级的掌握程度分数线必须是 0');
  s.school_name = String(s.school_name || '').slice(0, 80);
  s.teacher_name = String(s.teacher_name || '').slice(0, 40);
  s.subject = String(s.subject || '数学').slice(0, 20);
  return s;
}

export async function saveTeacherSettings(teacherId, input) {
  const s = validateSettings(input);
  await q(`INSERT INTO teacher_settings (teacher_id, settings, updated_at) VALUES ($1, $2, now())
    ON CONFLICT (teacher_id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`, [teacherId, s]);
  return s;
}

export function masteryLabel(pct, settings) {
  for (const l of settings.mastery_levels) if (pct >= l.min) return l.label;
  return settings.mastery_levels[settings.mastery_levels.length - 1].label;
}

export function topicLabel(pct, settings) {
  if (pct >= settings.topic_good) return '掌握良好';
  if (pct < settings.topic_weak) return '需要加强';
  return '基本掌握';
}

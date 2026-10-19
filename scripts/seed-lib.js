// 载入课本单元、知识点与题库（只载入通过验证的题目）
import { readFileSync } from 'node:fs';
import { tx } from '../server/db.js';
import { verifyQuestion } from '../server/verify.js';
import { invalidateBank } from '../server/services/questions.js';

export async function seedContent({ force = false } = {}) {
  const bank = JSON.parse(readFileSync(new URL('../content/questions.json', import.meta.url)));
  let added = 0, updated = 0, rejected = [];
  await tx(async (c) => {
    for (const u of bank.units) {
      await c.q(`INSERT INTO units (id, code, title, description, objectives, sort) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET code = $2, title = $3, description = $4, objectives = $5`, [u.id, u.code, u.title, u.description, JSON.stringify(u.objectives || []), u.sort]);
    }
    for (const s of bank.subtopics) {
      await c.q(`INSERT INTO subtopics (id, unit_id, code, title, objectives, sort) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET code = $3, title = $4, objectives = $5, sort = $6`, [s.id, s.unit_id, s.code, s.title, JSON.stringify(s.objectives || []), s.sort]);
    }
    for (const qd of bank.questions) {
      const errs = verifyQuestion(qd);
      if (errs.length) { rejected.push(`${qd.id}: ${errs.join('；')}`); continue; }
      const { id, unit_id, subtopic_id, difficulty, qtype, stages, marks, source, is_textbook, ...data } = qd;
      const r = await c.one(`INSERT INTO questions (id, unit_id, subtopic_id, difficulty, qtype, stages, data, marks, source, is_textbook, verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        ON CONFLICT (id) DO ${force ? `UPDATE SET unit_id = $2, subtopic_id = $3, difficulty = $4, qtype = $5, stages = $6, data = $7, marks = $8, source = $9, is_textbook = $10, verified = true, updated_at = now()` : 'NOTHING'}
        RETURNING (xmax = 0) AS inserted`, [id, unit_id, subtopic_id, difficulty, qtype, stages, data, marks, source, !!is_textbook]);
      if (r?.inserted) added++; else if (r) updated++;
    }
  });
  invalidateBank();
  return { added, updated, rejected };
}

-- 数学冒险王 数据库结构（PostgreSQL 14+，兼容 Neon）

CREATE TABLE IF NOT EXISTS teachers (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
  token_version INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_settings (
  teacher_id INT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  teacher_id  INT REFERENCES teachers(id) ON DELETE SET NULL,
  school_name TEXT,
  is_demo     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id           SERIAL PRIMARY KEY,
  class_id     INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  pupil_no     TEXT,
  pin_hash     TEXT,
  source       TEXT NOT NULL DEFAULT 'roster' CHECK (source IN ('roster', 'self')),
  is_demo      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS students_class_name_no ON students (class_id, name, COALESCE(pupil_no, ''));

CREATE TABLE IF NOT EXISTS student_sessions (
  id         SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS units (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  objectives  JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort        INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS subtopics (
  id         TEXT PRIMARY KEY,
  unit_id    TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,
  title      TEXT NOT NULL,
  objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS questions (
  id          TEXT PRIMARY KEY,
  unit_id     TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  subtopic_id TEXT NOT NULL REFERENCES subtopics(id) ON DELETE CASCADE,
  difficulty  INT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  qtype       TEXT NOT NULL CHECK (qtype IN ('number', 'remainder', 'steps', 'mcq', 'order')),
  stages      INT[] NOT NULL DEFAULT '{3}',
  data        JSONB NOT NULL,         -- 题目全部内容（题干、答案、解题步骤、提示等）
  marks       INT NOT NULL DEFAULT 1,
  source      TEXT,
  is_textbook BOOLEAN NOT NULL DEFAULT false,
  verified    BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  INT REFERENCES teachers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS questions_unit ON questions (unit_id, subtopic_id);

-- 闯关进度（每个学生每个单元一行）
CREATE TABLE IF NOT EXISTS progress (
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id    TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,
  xp         INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, unit_id)
);

-- 每一次进入练习关卡
CREATE TABLE IF NOT EXISTS stage_runs (
  id                UUID PRIMARY KEY,
  student_id        INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id           TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  stage             INT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'stage' CHECK (kind IN ('stage', 'remedial', 'bonus', 'quiz')),
  question_ids      TEXT[] NOT NULL DEFAULT '{}',
  base_count        INT NOT NULL DEFAULT 0,      -- 原本选出的题数（之后插入的补救题不算）
  quiz_id           INT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at       TIMESTAMPTZ,
  active_seconds    INT NOT NULL DEFAULT 0,
  passed            BOOLEAN,
  first_try_correct INT,
  total             INT,
  stars             INT
);
CREATE INDEX IF NOT EXISTS stage_runs_student ON stage_runs (student_id, unit_id);

-- 每一次作答（练习与正式评估都记录）
CREATE TABLE IF NOT EXISTS attempts (
  id                 BIGSERIAL PRIMARY KEY,
  student_id         INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  run_id             UUID,
  assessment_id      INT,
  question_id        TEXT NOT NULL,
  unit_id            TEXT NOT NULL,
  subtopic_id        TEXT,
  stage              INT,
  mode               TEXT NOT NULL CHECK (mode IN ('practice', 'formal')),
  response           JSONB NOT NULL,
  correct            BOOLEAN NOT NULL,
  marks_awarded      NUMERIC NOT NULL DEFAULT 0,
  max_marks          NUMERIC NOT NULL DEFAULT 0,
  try_no             INT NOT NULL DEFAULT 1,
  hints_used         INT NOT NULL DEFAULT 0,
  misconception_code TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attempts_student ON attempts (student_id, unit_id);
CREATE INDEX IF NOT EXISTS attempts_run ON attempts (run_id);

-- 老师布置的小测 / 复习活动
CREATE TABLE IF NOT EXISTS quizzes (
  id           SERIAL PRIMARY KEY,
  teacher_id   INT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  class_id     INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_id      TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  question_ids TEXT[] NOT NULL,
  mode         TEXT NOT NULL CHECK (mode IN ('practice', 'formal')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 正式评估场次（题目由服务器指定，提交以场次为单位，防止重复提交）
CREATE TABLE IF NOT EXISTS assessment_sessions (
  id             UUID PRIMARY KEY,
  student_id     INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id        TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quiz_id        INT REFERENCES quizzes(id) ON DELETE SET NULL,
  question_ids   TEXT[] NOT NULL,
  draft          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'abandoned')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessment_id  INT
);
CREATE INDEX IF NOT EXISTS assessment_sessions_student ON assessment_sessions (student_id, status);

CREATE TABLE IF NOT EXISTS assessments (
  id              SERIAL PRIMARY KEY,
  session_id      UUID NOT NULL UNIQUE REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  student_id      INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  unit_id         TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  quiz_id         INT REFERENCES quizzes(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  attempt_no      INT NOT NULL DEFAULT 1,
  started_at      TIMESTAMPTZ NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_sec    INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL,
  correct_count   INT NOT NULL,
  score           NUMERIC NOT NULL,
  max_score       NUMERIC NOT NULL,
  percentage      NUMERIC NOT NULL,
  result          JSONB NOT NULL,       -- 每题明细
  practice        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- 练习记录摘要（提示、重答、关卡）
  teacher_comment TEXT,
  is_demo         BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS assessments_class ON assessments (class_id, unit_id, submitted_at);

CREATE TABLE IF NOT EXISTS class_report_notes (
  id         SERIAL PRIMARY KEY,
  class_id   INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  notes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, report_key)
);

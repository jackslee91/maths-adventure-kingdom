# 数学冒险王：四年级数学闯关挑战

马来西亚 SJKC 四年级数学（KSSR Semakan）互动教学、闯关练习与学习评估平台。全部界面为简体中文。

当前内容：**单元 1.7 混合运算**（课本第 23 页 1.7.1 加减混合运算、第 29 页 1.7.2 乘除混合运算），98 道逐题验算的题目。

## 功能
- **教师教学模式**：课本格式的逐步竖式演示（进位、退位划去、部分积、长除法商中间的 0）、常见错误示范、再试一道、课堂小测、倒数计时、全屏，适合白板与 Google Meet。
- **学生闯关**：冒险地图六关——启航站、训练营、独立挑战、数学迷宫、终极 Boss、王者认证；提示、两次答错后的分步讲解与简单题、补救小站、宝箱挑战、徽章、经验值、音效与背景音乐。
- **服务器批改**：确定性规则、等值写法、单位、部分分（两步题、余数题）、依实际答案判断错误类型。
- **正式评估**：服务器指定题目、自动保存草稿、断线可重新提交、同一场次重复提交只算一次，后端确认后才显示“提交成功”。
- **教师管理中心**：学习记录、班级统计、知识点分析、学习困难名单、补救建议、题库管理（输入算式自动建题并验算）、小测与复习活动、名单管理、可调整的标准。
- **报告**：A4 中文 PDF（服务器生成、嵌入字体）——个人报告、全班分析报告、全班个人报告汇总、ZIP；CSV 与 Excel 导出；网页预览与打印。

## 快速开始
请看 [docs/部署说明.md](docs/部署说明.md)。本机：
```bash
cp .env.example .env   # 填写 DATABASE_URL、SESSION_SECRET、ADMIN_USERNAME、ADMIN_PASSWORD
npm start              # 第一次启动会自动建表、载入题库、建立管理员
```
不需要 `npm install`：服务器只使用 Node.js 22 内置模块（包括自带的 PostgreSQL 客户端与 PDF 生成器）。

## 文件
- `docs/01_课程分析与教学大纲.md` 第一阶段课本分析
- `docs/教师使用指南.md`、`docs/学生使用指南.md`
- `docs/美术素材指南.md` 上传卡通图片的文件夹、文件名、尺寸与画图提示（素材放在 `public/assets/`，清单在 `public/js/assets/manifest.js`）
- `db/migrations/001_init.sql` 数据库结构
- `content/questions.json` 题库（由 `content/generate-questions.js` 生成，`npm run verify` 验证）
- `tests/` 单元测试、API 安全测试、学生端完整流程测试

## 授权
`server/fonts/` 中的 Noto Sans SC 字体采用 SIL Open Font License（见 `LICENSE-NotoSansCJK.txt`）。

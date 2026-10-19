// =====================================================================
// 美术素材清单（统一的素材路径配置）
// ---------------------------------------------------------------------
// 每一个素材都有一个“代号”（例如 'char.boy.idle'），程序只用代号，
// 实际文件放在 public/assets/<folder>/<name>.<扩展名>。
// 扩展名会自动寻找：图片 webp → png → jpg；音效 mp3 → ogg → m4a。
// 想换图片：直接用同名文件覆盖即可，不必修改程序。
// 想换文件名：只修改这里的 name。
// 没有上传的素材会自动使用程序画的备用图案（fallback）。
// 注意：图片里不要有文字，所有文字由程序显示。
// =====================================================================

/**
 * 字段说明
 *  folder   文件夹（backgrounds / characters / maps / ui / enemies / effects / audio）
 *  name     文件名（不含扩展名）
 *  label    中文名称（素材检查页显示）
 *  size     建议尺寸（宽×高，像素）
 *  alpha    是否需要透明背景
 *  use      用在哪里
 *  anim     默认动画（见 public/css/assets.css）
 *  slice    九宫格切片像素（按钮、面板等可拉伸的 UI 图片）
 *  fallback 未上传时的备用图案代号（由 public/js/assets/index.js 绘制）
 */
const IMG = ['webp', 'png', 'jpg', 'jpeg'];
const PNG = ['webp', 'png'];
const AUD = ['mp3', 'ogg', 'm4a'];

export const ASSETS = {
  // ---------------- backgrounds/ 背景（不透明，1920×1080，WebP 或 JPG）
  'bg.home': { folder: 'backgrounds', name: 'home-bg', label: '首页背景', size: '1920×1080', alpha: false, ext: IMG, use: '首页：天空、远山、城堡、草地（不要人物与文字）', fallback: 'scene.home' },
  'bg.login': { folder: 'backgrounds', name: 'login-bg', label: '学生登记背景', size: '1920×1080', alpha: false, ext: IMG, use: '学生登记页（没有时使用首页背景）', fallback: 'bg.home' },
  'bg.hub': { folder: 'backgrounds', name: 'hub-bg', label: '背包 / 关卡选择背景', size: '1920×1080', alpha: false, ext: IMG, use: '学生主页、冒险地图页的外围背景（没有时使用首页背景）', fallback: 'bg.home' },
  'bg.play': { folder: 'backgrounds', name: 'play-bg', label: '答题背景（第 1–3 关）', size: '1920×1080', alpha: false, ext: IMG, use: '启航站、训练营、独立挑战区、补救小站', fallback: 'css' },
  'bg.maze': { folder: 'backgrounds', name: 'maze-bg', label: '数学迷宫背景', size: '1920×1080', alpha: false, ext: IMG, use: '第四关：紫色石洞、火把、石阶（不要门和宝箱，门与宝箱另外上传）', fallback: 'scene.maze' },
  'bg.boss': { folder: 'backgrounds', name: 'boss-bg', label: '终极 Boss 背景', size: '1920×1080', alpha: false, ext: IMG, use: '第五关：熔岩、火山、红色天空（不要怪兽，怪兽另外上传）', fallback: 'scene.boss' },
  'bg.exam': { folder: 'backgrounds', name: 'exam-bg', label: '王者认证背景', size: '1920×1080', alpha: false, ext: IMG, use: '第六关：金色城堡大厅或王座（没有时使用首页背景）', fallback: 'bg.home' },
  'bg.victory': { folder: 'backgrounds', name: 'victory-bg', label: '完成关卡背景', size: '1920×1080', alpha: false, ext: IMG, use: '过关、完成认证的庆祝画面（没有时使用首页背景）', fallback: 'bg.home' },

  // ---------------- characters/ 人物（透明背景 PNG/WebP）
  // 勇者（男生冒险家）：依游戏状态切换动作。没有的动作会沿 fallback 改用相近的图片。
  'char.boy.idle': { folder: 'characters', name: 'hero-idle', label: '勇者：站立', size: '660×880（3:4）', alpha: true, ext: PNG, use: '首页、地图、等待作答', anim: 'anim-breathe', fallback: 'kid.boy.stand' },
  'char.boy.run': { folder: 'characters', name: 'hero-run', label: '勇者：奔跑', size: '660×880（3:4）', alpha: true, ext: PNG, use: '地图上走向下一座岛、迷宫里前进', anim: 'anim-run', fallback: 'char.boy.idle' },
  'char.boy.jump': { folder: 'characters', name: 'hero-jump', label: '勇者：跳跃', size: '660×880（3:4）', alpha: true, ext: PNG, use: '答对时', anim: 'anim-jump', fallback: 'char.boy.cheer' },
  'char.boy.cheer': { folder: 'characters', name: 'hero-happy', label: '勇者：开心', size: '660×880（3:4）', alpha: true, ext: PNG, use: '过关、开宝箱', anim: 'anim-bounce', fallback: 'char.boy.idle' },
  'char.boy.think': { folder: 'characters', name: 'hero-thinking', label: '勇者：思考', size: '660×880（3:4）', alpha: true, ext: PNG, use: '第一次答错、看提示、补救小站', anim: 'anim-sway', fallback: 'char.boy.idle' },
  'char.boy.hurt': { folder: 'characters', name: 'hero-hurt', label: '勇者：受伤', size: '660×880（3:4）', alpha: true, ext: PNG, use: '两次答错、Boss 反击（不扣分，只是动画）', anim: 'anim-shake', fallback: 'char.boy.think' },
  'char.boy.attack': { folder: 'characters', name: 'hero-attack', label: '勇者：攻击', size: '660×880（3:4）', alpha: true, ext: PNG, use: 'Boss 战答对时（没有就用跳跃图）', anim: 'anim-attack', fallback: 'char.boy.jump' },
  'char.boy.win': { folder: 'characters', name: 'hero-win', label: '勇者：胜利', size: '660×880（3:4）', alpha: true, ext: PNG, use: '打败 Boss、完成王者认证', anim: 'anim-bounce', fallback: 'char.boy.cheer' },
  'char.girl.idle': { folder: 'characters', name: 'girl-idle', label: '女生冒险家：站立', size: '660×880（3:4）', alpha: true, ext: PNG, use: '首页、登记页；学生选择女生时的主角', anim: 'anim-breathe', fallback: 'kid.girl.stand' },
  'char.girl.cheer': { folder: 'characters', name: 'girl-cheer', label: '女生冒险家：欢呼', size: '660×880（3:4）', alpha: true, ext: PNG, use: '过关、开宝箱', anim: 'anim-bounce', fallback: 'char.girl.idle' },
  'char.girl.run': { folder: 'characters', name: 'girl-run', label: '女生冒险家：奔跑', size: '660×880（3:4）', alpha: true, ext: PNG, use: '地图、迷宫里移动', anim: 'anim-run', fallback: 'char.girl.idle' },
  'char.girl.jump': { folder: 'characters', name: 'girl-jump', label: '女生冒险家：跳跃', size: '660×880（3:4）', alpha: true, ext: PNG, use: '答对时', anim: 'anim-jump', fallback: 'char.girl.cheer' },
  'char.girl.think': { folder: 'characters', name: 'girl-thinking', label: '女生冒险家：思考', size: '660×880（3:4）', alpha: true, ext: PNG, use: '第一次答错、看提示', anim: 'anim-sway', fallback: 'char.girl.idle' },
  'char.girl.hurt': { folder: 'characters', name: 'girl-hurt', label: '女生冒险家：被击退', size: '660×880（3:4）', alpha: true, ext: PNG, use: '两次答错、Boss 反击（不扣分）', anim: 'anim-shake', fallback: 'char.girl.think' },
  'char.girl.attack': { folder: 'characters', name: 'girl-attack', label: '女生冒险家：攻击', size: '660×880（3:4）', alpha: true, ext: PNG, use: 'Boss 战答对时', anim: 'anim-attack', fallback: 'char.girl.jump' },
  'char.girl.win': { folder: 'characters', name: 'girl-win', label: '女生冒险家：胜利', size: '660×880（3:4）', alpha: true, ext: PNG, use: '打败 Boss、完成认证', anim: 'anim-bounce', fallback: 'char.girl.cheer' },
  // 向导阿算（魔法猫）
  'char.mascot.idle': { folder: 'characters', name: 'magic-cat', label: '向导阿算（魔法猫）：一般', size: '600×600', alpha: true, ext: PNG, use: '讲解、提示泡泡旁边', anim: 'anim-bob', fallback: 'mascot.happy' },
  'char.mascot.happy': { folder: 'characters', name: 'magic-cat-happy', label: '向导阿算：开心', size: '600×600', alpha: true, ext: PNG, use: '答对、称赞', anim: 'anim-bounce', fallback: 'char.mascot.idle' },
  'char.mascot.hint': { folder: 'characters', name: 'magic-cat-hint', label: '向导阿算：给提示', size: '600×600', alpha: true, ext: PNG, use: '按“获取提示”时、答错后的讲解', anim: 'anim-bob', fallback: 'char.mascot.idle' },
  'char.mascot.point': { folder: 'characters', name: 'magic-cat-pointing', label: '向导阿算：指方向', size: '600×600', alpha: true, ext: PNG, use: '地图上指引下一关', anim: 'anim-bob', fallback: 'char.mascot.idle' },
  'char.mascot.wow': { folder: 'characters', name: 'magic-cat-wow', label: '向导阿算：惊喜（选用）', size: '600×600', alpha: true, ext: PNG, use: '过关、获得徽章（没有就用开心图）', anim: 'anim-pop', fallback: 'char.mascot.happy' },
  'char.mascot.sad': { folder: 'characters', name: 'magic-cat-sad', label: '向导阿算：鼓励（选用）', size: '600×600', alpha: true, ext: PNG, use: '答错时安慰（没有就用给提示图）', anim: 'anim-sway', fallback: 'char.mascot.hint' },
  'char.teacher': { folder: 'characters', name: 'teacher', label: '老师（选用）', size: '600×800', alpha: true, ext: PNG, use: '教师教学模式', anim: 'anim-breathe', fallback: 'teacher' },
  'char.avatar.boy': { folder: 'characters', name: 'avatar-boy', label: '头像（选用）', size: '256×256', alpha: true, ext: PNG, use: '顶栏的玩家头像；没有时自动截取勇者站立图的头部', fallback: 'kid.boy.head' },
  'char.avatar.girl': { folder: 'characters', name: 'avatar-girl', label: '头像：女生（选用）', size: '256×256', alpha: true, ext: PNG, use: '备用头像', fallback: 'char.avatar.boy' },

  // ---------------- enemies/ 怪兽（透明背景）
  // 四种状态各一张图；缺少的状态会改用一般图，再由程序加上闪光、红光、变暗等效果。
  // 图片比例可以不同（3:4 或正方形），程序会放进同样大小的正方形框里、底部对齐，切换时不会忽大忽小。
  'enemy.boss.idle': { folder: 'enemies', name: 'boss-monster', label: '混乱魔王：一般', size: '750×1000（3:4）或正方形', alpha: true, ext: PNG, use: '第五关 Boss', anim: 'anim-hover', fallback: 'boss.idle' },
  'enemy.boss.hurt': { folder: 'enemies', name: 'boss-hurt', label: '混乱魔王：受伤', size: '1254×1254（正方形）', alpha: true, ext: PNG, use: '学生答对、攻击命中时', anim: 'anim-shake', fallback: 'enemy.boss.idle' },
  'enemy.boss.attack': { folder: 'enemies', name: 'boss-attack', label: '混乱魔王：反击', size: '1254×1254（正方形）', alpha: true, ext: PNG, use: '学生答错时（不会扣分，只有护盾效果）', anim: 'anim-lunge-left', fallback: 'enemy.boss.idle' },
  'enemy.boss.defeated': { folder: 'enemies', name: 'boss-defeated', label: '混乱魔王：被打败', size: '1254×1254（正方形）', alpha: true, ext: PNG, use: '打败 Boss 时', anim: 'anim-slump', fallback: 'enemy.boss.hurt' },

  // ---------------- maps/ 冒险地图
  'map.background': { folder: 'maps', name: 'adventure-map', label: '冒险地图（整张）', size: '1672×941 或 1920×1080（16:9）', alpha: false, ext: IMG, use: '地图底图：海洋与木桥。可以连岛屿一起画，也可以只画海洋再分别上传六座岛。不要文字与数字', fallback: 'map.svg' },
  'map.island.1': { folder: 'maps', name: 'island-1-start', label: '岛屿 1：数学启航站', size: '640×520', alpha: true, ext: PNG, use: '绿色小岛、灯塔、帆船', anim: 'anim-float', fallback: 'none' },
  'map.island.2': { folder: 'maps', name: 'island-2-training', label: '岛屿 2：解题训练营', size: '640×520', alpha: true, ext: PNG, use: '沙地、帐篷、旗子', anim: 'anim-float', fallback: 'none' },
  'map.island.3': { folder: 'maps', name: 'island-3-challenge', label: '岛屿 3：独立挑战区', size: '640×520', alpha: true, ext: PNG, use: '蓝色塔楼、冰晶', anim: 'anim-float', fallback: 'none' },
  'map.island.4': { folder: 'maps', name: 'island-4-maze', label: '岛屿 4：数学迷宫', size: '640×520', alpha: true, ext: PNG, use: '紫色城堡', anim: 'anim-float', fallback: 'none' },
  'map.island.5': { folder: 'maps', name: 'island-5-boss', label: '岛屿 5：终极 Boss', size: '640×520', alpha: true, ext: PNG, use: '火山、熔岩', anim: 'anim-float', fallback: 'none' },
  'map.island.6': { folder: 'maps', name: 'island-6-king', label: '岛屿 6：王者认证', size: '640×520', alpha: true, ext: PNG, use: '金色城堡、皇冠', anim: 'anim-float', fallback: 'none' },

  // ---------------- ui/ 按钮、面板、道具（透明背景；按钮与面板会以九宫格方式拉伸，文字由程序加上）
  'ui.title-plank': { folder: 'ui', name: 'title-plank', label: '标题木牌（空白）', size: '1200×360', alpha: true, ext: PNG, slice: 90, use: '首页“数学冒险王”标题底板，不要文字', fallback: 'css' },
  'ui.question-panel': { folder: 'ui', name: 'question-panel', label: '答题面板（空白，含答案栏）', size: '1448×1086', alpha: true, ext: PNG, use: '题目卡：外框由程序切成“面板”与“答案栏”两部分，题目和答案框由程序显示', fallback: 'ui.panel-parchment',
    // 切图位置（原图像素）：换了不同样式的面板图，只要修改这里
    cut: {
      base: [1448, 1086],
      keep: [[0, 712], [830, 1086]],                     // 保留的横条：上半部 + 下缘（去掉答案栏）
      patches: [                                         // [目标区域, 来源区域]（接好后的坐标）
        [[150, 712, 1150, 64], [150, 560, 1150, 64]],    // 答案栏留下的空位补上纸面
        [[470, 0, 510, 250], [990, 0, 70, 250]],         // 上方宝石装饰位置补上木条
        [[510, 782, 390, 186], [300, 782, 200, 186]],    // 下方宝石装饰位置补上木条
      ],
      frameSlice: [250, 180, 275, 180],                  // 外框九宫格（上 右 下 左）
      ornTop: [470, 0, 510, 250], ornBottom: [510, 900, 390, 186],   // 宝石装饰：以原比例叠加，不会被拉长
      bar: [170, 720, 1108, 174], barSlice: [40, 100, 40, 100],     // 答案栏
    } },
  'ui.popup-panel': { folder: 'ui', name: 'popup-panel', label: '弹出面板（空白）', size: '1448×1086（4:3）', alpha: true, ext: PNG, skin: 'stretch', use: '宝箱奖励等弹出视窗（整张显示，不拉伸变形）', fallback: 'css' },
  'ui.panel-parchment': { folder: 'ui', name: 'panel-parchment', label: '羊皮纸面板（空白，选用）', size: '800×600', alpha: true, ext: PNG, slice: 70, use: '题目卡、说明卡等面板，四角装饰会保留、中间拉伸', fallback: 'css' },
  'ui.sign-wood': { folder: 'ui', name: 'sign-wood', label: '小木牌（空白）', size: '600×180', alpha: true, ext: PNG, slice: 50, use: '关卡名称牌，例如“第 3 关：独立挑战区”', fallback: 'css' },
  'ui.ribbon-green': { folder: 'ui', name: 'ribbon-green', label: '绿色彩带（空白）', size: '1000×240', alpha: true, ext: PNG, slice: 110, use: '“答对了！”横幅', fallback: 'css' },
  'ui.ribbon-red': { folder: 'ui', name: 'ribbon-red', label: '红色彩带（空白）', size: '1000×240', alpha: true, ext: PNG, slice: 110, use: '“恭喜你！”横幅、关卡标题', fallback: 'css' },
  'ui.btn-orange': { folder: 'ui', name: 'button-primary', label: '主要按钮（金色，空白）', size: '2172×724（3:1）', alpha: true, ext: PNG, skin: 'stretch', use: '主要大按钮，例如“开始闯关”“继续”（整张拉伸，文字由程序显示）', fallback: 'css' },
  'ui.btn-green': { folder: 'ui', name: 'btn-green', label: '绿色按钮（空白）', size: '480×140', alpha: true, ext: PNG, slice: 56, use: '“提交答案”“确定”', fallback: 'css' },
  'ui.btn-blue': { folder: 'ui', name: 'button-secondary', label: '次要按钮（蓝色，空白）', size: '2172×724（3:1）', alpha: true, ext: PNG, skin: 'stretch', use: '次要大按钮，例如“获取提示”（整张拉伸）', fallback: 'css' },
  'ui.btn-purple': { folder: 'ui', name: 'btn-purple', label: '紫色按钮（空白）', size: '480×140', alpha: true, ext: PNG, slice: 56, use: '“获取提示”“补救小站”', fallback: 'css' },
  'ui.btn-red': { folder: 'ui', name: 'btn-red', label: '红色按钮（空白）', size: '480×140', alpha: true, ext: PNG, slice: 56, use: '“攻击”', fallback: 'css' },
  'ui.btn-wood': { folder: 'ui', name: 'btn-wood', label: '木头按钮（空白）', size: '480×140', alpha: true, ext: PNG, slice: 56, use: '“返回地图”', fallback: 'css' },
  'ui.key': { folder: 'ui', name: 'keypad-key', label: '数字键（空白）', size: '160×160', alpha: true, ext: PNG, slice: 40, use: '屏幕数字键盘的按键底图，数字由程序显示', fallback: 'css' },
  'ui.chest.closed': { folder: 'ui', name: 'treasure-chest', label: '宝箱', size: '600×600', alpha: true, ext: PNG, use: '宝箱挑战、迷宫出口', anim: 'anim-wiggle', fallback: 'chest.closed' },
  'ui.chest.open': { folder: 'ui', name: 'treasure-chest-open', label: '宝箱：打开（选用）', size: '600×600', alpha: true, ext: PNG, use: '打开宝箱时（没有就用宝箱图加上发光效果）', anim: 'anim-pop', fallback: 'ui.chest.closed' },
  'ui.door.closed': { folder: 'ui', name: 'door-closed', label: '迷宫门：关闭', size: '300×400', alpha: true, ext: PNG, use: '迷宫的密码门、岔路门（门上的字母由程序显示）', fallback: 'door.closed' },
  'ui.door.open': { folder: 'ui', name: 'door-open', label: '迷宫门：打开', size: '300×400', alpha: true, ext: PNG, use: '答对后打开的门', fallback: 'door.open' },
  'ui.key-item': { folder: 'ui', name: 'key-item', label: '钥匙', size: '256×128', alpha: true, ext: PNG, use: '迷宫钥匙房', anim: 'anim-spin-y', fallback: 'key' },
  'ui.star.full': { folder: 'ui', name: 'star-icon', label: '星星', size: '256×256', alpha: true, ext: PNG, use: '关卡星级', fallback: 'none' },
  'ui.star.empty': { folder: 'ui', name: 'star-empty', label: '星星（暗，选用）', size: '256×256', alpha: true, ext: PNG, use: '关卡星级（没有就把星星图变暗）', fallback: 'none' },
  'ui.heart.full': { folder: 'ui', name: 'heart-full', label: '护盾 / 爱心（满）', size: '128×128', alpha: true, ext: PNG, use: 'Boss 战护盾', fallback: 'none' },
  'ui.heart.empty': { folder: 'ui', name: 'heart-empty', label: '护盾 / 爱心（空）', size: '128×128', alpha: true, ext: PNG, use: 'Boss 战护盾', fallback: 'none' },
  'ui.coin': { folder: 'ui', name: 'coin', label: '金币', size: '128×128', alpha: true, ext: PNG, use: '经验值图标', fallback: 'none' },
  'ui.medal': { folder: 'ui', name: 'medal-king', label: '数学王者奖牌（缎带空白）', size: '512×560', alpha: true, ext: PNG, use: '完成认证且达到优秀时；“数学王者”字样由程序显示', anim: 'anim-pop', fallback: 'medal' },
  'ui.icon.settings': { folder: 'ui', name: 'icon-settings', label: '设置图标', size: '128×128', alpha: true, ext: PNG, use: '顶栏设置按钮', fallback: 'none' },
  'ui.icon.sound': { folder: 'ui', name: 'icon-sound', label: '声音图标', size: '128×128', alpha: true, ext: PNG, use: '顶栏声音按钮', fallback: 'none' },
  'ui.badge.starter': { folder: 'ui', name: 'badge-starter', label: '徽章：启航新星', size: '256×256', alpha: true, ext: PNG, use: '徽章图案，名称由程序显示', fallback: 'badge' },
  'ui.badge.trainee': { folder: 'ui', name: 'badge-trainee', label: '徽章：解题小能手', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.solo': { folder: 'ui', name: 'badge-solo', label: '徽章：独立挑战者', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.maze': { folder: 'ui', name: 'badge-maze', label: '徽章：迷宫探险家', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.boss': { folder: 'ui', name: 'badge-boss', label: '徽章：屠龙勇士', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.king': { folder: 'ui', name: 'badge-king', label: '徽章：数学王者', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.persist': { folder: 'ui', name: 'badge-persist', label: '徽章：坚持不懈', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.treasure': { folder: 'ui', name: 'badge-treasure', label: '徽章：宝箱猎人', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },
  'ui.badge.perfect': { folder: 'ui', name: 'badge-perfect', label: '徽章：全对之星', size: '256×256', alpha: true, ext: PNG, use: '徽章', fallback: 'badge' },

  // ---------------- effects/ 特效（透明背景）
  'fx.sparkle': { folder: 'effects', name: 'sparkle', label: '闪光', size: '512×512', alpha: true, ext: PNG, use: '答对时在题目上方闪一下', anim: 'anim-burst', fallback: 'css' },
  'fx.hit': { folder: 'effects', name: 'hit', label: '攻击命中', size: '512×512', alpha: true, ext: PNG, use: 'Boss 被攻击时', anim: 'anim-burst', fallback: 'emoji.hit' },
  'fx.star-burst': { folder: 'effects', name: 'star-burst', label: '星星爆发', size: '768×768', alpha: true, ext: PNG, use: '打开宝箱时在宝箱后面旋转、过关结算画面', anim: 'anim-spin-slow', fallback: 'none' },
  'fx.glow': { folder: 'effects', name: 'glow-ring', label: '光环', size: '512×512', alpha: true, ext: PNG, use: '地图上目前所在的岛、宝箱后面', anim: 'anim-pulse', fallback: 'none' },

  // ---------------- audio/ 声音（MP3 为主，可加 OGG）
  'bgm.map': { folder: 'audio', name: 'bgm-map', label: '背景音乐：地图与练习', size: '循环 1–2 分钟', ext: AUD, use: '地图与练习关卡', fallback: 'synth' },
  'bgm.maze': { folder: 'audio', name: 'bgm-maze', label: '背景音乐：数学迷宫', size: '循环 40 秒–2 分钟', ext: AUD, use: '第四关迷宫（没有时使用地图音乐）', fallback: 'bgm.map' },
  'bgm.boss': { folder: 'audio', name: 'bgm-boss', label: '背景音乐：Boss 战', size: '循环 1–2 分钟', ext: AUD, use: '第五关', fallback: 'synth' },
  'sfx.click': { folder: 'audio', name: 'sfx-click', label: '音效：按钮', size: '0.1 秒', ext: AUD, use: '点按钮', fallback: 'synth' },
  'sfx.correct': { folder: 'audio', name: 'sfx-correct', label: '音效：答对', size: '0.5–1 秒', ext: AUD, use: '答对', fallback: 'synth' },
  'sfx.wrong': { folder: 'audio', name: 'sfx-wrong', label: '音效：答错', size: '0.3–0.6 秒（柔和，不要刺耳）', ext: AUD, use: '答错', fallback: 'synth' },
  'sfx.hint': { folder: 'audio', name: 'sfx-hint', label: '音效：提示', size: '0.3 秒', ext: AUD, use: '获取提示', fallback: 'synth' },
  'sfx.step': { folder: 'audio', name: 'sfx-step', label: '音效：下一步骤', size: '0.1 秒', ext: AUD, use: '逐步讲解', fallback: 'synth' },
  'sfx.door': { folder: 'audio', name: 'sfx-door', label: '音效：开门', size: '0.5 秒', ext: AUD, use: '迷宫开门', fallback: 'synth' },
  'sfx.chest': { folder: 'audio', name: 'sfx-chest', label: '音效：打开宝箱', size: '1 秒', ext: AUD, use: '宝箱、拿到钥匙', fallback: 'synth' },
  'sfx.hit': { folder: 'audio', name: 'sfx-hit', label: '音效：攻击命中', size: '0.4 秒', ext: AUD, use: 'Boss 被攻击', fallback: 'synth' },
  'sfx.bossHit': { folder: 'audio', name: 'sfx-boss-hit', label: '音效：Boss 反击', size: '0.5 秒', ext: AUD, use: '答错时 Boss 反击', fallback: 'synth' },
  'sfx.level': { folder: 'audio', name: 'sfx-level', label: '音效：过关', size: '1–2 秒', ext: AUD, use: '完成一关', fallback: 'synth' },
  'sfx.victory': { folder: 'audio', name: 'sfx-victory', label: '音效：胜利', size: '2–3 秒', ext: AUD, use: '打败 Boss、完成认证', fallback: 'synth' },
};

/**
 * 冒险地图版面（百分比，以地图左上角为原点）。
 * 换了地图底图之后，只要调整这里的 x、y，岛屿编号牌和名称就会对准新图。
 *  x, y  岛屿中心位置（%）
 *  w     岛屿图片宽度（地图宽度的 %）
 */
export const MAP_LAYOUT = {
  ratio: 1240 / 760,
  islands: [
    { x: 15.3, y: 43.4, w: 22 },
    { x: 37.9, y: 32.9, w: 22 },
    { x: 61.3, y: 32.9, w: 22 },
    { x: 83.9, y: 34.2, w: 22 },
    { x: 80.6, y: 73.7, w: 24 },
    { x: 50.0, y: 75.0, w: 24 },
  ],
  labelOffsetY: 13,   // 名称牌在岛屿中心下方多少 %
  // 上传了整张地图（maps/adventure-map）时使用这一组位置。
  // x、y 是每一关在图片上的位置（%），以图片左上角为原点；换了别的地图图片只要改这里。
  image: {
    ratio: 1672 / 941,
    islands: [
      { x: 17.5, y: 30.5 },   // 1 数学启航站：左上方的村庄广场
      { x: 47.3, y: 25.8 },   // 2 解题训练营：上方中间的训练场（箭靶）
      { x: 85.5, y: 27.0 },   // 3 独立挑战区：右上方的水晶城
      { x: 19.5, y: 62.0 },   // 4 数学迷宫：左下方的树篱迷宫
      { x: 55.6, y: 75.5 },   // 5 终极 Boss：中间的火山堡垒
      { x: 87.0, y: 51.0 },   // 6 王者认证：右边的金色城堡
    ],
    labelOffsetY: 4,
  },
};

export const FOLDERS = {
  backgrounds: '背景图（不透明）',
  characters: '人物（透明背景）',
  maps: '冒险地图与岛屿',
  ui: '按钮、面板、道具、徽章（透明背景）',
  enemies: '怪兽（透明背景）',
  effects: '特效（透明背景）',
  audio: '背景音乐与音效',
};

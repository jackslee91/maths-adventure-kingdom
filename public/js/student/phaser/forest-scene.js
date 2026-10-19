// 《魔法森林大冒险》Phaser 场景：横向卷轴、镜头跟随、Arcade 物理（重力、地面与单向平台碰撞）、
// 金币与星星收集、绿色史莱姆巡逻、魔法门、终点宝箱、粒子特效。
// 每只史莱姆或每扇魔法门对应一道题目；碰到时暂停物理世界，交给外壳（launch.js）显示原有的答题界面。
// 注意：勇者的动作是用现有的静态动作图片切换，加上弹跳、倾斜、闪光等过渡效果，并不是逐帧骨骼动画。

const W = 1280, H = 720, GROUND = 620;
const SPEED = 310, JUMP = 840;
const FONT = '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif';

export function createForestScene(Phaser, { textures, questions, hooks }) {
  return class ForestScene extends Phaser.Scene {
    constructor() { super('forest'); }

    preload() {
      const loadInto = this.game.registry.get('loadInto');
      loadInto(this, textures);
      const bar = this.add.rectangle(W / 2, H / 2, 10, 14, 0xffd23f).setOrigin(0.5);
      this.loadingUi = [bar];
      this.loadingUi[1] = this.add.text(W / 2, H / 2 - 40, '正在打开魔法森林……', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#1d1238', strokeThickness: 6 }).setOrigin(0.5);
      this.load.on('progress', (v) => { bar.width = 10 + 500 * v; });
      this.load.on('loaderror', (f) => console.warn('魔法森林图片载入失败，改用备用图案：', f.key));
    }

    create() {
      (this.loadingUi || []).forEach(o => o.destroy());
      hooks.ready();
      this.controls = this.game.registry.get('controls');
      this.makeFallbackTextures();
      this.state = 'play';
      this.coins = 0; this.stars = 0; this.starsTotal = 0;
      this.poseUntil = 0; this.lockPose = null;

      // ------------------------------------------------ 关卡布局：每道题一个关卡点（史莱姆或魔法门）
      const n = questions.length;
      const doorIdx = new Set(n >= 4 ? [Math.floor(n / 3), Math.floor((2 * n) / 3)] : []);
      this.encs = questions.map((q, i) => ({ q, no: i + 1, kind: doorIdx.has(i) ? 'door' : 'slime', x: 900 + i * 640 }));
      this.baseTotal = this.encs.length;
      this.defeated = 0;
      const lastX = this.encs.length ? this.encs[this.encs.length - 1].x : 600;
      this.chestX = lastX + 520;
      this.worldW = this.chestX + 520;

      this.physics.world.setBounds(0, 0, this.worldW, H + 300);
      this.cameras.main.setBounds(0, 0, this.worldW, H);

      // ------------------------------------------------ 背景（视差、左右镜像拼接）与地面
      const bgW = this.textures.exists('bg') ? H * this.textures.get('bg').getSourceImage().width / this.textures.get('bg').getSourceImage().height : W;
      const tiles = Math.ceil((this.worldW * 0.35 + W) / bgW) + 1;
      for (let k = 0; k < tiles; k++) {
        if (!this.textures.exists('bg')) break;
        this.add.image(k * bgW, 0, 'bg').setOrigin(0, 0).setDisplaySize(bgW, H).setScrollFactor(0.35, 0).setFlipX(k % 2 === 1).setDepth(-10);
      }
      this.add.tileSprite(0, GROUND, this.worldW, H - GROUND, 'groundTex').setOrigin(0, 0).setDepth(1);
      const ground = this.add.rectangle(this.worldW / 2, GROUND + 50, this.worldW, 100);
      this.physics.add.existing(ground, true);
      this.ground = ground;

      // ------------------------------------------------ 浮空石台（单向平台：从下面可以跳上去）与收集品
      this.platforms = this.physics.add.staticGroup();
      this.pickups = this.physics.add.staticGroup();
      const gaps = this.encs.map((e, i) => [i === 0 ? 260 : this.encs[i - 1].x + 80, e.x - 300]);
      gaps.push([lastX + 80, this.chestX - 140]);
      gaps.forEach(([a, b], i) => {
        const mid = (a + b) / 2;
        this.addPlatform(mid, GROUND - 175, 280);
        for (let k = -1; k <= 1; k++) this.addPickup('coin', mid + k * 70, GROUND - 240);
        if (i % 2 === 1 || i === gaps.length - 1) {
          // 高台：先跳上低台，再跳上高台拿星星
          this.addPlatform(mid + 230, GROUND - 335, 220);
          this.addPickup('star', mid + 230, GROUND - 400);
        } else {
          for (let k = 0; k < 4; k++) this.addPickup('coin', a + 40 + k * 60, GROUND - 40 - Math.sin((k / 3) * Math.PI) * 60);
        }
      });

      // ------------------------------------------------ 勇者：物理身体（矩形）+ 显示用的图片
      this.player = this.add.rectangle(180, GROUND - 80, 56, 120);
      this.physics.add.existing(this.player);
      this.player.body.setCollideWorldBounds(true);
      this.player.body.setMaxVelocity(600, 1100);
      this.hero = this.add.image(180, GROUND, this.heroTex('idle')).setOrigin(0.5, 1).setDepth(6);
      this.sizeHero();
      this.physics.add.collider(this.player, ground);
      this.physics.add.collider(this.player, this.platforms, null, (pl, pf) => pl.body.velocity.y >= 0 && pl.body.bottom - pl.body.deltaY() <= pf.body.top + 6);
      this.physics.add.overlap(this.player, this.pickups, (pl, item) => this.collect(item));

      // ------------------------------------------------ 关卡点：挡路的隐形墙 + 史莱姆或魔法门
      this.walls = this.physics.add.staticGroup();
      this.encs.forEach((e) => this.spawnEncounter(e, ground));

      // ------------------------------------------------ 终点宝箱
      this.chest = this.add.image(this.chestX, GROUND + 6, 'chest').setOrigin(0.5, 1).setDepth(4);
      this.fitHeight(this.chest, 150);
      this.chestZone = this.add.zone(this.chestX, GROUND - 60, 120, 140);
      this.physics.add.existing(this.chestZone, true);
      this.physics.add.overlap(this.player, this.chestZone, () => this.reachChest());

      // ------------------------------------------------ 特效材质
      this.sparks = this.add.particles(0, 0, 'spark', {
        speed: { min: 120, max: 420 }, lifespan: { min: 350, max: 750 }, scale: { start: 1.1, end: 0 },
        tint: [0xffe066, 0xffffff, 0xffb627, 0x8fe3ff], blendMode: 'ADD', emitting: false,
      }).setDepth(20);
      this.starFx = this.add.particles(0, 0, 'tinyStar', {
        speed: { min: 80, max: 260 }, lifespan: 900, scale: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 },
        gravityY: 300, emitting: false,
      }).setDepth(20);

      // ------------------------------------------------ 镜头与画面上方的资讯
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12, -180, 80);
      this.hud = this.add.text(20, 16, '', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffffff', stroke: '#1d1238', strokeThickness: 7 }).setScrollFactor(0).setDepth(30);
      this.title = this.add.text(W - 20, 16, '魔法森林大冒险', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ffe066', stroke: '#1d1238', strokeThickness: 7 }).setOrigin(1, 0).setScrollFactor(0).setDepth(30);
      this.updateHud();

      // ------------------------------------------------ 键盘（不抢网页按键，答题时会停用）
      this.keys = this.input.keyboard.addKeys({ left: 'LEFT', right: 'RIGHT', up: 'UP', space: 'SPACE', a: 'A', d: 'D', w: 'W' }, false);
      this.showToast('← → 移动，空格跳跃！碰到史莱姆或魔法门就会出题。');
      hooks.setState('play');
      // 自动测试用：读取勇者位置与关卡点状态（只读，不影响游戏）
      window.__forestTeleport = (x) => { this.player.body.reset(x, GROUND - 80); };
      window.__forestDebug = () => ({ fps: Math.round(this.game.loop.actualFps), d: Math.round(this.game.loop.delta), raw: Math.round(this.game.loop.rawDelta), now: Math.round(performance.now()), px: Math.round(this.player.x), state: this.state, encs: this.encs.map(e => ({ kind: e.kind, x: e.x, alive: e.alive, bx: e.body ? Math.round(e.body.x) : null })) });
    }

    // ================================================== 建立物件
    addPlatform(cx, topY, w) {
      if (this.textures.exists('platform')) {
        const img = this.add.image(cx, topY, 'platform').setDepth(2);
        const src = this.textures.get('platform').getSourceImage();
        const dw = w + 40, dh = dw * src.height / src.width;
        img.setDisplaySize(dw, dh).setOrigin(0.5, 0.36); // 草地表面约在图片高度 36% 处
      } else this.add.image(cx, topY, 'platFallback').setOrigin(0.5, 0).setDisplaySize(w, 40).setDepth(2);
      const r = this.add.rectangle(cx, topY + 20, w - 20, 40);   // 厚一点，画面较慢时也不会穿过平台
      this.physics.add.existing(r, true);
      this.platforms.add(r);
    }

    addPickup(kind, x, y) {
      const img = this.physics.add.staticImage(x, y, kind === 'star' ? 'star' : 'coin');
      img.setDisplaySize(kind === 'star' ? 58 : 44, kind === 'star' ? 58 : 44).refreshBody();
      img.setData('kind', kind).setDepth(5);
      this.tweens.add({ targets: img, y: y - 8, duration: 700 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      if (kind === 'star') this.starsTotal++;
      this.pickups.add(img);
    }

    spawnEncounter(e, ground) {
      e.alive = true; e.busy = false;
      e.wall = this.add.zone(e.x, H / 2, 30, H * 1.4);
      this.physics.add.existing(e.wall, true);
      this.walls.add(e.wall);
      // 魔法门：碰到门就出题。史莱姆：要真的碰到史莱姆才出题；后面的魔法藤蔓只负责挡路（跳过史莱姆也过不去，史莱姆巡逻回来碰到你才出题）
      e.colliders = [this.physics.add.collider(this.player, e.wall, e.kind === 'door' ? () => this.trigger(e) : null)];
      if (e.kind !== 'door') {
        e.fence = this.add.rectangle(e.x, GROUND - 170, 18, 340, 0x7cff8a, 0.35).setDepth(3);
        e.fenceGlow = this.add.particles(e.x, GROUND - 10, 'spark', { x: { min: -6, max: 6 }, speedY: { min: -160, max: -60 }, lifespan: 1600, scale: { start: 0.6, end: 0 }, tint: [0x9dff7a, 0xffffff], blendMode: 'ADD', frequency: 90 }).setDepth(3);
        this.tweens.add({ targets: e.fence, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
      }
      if (e.kind === 'door') {
        e.sprite = this.add.image(e.x, GROUND + 4, 'doorClosed').setOrigin(0.5, 1).setDepth(4);
        this.fitHeight(e.sprite, 210);
        e.glow = this.add.circle(e.x, GROUND - 140, 22, 0xffd23f, 0.9).setDepth(5);
        e.mark = this.add.text(e.x, GROUND - 140, '?', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#3a2418' }).setOrigin(0.5).setDepth(6);
        this.tweens.add({ targets: e.glow, scale: 1.18, duration: 650, yoyo: true, repeat: -1 });
      } else {
        // 史莱姆：在墙前面来回巡逻
        e.body = this.add.rectangle(e.x - 120, GROUND - 40, 92, 70);
        this.physics.add.existing(e.body);
        e.body.body.setCollideWorldBounds(true);
        this.physics.add.collider(e.body, ground);
        e.body.body.setVelocityX(-70);
        e.min = e.x - 280; e.max = e.x - 70;
        e.sprite = this.add.image(e.body.x, GROUND, 'slime').setOrigin(0.5, 1).setDepth(5);
        this.fitHeight(e.sprite, e.extra ? 86 : 104);
        e.colliders.push(this.physics.add.overlap(this.player, e.body, () => this.trigger(e)));
      }
    }

    // ================================================== 数学挑战
    trigger(e) {
      if (!e.alive || e.busy || this.state !== 'play') return;
      e.busy = true;
      this.state = 'challenge';
      hooks.setState('challenge');
      this.player.body.setVelocity(0, 0);
      this.setPose('think');
      this.physics.pause();
      this.input.keyboard.enabled = false;
      this.controls.left = this.controls.right = this.controls.jump = false;
      hooks.challenge(e).then((res) => {
        if (!this.sys || !this.sys.isActive()) return;
        // 答题期间放开的按键 Phaser 收不到，先把所有按键重设为“没按下”，避免勇者自己一直走
        this.input.keyboard.resetKeys();
        this.controls.left = this.controls.right = this.controls.jump = false;
        this.input.keyboard.enabled = true;
        this.physics.resume();
        if (res.correct) this.defeat(e);
        else this.flee(e, res.easier);
      });
    }

    defeat(e) {
      this.state = 'anim'; hooks.setState('anim');
      const reduce = hooks.reduce();
      this.setPose('attack', 1000);
      hooks.sound('hit');
      const from = { x: this.player.x + 40, y: this.player.y - 30 };
      const to = { x: e.kind === 'door' ? e.x : e.body.x, y: e.kind === 'door' ? GROUND - 120 : GROUND - 50 };
      const orb = this.add.circle(from.x, from.y, 20, 0xfff3a0).setDepth(19);
      const glow = this.add.circle(from.x, from.y, 38, 0xffc93c, 0.45).setDepth(18);
      const trail = this.add.particles(0, 0, 'spark', { follow: orb, speed: 30, lifespan: 300, scale: { start: 0.8, end: 0 }, tint: 0xffe066, blendMode: 'ADD', frequency: 16 }).setDepth(17);
      this.tweens.add({
        targets: [orb, glow], x: to.x, y: to.y, duration: reduce ? 60 : 420, ease: 'Quad.in',
        onComplete: () => {
          orb.destroy(); glow.destroy(); trail.destroy();
          this.impact(to.x, to.y, e.kind === 'door' ? '开门！' : '命中！');
          e.alive = false;
          if (e.kind === 'door') {
            if (this.textures.exists('doorOpen')) e.sprite.setTexture('doorOpen');
            this.fitHeight(e.sprite, 210);
            e.glow.destroy(); e.mark.destroy();
            hooks.sound('door');
          } else {
            e.body.body.enable = false;
            this.tweens.add({ targets: e.sprite, x: e.sprite.x + 220, y: e.sprite.y - 160, angle: 400, alpha: 0, scale: e.sprite.scale * 0.6, duration: 700, ease: 'Quad.out', onComplete: () => e.sprite.destroy() });
            this.coinBurst(to.x, to.y);
          }
          this.clearEncounter(e);
          if (!e.extra) this.defeated++;
          this.updateHud();
          this.time.delayedCall(reduce ? 200 : 650, () => { this.state = 'play'; hooks.setState('play'); });
        },
      });
    }

    flee(e, easier) {
      // 两次答错：看完讲解后，史莱姆跑掉；前面再出现一只小史莱姆出简单同类题
      e.alive = false;
      if (e.body) e.body.body.enable = false;
      this.tweens.add({ targets: e.sprite, x: e.sprite.x + 260, alpha: 0, duration: 650, onComplete: () => e.sprite.destroy() });
      this.clearEncounter(e);
      if (!e.extra) this.defeated++;
      if (easier) {
        const ex = { q: easier, no: e.no, kind: 'slime', x: e.x + 330, extra: true };
        this.encs.splice(this.encs.indexOf(e) + 1, 0, ex);
        this.spawnEncounter(ex, this.ground);
        this.showToast('小史莱姆出现了！先做一道简单的同类题。');
      }
      this.updateHud();
      this.setPose('idle');
      this.state = 'play'; hooks.setState('play');
    }

    impact(x, y, text) {
      if (this.textures.exists('hit')) {
        const h = this.add.image(x, y, 'hit').setDepth(21).setBlendMode('ADD');
        this.fitHeight(h, 120);
        this.tweens.add({ targets: h, scale: h.scale * 2.4, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => h.destroy() });
      }
      this.sparks.explode(36, x, y);
      if (!hooks.reduce()) this.cameras.main.shake(220, 0.008);
      const t = this.add.text(x, y - 90, text, { fontFamily: FONT, fontSize: '46px', fontStyle: 'bold', color: '#ffe066', stroke: '#2a0e00', strokeThickness: 9 }).setOrigin(0.5).setDepth(22);
      this.tweens.add({ targets: t, y: y - 170, alpha: 0, duration: 1000, ease: 'Quad.out', onComplete: () => t.destroy() });
    }

    coinBurst(x, y) {
      for (let k = 0; k < 5; k++) {
        const c = this.add.image(x, y, 'coin').setDepth(21);
        c.setDisplaySize(36, 36);
        this.tweens.add({ targets: c, x: x + (k - 2) * 50, y: y - 120 - Math.random() * 60, duration: 380, ease: 'Quad.out', yoyo: false,
          onComplete: () => this.tweens.add({ targets: c, alpha: 0, y: c.y - 40, duration: 300, onComplete: () => c.destroy() }) });
      }
      this.coins += 5;
      this.updateHud();
    }

    collect(item) {
      if (!item.active || !item.body.enable) return;
      item.body.enable = false;
      const kind = item.getData('kind');
      if (kind === 'star') { this.stars++; hooks.sound('hint'); this.starFx.explode(16, item.x, item.y); }
      else { this.coins++; hooks.sound('step'); this.sparks.explode(8, item.x, item.y); }
      this.tweens.killTweensOf(item);
      this.tweens.add({ targets: item, y: item.y - 60, alpha: 0, scale: item.scale * 1.4, duration: 300, onComplete: () => item.destroy() });
      this.updateHud();
    }

    reachChest() {
      if (this.state !== 'play' || this.encs.some(e => e.alive)) return;
      this.state = 'win'; hooks.setState('win');
      this.player.body.setVelocity(0, 0);
      this.setPose('win');
      if (this.textures.exists('chestOpen')) this.chest.setTexture('chestOpen');
      this.fitHeight(this.chest, 160);
      if (this.textures.exists('burst')) {
        const b = this.add.image(this.chestX, GROUND - 80, 'burst').setDepth(3).setAlpha(0.9);
        this.fitHeight(b, 300);
        this.tweens.add({ targets: b, angle: 360, duration: 6000, repeat: -1 });
      }
      this.starFx.explode(40, this.chestX, GROUND - 100);
      this.sparks.explode(40, this.chestX, GROUND - 100);
      hooks.sound('chest'); hooks.celebrate(50);
      const t = this.add.text(this.chestX, GROUND - 330, '过关！', { fontFamily: FONT, fontSize: '64px', fontStyle: 'bold', color: '#ffe066', stroke: '#2a0e00', strokeThickness: 10 }).setOrigin(0.5).setDepth(22);
      this.tweens.add({ targets: t, scale: { from: 0.4, to: 1 }, duration: 500, ease: 'Back.out' });
      this.time.delayedCall(1900, () => hooks.win({ coins: this.coins, stars: this.stars }));
    }

    // ================================================== 每一帧
    update(time) {
      const body = this.player.body;
      const c = this.controls, k = this.keys;
      if (this.state === 'play') {
        const left = c.left || k.left.isDown || k.a.isDown;
        const right = c.right || k.right.isDown || k.d.isDown;
        body.setVelocityX(right && !left ? SPEED : left && !right ? -SPEED : 0);
        const wantJump = c.jump || Phaser.Input.Keyboard.JustDown(k.space) || Phaser.Input.Keyboard.JustDown(k.up) || Phaser.Input.Keyboard.JustDown(k.w);
        c.jump = false;
        if (wantJump && (body.blocked.down || body.touching.down)) { body.setVelocityY(-JUMP); hooks.sound('click'); }
        if (body.velocity.x) this.hero.setFlipX(body.velocity.x < 0);
      } else if (this.state !== 'challenge') body.setVelocityX(0);

      // 史莱姆巡逻
      for (const e of this.encs) {
        if (e.kind !== 'slime' || !e.alive || !e.body) continue;
        const b = e.body.body;
        if (e.body.x <= e.min) b.setVelocityX(70); else if (e.body.x >= e.max) b.setVelocityX(-70);
        e.sprite.x = e.body.x; e.sprite.y = e.body.y + 35;
        e.sprite.setFlipX(b.velocity.x > 0);
        e.sprite.scaleY = e.sprite.getData('sy') * (1 + Math.sin(time / 180 + e.x) * 0.05);
      }

      // 勇者动作：用现有的动作图片切换（站立、奔跑、跳跃、思考、攻击、受伤、胜利）
      const onGround = body.blocked.down || body.touching.down;
      let pose;
      if (this.lockPose && time < this.poseUntil) pose = this.lockPose;
      else if (this.state === 'challenge') pose = 'think';
      else if (this.state === 'win') pose = 'win';
      else if (!onGround) pose = 'jump';
      else if (Math.abs(body.velocity.x) > 10) pose = 'run';
      else pose = 'idle';
      const tex = this.heroTex(pose);
      if (this.hero.texture.key !== tex) { this.hero.setTexture(tex); this.sizeHero(); }
      const moving = pose === 'run';
      this.hero.x = this.player.x;
      this.hero.y = this.player.body.bottom + 6 + (moving ? -Math.abs(Math.sin(time / 85)) * 7 : 0);
      this.hero.rotation = moving ? Math.sin(time / 85) * 0.04 : 0;
      if (pose === 'idle') this.hero.scaleY = this.hero.getData('sy') * (1 + Math.sin(time / 420) * 0.012);
    }

    // ================================================== 小工具
    clearEncounter(e) {
      (e.colliders || []).forEach(c => this.physics.world.removeCollider(c));
      e.colliders = [];
      if (e.wall) { e.wall.destroy(); e.wall = null; }
      if (e.fence) { e.fence.destroy(); e.fence = null; }
      if (e.fenceGlow) { e.fenceGlow.destroy(); e.fenceGlow = null; }
      if (e.body && e.kind === 'slime') { e.body.destroy(); e.body = null; }
    }
    setPose(p, ms = 0) { this.lockPose = ms ? p : null; this.poseUntil = ms ? this.time.now + ms : 0; }
    heroTex(p) { return this.textures.exists(`hero_${p}`) ? `hero_${p}` : this.textures.exists('hero_idle') ? 'hero_idle' : 'heroFallback'; }
    sizeHero() { this.fitHeight(this.hero, 168); }
    fitHeight(img, h) {
      const src = img.texture.getSourceImage();
      const s = h / src.height;
      img.setScale(s); img.setData('sy', s);
      return img;
    }
    updateHud() {
      const left = this.encs.filter(e => e.alive && !e.extra).length;
      this.hud.setText(`金币 ${this.coins}　星星 ${this.stars} / ${this.starsTotal}　关卡点 ${this.baseTotal - left} / ${this.baseTotal}`);
    }
    showToast(text) {
      const t = this.add.text(W / 2, 90, text, { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#1d1238cc', padding: { x: 18, y: 10 } }).setOrigin(0.5).setScrollFactor(0).setDepth(31);
      this.tweens.add({ targets: t, alpha: 0, delay: 3200, duration: 600, onComplete: () => t.destroy() });
    }
    makeFallbackTextures() {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const make = (key, w, h, draw) => { if (this.textures.exists(key)) return; g.clear(); draw(g); g.generateTexture(key, w, h); };
      make('spark', 16, 16, (gg) => { gg.fillStyle(0xffffff, 1); gg.fillCircle(8, 8, 8); });
      make('tinyStar', 24, 24, (gg) => { gg.fillStyle(0xffe066, 1); gg.fillPoints(starPoints(12, 12, 11, 5), true); });
      make('groundTex', 128, H - GROUND, (gg) => {
        gg.fillStyle(0x8a5a32, 1); gg.fillRect(0, 0, 128, H - GROUND);
        gg.fillStyle(0x6f4526, 1); gg.fillRect(10, 40, 30, 14); gg.fillRect(70, 66, 36, 14);
        gg.fillStyle(0x6dbb3c, 1); gg.fillRect(0, 0, 128, 18);
        gg.fillStyle(0x4f9a2a, 1); gg.fillRect(0, 16, 128, 4);
      });
      make('platFallback', 280, 40, (gg) => { gg.fillStyle(0x8a5a32, 1); gg.fillRoundedRect(0, 0, 280, 40, 14); gg.fillStyle(0x6dbb3c, 1); gg.fillRoundedRect(0, 0, 280, 14, 8); });
      make('coin', 48, 48, (gg) => { gg.fillStyle(0xc98a2b, 1); gg.fillCircle(24, 24, 23); gg.fillStyle(0xffd23f, 1); gg.fillCircle(24, 24, 19); });
      make('star', 64, 64, (gg) => { gg.fillStyle(0xffd23f, 1); gg.fillPoints(starPoints(32, 32, 30, 5), true); });
      make('slime', 120, 100, (gg) => { gg.fillStyle(0x7bd23b, 1); gg.fillEllipse(60, 60, 116, 80); gg.fillStyle(0xffffff, 1); gg.fillCircle(40, 50, 10); gg.fillCircle(70, 50, 10); });
      make('doorClosed', 150, 210, (gg) => { gg.fillStyle(0x8a8a8a, 1); gg.fillRect(0, 0, 150, 210); gg.fillStyle(0x8a5a32, 1); gg.fillRect(20, 30, 110, 180); });
      make('chest', 160, 130, (gg) => { gg.fillStyle(0xc98a2b, 1); gg.fillRoundedRect(0, 20, 160, 110, 16); gg.fillStyle(0xffd23f, 1); gg.fillRect(70, 50, 20, 30); });
      make('heroFallback', 80, 160, (gg) => { gg.fillStyle(0xe2362b, 1); gg.fillRoundedRect(10, 50, 60, 110, 20); gg.fillStyle(0xffd9b0, 1); gg.fillCircle(40, 34, 30); });
    }
  };
}

function starPoints(cx, cy, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (Math.PI / n) * i - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

/* 横屏 HTML 版真浏览器验收：登录 → 大厅 → 对弈弹层 → 开枰 → 装扮 / 设置 → 提示
   用法：node tools/ui-e2e.cjs  （需先在仓库根起静态服务，端口 8877，webroot 指向 _webtest） */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.UI_BASE || 'http://localhost:8877/';
const SHOTS = path.resolve(process.env.UI_SHOTS || 'ui-shots');
fs.mkdirSync(SHOTS, { recursive: true });

const R = [];
const ok = (name, cond, extra) => { R.push({ name, pass: !!cond, extra: extra || '' }); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    headless: true, executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/favicon|404|WebSocket|net::ERR/.test(m.text())) errs.push('CONSOLE: ' + m.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(900);

  /* 1. 首次进入 = 注册页，不是直接发凭证 */
  const first = await page.evaluate(() => ({
    reg: !document.querySelector('#register').hidden,
    loginHidden: document.querySelector('#login').hidden,
    codeShown: document.querySelector('#lgCode').textContent.trim(),
    registered: localStorage.getItem('qipai.registered'),
    docW: document.documentElement.scrollWidth, vw: window.innerWidth,
    layerW: document.querySelector('#register').getBoundingClientRect().width,
    goRect: (() => { const r = document.querySelector('#rgGo').getBoundingClientRect();
                      return { bottom: r.bottom, top: r.top, h: r.height }; })(),
    vh: window.innerHeight
  }));
  ok('首次进入是「创建棋客」注册页，登录页不出现', first.reg && first.loginHidden, JSON.stringify(first));
  ok('注册前不显示、不预分配凭证', first.codeShown === '—' && !first.registered, first.codeShown);
  ok('注册页横向铺满、无左右黑边',
    first.docW <= first.vw + 1 && first.layerW >= first.vw - 2, `docW=${first.docW} vw=${first.vw} layerW=${first.layerW}`);
  ok('注册按钮在首屏内、底部不被裁', first.goRect.bottom <= first.vh + 1 && first.goRect.top >= 0,
    JSON.stringify(first.goRect) + ' vh=' + first.vh);
  const cover = await page.evaluate(() => {
    const r = document.querySelector('#rgName').getBoundingClientRect();
    const top = (document.elementsFromPoint(r.left + 20, r.top + 10) || [])[0];
    return { toastShown: document.querySelector('#toast').classList.contains('show'),
      top: String((top && (top.id || top.className || top.tagName)) || '') };
  });
  ok('注册页无自动浮条遮挡表单标签', !cover.toastShown && !/toast/i.test(cover.top), JSON.stringify(cover));
  await page.screenshot({ path: path.join(SHOTS, '00-register.png') });

  /* 1.5 注册校验：空 / 单字被拦，错误就地显示 */
  await page.click('#rgGo');
  const err = await page.evaluate(() => ({ shown: !document.querySelector('#rgErr').hidden,
    txt: document.querySelector('#rgErr').textContent.trim() }));
  ok('称呼为空时拦下并就地给提示', err.shown && /2–12/.test(err.txt), err.txt);

  /* 1.6 填称呼 + 选标记 → 注册完成后才给凭证 */
  await page.fill('#rgName', '阿弈');
  await page.click('.rg-av[data-id="zhu"]');
  await page.click('#rgGo');
  await page.waitForTimeout(200);
  const regDone = await page.evaluate(() => ({
    regHidden: document.querySelector('#register').hidden,
    loginShown: !document.querySelector('#login').hidden,
    newTag: !document.querySelector('#lgNew').hidden,
    hello: document.querySelector('#lgHello').textContent.trim(),
    code: document.querySelector('#lgCode').textContent.trim(),
    registered: localStorage.getItem('qipai.registered'),
    avatar: localStorage.getItem('qipai.avatar')
  }));
  ok('注册完成后才展示凭证，且格式为 YJ-XXXX-XXXX-XXXX',
    regDone.regHidden && regDone.loginShown && regDone.newTag &&
    /^YJ-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(regDone.code), JSON.stringify(regDone));
  ok('称呼与标记写进本机、注册标记已落盘',
    /阿弈/.test(regDone.hello) && regDone.registered === 'true' && /zhu/.test(regDone.avatar || ''), JSON.stringify(regDone));
  await page.screenshot({ path: path.join(SHOTS, '01-login.png') });

  /* 1.7 二次进入：直接登录页，不再要求注册，凭证不变 */
  const codeBefore = regDone.code;
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const second = await page.evaluate(() => ({
    regHidden: document.querySelector('#register').hidden,
    loginShown: !document.querySelector('#login').hidden,
    code: document.querySelector('#lgCode').textContent.trim(),
    localOn: document.querySelector('.lg-mode[data-mode="local"]').classList.contains('on'),
    serverHidden: document.querySelector('#lgServerRow').hidden,
    notice: !document.querySelector('#lgNotice').hidden,
    tag: document.querySelector('#lgModeTag').textContent.trim(),
    goBottom: document.querySelector('#lgGo').getBoundingClientRect().bottom,
    vh: window.innerHeight,
    docW: document.documentElement.scrollWidth, vw: window.innerWidth
  }));
  ok('已注册后直接进登录页，不再要求注册', second.regHidden && second.loginShown, JSON.stringify(second));
  ok('凭证保持不变，默认「本地模式 · 可局域网联机」',
    second.code === codeBefore && second.localOn && /本地模式/.test(second.tag), JSON.stringify(second));
  ok('服务器地址默认隐藏（可选项）、提示条可关', second.serverHidden && second.notice);
  ok('登录页横向铺满、入局按钮在首屏内不被裁',
    second.docW <= second.vw + 1 && second.goBottom <= second.vh + 1,
    `docW=${second.docW} vw=${second.vw} goBottom=${second.goBottom} vh=${second.vh}`);

  /* 2. 关提示并入局 */
  await page.click('#lgNoticeChk');
  const noticeGone = await page.evaluate(() => document.querySelector('#lgNotice').hidden);
  ok('「不再提示」可关闭提示条', noticeGone);
  await page.click('#lgGo');
  await page.waitForTimeout(1600); // 旧版在 600ms 自动弹小引，等久一点才验得出来

  /* 2.5 入局后不得有任何自动弹窗 / 离线条盖住大厅 */
  const overlay = await page.evaluate(() => {
    const m = document.querySelector('#modal');
    const ob = document.querySelector('#offlineBar');
    const top = (document.elementsFromPoint(660, 300) || [])[0];
    return {
      modalHidden: m.hidden, modalDisplay: getComputedStyle(m).display,
      offlineHidden: ob.hidden, offlineDisplay: getComputedStyle(ob).display,
      topIsHall: /hall|hero|main|P|guide-step/i.test((top && (top.id || top.className || top.tagName)) || '')
    };
  });
  ok('入局后不再自动弹小引 / 离线条盖住大厅',
    overlay.modalHidden && overlay.modalDisplay === 'none' && overlay.offlineHidden,
    JSON.stringify(overlay));
  await page.screenshot({ path: path.join(SHOTS, '02a-hall-clean.png') });

  /* 3. 横屏大厅骨架 */
  const hall = await page.evaluate(() => {
    const h = document.querySelector('#hall');
    const cs = getComputedStyle(h);
    return {
      shown: !h.hidden, cols: cs.gridTemplateColumns, rows: cs.gridTemplateRows,
      friends: !!document.querySelector('#frList'),
      entries: document.querySelectorAll('.he-btn').length,
      tabs: document.querySelectorAll('.ht-tab').length,
      play: !!document.querySelector('#hallPlay'),
      note: (document.querySelector('#hallNote') || {}).textContent || '',
      mode: (document.querySelector('#hallMode') || {}).textContent || ''
    };
  });
  ok('大厅显示且为三栏两栏头尾的横屏网格', hall.shown && hall.rows.split(' ').length === 3 && hall.cols.split(' ').length === 3, hall.cols + ' / ' + hall.rows);
  ok('左好友栏 / 右入口列 / 底部 tab 齐备', hall.friends && hall.entries >= 5 && hall.tabs >= 6, `入口${hall.entries} tab${hall.tabs}`);
  ok('中央大「对弈」按钮存在', hall.play);
  ok('今日题记有实际内容，不是空白', /月.*日|先与隐士|已对/.test(hall.note), hall.note.slice(0, 40));
  ok('大厅标注本地模式（服务器可选）', /本地模式|已连棋馆/.test(hall.mode), hall.mode);
  await page.screenshot({ path: path.join(SHOTS, '02-hall.png') });

  /* 4. 好友：凭证加好友 + 在线状态 */
  await page.click('#frAdd');
  await page.fill('#faCode', 'YJ-TEST-TEST-TEST');
  await page.fill('#faName', '测试棋友');
  await page.click('#faOk');
  await page.waitForTimeout(200);
  const fr = await page.evaluate(() => ({
    rows: document.querySelectorAll('.fr-item').length,
    txt: document.querySelector('#frList').textContent,
    tip: document.querySelector('#frTip').textContent
  }));
  ok('凭凭证加好友成功，好友栏出现两项', fr.rows === 2, fr.txt.replace(/\s+/g, ' ').slice(0, 80));
  ok('本机在线 / 未连棋馆好友离线，且明确不连公网', /本机 · 在线/.test(fr.txt) && /离线/.test(fr.txt) && /不连公网/.test(fr.tip));
  const frInfo = await page.evaluate(() => ({
    info: !!document.querySelector('.fr-info'),
    anim: getComputedStyle(document.querySelector('#hallPlay'), '::after').animationName
  }));
  ok('好友栏空档有说明卡，不再大片留白', frInfo.info);
  ok('主按钮不再有循环扫光（不会闪断像卡顿）', frInfo.anim !== 'hSheen', frInfo.anim);

  /* 5. 对弈弹层：层级选择，不跳整页 */
  await page.click('#hallPlay');
  await page.waitForTimeout(200);
  const pp = await page.evaluate(() => ({
    picker: !document.querySelector('#playPicker').hidden,
    hallStill: !document.querySelector('#hall').hidden,
    main: document.querySelectorAll('.pp-card-item').length,
    head: (document.querySelector('.pp-group') || {}).textContent || ''
  }));
  ok('点「对弈」弹出层级面板，大厅仍在（没有整页跳走）', pp.picker && pp.hallStill);
  ok('主推 8 局列出', pp.main === 8, pp.head);
  await page.click('#ppMore');
  await page.waitForTimeout(150);
  const ppAll = await page.evaluate(() => ({
    cards: document.querySelectorAll('.pp-card-item').length,
    more: document.querySelector('#ppMore').textContent
  }));
  ok('副推展开后共 7 项（专精 6 + 轮弦）', ppAll.cards === 7, String(ppAll.cards));
  await page.fill('#ppSearch', '楚汉');
  await page.waitForTimeout(150);
  const searched = await page.evaluate(() => document.querySelectorAll('.pp-card-item').length);
  ok('对弈检索可用', searched >= 1, String(searched));
  await page.fill('#ppSearch', '');
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(SHOTS, '03-picker.png') });

  /* 6. 开枰：楚汉棋，红黑实心双色 + 可落子 */
  const picked = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.pp-card-item')).find(x => /楚汉棋/.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  });
  ok('选中楚汉棋并开枰', picked);
  await page.waitForTimeout(1400);
  const board = await page.evaluate(() => {
    const cv = document.querySelector('#board');
    if (!cv || !cv.width) return { ready: false };
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let red = 0, black = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.abs(r - 163) < 26 && Math.abs(g - 57) < 30 && Math.abs(b - 43) < 30) red++;
      if (r < 70 && g < 70 && b < 70) black++;
    }
    return {
      ready: true, red, black,
      play: document.querySelector('#screen-play').classList.contains('active'),
      title: (document.querySelector('#matchTitle') || {}).textContent || ''
    };
  });
  ok('进入对局页且棋盘已绘制', board.ready && board.play, board.title || '');
  ok('棋盘同时出现朱砂红与墨黑实心棋子（阵营可辨）', board.red > 200 && board.black > 200, `red=${board.red} black=${board.black}`);
  // 按 render.js 的交叉点公式精确点己方兵，验证对局内核有响应
  const clickRes = await page.evaluate(async () => {
    const S = window.YJ.S;
    const snap = () => [S.selFrom, S.selected ? S.selected.size : -1,
      (S.view && S.view.last) || '', (document.querySelector('#logList') || {}).textContent || '',
      (document.querySelector('#handHint') || {}).textContent || ''].join('|');
    const before = snap();
    const cv = document.querySelector('#board'), r = cv.getBoundingClientRect();
    const W = cv.clientWidth, H = cv.clientHeight;
    const pad = Math.max(20, Math.min(W, H) * .075);
    const stepX = (W - 2 * pad) / 8, stepY = (H - 2 * pad) / 9, step = Math.min(stepX, stepY);
    const ox = pad + (W - 2 * pad - step * 8) / 2, oy = pad + (H - 2 * pad - step * 9) / 2;
    const candidates = [[0, 6], [2, 6], [4, 6], [6, 6], [8, 6], [0, 9], [4, 9]];
    let hit = false;
    for (const [cx, cy] of candidates) {
      cv.dispatchEvent(new MouseEvent('click', {
        bubbles: true, clientX: r.left + ox + cx * step, clientY: r.top + oy + cy * step
      }));
      await new Promise(rs => setTimeout(rs, 260));
      if (snap() !== before) { hit = true; break; }
    }
    return { hit, before: before.slice(0, 60), after: snap().slice(0, 60) };
  });
  ok('点击棋盘有交互响应（选中 / 落子 / 谱更新）', clickRes.hit,
    clickRes.hit ? clickRes.after : ('无变化 ' + clickRes.before));
  await page.screenshot({ path: path.join(SHOTS, '04-play.png') });

  /* 7. 装扮独立页（从设置里拆出） */
  await page.evaluate(() => window.YJ_SHELL && (document.querySelector('#backHall').click()));
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('.he-btn[data-id="shop"]').click());
  await page.waitForTimeout(350);
  const shop = await page.evaluate(() => ({
    active: document.querySelector('#screen-shop').classList.contains('active'),
    items: document.querySelectorAll('#shopGrid .shop-item').length,
    inSettings: !!document.querySelector('#screen-settings #shopGrid')
  }));
  ok('装扮独立成页且不在案牍里', shop.active && !shop.inSettings);
  ok('49 件装扮渲染出来', shop.items >= 40, String(shop.items));
  await page.screenshot({ path: path.join(SHOTS, '05-shop.png') });

  /* 8. 设置页对比度（黑底黑字修复） */
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.nav-item')).find(x => x.dataset.screen === 'settings');
    if (b) b.click();
  });
  await page.waitForTimeout(350);
  const contrast = await page.evaluate(() => {
    const g = document.querySelector('.set-group');
    if (!g) return { ok: false, why: 'no .set-group' };
    const parse = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
    const lum = (c) => {
      const f = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * f[0] + .7152 * f[1] + .0722 * f[2];
    };
    const bg = parse(getComputedStyle(g).backgroundColor);
    const fgEl = g.querySelector('.set-name') || g.querySelector('b') || g;
    const fg = parse(getComputedStyle(fgEl).color);
    if (bg.length < 3 || fg.length < 3) return { ok: false, why: 'color parse', bg, fg };
    const a = lum(bg), b = lum(fg);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    return { ok: ratio >= 4.5, ratio: +ratio.toFixed(2), bg, fg };
  });
  ok('设置页文字与底色对比度 ≥ 4.5（黑底黑字已修）', contrast.ok, JSON.stringify(contrast));
  await page.screenshot({ path: path.join(SHOTS, '06-settings.png') });

  /* 9. toast 不遮挡、不截断（之前被键盘 / 底栏切一半） */
  await page.evaluate(() => window.YJ.toast('局域网内未找到其他玩家，请确认棋馆已启动；不填服务器时请点「对弈」与隐士开枰，这是一条较长提示用于验证不会被遮挡截断'));
  await page.waitForTimeout(180);
  const toast = await page.evaluate(() => {
    const e = document.querySelector('#toast'); const r = e.getBoundingClientRect();
    return {
      show: e.classList.contains('show'), top: r.top, bottom: r.bottom, left: r.left, right: r.right,
      z: +getComputedStyle(e).zIndex, clipped: e.scrollWidth > e.clientWidth + 1,
      text: e.textContent.length
    };
  });
  ok('提示完整显示在顶部、在视口内、不被遮挡截断',
    toast.show && toast.top >= 0 && toast.bottom <= 720 && toast.left >= 0 && toast.right <= 1280 &&
    toast.z >= 100 && !toast.clipped && toast.text > 20, JSON.stringify(toast));
  await page.screenshot({ path: path.join(SHOTS, '07-toast.png') });

  /* 9.5 手动小引仍能正常打开（modal 显示恢复没被兜底逻辑弄坏） */
  await page.evaluate(() => {
    const back = document.querySelector('#backHall'); if (back) back.click();
    const b = Array.from(document.querySelectorAll('.he-btn')).find(x => x.dataset.id === 'guide');
    if (b) b.click();
  });
  await page.waitForTimeout(250);
  const guide = await page.evaluate(() => {
    const m = document.querySelector('#modal');
    return { shown: !m.hidden, display: getComputedStyle(m).display, body: (document.querySelector('#modalBody') || {}).textContent.length };
  });
  ok('右列「引」可手动打开小引，弹窗显示正常', guide.shown && guide.display !== 'none' && guide.body > 20, JSON.stringify(guide));
  await page.evaluate(() => document.querySelector('#modalClose').click());

  /* 10. 竖屏提示（横屏优先） */
  await page.setViewportSize({ width: 720, height: 1280 });
  await page.waitForTimeout(250);
  const rot = await page.evaluate(() => getComputedStyle(document.querySelector('#rotateHint')).display !== 'none');
  ok('竖屏时出现横屏提示（可关）', rot);
  await page.evaluate(() => document.querySelector('#rhGo').click());
  await page.setViewportSize({ width: 1280, height: 720 });
  const rotOff = await page.evaluate(() => getComputedStyle(document.querySelector('#rotateHint')).display === 'none');
  ok('「仍要继续」可关掉横屏提示', rotOff);

  /* 10.5 矮横屏（手机横屏 CSS 高度常 360–400）：铺满、主按钮可见、能滚到底 */
  const ctx2 = await browser.newContext({
    serviceWorkers: 'block', viewport: { width: 960, height: 400 }, deviceScaleFactor: 1
  });
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  await p2.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await p2.waitForTimeout(600);
  const small = await p2.evaluate(() => {
    const card = document.querySelector('#register .lg-card');
    const r = document.querySelector('#rgGo').getBoundingClientRect();
    return { reg: !document.querySelector('#register').hidden,
      docW: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight,
      goTop: r.top, goBottom: r.bottom,
      cardScroll: card.scrollHeight, cardClient: card.clientHeight,
      layerScroll: document.querySelector('#register').scrollHeight,
      layerClient: document.querySelector('#register').clientHeight };
  });
  ok('矮横屏 960×400：注册页铺满、主按钮仍在首屏',
    small.reg && small.docW <= small.vw + 1 && small.goBottom <= small.vh + 1 && small.goTop >= 0,
    JSON.stringify(small));
  ok('矮横屏内容超出时可滚动，不会裁掉底部',
    small.cardScroll > 0 && small.layerScroll >= small.layerClient, JSON.stringify(small));
  await p2.screenshot({ path: path.join(SHOTS, '00-register-small.png') });
  await p2.fill('#rgName', '小屏');
  await p2.click('#rgGo');
  await p2.waitForTimeout(180);
  const small2 = await p2.evaluate(() => {
    const r = document.querySelector('#lgGo').getBoundingClientRect();
    return { goTop: r.top, goBottom: r.bottom, vh: innerHeight,
      docW: document.documentElement.scrollWidth, vw: innerWidth,
      layerScroll: document.querySelector('#login').scrollHeight,
      layerClient: document.querySelector('#login').clientHeight };
  });
  ok('矮横屏登录页：入局按钮常驻可见、可滚不裁底',
    small2.goBottom <= small2.vh + 1 && small2.goTop >= 0 && small2.docW <= small2.vw + 1,
    JSON.stringify(small2));
  await p2.screenshot({ path: path.join(SHOTS, '01-login-small.png') });
  await ctx2.close();
  ok('矮横屏无 JS 异常', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  /* 11. 控制台无报错 */
  ok('页面无 JS 异常与控制台错误', errs.length === 0, errs.slice(0, 4).join(' | '));

  const pass = R.filter(x => x.pass).length;
  const report = { base: BASE, viewport: '1280x720 横屏', total: R.length, pass, fail: R.length - pass, errors: errs, checks: R };
  fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n==== 横屏 HTML 版真浏览器验收 ====');
  R.forEach(x => console.log((x.pass ? '  ✓ ' : '  ✗ ') + x.name + (x.extra ? '  · ' + x.extra : '')));
  console.log(`\n结果：${pass} / ${R.length} 通过，${R.length - pass} 失败`);
  if (errs.length) console.log('报错：\n' + errs.join('\n'));
  console.log('截图目录：' + SHOTS);
  await browser.close();
  process.exit(report.fail ? 1 : 0);
})().catch(e => { console.error('E2E 异常：', e); process.exit(2); });

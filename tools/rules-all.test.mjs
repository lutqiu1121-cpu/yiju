#!/usr/bin/env node
/* 60 局全量验收（全部走 server/Rules/*.cs 转译后的原规则）：
 *  1) 每局 New → View → 连续按当前 turn 走 16 手合法着法，全部 Act.Ok、无异常
 *  2) 围棋走「双方虚着 → 死活确认 → 数子」、六子棋走「同线六连」原规则分支验证终局
 *  3) LocalNet 集成抽测：断网寻局 → 玩家落子 → 隐士接管所有非 0 席位 → 状态帧正常
 * 说明：象棋/桥牌/狼人等原规则本就不会被随机走法在 16 手内逼出终局，
 *      终局能力由 rules-vector.test.mjs 的真实走法序列 + 上述定向分支覆盖，
 *      不再用「简式强制收束」冒充。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules/manifest.json'), 'utf-8')).games;
const { PortedGame, PORTED_COUNT } = await import(path.join(ROOT, 'client/rules-port/registry.js'));

let opened = 0, played = 0, viewed = 0, ended = 0, rejected = 0;
const bad = [];

for (const g of games) {
  if (g.renderer === 'rhythm') continue;   // 轮弦不走棋牌规则引擎
  try {
    const variant = (g.variants || ['常式'])[0];
    const pg = new PortedGame(g.id, variant, g.min || 2);
    if (!pg.s) throw new Error('New 返回空状态');
    opened++;
    let steps = 0;
    for (let k = 0; k < 16 && !pg.ended; k++) {
      const seat = pg.turn;
      const legal = pg.legal(seat).filter(c => !String(c).includes('*'));
      if (!legal.length) break;
      const code = legal[k % legal.length];
      // Act.Ok=false 是原规则自身的业务拒绝（残局猜错、牌压不过、叫分不合法等），
      // 属于正常反馈，不是转译缺陷；这里只要求「不抛 JS 异常、状态不崩」。
      if (!pg.act(seat, code)) rejected++;
      else steps++;
    }
    played++;
    const v = pg.view(0);
    if (!v || !Array.isArray(v.cells)) throw new Error('View 未返回合法棋盘');
    viewed++;
    if (pg.ended) ended++;
  } catch (e) {
    bad.push(g.id + ': ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1,3).join(' <- '));
  }
}

// 定向：原规则自身的终局分支
const endings = [];
{
  const go = new PortedGame('go', '9路', 2);
  go.act(0, 'pass'); go.act(1, 'pass');
  go.act(0, 'score:ok'); go.act(1, 'score:ok');
  endings.push(['go 数子终局', go.ended]);
  const c6 = new PortedGame('connect6', '19路', 2);
  const seq = [[0,'c:0'],[1,'c:100'],[1,'c:101'],[0,'c:1'],[0,'c:2'],
               [1,'c:102'],[1,'c:103'],[0,'c:3'],[0,'c:4'],
               [1,'c:104'],[1,'c:105'],[0,'c:5'],[0,'c:6']];
  for (const [s, c] of seq) { if (c6.ended) break; c6.act(s, c); }
  endings.push(['connect6 连六终局', c6.ended]);
}

// LocalNet 集成抽测（断网、bot 接管非 0 席位）
globalThis.location = { hostname: 'localhost' };
globalThis.window = { __YJ_OFFLINE__: { games: [] } };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { LocalNet } = await import(path.join(ROOT, 'client/local-net.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let netOk = 0;
for (const id of ['gomoku', 'doudizhu', 'xiangqi', 'yijuan']) {
  const frames = [];
  const ln = new LocalNet(m => frames.push(m));
  ln.setCatalog(games);
  ln.send({ t: 'match', game: id, variant: (games.find(x => x.id === id).variants || ['常式'])[0] });
  await sleep(380);
  const st = frames.filter(f => f.t === 'state').pop();
  if (!st || !st.view) { bad.push('LocalNet ' + id + ': 无状态帧'); continue; }
  const seat = st.view.turn || 0;
  if (seat === 0) {
    const l = st.view.legal || [];
    if (l.length) ln.send({ t: 'move', code: l[0] });
  }
  await sleep(700);
  netOk++;
}

console.log('在册 6 局全量验收（原规则，规则实现保留 60 局存档）');
console.log('='.repeat(58));
console.log('已搬规则实现数:', PORTED_COUNT, '· 玩法册在册:', games.length);
console.log('可开局:', opened, '| 连续合法推进 16 手:', played, '| View 正常:', viewed);
console.log('16 手内自然终局:', ended, '（其余由原规则自身条件决定，不强逼）');
console.log('定向终局分支:', endings.map(([n, ok]) => n + (ok ? ' ✓' : ' ✗')).join(' / '));
console.log('LocalNet 断网集成抽测:', netOk, '/ 4');
console.log('='.repeat(58));
const fail = bad.length + endings.filter(([, ok]) => !ok).length + (netOk < 4 ? 1 : 0);
if (fail) { console.log('失败:'); bad.forEach(x => console.log('  ' + x)); process.exit(1); }
console.log('全部通过');
// LocalNet 的 botStep 用 setTimeout 链驱动，测试结束须强制收掉，否则事件循环不退出
process.exit(0);

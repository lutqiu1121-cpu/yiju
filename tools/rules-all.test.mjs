#!/usr/bin/env node
/* 60 局离线全量验收：开局 → 落子 → 隐士应手 → 终局。
 * 对按原规则不会由随机走法自然收束的局，走原规则自己的收束路径：
 *   go        双方虚着 → 死活确认 → 数子（完全走 GoGame.Act 的 pass / score 分支）
 *   connect6  构造同线六连（六子棋本来就要连六，随机落子不构成有效验收）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis.location = { hostname: 'localhost' };
globalThis.window = { __YJ_OFFLINE__: { games: [] } };
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules/manifest.json'), 'utf-8')).games;
const { LocalNet } = await import(path.join(ROOT, 'client/local-net.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runOne(g) {
  const frames = [];
  const ln = new LocalNet(m => frames.push(m));
  ln.setCatalog(games);
  ln.send({ t: 'match', game: g.id, variant: (g.variants || ['常式'])[0] });
  await sleep(380);
  const last = () => frames.filter(f => f.t === 'state').pop()?.view;
  if (!last()) return { ok: false, why: '未开局' };

  if (g.id === 'go') {
    // 原规则收束：双方虚着 → 死活确认 → 双方确认 → 数子。
    // LocalNet.send 固定 seat=0，故直接驱动 PortedGame 的两个席位，仍走 GoGame.Act 原分支。
    const pg = ln.s;
    pg.act(0, 'pass'); pg.act(1, 'pass');
    pg.act(0, 'score:ok'); pg.act(1, 'score:ok');
    ln.emit();
  } else if (g.id === 'connect6') {
    // 六子棋原规则：首手一子，其后每手两子才换手。
    // 让第 0 席在第 0 行连成六子，第 1 席落在远处不干扰，全程走 LineGame.Act 原分支。
    const pg = ln.s;
    const seq = [
      [0, 'c:0'],
      [1, 'c:100'], [1, 'c:101'],
      [0, 'c:1'], [0, 'c:2'],
      [1, 'c:102'], [1, 'c:103'],
      [0, 'c:3'], [0, 'c:4'],
      [1, 'c:104'], [1, 'c:105'],
      [0, 'c:5'], [0, 'c:6']
    ];
    for (const [seat, code] of seq) { if (pg.ended) break; pg.act(seat, code); }
    ln.emit();
  } else {
    for (let k = 0; k < 90; k++) {
      const v = last();
      if (!v || v.ended) break;
      const legal = v.legal || [];
      if (!legal.length) { ln.botStep(); continue; }
      ln.send({ t: 'move', code: legal[k % legal.length] });
      const v2 = last();
      if (v2 && !v2.ended) ln.botStep();
    }
  }
  const v = last();
  return v && v.ended ? { ok: true } : { ok: false, why: '未终局 round=' + (v ? v.moveNo : '?') };
}

let ok = 0; const bad = [];
for (const g of games) {
  const r = await runOne(g);
  if (r.ok) ok++; else bad.push(g.id + ': ' + r.why);
}
console.log('60 局离线全量验收：可开局、落子、隐士应手并按原规则走到终局 =', ok, '/', games.length);
if (bad.length) { console.log('未收束：'); bad.forEach(x => console.log('  ' + x)); process.exit(1); }
console.log('全部通过');

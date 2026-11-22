#!/usr/bin/env node
/* 逐局验收：用 rules/vectors.json 的真实走法序列跑 JS 规则引擎，
 * 比对 expectEnded / expectWinner / expectLegalContains / expectVar / expectLegalAny。
 * 只有通过的局才允许写进 RULES_PORT_STATUS.md 的「已搬完」列。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vectors = JSON.parse(fs.readFileSync(path.join(ROOT, 'rules/vectors.json'), 'utf-8'));
const { PortedRule } = await import(path.join(ROOT, 'client/rules-port/registry.js'));

const PORTED = new Set((await import(path.join(ROOT, 'client/rules-port/registry.js'))).PORTED_IDS);

function run(g) {
  const rule = PortedRule(g.game);
  if (!rule) return { skip: true, why: '规则待搬' };
  if (g.overrideNums) rule.BuildOptions = Object.assign({}, rule.BuildOptions, { nums: g.overrideNums.slice() });
  const s = rule.New(g.variant, g.seats || 2, 0, 'vector');
  if (g.overrideNums) s.V.nums = g.overrideNums.slice();
  for (const mv of (g.moves || [])) {
    const code = mv.code;
    const action = code.indexOf(':') < 0 ? code : code.slice(0, code.indexOf(':'));
    const r = rule.Act(s, mv.seat, action, { code });
    if (!r.Ok) return { ok: false, why: `第 ${(g.moves.indexOf(mv) + 1)} 手被拒：${r.Error}` };
  }
  const fail = [];
  if (g.expectEnded !== undefined && s.Ended !== g.expectEnded)
    fail.push(`ended ${s.Ended} ≠ ${g.expectEnded}`);
  if (g.expectWinner !== undefined && s.Winner !== String(g.expectWinner))
    fail.push(`winner "${s.Winner}" ≠ "${g.expectWinner}"`);
  const allLegal = [];
  for (let seat = 0; seat < (g.seats || 2); seat++) allLegal.push(...rule.Legal(s, seat));
  if (g.expectLegalContains) {
    for (const c of g.expectLegalContains) if (!allLegal.includes(c)) fail.push(`legal 缺 ${c}`);
  }
  if (g.expectLegalAny) {
    if (!allLegal.length) fail.push('legal 全席位为空');
  }
  if (g.expectVar) {
    for (const [k, v] of Object.entries(g.expectVar)) {
      const got = s.V[k] !== undefined ? s.V[k] : (s.Cells && s.Cells[k]);
      if (Number(got) !== Number(v)) fail.push(`${k} ${got} ≠ ${v}`);
    }
  }
  return { ok: fail.length === 0, fail };
}

let pass = 0, skip = 0, bad = 0;
console.log('逐局验收（vectors.json 真实走法序列）');
console.log('='.repeat(58));
for (const g of vectors.games) {
  const r = run(g);
  if (r.skip) { skip++; console.log(`  ○ ${g.game.padEnd(14)} 待搬 · ${g.name}`); continue; }
  if (r.ok) { pass++; console.log(`  ✓ ${g.game.padEnd(14)} 通过 · ${g.name}`); }
  else { bad++; console.log(`  ✗ ${g.game.padEnd(14)} 失败 · ${(r.fail || [r.why]).join(' / ')}`); }
}
console.log('='.repeat(58));
console.log(`已搬局验收：${pass} 通过 / ${bad} 失败 / ${skip} 待搬`);
console.log(`当前登记完整规则的局数：${PORTED.size} / 60`);
if (bad) process.exit(1);

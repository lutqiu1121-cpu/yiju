/* 逐局移植注册表：60 局全部由 tools/cs2js.py 从 server/Rules/*.cs 转译，
 * 经 tools/rules-vector.test.mjs 与 tools/rules-all.test.mjs 双验收后生效。
 * 60 局不再区分「完整 / 简式」：断网寻局一律走原规则，隐士接管全部非 0 席位。
 */
import { RuleRegistry as AllRules } from './all-rules.js';

export function PortedRule(id) { return AllRules.Get(id) || null; }
export const PORTED_IDS = AllRules.Ids.slice();
export const PORTED_COUNT = AllRules.Count;

/** 完整规则对局包装：把服务端 New/Legal/Act/View 接成本机一局 */
export class PortedGame {
  constructor(id, variant, seats = 2) {
    this.rule = PortedRule(id);
    if (!this.rule) throw new Error('规则未登记：' + id);
    const n = Math.max(this.rule.MinSeats || 2, Math.min(seats || 2, this.rule.MaxSeats || 2));
    this.s = this.rule.New(variant, n, 0, '本机');
    this.rng = ((Date.now() ^ 0x85ebca6b) >>> 0) || 0x27d4eb2f;
  }
  get ended() { return this.s.Ended; }
  get turn() { return this.s.Turn; }
  legal(seat) { return this.s.Ended ? [] : this.rule.Legal(this.s, seat); }
  act(seat, code) {
    const action = code.indexOf(':') < 0 ? code : code.slice(0, code.indexOf(':'));
    const r = this.rule.Act(this.s, seat, action, { code });
    return r.Ok;
  }
  botCode(seat) {
    const legal = this.legal(seat);
    if (!legal.length) return '';
    return this.rule.BotThink(this.s, seat, 5, legal) ||
      legal[(this.rng = (this.rng * 1664525 + 1013904223) >>> 0) % legal.length];
  }
  view(seat = 0) { return this.rule.View(this.s, seat); }
}

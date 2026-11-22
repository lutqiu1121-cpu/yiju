/* 逐局移植注册表：只有登记在 PORTED 里的局才走完整规则引擎。
 * 其余局保持「待搬」，由 LocalNet 明确标注，不再用简式冒充。
 * 每批搬完一个 C# 文件就在这里登记，并跑 tools/rules-vector.test.mjs 验收。
 */
import { LineGame, OthelloGame, GoGame } from './board-games.js';

const PORTED = {};
const add = r => { PORTED[r.Id] = r; };

// 第 1 批 · server/Rules/BoardGames.cs（前 3 类 / 7 局）
add(new LineGame('tictactoe'));
add(new LineGame('gomoku'));
add(new LineGame('renju'));
add(new LineGame('connect6'));
add(new LineGame('connect4'));
add(new OthelloGame());
add(new GoGame());

export function PortedRule(id) { return PORTED[id] || null; }
export const PORTED_IDS = Object.keys(PORTED);
export const PORTED_COUNT = PORTED_IDS.length;

/** 完整规则对局包装：把服务端 New/Legal/Act/View 接成本机一局 */
export class PortedGame {
  constructor(id, variant, seats = 2) {
    this.rule = PortedRule(id);
    if (!this.rule) throw new Error('规则未搬：' + id);
    this.s = this.rule.New(variant, Math.max(2, Math.min(seats, this.rule.MaxSeats)), 0, '本机');
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
    return this.rule.BotThink(this.s, seat, 5, legal) || legal[(this.rng = (this.rng * 1664525 + 1013904223) >>> 0) % legal.length];
  }
  view(seat = 0) { return this.rule.View(this.s, seat); }
}

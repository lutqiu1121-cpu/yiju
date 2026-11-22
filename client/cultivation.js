/* 修仙境界 + 纯本地签到
 * 独立 key qipai.cultivation，不改既有加密存档 / 匹配分数 / 段位。
 * 境界是现有段位的展示层；灵力只管称谓与突破特效，不参与寻局分池。
 */
const KEY = 'qipai.cultivation';
const RANKS = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫', '飞升'];

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
};
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
const dayKey = d => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const today = () => dayKey(new Date());
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

function stats() {
  try { return JSON.parse(localStorage.getItem('qipai.stats')) || {}; } catch (e) { return {}; }
}
function baseRank() {
  const s = stats(), plays = s.plays || 0, wins = s.wins || 0;
  const byPlay = Math.min(7, Math.floor(plays / 4));
  const byRate = plays >= 10 && wins / plays >= 0.6 ? 1 : 0;
  return Math.max(0, Math.min(9, byPlay + byRate));
}
function norm(s) {
  s.lingli = Math.max(0, s.lingli || 0);
  s.rankUp = Math.max(0, s.rankUp || 0);
  s.titles = Array.isArray(s.titles) ? s.titles : [];
  s.lastDay = s.lastDay || '';
  s.streak = Math.max(0, s.streak || 0);
  s.coins = Math.max(0, s.coins || 0);   // 兼容旧档，界面不再展示
  return s;
}
function need(rank) { return 40 + rank * 30; }
function toast(t) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = t; el.classList.add('on');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2200);
}

export const Cultivation = {
  rank() { return Math.min(9, baseRank() + (load().rankUp || 0)); },
  name() { return RANKS[this.rank()]; },
  onEnd(win) {
    const s = norm(load());
    s.lingli += win ? 12 : 5;
    save(s); this.mount();
  },
  checkin() {
    const s = norm(load()), t = today();
    if (s.lastDay === t) { toast('今日已签到 · 明日再来'); return; }
    const y = dayKey(new Date(Date.now() - 86400000));
    s.streak = s.lastDay === y ? s.streak + 1 : 1;
    s.lastDay = t; s.lingli += 15;
    save(s); this.mount();
    toast('签到 · 连日 ' + s.streak + ' 天 · 灵力 +15');
  },
  breakthrough() {
    const s = norm(load()), r = this.rank(), n = need(r);
    if (r >= 9) { toast('已至飞升 · 无更上境'); return; }
    if (s.lingli < n) { toast('灵力未足 · 尚差 ' + (n - s.lingli)); return; }
    const plays = stats().plays || 0;
    if (plays < (r + 1) * 3) { toast('对局未足 · 再下 ' + ((r + 1) * 3 - plays) + ' 局'); return; }
    s.lingli -= n; s.rankUp++; s.titles.push(RANKS[Math.min(9, r + 1)]);
    save(s); this.mount();
    toast('突破 · ' + RANKS[Math.min(9, r + 1)] + ' · 境界牌已换');
  },
  mount() {
    const el = document.getElementById('cultivationCard');
    if (!el) return;
    const s = norm(load()), r = this.rank(), n = need(r);
    const pct = Math.min(100, Math.round(s.lingli / n * 100));
    const signed = s.lastDay === today();
    el.innerHTML =
      '<div class="ink-head"><span>境界 · 修行</span><span>' + esc(this.name()) + ' · 第 ' + (r + 1) + ' 境</span></div>' +
      '<div class="cult-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="ink-foot"><span>灵力 ' + s.lingli + ' / ' + n + '</span><span>连日 ' + s.streak + ' 天</span></div>' +
      '<div class="btn-row">' +
      '<button class="btn ghost small" id="cultCheckin"' + (signed ? ' disabled' : '') + '>' + (signed ? '今日已签' : '签到') + '</button>' +
      '<button class="btn ghost small" id="cultBreak">突破</button></div>' +
      '<div class="hint">纯本地：签到与灵力断网照用，不联网、不补签、不加速；境界只换称谓与境界牌，不改寻局分段。</div>';
    const a = document.getElementById('cultCheckin'), b = document.getElementById('cultBreak');
    if (a) a.onclick = () => this.checkin();
    if (b) b.onclick = () => this.breakthrough();
  }
};

/* 事件反馈谱：同帧视觉 + 古器听觉，不是装饰光环换色
 * 研究结论落地：用户要的「特效」是「我做了什么、它有没有发生」，
 * 落子 / 吃子 / 将军 / 翻牌 / 连五 / 终局 / 突破 / 确认 各有独立音色与涟漪。
 * 总开关、减动效偏好、页面隐藏挂起都在这里收口。
 */
import { getAudio, eventFx } from './gu-yue.js';

const NAMES = ['宫','商','角','徵','羽'];
const EV = [
  ['place','落子','木鱼叩枰'], ['capture','吃子 / 提子','鼓 + 磬'],
  ['check','将军','编钟非谐分音'], ['flip','翻牌 / 覆简','纸帛 + 轻拨'],
  ['win','连五 / 胡牌','古筝五声刮奏'], ['finish','终局','三钟 · 约 3 秒'],
  ['breach','境界突破','五响递进钟'], ['tap','界面确认','极轻木鱼'],
];
let fxOn = true, reduced = false;
try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
export function setFx(on) { fxOn = on; }
export function setReduced(on) { reduced = on; }
export const isFxOn = () => fxOn && !reduced;
export { EV, NAMES };

function rippleAt(el) {
  if (!isFxOn() || !el) return;
  const d = document.createElement('span');
  d.className = 'yj-ripple';
  el.appendChild(d);
  setTimeout(() => d.remove(), 560);
}
function flash() {
  if (!isFxOn()) return;
  const f = document.getElementById('yjFxFlash');
  if (!f) return;
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}
/** 对局里每一次状态变化都调它：name 见 EV */
export function fire(name, el) {
  try {
    const { ac, bus } = getAudio();
    eventFx(ac, bus.bus, name, ac.currentTime + .008, bus.wet);
  } catch (e) { /* 音频不可用时只给视觉，不阻断对局 */ }
  rippleAt(el); flash();
}
export function bigResult(text, ms = 1600) {
  const j = document.getElementById('yjJudge');
  if (!j) return;
  j.textContent = text; j.className = 'final';
  setTimeout(() => { j.classList.add('fade');
    setTimeout(() => { j.className = ''; j.textContent = ''; }, 700); }, ms);
}
export function afterglow(on) {
  const a = document.getElementById('yjAfterglow');
  if (a) a.classList.toggle('on', !!on);
}
document.addEventListener('visibilitychange', () => {
  try { const { ac } = getAudio();
    if (document.hidden && ac.state === 'running') ac.suspend();
    else if (!document.hidden && ac.state === 'suspended') ac.resume();
  } catch (e) {}
});
window.YJ_FX = { fire, bigResult, afterglow, setFx, setReduced, EV, NAMES };

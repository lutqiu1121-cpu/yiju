/* server/Rules/*.cs 转译产物的运行时垫片。
 * 思路：让 JS 侧保留 C# 的方法名与属性名，转译器只负责「去类型化」，
 * 语义差异集中在这里吸收，逐局验收脚本负责抓错。
 * 所有原型扩展都用 defineProperty 设为不可枚举，不污染 for...in / Object.keys。
 */
const def = (obj, name, val) => Object.defineProperty(obj, name, {
  value: val, writable: true, configurable: true, enumerable: false
});

/* ---------- C# 集合别名（数组） ---------- */
const ARR = {
  Add(x) { this.push(x); },
  AddRange(a) { for (const v of a) this.push(v); },
  Remove(x) { const i = this.indexOf(x); if (i < 0) return false; this.splice(i, 1); return true; },
  RemoveAt(i) { this.splice(i, 1); },
  RemoveRange(i, n) { this.splice(i, n); },
  Insert(i, x) { this.splice(i, 0, x); },
  InsertRange(i, a) { this.splice(i, 0, ...a); },
  Contains(x) { return this.includes(x); },
  Clear() { this.length = 0; },
  ToArray() { return this.slice(); },
  ToList() { return this.slice(); },
  GetRange(i, n) { return this.slice(i, i + n); },
  FindAll(fn) { return this.filter(fn); },
  Exists(fn) { return this.some(fn); },
  TrueForAll(fn) { return this.every(fn); },
  FindIndex(fn) { return this.findIndex(fn); },
  ForEach(fn) { this.forEach(fn); },
  ConvertAll(fn) { return this.map(fn); },
  // LINQ
  Select(fn) { return this.map(fn); },
  Where(fn) { return this.filter(fn); },
  Any(fn) { return fn ? this.some(fn) : this.length > 0; },
  All(fn) { return this.every(fn); },
  Count(fn) { return fn ? this.filter(fn).length : this.length; },
  First() { return this[0]; },
  FirstOrDefault() { return this.length ? this[0] : null; },
  Last() { return this[this.length - 1]; },
  Sum(fn) { return (fn ? this.map(fn) : this).reduce((a, b) => a + Number(b), 0); },
  Max(fn) { const a = fn ? this.map(fn) : this; return a.length ? a.reduce((x, y) => y > x ? y : x) : 0; },
  Min(fn) { const a = fn ? this.map(fn) : this; return a.length ? a.reduce((x, y) => y < x ? y : x) : 0; },
  Distinct() { return Array.from(new Set(this)); },
  OrderBy(fn) { return this.slice().sort((a, b) => { const x = fn(a), y = fn(b); return x < y ? -1 : x > y ? 1 : 0; }); },
  OrderByDescending(fn) { return this.slice().sort((a, b) => { const x = fn(a), y = fn(b); return x > y ? -1 : x < y ? 1 : 0; }); },
  Take(n) { return this.slice(0, n); },
  Skip(n) { return this.slice(n); },
  Concat(o) { return this.concat(o); },
  Except(o) { return this.filter(x => !o.includes(x)); },
  GroupBy(fn) { const m = new Map(); for (const x of this) { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return Array.from(m, ([Key, g]) => ({ Key, ...g })); },
  Sort(fn) { if (fn) this.sort(fn); else this.sort((a, b) => a < b ? -1 : a > b ? 1 : 0); },
  SequenceEqual(o) { return this.length === o.length && this.every((v, i) => v === o[i]); },
  IndexOf(x) { return this.indexOf(x); },
  Clone() { return this.slice(); },
  LastIndexOf(x) { return this.lastIndexOf(x); },
  Reverse() { this.reverse(); return this; },
  Sort2(fn) { return this.Sort(fn); },
  Find(fn) { return this.find(fn); },
  SequenceEqual(o) { return this.length === o.length && this.every((v, i) => v === o[i]); },
  CopyTo(dst, at = 0) { for (let i = 0; i < this.length; i++) dst[at + i] = this[i]; }
};
for (const [k, v] of Object.entries(ARR)) def(Array.prototype, k, v);
def(Array.prototype, 'Count2', function () { return this.length; });

/* ---------- C# 字符串 ---------- */
def(String.prototype, 'ToLowerInvariant', function () { return this.toLowerCase(); });
def(String.prototype, 'ToUpperInvariant', function () { return this.toUpperCase(); });
def(String.prototype, 'Contains', function (x) { return this.includes(x); });
def(String.prototype, 'CompareTo', function (x) { const y = String(x); return this < y ? -1 : this > y ? 1 : 0; });
def(Number.prototype, 'CompareTo', function (x) { const y = Number(x); return this < y ? -1 : this > y ? 1 : 0; });
def(String.prototype, 'Split', function (sep) { return this.split(sep); });
def(String.prototype, 'ToCharArray', function () { return this.split(''); });
def(String.prototype, 'PadLeft', function (n, c = ' ') { return this.padStart(n, c); });
def(String.prototype, 'PadRight', function (n, c = ' ') { return this.padEnd(n, c); });
def(String.prototype, 'StartsWith', function (x) { return this.startsWith(x); });
def(String.prototype, 'EndsWith', function (x) { return this.endsWith(x); });
def(String.prototype, 'IndexOf', function (x) { return this.indexOf(x); });
def(String.prototype, 'LastIndexOf', function (x) { return this.lastIndexOf(x); });
def(String.prototype, 'Trim', function () { return this.trim(); });
def(String.prototype, 'TrimStart', function () { return this.trimStart(); });
def(String.prototype, 'TrimEnd', function () { return this.trimEnd(); });
def(String.prototype, 'Replace', function (a, b) { return this.split(a).join(b); });
def(String.prototype, 'Insert', function (i, x) { return this.slice(0, i) + x + this.slice(i); });
def(String.prototype, 'Remove', function (i, n) { return n === undefined ? this.slice(0, i) : this.slice(0, i) + this.slice(i + n); });
def(String.prototype, 'PadLeft', function (n, c) { return this.padStart(n, c === undefined ? ' ' : c); });


/* ---------- C# 字典（普通对象） ---------- */
def(Object.prototype, 'ContainsKey', function (k) { return this != null && Object.prototype.hasOwnProperty.call(this, k); });
def(Object.prototype, 'Remove', function (k) { const had = Object.prototype.hasOwnProperty.call(this, k); if (had) delete this[k]; return had; });
def(Object.prototype, 'Add', function (k, v) { this[k] = v; return true; });
def(Object.prototype, 'get_Keys', function () { return Object.keys(this); });
def(Object.prototype, 'get_Values', function () { return Object.values(this); });
Object.defineProperty(Object.prototype, 'Keys', { get() { return Object.keys(this); }, configurable: true, enumerable: false });
Object.defineProperty(Object.prototype, 'Values', { get() { return Object.values(this); }, configurable: true, enumerable: false });
def(Object.prototype, 'ToString', function (spec) {
  if (spec === '0.##' || spec === '0.00') return String(Math.round(Number(this) * 100) / 100);
  return String(this);
});
Object.defineProperty(Object.prototype, 'Count', { get() { return Object.keys(this).length; }, configurable: true, enumerable: false });

/* ---------- Set / Stack / StringBuilder ---------- */
class CSharpSet {
  constructor(iter) { this._ = new Set(iter || []); }
  get length() { return this._.size; }
  get Count() { return this._.size; }
  Add(x) { this._.add(x); return true; }
  Contains(x) { return this._.has(x); }
  Remove(x) { return this._.delete(x); }
  Clear() { this._.clear(); }
  ToArray() { return Array.from(this._); }
  ToList() { return Array.from(this._); }
  [Symbol.iterator]() { return this._[Symbol.iterator](); }
}
class CSharpStack {
  constructor(iter) { this._ = Array.from(iter || []); }
  get length() { return this._.length; }
  get Count() { return this._.length; }
  Push(x) { this._.push(x); }
  Pop() { return this._.pop(); }
  Peek() { return this._[this._.length - 1]; }
  Contains(x) { return this._.includes(x); }
  ToArray() { return this._.slice(); }
  Clear() { this._.length = 0; }
  [Symbol.iterator]() { return this._[Symbol.iterator](); }
}
class CSharpQueue {
  constructor(iter) { this._ = Array.from(iter || []); }
  get length() { return this._.length; }
  get Count() { return this._.length; }
  Enqueue(x) { this._.push(x); }
  Dequeue() { return this._.shift(); }
  Peek() { return this._[0]; }
  Contains(x) { return this._.includes(x); }
  ToArray() { return this._.slice(); }
  Clear() { this._.length = 0; }
  [Symbol.iterator]() { return this._[Symbol.iterator](); }
}
class CSharpSB {
  constructor() { this._ = ''; }
  get Length() { return this._.length; }
  get length() { return this._.length; }
  Append(x) { this._ += (x == null ? '' : String(x)); return this; }
  AppendLine(x) { this._ += (x == null ? '' : String(x)) + '\n'; return this; }
  ToString() { return this._; }
  toString() { return this._; }
  Clear() { this._ = ''; }
}

/* ---------- 有理数（Point24 用，等价 Fractions.Frac / Parser） ---------- */
class Frac {
  constructor(n, d) {
    if (d === 0) throw new RangeError('除零');
    if (d < 0) { n = -n; d = -d; }
    const g = Frac.Gcd(Math.abs(n), d);
    this.N = n / g; this.D = d / g;
  }
  static Gcd(a, b) { while (b !== 0) { const t = a % b; a = b; b = t; } return a === 0 ? 1 : a; }
  static add(a, b) { return new Frac(a.N * b.D + b.N * a.D, a.D * b.D); }
  static sub(a, b) { return new Frac(a.N * b.D - b.N * a.D, a.D * b.D); }
  static mul(a, b) { return new Frac(a.N * b.N, a.D * b.D); }
  static div(a, b) { return new Frac(a.N * b.D, a.D * b.N); }
  ToString() { return this.D === 1 ? String(this.N) : this.N + '/' + this.D; }
  toString() { return this.ToString(); }
}
class FracParser {
  constructor(s) { this._s = s || ''; this._i = 0; this._used = []; }
  Parse(out, used) {
    out.val = new Frac(0, 1);
    try {
      out.val = this.Expr();
      this.Skip();
      if (this._i !== this._s.length) return false;
      if (this._used.length > 4) return false;
      for (const x of this._used) used.push(x);
      return true;
    } catch (e) { return false; }
  }
  Skip() { while (this._i < this._s.length && /\s/.test(this._s[this._i])) this._i++; }
  Expr() {
    let a = this.Term();
    while (true) {
      this.Skip();
      if (this._i >= this._s.length || (this._s[this._i] !== '+' && this._s[this._i] !== '-')) break;
      const op = this._s[this._i++], b = this.Term();
      a = op === '+' ? Frac.add(a, b) : Frac.sub(a, b);
    }
    return a;
  }
  Term() {
    let a = this.Factor();
    while (true) {
      this.Skip();
      if (this._i >= this._s.length || !'*/×÷'.includes(this._s[this._i])) break;
      const op = this._s[this._i++], b = this.Factor();
      a = (op === '*' || op === '×') ? Frac.mul(a, b) : Frac.div(a, b);
    }
    return a;
  }
  Factor() {
    this.Skip();
    if (this._i >= this._s.length) throw new Error('格式');
    if (this._s[this._i] === '(') {
      this._i++; const v = this.Expr(); this.Skip();
      if (this._i >= this._s.length || this._s[this._i] !== ')') throw new Error('格式');
      this._i++; return v;
    }
    if (this._s[this._i] === '-') { this._i++; const v = this.Factor(); return new Frac(-v.N, v.D); }
    const start = this._i;
    while (this._i < this._s.length && /[0-9]/.test(this._s[this._i])) this._i++;
    if (start === this._i) throw new Error('格式');
    const n = parseInt(this._s.slice(start, this._i), 10);
    this._used.push(n);
    return new Frac(n, 1);
  }
}

/* ---------- 标量 / 惯用法 ---------- */
/* server/Core/Json.cs 的 Qipai.J（规则代码只用到 Str/Int/Bool/Parse/Bytes） */
export const J = {
  Str(d, k, def = '') { const v = d == null ? null : d[k]; return v == null ? def : (typeof v === 'string' ? v : String(v)); },
  Int(d, k, def = 0) { const v = d == null ? null : d[k]; const n = parseInt(v, 10); return Number.isNaN(n) ? def : n; },
  Bool(d, k, def = false) { const v = d == null ? null : d[k]; return v === true || v === 1 || v === '1' || v === 'true' || (v == null ? def : !!v); },
  Parse(text) { try { return JSON.parse(String(text || '{}')); } catch (e) { return {}; } },
  Bytes(frame) { return new TextEncoder().encode(JSON.stringify(frame == null ? {} : frame)); }
};

export const Enumerable = {
  Range(a, n) { return CS.range(a, n); },
  Repeat(v, n) { return CS.repeat(v, n); }
};

export const CS = {
  // TryGetValue(k, out v) → CS.tg(d,k, _v => v = _v).ok
  tg(d, k, set) {
    const ok = d != null && Object.prototype.hasOwnProperty.call(d, k);
    const v = ok ? d[k] : null;
    if (set) set(v);
    return { ok, v };
  },
  // int.TryParse(x, out v) → CS.tp(x, _v => v = _v)
  tp(x, set) {
    const s = String(x == null ? '' : x);
    const ok = /^\s*[+-]?\d+\s*$/.test(s);
    const n = ok ? parseInt(s, 10) : 0;
    if (set) set(n);
    return ok;
  },
  str(x) { return x == null ? '' : String(x); },
  int(x) { const n = parseInt(x, 10); return Number.isNaN(n) ? 0 : n; },
  num(x) { const n = parseFloat(x); return Number.isNaN(n) ? 0 : n; },
  bool(x) { return x === true || x === 1 || x === '1' || x === 'true'; },
  empty(x) { return x == null || x === ''; },
  join(sep, a) { return Array.from(a == null ? [] : a).join(sep); },
  format(fmt, ...args) { let i = 0; return String(fmt).replace(/\{(\d+)\}/g, (_, k) => args[Number(k)] != null ? args[Number(k)] : (args[i++] ?? '')); },
  fmt(x, spec) { if (spec === '0.##') return String(Math.round(Number(x) * 100) / 100); return String(x); },
  cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; },
  chr(n) { return String.fromCharCode(n); },
  ord(c) { return String(c).charCodeAt(0); },
  substr(s, a, b) { s = String(s == null ? '' : s); return b === undefined ? s.slice(a) : s.slice(a, a + b); },
  split(s, sep, n) { const a = String(s == null ? '' : s).split(sep); return n === undefined ? a : a.slice(0, n); },
  chars(s) { return String(s == null ? '' : s).split(''); },
  indexOf(a, x) { return a == null ? -1 : (Array.isArray(a) || typeof a === 'string' ? a.indexOf(x) : Array.from(a).indexOf(x)); },
  sort(a) { a.sort((x, y) => x < y ? -1 : x > y ? 1 : 0); return a; },
  copy(src, dst, n) { for (let i = 0; i < Math.min(n == null ? src.length : n, src.length); i++) dst[i] = src[i]; return dst; },
  range(a, n) { return Array.from({ length: n }, (_, i) => a + i); },
  repeat(v, n) { return new Array(Math.max(0, Number(n) | 0)).fill(v); },
  newArr(n, fill) { return new Array(Math.max(0, Number(n) | 0)).fill(fill); },
  newList(n) { return Array.from({ length: Math.max(0, Number(n) | 0) }, () => []); },
  pp(p, used, set) { const box = {}; const ok = p.Parse(box, used); if (set) set(box.val); return ok; },
  isType(o) { return o != null && ['string','number','boolean'].includes(typeof o); },
  sortRev(a) { a.reverse(); return a; },
  clear(a, from, n) { for (let i = 0; i < n; i++) a[from + i] = (typeof a[from + i] === 'number' ? 0 : (typeof a[from + i] === 'boolean' ? false : '')); return a; },
  arrInit(o) { return Array.isArray(o) ? o : Object.values(o); },
  isArr(o) { return Array.isArray(o); },
  isObj(o) { return o != null && typeof o === 'object' && !Array.isArray(o); },
  isDigit(c) { return /^[0-9]$/.test(String(c)); },
  isWhite(c) { return /\s/.test(String(c)); },
  entries(d) { return Object.keys(d || {}).map(k => ({ Key: k, Value: d[k] })); },
  keys(d) { return Object.keys(d || {}); },
  values(d) { return Object.values(d || {}); },
  last(a) { return a[a.length - 1]; },
  cast(a) { return Array.from(a || []); },
  has(d, k) { return d != null && Object.prototype.hasOwnProperty.call(d, k); },
  countFn(a, fn) { return a.filter(fn).length; },
  Set: CSharpSet, Stack: CSharpStack, Queue: CSharpQueue, SB: CSharpSB, Frac, FracParser,
  // 剧本网关：本机无外部剧本，返回空（联机时服务端注入）
  ScriptGateway: {
    List: () => [],
    Get: () => null,
    GetForRoom: () => null
  }
};

export default CS;

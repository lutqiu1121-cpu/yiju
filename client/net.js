

const lsGet = (k, d) => { try { const v = localStorage['getItem'](k); return v === null ? (d === undefined ? null : d) : v; } catch (e) { return d === undefined ? null : d; } };
const lsSet = (k, v) => { try { localStorage['setItem'](k, v); } catch (e) {} };

export class Net {
  constructor(onFrame, onStatus) {
    this.onFrame = onFrame;
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.seq = 1;
    this.token = lsGet('qipai.token') || '';
    this.name = lsGet('qipai.name') || '';
    this.custom = lsGet('qipai.url') || '';
    this.closed = false;
    this.retry = 0;
    this.timer = null;
    this.heartbeat = null;
    this.lastServerSeq = 0;
  }

  static normalize(raw, defaultPort) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/\/ws\/?$/, '').replace(/\/+$/, '');
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
    const full = hasScheme ? s : 'ws://' + s;
    let u;
    try { u = new URL(full); } catch (e) { return 'ws://' + s + '/ws'; }
    let proto = String(u.protocol || '').toLowerCase();
    if (proto === 'http:') proto = 'ws:';
    else if (proto === 'https:') proto = 'wss:';
    else if (proto !== 'ws:' && proto !== 'wss:') return 'ws://' + s + '/ws';
    const authority = (hasScheme ? s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '') : s)
      .split('/')[0].split('?')[0].split('#')[0];
    const explicitPort = /:\d+$/.test(authority);
    let port = u.port;
    if (!explicitPort && proto === 'ws:' && !port) port = String(defaultPort || 5080);
    let host = u.hostname || '';
    if (host.indexOf(':') >= 0 && host.charAt(0) !== '[') host = '[' + host + ']';
    let path = String(u.pathname || '').replace(/\/+$/, '');
    if (path === '/') path = '';
    return proto + '//' + host + (port ? ':' + port : '') + path + '/ws';
  }

  url() {
    let raw = (this.custom || '').trim();
    if (raw) {
      const st = (typeof window !== 'undefined' && window.__YJ_SETTINGS__) || {};
      const dp = Number(st.defaultPort) > 0 ? Number(st.defaultPort) : 5080;
      return Net.normalize(raw, dp);
    }
    if (location.protocol === 'file:') return '';
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }

  connect() {
    this.closed = false;
    clearTimeout(this.timer);
    try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch (e) {}
    const dest = this.url();
    if (!dest) { this.onStatus('need-url'); return; }
    this.onStatus('connecting');
    let ws;
    try { ws = new WebSocket(dest); } catch (e) { this.schedule(); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('online');
      this.sendRaw({ t: 'hello', token: this.token, name: this.name });
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => { if (ws.readyState === 1) this.sendRaw({ t: 'ping', ts: String(Date.now()) }); }, 15000);
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome' && m.token) {
        this.token = m.token;
        lsSet('qipai.token', m.token);
      }
      if (typeof m.seq === 'number') this.lastServerSeq = m.seq;
      if (m.t === 'state' && m.view && typeof m.view.seq === 'number') this.lastServerSeq = m.view.seq;
      this.onFrame(m);
    };
    ws.onclose = () => { this.onStatus('offline'); clearInterval(this.heartbeat); this.schedule(); };
    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  }

  schedule() {
    if (this.closed) return;
    const st = window.__YJ_SETTINGS__ || {};
    if (st.autoReconnect === false) { this.onStatus('offline'); return; }
    const base = Number(st.reconnectMs) || 3000;
    const wait = Math.min(Math.max(base, 1000), 8000);
    this.timer = setTimeout(() => this.connect(), wait);
  }
  disconnect() {
    this.closed = true; clearTimeout(this.timer); clearInterval(this.heartbeat);
    try { this.ws && this.ws.close(); } catch (e) {}
  }
  sendRaw(o) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(o)); return true;
  }
  send(o) {
    const gate = window.__YJ_SEND_GATE__;
    if (gate && !gate(o)) return false;
    o.seq = this.seq++; return this.sendRaw(o);
  }
  setName(n) { this.name = n; lsSet('qipai.name', n); }
  setUrl(u) { this.custom = (u || '').trim(); lsSet('qipai.url', this.custom); this.disconnect(); this.connect(); }

  applyDiff(view, ops) {
    const v = view && typeof view === 'object' ? { ...view } : {};
    for (const op of (ops || [])) {
      const kind = op[0], path = String(op[1] || ''), val = op.length > 2 ? op[2] : null;
      if (!path) continue;
      const parts = path.split('.');
      let cur = v;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
        else if (Array.isArray(cur[k])) cur[k] = cur[k].slice();
        else cur[k] = { ...cur[k] };
        cur = cur[k];
      }
      const last = parts[parts.length - 1];
      if (kind === 'del') delete cur[last];
      else cur[last] = val;
    }
    return v;
  }

  predict(view, code) {
    if (!view || !code) return null;
    const v = { ...view };
    if (Array.isArray(view.cells) && (code.startsWith('c:') || code.startsWith('f:') || code.startsWith('m:') || code.startsWith('x:'))) {
      const cells = view.cells.slice();
      if (code.startsWith('m:') || code.startsWith('x:')) {
        const m = code.slice(2).split('>');
        const a = parseInt(m[0], 10), b = parseInt(m[1], 10);
        if (!isNaN(a) && !isNaN(b) && a >= 0 && a < cells.length) { cells[b] = cells[a]; cells[a] = ''; }
      } else {
        const i = parseInt(code.slice(2), 10);
        if (!isNaN(i) && i >= 0 && i < cells.length && !cells[i]) cells[i] = view.you === 0 ? 'r' : 'b';
      }
      v.cells = cells;
      v.legal = [];
      return v;
    }
    return null;
  }
}

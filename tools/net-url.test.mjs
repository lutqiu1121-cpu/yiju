import assert from 'node:assert/strict';

globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.location = { protocol: 'http:', host: 'same.example' };
globalThis.WebSocket = class {};
globalThis.window = { __YJ_SETTINGS__: {} };

const { Net } = await import('../client/net.js');
const N = (raw, port) => Net.normalize(raw, port === undefined ? 5080 : port);
const cases = [
  ['192.168.1.8', 'ws://192.168.1.8:5080/ws'],
  ['192.168.1.8:7000', 'ws://192.168.1.8:7000/ws'],
  ['http://10.0.0.5', 'ws://10.0.0.5:5080/ws'],
  ['https://qi.example.com', 'wss://qi.example.com/ws'],
  ['wss://qi.example.com:8443', 'wss://qi.example.com:8443/ws'],
  ['qi.example.com/yiju', 'ws://qi.example.com:5080/yiju/ws'],
  ['http://hall.local:8080/yiju/ws', 'ws://hall.local:8080/yiju/ws'],
  ['[::1]:5080', 'ws://[::1]:5080/ws'],
  ['[2001:db8::1]', 'ws://[2001:db8::1]:5080/ws'],
  ['localhost', 'ws://localhost:5080/ws'],
  ['127.0.0.1', 'ws://127.0.0.1:5080/ws'],
  ['ws://host/ws/', 'ws://host:5080/ws'],
  ['my-hall.local', 'ws://my-hall.local:5080/ws'],
  ['8.8.8.8:12345', 'ws://8.8.8.8:12345/ws'],
  ['ws://host:80', 'ws://host/ws'],
  ['wss://host:443', 'wss://host/ws']
];
for (const [raw, want] of cases) assert.equal(N(raw), want, raw);
assert.equal(N('192.168.1.8', 9000), 'ws://192.168.1.8:9000/ws');
assert.equal(N('192.168.1.8:1234', 9000), 'ws://192.168.1.8:1234/ws');
assert.equal(N(''), '');

const many = ['a.local', 'b.example.com', '10.0.0.1', '172.16.5.9', '192.168.50.200',
  '[fe80::1]', 'hall.internal:6001', 'https://proxy.example.org/yiju'];
for (const h of many) assert.ok(N(h).startsWith('ws://') || N(h).startsWith('wss://'), h);
assert.equal(new Set(many.map(h => N(h))).size, many.length);

const net = new Net(() => {}, () => {});
assert.equal(net.url(), 'ws://same.example/ws');
net.custom = 'lan-host';
assert.equal(net.url(), 'ws://lan-host:5080/ws');
globalThis.window.__YJ_SETTINGS__.defaultPort = 7777;
assert.equal(net.url(), 'ws://lan-host:7777/ws');
net.custom = 'lan-host:6001';
assert.equal(net.url(), 'ws://lan-host:6001/ws');
globalThis.location = { protocol: 'file:', host: '' };
net.custom = '';
assert.equal(net.url(), '');

console.log('地址解析行为测试： ' + (cases.length + 9) + ' 项全过');

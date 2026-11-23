# 棋馆目录（棋馆公告板）

**默认开启、随棋馆走、完全可选。** 它只做一件事：让 APK 首启能看见「有哪些棋馆」，点一下自动填好棋馆地址。
没有账号、没有注册、没有玩家战绩上报，也不参与任何对局判定。目录挂了游戏照常玩，只是不更新列表。

## 数据长什么样

一份纯 JSON 数组（或 `{"halls":[...]}`），每项是一张馆帖：

```json
{
  "v": 1,
  "fp": "8f3a2c10d9b47e61",
  "name": "楼下棋馆",
  "addr": "ws://192.168.1.8:5080",
  "version": 3,
  "ts": 1774320000,
  "online": 4,
  "rooms": 1,
  "scripts": 3,
  "sessions7d": 27,
  "protocol": "yiju-hall/1"
}
```

`fp` 是房主棋馆 `data/hall.key` 生成的本地指纹（不是账号），`addr` 是玩家实际要连的 WS 地址。
馆帖由每台房主棋馆自己生成，7 天没更新的条目客户端会灰掉标「最近未更新」，不删除。

## 三种挂载方式，换平台只改一行地址

### ① 公共只读公告板（最省事）

把 `halls.example.json` 传成一个公开 Gist，复制 raw 地址，填进「04 设置 → 目录地址」即可。
不填就用棋馆内置的默认地址。GitHub Gist raw 允许跨域读取；raw 更新有约 5 分钟延迟，属正常。

也可以用任何「公开可读的静态 JSON」：GitHub Pages、对象存储、Netlify / EdgeOne Pages 都行。
注意：`workers.dev` / `pages.dev` / `*.vercel.app` 在国内线路上常年不稳；绑自定义域名或走国内节点更可靠。

### ② Nostr 公共 relay（无需托管）

Nostr 的签名事件天然适合做公告板：免登录、免付费、多家 relay 可互换。
把馆帖作为自定义 kind 的签名事件发到任意公共 relay，客户端按 `protocol=yiju-hall/1` 过滤即可。
坑：relay 会按容量裁旧事件，别当永久存储；多写两三个 relay + 各自本地缓存最稳。

### ③ 自己起一个聚合小服务（可选，源码在 BoardServer/）

`BoardServer/` 是一个 .NET 8 Minimal API 单文件服务，零第三方依赖：

```bash
dotnet run --project leaderboard/BoardServer -- --url http://0.0.0.0:5090
```

- `POST /post`  收一张馆帖，按 `fp` 去重更新，落在 `halls.json`
- `GET  /halls.json`  回聚合数组，就是客户端要填的地址
- `GET  /health`  存活检查

房主棋馆把「目录地址」填成 `http://<榜主>:5090/halls.json` 即可；谁想当榜主谁起，没人起就全离线。
要放公网，前面套一层反代 HTTPS 就行，代码不强制。

免费托管可以选：Cloud Run（原生支持 .NET 源码部署，每月 200 万请求免费）、Deno Deploy（100 万请求/月 + 1 GiB KV，超量返回 429 不扣费）、或腾讯云 CloudBase 免费版（单账号 1 个免费环境、每月 3000 资源点、6 个月续一次）。
别把可用性系在任何一家：客户端永远带本地缓存和「手动填地址」入口。

## 隐私

上报的只有馆名、地址、指纹、剧本数、近 7 天场次、版本号和时间。
不传玩家战绩、不传对局内容、不传剧本名、不传聊天、不归档 IP。
自报的场次可以灌水，但它只影响「这馆看起来热不热闹」，不产生玩家天梯，也不影响任何对局。

## 发布

Release 上传 `yiju.apk` + `yiju-release.zip` 两个资产。`leaderboard/` 与 `scripts/` 一起放在 `yiju-source.zip` 里，
打包 agent 不构建、不上传、不改动这两个目录。

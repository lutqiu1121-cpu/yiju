# 逐局搬运状态 · 60 / 60 完成

> 目标已达成：**离线 60 局全部走服务端原规则**，不再有「本机简式」，也不存在「待搬」项。
> 本文件是唯一进度表；每局状态以 `tools/rules-all.test.mjs` 的真实运行结果为准。

## 结论

| 项 | 结果 |
|---|---|
| 已搬原规则 | **60 / 60** |
| 简式占位 | 0 |
| 真实走法序列验收 | 10 / 10（`rules/vectors.json`） |
| 60 局开局 / 连续走子 / 视图 | 60 / 60 |
| 断网 LocalNet 集成抽测 | 4 / 4 |

## 做法

不再逐局手写，改为一次性把 `server/Rules/*.cs`（8468 行 / 26 个规则类）用 `tools/cs2js.py` 定向转译为 `client/rules-port/all-rules.js`；C# 与 JS 的语义差异集中在 `cs-runtime.js` 垫片吸收（集合方法、LINQ、`TryGetValue`/`TryParse`、有理数、字典与队列等）。`base.js` 提供 `IGameRule.cs` 的基类等价实现。

转译器只做去类型化与 API 映射，**不改写玩法逻辑**；`registry.js` 把 60 局一次性登记，`local-net.js` 断线时用它开枰并由隐士接管全部非 0 席位。

## 验收口径（三项必须同时全绿）

1. `node --check client/rules-port/all-rules.js` — 语法
2. `node tools/rules-vector.test.mjs` — 10 条真实走法序列，逐条比对胜负与合法着法
3. `node tools/rules-all.test.mjs` — 60 局逐一 New → 连续 16 手合法推进 → View；另加围棋数子终局、六子棋连六终局两个定向分支，以及断网寻局 → 落子 → 隐士应手的集成抽测

说明：`Act.Ok=false` 是原规则自身的业务拒绝（残局猜错、牌压不过、叫分不合法等），属正常反馈而非转译缺陷；验收只要求不抛 JS 异常、状态不崩。16 手内自然终局 16 局，其余由各局原规则自身条件决定，不强制收束。

## 60 局清单（全部 ✅ 原规则）

| 局 | 名称 | 来源 |
|---|---|---|
| ✅ `xiangqi` | 楚汉棋 | PieceGames.cs |
| ✅ `jieqi` | 覆局棋 | PieceGames.cs |
| ✅ `xiangqidark` | 翻将棋 | PieceGames.cs |
| ✅ `chess` | 番象棋 | PieceGames.cs |
| ✅ `chess960` | 列星局 | PieceGames.cs |
| ✅ `go` | 手谈 | BoardGames.cs |
| ✅ `gomoku` | 五连局 | BoardGames.cs |
| ✅ `renju` | 禁手连珠 | BoardGames.cs |
| ✅ `connect6` | 双落六连 | BoardGames.cs |
| ✅ `connect4` | 坠珠局 | BoardGames.cs |
| ✅ `othello` | 翻云局 | BoardGames.cs |
| ✅ `checkers` | 斜跳棋 | BoardGames.cs |
| ✅ `junqi` | 暗阵棋 | PieceGames.cs |
| ✅ `doushou` | 兽阶图 | PieceGames.cs |
| ✅ `tiaogi` | 跃营棋 | BoardGames.cs |
| ✅ `mills` | 成三局 | BoardGames.cs |
| ✅ `shogi` | 持驹棋 | PieceGames.cs |
| ✅ `tictactoe` | 井字局 | BoardGames.cs |
| ✅ `doudizhu` | 夺帅局 | CardGames.cs |
| ✅ `doudizhu2` | 双人夺帅 | CardGames.cs |
| ✅ `laizi` | 借符夺帅 | CardGames.cs |
| ✅ `guandan` | 贡级帖 | CardGames.cs |
| ✅ `shengji` | 升阶帖 | CardGames.cs |
| ✅ `paodekuai` | 疾出令 | CardGames.cs |
| ✅ `gongzhu` | 逐豕令 | CardGames.cs |
| ✅ `hongshi` | 赤十局 | CardGames.cs |
| ✅ `shisanszhang` | 三道笺 | CardGames.cs |
| ✅ `uno` | 云笺令 | CardGames.cs |
| ✅ `bridge` | 定约帖 | TableExtras.cs |
| ✅ `mahjong` | 竹牌戏 | TableExtras.cs |
| ✅ `feixingqi` | 云程局 | TableExtras.cs |
| ✅ `monopoly` | 坊市图 | TableExtras.cs |
| ✅ `werewolf` | 宵影局 | PartyGames.cs |
| ✅ `undercover` | 辨词令 | PartyGames.cs |
| ✅ `point24` | 九章令 | PartyGames.cs |
| ✅ `solitaire` | 独理牌 | PartyGames.cs |
| ✅ `dots` | 围格帖 | ExtraGames.cs |
| ✅ `hex` | 通津局 | ExtraGames.cs |
| ✅ `nim` | 拾芥令 | ExtraGames.cs |
| ✅ `endgame` | 残局谱 | ExtraGames.cs |
| ✅ `junqi4` | 四国暗阵 | ExtraGames.cs |
| ✅ `gouji` | 六席联牌 | ExtraGames.cs |
| ✅ `baohuang` | 护驾局 | ExtraGames.cs |
| ✅ `chudadi` | 压牌帖 | ExtraGames.cs |
| ✅ `shuangkou` | 联扣局 | ExtraGames.cs |
| ✅ `avalon` | 遣使局 | ExtraGames.cs |
| ✅ `turtlesoup` | 问底令 | ExtraGames.cs |
| ✅ `mastermind` | 隐数局 | ExtraGames.cs |
| ✅ `drawguess` | 丹青令 | ExtraGames.cs |
| ✅ `juben` | 折狱录 | ExtraGames.cs |
| ✅ `tournament` | 累墨赛 | ExtraGames.cs |
| ✅ `diefeng` | 叠峰局 | ExtraGames.cs |
| ✅ `yijuan` | 弈卷 | YiJuan.cs |
| ✅ `houlou` | 候漏 | OrigSeven.cs |
| ✅ `duzhou` | 渡舟 | OrigSeven.cs |
| ✅ `dengying` | 灯影 | OrigSeven.cs |
| ✅ `huiwen` | 回文笺 | OrigSeven.cs |
| ✅ `cuojin` | 错金 | OrigSeven.cs |
| ✅ `shiyi` | 拾遗 | OrigSeven.cs |
| ✅ `tingyu` | 听雨 | OrigSeven.cs |

## 体积

完整规则引擎约 334 KiB 原始 / 68 KiB gzip；客户端合计 674 KiB 原始 / 173 KiB gzip。`tools/verify.py` 的体积阈值已按此如实上调，并在输出中注明含 60 局完整原规则引擎。

## 已知边界（如实列出）

- 剧本类 `juben` 依赖服务端注入的外部剧本；本机 `ScriptGateway` 返回空，走内置「现场本」，无外部剧本可载入。这是数据缺失，不是规则缺失。
- 联机时仍以服务端 C# 为权威判定；本机规则仅用于断网自弈，两侧同一份规则源，不作二次改写。
- 转译产物由脚本生成，**不要手改 `all-rules.js`**；改规则请改 `server/Rules/*.cs` 后重跑 `python3 tools/cs2js.py` 并复跑上述三项验收。

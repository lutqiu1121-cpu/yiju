# 60 局逐局移植状态

> 目标：**离线 60 局全部走服务端原规则**，不用「本机简式」冒充。
> 验收硬标准：`node tools/rules-vector.test.mjs`（vectors.json 真实走法序列）
> 与 `node tools/rules-all.test.mjs`（60 局开局→落子→隐士应手→按原规则终局）。
> **每批搬完必须两个脚本都全绿，才把该批局号登记进 `client/rules-port/registry.js`。**

## 当前进度

| 状态 | 局数 |
|---|---|
| ✅ 完整规则（rules-port，向量验收通过） | 7 |
| ✅ 忠实移植（local-net.js，OrigSeven.cs 逻辑） | 7 |
| ⚠️ 简式待补（yijuan 的 YiJuan.cs 454 行未搬） | 1 |
| ⬜ 待搬 | 45 |

## 分批清单（逐局可查）

### 第 1 批 · 已完成 · 7/7 局
`server/Rules/BoardGames.cs（LineGame / OthelloGame / GoGame）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `tictactoe` | 井字局 | ✅ 完整规则 |
| `gomoku` | 五连局 | ✅ 完整规则 |
| `renju` | 禁手连珠 | ✅ 完整规则 |
| `connect6` | 双落六连 | ✅ 完整规则 |
| `connect4` | 坠珠局 | ✅ 完整规则 |
| `othello` | 翻云局 | ✅ 完整规则 |
| `go` | 手谈 | ✅ 完整规则 |

### 第 2 批 · 0/3 局
`server/Rules/BoardGames.cs（CheckersGame / MillsGame / HexJumpGame）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `checkers` | 斜跳棋 | ⬜ 待搬 |
| `mills` | 成三局 | ⬜ 待搬 |
| `tiaogi` | 跃营棋 | ⬜ 待搬 |

### 第 3 批 · 0/8 局
`server/Rules/PieceGames.cs（Xiangqi / Dark×4 / Chess×2 / Shogi）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `xiangqi` | 楚汉棋 | ⬜ 待搬 |
| `jieqi` | 覆局棋 | ⬜ 待搬 |
| `xiangqidark` | 翻将棋 | ⬜ 待搬 |
| `junqi` | 暗阵棋 | ⬜ 待搬 |
| `doushou` | 兽阶图 | ⬜ 待搬 |
| `chess` | 番象棋 | ⬜ 待搬 |
| `chess960` | 列星局 | ⬜ 待搬 |
| `shogi` | 持驹棋 | ⬜ 待搬 |

### 第 4 批 · 0/9 局
`server/Rules/CardGames.cs（TrickGame×8 / ShowdownGame）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `doudizhu` | 夺帅局 | ⬜ 待搬 |
| `doudizhu2` | 双人夺帅 | ⬜ 待搬 |
| `laizi` | 借符夺帅 | ⬜ 待搬 |
| `guandan` | 贡级帖 | ⬜ 待搬 |
| `shengji` | 升阶帖 | ⬜ 待搬 |
| `paodekuai` | 疾出令 | ⬜ 待搬 |
| `gongzhu` | 逐豕令 | ⬜ 待搬 |
| `hongshi` | 赤十局 | ⬜ 待搬 |
| `shisanszhang` | 三道笺 | ⬜ 待搬 |

### 第 5 批 · 0/3 局
`server/Rules/TableExtras.cs（Uno / Bridge / Mahjong）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `uno` | 云笺令 | ⬜ 待搬 |
| `bridge` | 定约帖 | ⬜ 待搬 |
| `mahjong` | 竹牌戏 | ⬜ 待搬 |

### 第 6 批 · 0/6 局
`server/Rules/PartyGames.cs（Flight / Monopoly / Werewolf / Undercover / Point24 / Solitaire）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `feixingqi` | 云程局 | ⬜ 待搬 |
| `monopoly` | 坊市图 | ⬜ 待搬 |
| `werewolf` | 宵影局 | ⬜ 待搬 |
| `undercover` | 辨词令 | ⬜ 待搬 |
| `point24` | 九章令 | ⬜ 待搬 |
| `solitaire` | 独理牌 | ⬜ 待搬 |

### 第 7 批 · 0/15 局
`server/Rules/ExtraGames.cs（ExtraGame×13 / Director / Tournament）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `dots` | 围格帖 | ⬜ 待搬 |
| `hex` | 通津局 | ⬜ 待搬 |
| `nim` | 拾芥令 | ⬜ 待搬 |
| `endgame` | 残局谱 | ⬜ 待搬 |
| `junqi4` | 四国暗阵 | ⬜ 待搬 |
| `gouji` | 六席联牌 | ⬜ 待搬 |
| `baohuang` | 护驾局 | ⬜ 待搬 |
| `chudadi` | 压牌帖 | ⬜ 待搬 |
| `shuangkou` | 联扣局 | ⬜ 待搬 |
| `avalon` | 遣使局 | ⬜ 待搬 |
| `turtlesoup` | 问底令 | ⬜ 待搬 |
| `mastermind` | 隐数局 | ⬜ 待搬 |
| `drawguess` | 丹青令 | ⬜ 待搬 |
| `juben` | 折狱录 | ⬜ 待搬 |
| `tournament` | 累墨赛 | ⬜ 待搬 |

### 第 8 批 · 0/2 局
`server/Rules/OriginalGame.cs + YiJuan.cs（PeakGame / YiJuan 完整 454 行）`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `diefeng` | 叠峰局 | ⬜ 待搬 |
| `yijuan` | 弈卷 | ⚠️ 简式 · 待搬完整规则 |

### 已搬（手工） · 7/7 局
`server/Rules/OrigSeven.cs → client/local-net.js`

| 局 ID | 名称 | 状态 |
|---|---|---|
| `houlou` | 候漏 | ✅ 忠实移植 |
| `duzhou` | 渡舟 | ✅ 忠实移植 |
| `dengying` | 灯影 | ✅ 忠实移植 |
| `huiwen` | 回文笺 | ✅ 忠实移植 |
| `cuojin` | 错金 | ✅ 忠实移植 |
| `shiyi` | 拾遗 | ✅ 忠实移植 |
| `tingyu` | 听雨 | ✅ 忠实移植 |

## 每批执行口径

1. 按 C# 源文件逐类对照，写入 `client/rules-port/` 下对应 JS 模块（继承 `base.js` 的 `RuleBase`）。
2. 在 `client/rules-port/registry.js` 登记该批局号。
3. 补该局真实走法序列到 `rules/vectors.json`（含 `expectEnded` / `expectWinner` / `expectLegalContains` / `expectVar`）。
4. 跑 `node tools/rules-vector.test.mjs` 与 `node tools/rules-all.test.mjs`，**全绿才算搬完**。
5. 更新本文件状态表与 `PORTED_COUNT`。

## 诚实边界

- 未登记的局在离线时**明确标注「本机简式 · 规则待搬」**，可试玩但不冒充完整规则；联机时仍走服务端原规则。
- `yijuan` 当前本地版是「覆简比年序」简式，与 `server/Rules/YiJuan.cs` 的「两卷夹一线、弃简推牌、游方共推界墨」不同，列入第 8 批补完。
- 自动转译 8468 行 C# 的方案已试过，`node --check` 不通，已撤回，不拿跑不通的产物冒充完成。

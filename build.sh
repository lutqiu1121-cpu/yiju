#!/usr/bin/env bash
# 一键构建 + 回归 + 体积实测。只需要 .NET 8 SDK。
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/5 规则引擎回归"
dotnet run --project tools/RuleTests --configuration Release

echo "== 2/5 发布服务端（framework-dependent，体积最小）"
rm -rf publish
dotnet publish server/Qipai.Server.csproj \
  --configuration Release --output publish/server \
  -p:DebugType=none -p:GenerateDocumentationFile=false

echo "== 3/5 拷贝同源静态资源（客户端 / 规则清单 / 主题）"
python3 tools/gen-offline.py >/dev/null 2>&1 || true
python3 tools/gen-wear.py >/dev/null 2>&1 || true
cp -r client publish/client
cp -r rules  publish/rules
cp -r themes publish/themes
cp -r scripts publish/scripts      # 房主本地剧本库：随运行包走，不进 APK
cp README.md publish/README.md
cp LICENSE  publish/LICENSE
cp LICENSE  publish/client/LICENSE.txt   # 同源 /LICENSE.txt 可直接打开
cp -r tools  publish/tools

echo "== 4/5 体积实测"
CLIENT_RAW=$(find publish/client -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
CLIENT_GZ=$(for f in publish/client/*; do gzip -9 -c "$f" | wc -c; done | awk '{s+=$1} END{print s+0}')
SERVER_RAW=$(find publish/server -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
SCRIPT_COUNT=$(find publish/scripts -maxdepth 1 -name '*.json' | wc -l)
TOTAL_RAW=$(find publish -type f -printf '%s\n' | awk '{s+=$1} END{print s+0}')
{
  echo "构建日期: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "客户端原始: $CLIENT_RAW 字节 ($(awk -v n="$CLIENT_RAW" 'BEGIN{printf "%.1f",n/1024}') KiB)"
  echo "客户端 gzip: $CLIENT_GZ 字节 ($(awk -v n="$CLIENT_GZ" 'BEGIN{printf "%.1f",n/1024}') KiB)"
  echo "服务端发布: $SERVER_RAW 字节 ($(awk -v n="$SERVER_RAW" 'BEGIN{printf "%.1f",n/1024}') KiB)"
  echo "发布包合计: $TOTAL_RAW 字节 ($(awk -v n="$TOTAL_RAW" 'BEGIN{printf "%.1f",n/1024}') KiB)"
  echo "玩法: 58 个 · 示例剧本: $SCRIPT_COUNT 个 · 主题: 10 套"
  echo "说明: framework-dependent，目标机器需已装 .NET 8 Runtime；未内嵌任何位图 / 字体 / 音频 / 第三方前端框架。"
} | tee publish/SIZES.txt

echo "== 5/5 打包 Release 产物与源码包"
cp publish/SIZES.txt ./SIZES.txt
(cd publish && zip -qr ../yiju-release.zip \
  server client rules themes scripts tools README.md LICENSE SIZES.txt)
zip -qr ./yiju-source.zip . \
  -x './publish/*' './.git/*' './yiju-repo.bundle' \
     './server/obj/*' './server/bin/*' \
     './tools/RuleTests/obj/*' './tools/RuleTests/bin/*' \
     './android/.gradle/*' './android/build/*' './android/app/build/*' \
     './android/app/src/main/assets/*' './android/local.properties' \
     './android/gradlew' './android/gradlew.bat' \
     './android/gradle/wrapper/gradle-wrapper.jar' \
     './yiju-*.zip' './*.apk' './SIZES.txt' './.probe/*' \
     './data/*' './leaderboard/BoardServer/obj/*' './leaderboard/BoardServer/bin/*'
echo "完成：yiju-release.zip / yiju-source.zip / SIZES.txt"
echo "APK 另跑： bash build-apk.sh  → yiju.apk"
echo "运行： dotnet publish/server/qipai-server.dll"
echo "然后浏览器打开 http://localhost:5080 （手机与电脑同一 WiFi 时用启动日志里打印的局域网地址）"

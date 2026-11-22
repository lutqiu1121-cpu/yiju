#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${YIJU_CONF:-$ROOT/yiju.conf}"

if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<'CONF'
# 弈局 · 一键配置。改完保存，直接 ./start.sh 即可；命令行参数会覆盖这里。
HOST=0.0.0.0
PORT=5080
HALL=弈局棋馆
DIRECTORY=on
TIME=on
BOARDS=on
ROOT=.
OPEN=no
BUILD=no
CONF
  echo "[弈局] 已生成一键配置：$CONF"
fi

conf_get() {
  local k="$1" d="$2" v
  v="$(sed -n "s/^[[:space:]]*$k[[:space:]]*=[[:space:]]*//p" "$CONF" 2>/dev/null | head -n 1 | sed 's/[[:space:]]*#.*$//' | tr -d '\"\r')"
  [ -n "$v" ] && printf '%s' "$v" || printf '%s' "$d"
}

HOST="$(conf_get HOST 0.0.0.0)"
PORT="$(conf_get PORT 5080)"
HALL="$(conf_get HALL 弈局棋馆)"
DIRECTORY="$(conf_get DIRECTORY on)"
TIME="$(conf_get TIME on)"
BOARDS="$(conf_get BOARDS on)"
OPEN="$(conf_get OPEN no)"
BUILD="$(conf_get BUILD no)"

ARGS=(--url "http://$HOST:$PORT" --hall "$HALL" --root "$ROOT"
      --directory "$DIRECTORY" --time "$TIME" --boards "$BOARDS")

EXTRA=()
for a in "$@"; do EXTRA+=("$a"); done
case " ${EXTRA[*]} " in
  *" --help "*|*" -h "*) exec dotnet run --project "$ROOT/server" -- --help ;;
esac
if [ "$OPEN" = "on" ] || [ "$OPEN" = "yes" ] || [ "$OPEN" = "true" ]; then EXTRA+=(--open); fi
if [ "$BUILD" = "on" ] || [ "$BUILD" = "yes" ] || [ "$BUILD" = "true" ]; then EXTRA+=(--build); fi

if ! command -v dotnet >/dev/null 2>&1; then
  echo "[弈局] 未找到 dotnet，请先装 .NET 8 SDK（https://dotnet.microsoft.com/download/dotnet/8.0）。"
  echo "[弈局] 装好后重新执行：./start.sh"
  exit 1
fi

if [ -f "$ROOT/publish/server/qipai-server.dll" ]; then
  CMD=(dotnet "$ROOT/publish/server/qipai-server.dll")
else
  CMD=(dotnet run --project "$ROOT/server" -c Release --)
  if printf '%s' " ${EXTRA[*]} " | grep -q -- ' --build '; then
    dotnet build "$ROOT/server/Qipai.Server.csproj" -c Release
    EXTRA=("${EXTRA[@]/--build/}")
  fi
fi

echo "[弈局] 一键启动 · 配置 $CONF · 端口 $PORT · 匾额「$HALL」"
echo "[弈局] 谱页：http://localhost:$PORT · 手机可填下列任一地址（任意地址均可，端口可省）"
( hostname -I 2>/dev/null || ip -4 addr 2>/dev/null | sed -n 's/.*inet \([0-9.]*\).*/\1/p' ) | tr ' ' '\n' | grep -v '^$' | sed "s/$/:$PORT/" || true
echo "    localhost:$PORT"

exec "${CMD[@]}" "${ARGS[@]}" "${EXTRA[@]}"

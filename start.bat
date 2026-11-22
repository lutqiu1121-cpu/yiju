@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0
set CONF=%ROOT%yiju.conf
if not exist "%CONF%" (
  > "%CONF%" echo # 弈局 · 一键配置
  >>"%CONF%" echo HOST=0.0.0.0
  >>"%CONF%" echo PORT=5080
  >>"%CONF%" echo HALL=弈局棋馆
  >>"%CONF%" echo DIRECTORY=on
  >>"%CONF%" echo TIME=on
  >>"%CONF%" echo BOARDS=on
  >>"%CONF%" echo ROOT=.
  >>"%CONF%" echo OPEN=no
  >>"%CONF%" echo BUILD=no
  echo [弈局] 已生成一键配置：%CONF%
)
set HOST=0.0.0.0
set PORT=5080
set HALL=弈局棋馆
set DIRECTORY=on
set TIME=on
set BOARDS=on
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%CONF%") do (
  if "%%a"=="HOST" set HOST=%%b
  if "%%a"=="PORT" set PORT=%%b
  if "%%a"=="HALL" set HALL=%%b
  if "%%a"=="DIRECTORY" set DIRECTORY=%%b
  if "%%a"=="TIME" set TIME=%%b
  if "%%a"=="BOARDS" set BOARDS=%%b
)
where dotnet >nul 2>nul
if errorlevel 1 (
  echo [弈局] 未找到 dotnet，请先装 .NET 8 SDK：https://dotnet.microsoft.com/download/dotnet/8.0
  exit /b 1
)
echo [弈局] 一键启动 · 端口 %PORT% · 谱页 http://localhost:%PORT%
echo [弈局] 手机可填本机局域网 IP 或任意可达地址，端口可省。
dotnet run --project "%ROOT%server" -c Release -- --url http://%HOST%:%PORT% --hall "%HALL%" --root "%ROOT%" --directory %DIRECTORY% --time %TIME% --boards %BOARDS% %*
endlocal

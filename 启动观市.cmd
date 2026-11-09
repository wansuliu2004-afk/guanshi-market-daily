@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "GUANSHI_NODE=node"
where node >nul 2>&1
if errorlevel 1 set "GUANSHI_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
echo 观市财经日报将在 http://127.0.0.1:4173 启动。
echo 启动后请在浏览器打开该地址，关闭此窗口可停止服务。
echo 标题与公开行情每5分钟采集一次，需保持服务运行与网络连接。
"%GUANSHI_NODE%" server.mjs
pause

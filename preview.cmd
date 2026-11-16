@echo off
rem 双击我：在 8123 端口起一个本地服务并打开浏览器。
rem 原因：页面里的路径是 /assets/... 这种绝对路径，双击 html 用 file:// 打开时
rem 会去磁盘根目录找 /assets/...，所以 CSS 全部加载失败——只剩白底蓝链接。
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo 没找到 python。装一个 Python，或改用:  npx serve .
  echo.
  pause
  exit /b 1
)
echo 服务地址 http://localhost:8123/   按 Ctrl+C 停止
python -c "import http.server,socketserver,threading,webbrowser;socketserver.TCPServer.allow_reuse_address=True;threading.Timer(1.0,lambda:webbrowser.open('http://localhost:8123/')).start();socketserver.TCPServer(('127.0.0.1',8123),http.server.SimpleHTTPRequestHandler).serve_forever()"

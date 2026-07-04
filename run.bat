@echo off
echo ===================================================
echo   CYBERPUNK STOCK MARKET SHOOTER - LOCAL SERVER
echo ===================================================
echo.
echo Launching default web browser at http://localhost:8000 ...
start "" http://localhost:8000
echo.
echo Starting Python HTTP Server on port 8000...
echo Keep this window open while playing the game.
echo Press Ctrl+C in this window to stop the server.
echo.
python -m http.server 8000

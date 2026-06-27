@echo off
echo =========================================================
echo  Starting TALLY Lite - GST Billing Fullstack System...
echo =========================================================
echo.
echo Launching Backend server (Port 5000)...
start cmd /k "cd backend && npm start"
echo.
echo Launching Frontend dev server (Port 5173)...
start cmd /k "cd frontend && npm run dev"
echo.
echo =========================================================
echo  System active! Open http://localhost:5173 in browser.
echo =========================================================
echo.
pause

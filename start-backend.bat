@echo off
echo Starting WSSC Backend Server...
echo.

cd backend

echo Checking if MongoDB is running...
mongosh --eval "db.adminCommand('ping')" >nul 2>&1
if %errorlevel% neq 0 (
    echo MongoDB is not running. Attempting to start...
    net start MongoDB >nul 2>&1
    if %errorlevel% neq 0 (
        echo.
        echo ⚠️  Failed to start MongoDB service.
        echo    This requires administrator privileges.
        echo    Please run one of the following:
        echo.
        echo    1. Run this script as Administrator (Right-click ^> Run as administrator)
        echo    2. Manually start MongoDB service:
        echo       - Open Services (services.msc)
        echo       - Find "MongoDB" service
        echo       - Right-click ^> Start
        echo    3. Or start MongoDB manually: mongod
        echo.
        echo    Continuing anyway - MongoDB might already be running...
        echo.
    ) else (
        echo ✅ MongoDB service started successfully.
        timeout /t 2 >nul
    )
) else (
    echo ✅ MongoDB is already running.
)

echo.
echo Checking if port 3000 is available...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  Port 3000 is already in use!
    echo.
    echo    Finding process using port 3000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
        echo    Process ID (PID): %%a
        echo    To kill this process, run: taskkill /PID %%a /F
        echo    Or change PORT in backend/.env file to use a different port.
        echo.
    )
    echo    Continuing anyway - the server will show an error if port is still in use...
    echo.
) else (
    echo ✅ Port 3000 is available.
)

echo.
echo Starting backend server...
echo.
npm run dev

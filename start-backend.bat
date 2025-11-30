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
echo Starting backend server...
echo    (Server will automatically find an available port if 3000 is in use)
echo.
npm run dev

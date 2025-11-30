@echo off
echo Killing process using port 3000...
echo.

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    set PID=%%a
    echo Found process with PID: %%a
    echo Attempting to kill process...
    taskkill /PID %%a /F
    if %errorlevel% equ 0 (
        echo ✅ Process killed successfully!
    ) else (
        echo ❌ Failed to kill process. You may need to run as Administrator.
    )
    goto :done
)

echo No process found using port 3000.
:done
echo.
pause


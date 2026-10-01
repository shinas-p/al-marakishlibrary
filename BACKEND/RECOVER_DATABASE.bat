@echo off
echo ================================================
echo ALMARAKISH LIBRARY - DATABASE RECOVERY
echo ================================================
echo.

REM Set XAMPP paths
set MYSQL_BIN=C:\xampp\mysql\bin
set DB_NAME=almarakish_db
set DB_USER=root
set DB_PASS=

echo Step 1: Stopping MySQL...
net stop mysql
timeout /t 3

echo.
echo Step 2: Starting MySQL...
net start mysql
timeout /t 5

echo.
echo Step 3: Creating database '%DB_NAME%'...
"%MYSQL_BIN%\mysql.exe" -u%DB_USER% -e "DROP DATABASE IF EXISTS %DB_NAME%;"
"%MYSQL_BIN%\mysql.exe" -u%DB_USER% -e "CREATE DATABASE %DB_NAME%;"

echo.
echo Step 4: Importing database structure and data...
"%MYSQL_BIN%\mysql.exe" -u%DB_USER% %DB_NAME% < "COMPLETE_DATABASE_RECONSTRUCTION.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo SUCCESS! Database restored successfully!
    echo ================================================
    echo.
    echo Database Name: %DB_NAME%
    echo Tables imported successfully
    echo.
    echo Next steps:
    echo 1. Open http://localhost/phpmyadmin
    echo 2. Check if 'almarakish_db' exists
    echo 3. Test your application
    echo.
) else (
    echo.
    echo ================================================
    echo ERROR! Database import failed!
    echo ================================================
    echo.
    echo Please check:
    echo 1. MySQL is running (check XAMPP Control Panel)
    echo 2. File exists: COMPLETE_DATABASE_RECONSTRUCTION.sql
    echo 3. Try importing manually via phpMyAdmin
    echo.
)

pause

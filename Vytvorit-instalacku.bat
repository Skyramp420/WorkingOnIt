@echo off
chcp 65001 >nul
cd /d "%~dp0"
title WorkingOnIt - instalacka
rem rovnake balicky ako Spustit.bat (pri novej verzii sa doinstaluju)
if not exist "node_modules\.woi-deps-6" (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo  Instalacia balickov zlyhala. Skontroluj internet a skus znova.
    pause
    exit /b
  )
  echo ok> "node_modules\.woi-deps-6"
)
echo  Vytvaram instalacku, moze to trvat par minut...
call npm run build
if errorlevel 1 (
  echo.
  echo  Nepodarilo sa. Ak chyba hovori o "symbolic link", zapni v nastaveniach Windows
  echo  Pre vyvojarov ^> Rezim vyvojara a skus znova. Appku mozes aj tak pouzivat cez Spustit.bat.
  pause
  exit /b
)
explorer dist

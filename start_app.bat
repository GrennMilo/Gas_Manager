@echo off
echo ===================================================================
echo   RMIC - Gestione Bombole in Pressione - Avvio Server Report
echo ===================================================================
echo.

REM Create reports directory if it doesn't exist
if not exist reports mkdir reports

REM Check if Python is installed
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python non trovato. Assicurati che Python sia installato e nel PATH.
    goto :end
)

REM Check if dependencies are installed
echo [*] Verifica delle dipendenze...
pip show flask > nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Flask non trovato. Installazione in corso...
    pip install -r requirements.txt
) else (
    echo [+] Dipendenze trovate.
)

echo.
echo [*] Avvio server in corso...
echo [*] Il browser si aprirà automaticamente.
echo [*] Per terminare premere CTRL+C nella finestra del terminale.
echo.
echo ===================================================================

python app.py

:end
pause 
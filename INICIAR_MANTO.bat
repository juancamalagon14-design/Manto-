@echo off
chcp 65001 >nul
title Manto 2.0 - Inicio Automático
color 0A

echo ====================================================================
echo                 MANTO 2.0 - INICIADOR AUTOMATICO
echo ====================================================================
echo.

:: 1. Verificar si Node.js está instalado en la máquina
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js no está instalado en este equipo de la oficina.
    echo Por favor descarga e instala Node.js (v20 o superior) desde:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 2. Configurar entorno de backend si no existe
if not exist "backend\.env" (
    echo [*] Creando backend\.env para ejecucion local inmediata...
    (
        echo PORT=3003
        echo NODE_ENV=development
        echo # DATABASE_URL=
        echo JWT_SECRET=super_secret_jwt_key_manto_dev_environment_min_32_chars
        echo GEMINI_API_KEY=
    ) > backend\.env
)

:: 3. Verificar e instalar dependencias de Backend si faltan
if not exist "backend\node_modules\" (
    echo [*] Instalando dependencias del Backend (solo tarda la primera vez)...
    cd backend
    call npm.cmd install
    cd ..
)

:: 4. Verificar e instalar dependencias de Frontend si faltan
if not exist "frontend\node_modules\" (
    echo [*] Instalando dependencias del Frontend (solo tarda la primera vez)...
    cd frontend
    call npm.cmd install
    cd ..
)

:: 5. Iniciar Backend en segundo plano
echo [*] Iniciando Backend NestJS (Puerto 3003)...
start "Manto Backend API" cmd /k "cd /d "%~dp0backend" && npm.cmd run start:dev"

:: Esperar 5 segundos a que el backend levante
timeout /t 5 /nobreak >nul

:: 6. Iniciar Frontend en segundo plano
echo [*] Iniciando Frontend Next.js (Puerto 3002)...
start "Manto Frontend NextJS" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

:: Esperar 8 segundos a que Next.js compile
timeout /t 8 /nobreak >nul

:: 7. Abrir navegador en el cotizador y la plataforma
echo [*] Abriendo la aplicación en tu navegador...
start http://localhost:3002/mascotas/cotizar

echo.
echo ====================================================================
echo  ¡MANTO 2.0 ESTÁ CORRIENDO EN VIVO!
echo  - Cotizador Nuquí: http://localhost:3002/mascotas/cotizar
echo  - Landing Manto:   http://localhost:3002/
echo  - Backend API:     http://localhost:3003/
echo ====================================================================
echo.
echo Mantén abiertas las ventanas de Backend y Frontend mientras presentes.
echo.
pause

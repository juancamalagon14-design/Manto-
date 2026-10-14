Write-Host "=== [MANTO 2.0] Purga de Cache y Reinicio de Next.js en Puerto 3002 ===" -ForegroundColor Cyan

# 1. Matar procesos en puerto 3002
Write-Host "1. Verificando procesos en puerto 3002..." -ForegroundColor Yellow
$pids = Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
    Write-Host "Procesos encontrados en puerto 3002: $($pids -join ', ')" -ForegroundColor Red
    $pids | ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        Write-Host "Proceso $_ detenido." -ForegroundColor Green
    }
} else {
    Write-Host "No hay procesos escuchando en puerto 3002." -ForegroundColor Green
}

Start-Sleep -Seconds 2

# 2. Purgar carpeta .next
$nextDir = Join-Path $PSScriptRoot ".next"
Write-Host "2. Purgando directorio .next en: $nextDir" -ForegroundColor Yellow
if (Test-Path $nextDir) {
    try {
        Remove-Item -Recurse -Force $nextDir -ErrorAction Stop
        Write-Host "Directorio .next eliminado exitosamente." -ForegroundColor Green
    } catch {
        Write-Warning "Fallo al eliminar .next de inmediato: $_"
        Start-Sleep -Seconds 2
        Remove-Item -Recurse -Force $nextDir -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "El directorio .next no existia o ya estaba limpio." -ForegroundColor Green
}

# 3. Iniciar Next.js en segundo plano
Write-Host "3. Iniciando npm run dev (puerto 3002)..." -ForegroundColor Yellow
$process = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory $PSScriptRoot -PassThru -NoNewWindow
Write-Host "Servidor de desarrollo iniciado con PID: $($process.Id)" -ForegroundColor Green

# 4. Esperar y verificar HTTP
Write-Host "4. Esperando inicializacion de Next.js (10 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

$retries = 6
$success = $false
for ($i = 1; $i -le $retries; $i++) {
    try {
        Write-Host "Intento $i de verificacion HTTP en http://localhost:3002..."
        $response = Invoke-WebRequest -Uri "http://localhost:3002" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "=== VERIFICACION EXITOSA ===" -ForegroundColor Green
            Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
            Write-Host "Longitud de respuesta: $($response.Content.Length) bytes" -ForegroundColor Green
            $excerpt = $response.Content.Substring(0, [Math]::Min(300, $response.Content.Length))
            Write-Host "Extracto HTML:" -ForegroundColor Cyan
            Write-Host $excerpt
            $success = $true
            break
        }
    } catch {
        Write-Host "Esperando que el servidor responda... ($_)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

if (-not $success) {
    Write-Warning "El servidor Next.js no respondio en el tiempo esperado. Por favor verificar los logs del proceso PID $($process.Id)."
}

# Abre CHAMBA en el navegador (build web estático)
$port = 8090
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "dist-web-test\index.html")) {
  Write-Host "Generando build web (puede tardar unos minutos)..."
  npx expo export -p web --output-dir dist-web-test
}

Write-Host "Iniciando CHAMBA en http://localhost:$port"
Start-Process "http://localhost:$port"
npx serve dist-web-test -l $port

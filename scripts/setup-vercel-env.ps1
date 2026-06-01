# Configura Vercel CLI: link + env vars desde .env local
# Requisito: npx vercel login (sesión activa)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".env")) {
  Write-Error "No se encontró .env en la raíz del proyecto."
}

$envMap = @{}
Get-Content ".env" | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line -match "^([^=]+)=(.*)$") {
    $envMap[$matches[1]] = $matches[2]
  }
}

$url = $envMap["EXPO_PUBLIC_SUPABASE_URL"]
$key = $envMap["EXPO_PUBLIC_SUPABASE_ANON_KEY"]
$pilot = $envMap["EXPO_PUBLIC_PILOT_MODE"]

if (-not $url -or -not $key) {
  Write-Error "Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY en .env"
}

Write-Host ">> Vinculando proyecto Vercel 'chamba'..."
npx vercel link --yes --project chamba

Write-Host ">> Agregando EXPO_PUBLIC_SUPABASE_URL (production)..."
$url | npx vercel env add EXPO_PUBLIC_SUPABASE_URL production

Write-Host ">> Agregando EXPO_PUBLIC_SUPABASE_ANON_KEY (production)..."
$key | npx vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY production

if ($pilot) {
  Write-Host ">> Agregando EXPO_PUBLIC_PILOT_MODE (production)..."
  $pilot | npx vercel env add EXPO_PUBLIC_PILOT_MODE production
}

Write-Host ">> Redeploy production..."
npx vercel --prod --yes

Write-Host "Listo."

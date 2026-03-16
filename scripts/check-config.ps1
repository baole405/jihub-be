param(
  [ValidateSet('prod','local')]
  [string]$Mode = 'prod'
)

$ErrorActionPreference = 'Stop'

function Read-EnvFile {
  param([string]$Path)
  $data = @{}
  if (-not (Test-Path $Path)) { return $data }
  $lines = Get-Content -Path $Path
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    if ($line.TrimStart().StartsWith('#')) { continue }
    $idx = $line.IndexOf('=')
    if ($idx -lt 1) { continue }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1)
    if ($key) { $data[$key] = $value }
  }
  return $data
}

function Report {
  param(
    [string]$Label,
    [bool]$Ok,
    [string]$Message
  )
  if ($Ok) {
    Write-Host "[PASS] $Label"
  } else {
    Write-Host "[FAIL] $Label :: $Message"
    $script:Errors++
  }
}

function Warn {
  param([string]$Label, [string]$Message)
  Write-Host "[WARN] $Label :: $Message"
  $script:Warnings++
}

$script:Errors = 0
$script:Warnings = 0

$scriptRoot = $PSScriptRoot
$beRoot = Resolve-Path (Join-Path $scriptRoot "..")
$feRoot = Resolve-Path (Join-Path $scriptRoot "..\\..\\fe-repo")

$beEnvPath = Join-Path $beRoot ".env"
$feEnvPath = Join-Path $feRoot "apps\\web\\.env"

$beEnv = Read-EnvFile $beEnvPath
$feEnv = Read-EnvFile $feEnvPath

$appPlatform = "https://jihub-toxzx.ondigitalocean.app"
$frontendProd = "https://jihub.vercel.app"
$frontendLocal = "http://localhost:3000"
$apiLocal = "http://localhost:8080"
$vpsIp = "143.198.223.247"

Write-Host "== Config Check ($Mode) =="

# FE checks
if ($Mode -eq 'prod') {
  Report "FE NEXT_PUBLIC_API_URL set" ($feEnv.ContainsKey('NEXT_PUBLIC_API_URL')) "Missing in $feEnvPath"
  if ($feEnv.ContainsKey('NEXT_PUBLIC_API_URL')) {
    $val = $feEnv['NEXT_PUBLIC_API_URL']
    Report "FE NEXT_PUBLIC_API_URL uses App Platform" ($val -match [regex]::Escape($appPlatform)) "Should be $appPlatform"
    Report "FE NEXT_PUBLIC_API_URL not VPS" ($val -notmatch $vpsIp) "Contains VPS IP"
  }

  Report "FE NEXT_PUBLIC_FRONTEND_URL set" ($feEnv.ContainsKey('NEXT_PUBLIC_FRONTEND_URL')) "Missing in $feEnvPath"
  if ($feEnv.ContainsKey('NEXT_PUBLIC_FRONTEND_URL')) {
    $val = $feEnv['NEXT_PUBLIC_FRONTEND_URL']
    Report "FE NEXT_PUBLIC_FRONTEND_URL uses Vercel" ($val -match [regex]::Escape($frontendProd)) "Should be $frontendProd"
  }
} else {
  Report "FE NEXT_PUBLIC_API_URL set" ($feEnv.ContainsKey('NEXT_PUBLIC_API_URL')) "Missing in $feEnvPath"
  if ($feEnv.ContainsKey('NEXT_PUBLIC_API_URL')) {
    $val = $feEnv['NEXT_PUBLIC_API_URL']
    Report "FE NEXT_PUBLIC_API_URL uses local BE" ($val -match [regex]::Escape($apiLocal)) "Should be $apiLocal"
  }

  Report "FE NEXT_PUBLIC_FRONTEND_URL set" ($feEnv.ContainsKey('NEXT_PUBLIC_FRONTEND_URL')) "Missing in $feEnvPath"
  if ($feEnv.ContainsKey('NEXT_PUBLIC_FRONTEND_URL')) {
    $val = $feEnv['NEXT_PUBLIC_FRONTEND_URL']
    Report "FE NEXT_PUBLIC_FRONTEND_URL uses localhost" ($val -match [regex]::Escape($frontendLocal)) "Should be $frontendLocal"
  }
}

# BE checks (prod-oriented)
Report "BE ALLOWED_CORS_ORIGINS set" ($beEnv.ContainsKey('ALLOWED_CORS_ORIGINS')) "Missing in $beEnvPath"
if ($beEnv.ContainsKey('ALLOWED_CORS_ORIGINS')) {
  $val = $beEnv['ALLOWED_CORS_ORIGINS']
  Report "BE ALLOWED_CORS_ORIGINS includes FE" ($val -match [regex]::Escape($frontendProd)) "Should include $frontendProd"
  Report "BE ALLOWED_CORS_ORIGINS not VPS" ($val -notmatch $vpsIp) "Contains VPS IP"
}

Report "BE FRONTEND_URL set" ($beEnv.ContainsKey('FRONTEND_URL')) "Missing in $beEnvPath"
if ($beEnv.ContainsKey('FRONTEND_URL')) {
  $val = $beEnv['FRONTEND_URL']
  Report "BE FRONTEND_URL uses Vercel" ($val -match [regex]::Escape($frontendProd)) "Should be $frontendProd"
}

Report "BE GH_CALLBACK_URL set" ($beEnv.ContainsKey('GH_CALLBACK_URL')) "Missing in $beEnvPath"
if ($beEnv.ContainsKey('GH_CALLBACK_URL')) {
  $val = $beEnv['GH_CALLBACK_URL']
  Report "BE GH_CALLBACK_URL uses App Platform" ($val -match [regex]::Escape("$appPlatform/api/auth/github/callback")) "Should be $appPlatform/api/auth/github/callback"
  Report "BE GH_CALLBACK_URL not VPS" ($val -notmatch $vpsIp) "Contains VPS IP"
}

Report "BE JIRA_CALLBACK_URL set" ($beEnv.ContainsKey('JIRA_CALLBACK_URL')) "Missing in $beEnvPath"
if ($beEnv.ContainsKey('JIRA_CALLBACK_URL')) {
  $val = $beEnv['JIRA_CALLBACK_URL']
  Report "BE JIRA_CALLBACK_URL uses App Platform" ($val -match [regex]::Escape("$appPlatform/api/auth/jira/callback")) "Should be $appPlatform/api/auth/jira/callback"
  Report "BE JIRA_CALLBACK_URL not VPS" ($val -notmatch $vpsIp) "Contains VPS IP"
}

if ($beEnv.ContainsKey('API_BASE_URL')) {
  $val = $beEnv['API_BASE_URL']
  if ($val -notmatch [regex]::Escape($appPlatform)) {
    Warn "BE API_BASE_URL" "Expected $appPlatform"
  }
}

Write-Host "== Summary: $Errors error(s), $Warnings warning(s) =="
if ($Errors -gt 0) { exit 1 }

$ErrorActionPreference = "Stop"

$Git = "C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
$Repo = "https://github.com/w4336040/nextjs-boilerplate.git"

if (-not (Test-Path $Git)) {
  throw "Git executable not found: $Git"
}

Set-Location $PSScriptRoot

Write-Host "Initializing local Git repository..."
& $Git init

Write-Host "Configuring Git identity if missing..."
$Name = (& $Git config user.name) 2>$null
$Email = (& $Git config user.email) 2>$null
if (-not $Name) {
  & $Git config user.name "w4336040"
}
if (-not $Email) {
  & $Git config user.email "w4336040@users.noreply.github.com"
}

Write-Host "Staging safe files..."
& $Git add README.md .env.example .gitignore tools sync_to_github.ps1 docs app/api/alibaba

Write-Host "Creating commit..."
$Status = & $Git status --porcelain
if ($Status) {
  & $Git commit -m "Add Alibaba Open Platform OAuth setup"
} else {
  Write-Host "No file changes to commit."
}

Write-Host "Setting main branch..."
& $Git branch -M main

Write-Host "Configuring GitHub remote..."
$ExistingRemote = ""
try {
  $ExistingRemote = (& $Git remote get-url origin 2>$null)
} catch {
  $ExistingRemote = ""
}

if ($ExistingRemote) {
  & $Git remote set-url origin $Repo
} else {
  & $Git remote add origin $Repo
}

Write-Host "Pushing to GitHub..."
Write-Host "If GitHub asks for login, use browser login or paste a NEW token. Do not use the leaked token."
& $Git push -u origin main

Write-Host "Done."

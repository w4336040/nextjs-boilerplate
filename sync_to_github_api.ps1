param(
  [string]$Owner = "w4336040",
  [string]$Repo = "nextjs-boilerplate",
  [string]$Branch = "main",
  [string]$BaseRef = "origin/main",
  [string]$Message = "Sync product optimization dashboard via API"
)

$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

function Get-GitHubToken {
  param([Parameter(Mandatory = $true)][string]$Username)

  if ($env:GITHUB_TOKEN) {
    return $env:GITHUB_TOKEN
  }

  $Gcm = Get-Command git-credential-manager -ErrorAction SilentlyContinue
  $GcmPath = if ($Gcm) { $Gcm.Source } else { "C:\Program Files\Git\mingw64\bin\git-credential-manager.exe" }
  if (-not (Test-Path -LiteralPath $GcmPath)) {
    throw "Missing GITHUB_TOKEN and Git Credential Manager was not found."
  }

  $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
  $StartInfo.FileName = $GcmPath
  $StartInfo.Arguments = "get"
  $StartInfo.RedirectStandardInput = $true
  $StartInfo.RedirectStandardOutput = $true
  $StartInfo.RedirectStandardError = $true
  $StartInfo.UseShellExecute = $false

  $Process = [System.Diagnostics.Process]::Start($StartInfo)
  $Process.StandardInput.Write("protocol=https`nhost=github.com`nusername=$Username`n`n")
  $Process.StandardInput.Close()
  $Output = $Process.StandardOutput.ReadToEnd()
  $ErrorOutput = $Process.StandardError.ReadToEnd()
  $Process.WaitForExit()

  if ($Process.ExitCode -ne 0) {
    throw "Git Credential Manager could not return GitHub credentials. $ErrorOutput"
  }

  foreach ($Line in ($Output -split "`r?`n")) {
    if ($Line -match "^password=(.+)$") {
      return $Matches[1]
    }
  }

  throw "Git Credential Manager returned no GitHub token/password."
}

$Token = Get-GitHubToken -Username $Owner

function Invoke-GitHubApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [object]$Body = $null
  )

  $Headers = @{
    Authorization          = "Bearer $Token"
    Accept                 = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "User-Agent"           = "codex-api-sync"
  }

  $Uri = "https://api.github.com$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
  }

  $Json = $Body | ConvertTo-Json -Depth 20 -Compress
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json; charset=utf-8" -Body $Json
}

function Convert-ToBase64Utf8 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $Bytes = [System.IO.File]::ReadAllBytes($Path)
  return [Convert]::ToBase64String($Bytes)
}

function Get-GitOutput {
  param([Parameter(Mandatory = $true)][string[]]$Args)
  $Output = & git @Args
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Args -join ' ') failed."
  }
  return $Output
}

$TargetRef = Invoke-GitHubApi -Method GET -Path "/repos/$Owner/$Repo/git/ref/heads/$Branch"
$RemoteCommitSha = $TargetRef.object.sha
$RemoteCommit = Invoke-GitHubApi -Method GET -Path "/repos/$Owner/$Repo/git/commits/$RemoteCommitSha"
$BaseTreeSha = $RemoteCommit.tree.sha

$LocalHead = (Get-GitOutput -Args @("rev-parse", "HEAD")).Trim()
$LocalBase = (Get-GitOutput -Args @("rev-parse", $BaseRef)).Trim()

if ($LocalBase -ne $RemoteCommitSha) {
  Write-Warning "Local $BaseRef is $LocalBase but GitHub $Branch is $RemoteCommitSha. Fetch/update before syncing if this is unexpected."
}

$NameStatus = Get-GitOutput -Args @("diff", "--name-status", "$BaseRef..HEAD")
if (-not $NameStatus) {
  Write-Host "No local changes ahead of $BaseRef."
  exit 0
}

$TreeItems = @()
foreach ($Line in $NameStatus) {
  if (-not $Line.Trim()) { continue }
  $Parts = $Line -split "`t"
  $Status = $Parts[0]

  if ($Status.StartsWith("R")) {
    $OldPath = $Parts[1]
    $NewPath = $Parts[2]
    $TreeItems += @{
      path = $OldPath
      mode = "100644"
      type = "blob"
      sha  = $null
    }
    $Path = $NewPath
  } else {
    $Path = $Parts[1]
  }

  if ($Status -eq "D") {
    $TreeItems += @{
      path = $Path
      mode = "100644"
      type = "blob"
      sha  = $null
    }
    continue
  }

  $FullPath = Join-Path $PSScriptRoot $Path
  if (-not (Test-Path -LiteralPath $FullPath)) {
    throw "Changed file not found: $Path"
  }

  $Blob = Invoke-GitHubApi -Method POST -Path "/repos/$Owner/$Repo/git/blobs" -Body @{
    content  = Convert-ToBase64Utf8 -Path $FullPath
    encoding = "base64"
  }

  $TreeItems += @{
    path = $Path.Replace("\", "/")
    mode = "100644"
    type = "blob"
    sha  = $Blob.sha
  }
}

$Tree = Invoke-GitHubApi -Method POST -Path "/repos/$Owner/$Repo/git/trees" -Body @{
  base_tree = $BaseTreeSha
  tree      = $TreeItems
}

$Commit = Invoke-GitHubApi -Method POST -Path "/repos/$Owner/$Repo/git/commits" -Body @{
  message = $Message
  tree    = $Tree.sha
  parents = @($RemoteCommitSha)
}

Invoke-GitHubApi -Method PATCH -Path "/repos/$Owner/$Repo/git/refs/heads/$Branch" -Body @{
  sha   = $Commit.sha
  force = $false
} | Out-Null

Write-Host "GitHub API sync complete."
Write-Host "Repository: https://github.com/$Owner/$Repo"
Write-Host "Branch: $Branch"
Write-Host "Commit: $($Commit.sha)"
Write-Host "Local HEAD that was synced: $LocalHead"

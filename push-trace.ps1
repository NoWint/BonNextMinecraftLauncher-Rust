$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = "0"
$env:GIT_TRACE = "1"

$token = gh auth token
$remoteUrl = "https://x-access-token:$token@github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git"
git remote set-url origin $remoteUrl

Write-Host "=== Pushing plugin-architecture branch ==="
& git push origin plugin-architecture 2>&1 | Out-File push-trace.txt -Encoding utf8
$code = $LASTEXITCODE
Write-Host "Exit code: $code"

# Show last 30 lines of trace
Get-Content push-trace.txt -Tail 30

# Reset remote URL
git remote set-url origin https://github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git

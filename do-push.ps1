$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = "0"

# Get token and set remote with auth
$token = gh auth token
$remoteUrl = "https://x-access-token:$token@github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git"
git remote set-url origin $remoteUrl

Write-Host "Pushing to UDBETTER/BonNextMinecraftLauncher-Rust..."
$output = & git push -u origin main 2>&1
$code = $LASTEXITCODE
Write-Host "Exit code: $code"
$output | ForEach-Object { Write-Host $_ }

# Reset remote URL to remove token
git remote set-url origin https://github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git

Write-Host "Done. Branch tracking:"
git branch -vv

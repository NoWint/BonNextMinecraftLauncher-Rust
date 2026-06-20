$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = "0"

$token = gh auth token
$remoteUrl = "https://x-access-token:$token@github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git"
git remote set-url origin $remoteUrl

Write-Host "=== Fetching from UDBETTER fork ==="
& git fetch origin 2>&1 | ForEach-Object { Write-Host "FETCH: $_" }
Write-Host "Fetch exit: $LASTEXITCODE"

Write-Host "=== Remote branches ==="
& git branch -a 2>&1 | ForEach-Object { Write-Host $_ }

Write-Host "=== Creating plugin-architecture branch ==="
& git checkout -b plugin-architecture 2>&1 | ForEach-Object { Write-Host "CHECKOUT: $_" }

Write-Host "=== Pushing plugin-architecture branch ==="
& git push -u origin plugin-architecture 2>&1 | ForEach-Object { Write-Host "PUSH: $_" }
Write-Host "Push exit: $LASTEXITCODE"

# Reset remote URL
git remote set-url origin https://github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git

Write-Host "=== Done ==="

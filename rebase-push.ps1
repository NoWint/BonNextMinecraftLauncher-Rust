$ErrorActionPreference = 'Continue'
$env:GIT_TERMINAL_PROMPT = "0"

# 1. Fetch NoWint's main as a fake remote
Write-Host "=== Fetching NoWint main ==="
& git fetch https://github.com/NoWint/BonNextMinecraftLauncher-Rust.git main 2>&1 | ForEach-Object { Write-Host "FETCH: $_" }

# 2. Create a new branch based on NoWint/main
Write-Host "=== Creating branch based on NoWint/main ==="
& git branch -D plugin-arch-v2 2>&1 | Out-Null
& git checkout -b plugin-arch-v2 FETCH_HEAD 2>&1 | ForEach-Object { Write-Host "CHECKOUT: $_" }

# 3. Remove all tracked files from NoWint's version, then add our files
Write-Host "=== Removing old files ==="
& git rm -r --cached . 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host "RM: $_" }

# 4. Add all our files
Write-Host "=== Adding our files ==="
& git add -A 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host "ADD: $_" }

# 5. Commit
Write-Host "=== Committing ==="
& git commit -m "feat: Plugin Architecture Implementation" 2>&1 | ForEach-Object { Write-Host "COMMIT: $_" }

# 6. Push to UDBETTER fork
Write-Host "=== Pushing to UDBETTER fork ==="
$token = gh auth token
$remoteUrl = "https://x-access-token:$token@github.com/UDBETTER/BonNextMinecraftLauncher-Rust.git"
& git push $remoteUrl plugin-arch-v2 2>&1 | ForEach-Object { Write-Host "PUSH: $_" }
Write-Host "Push exit: $LASTEXITCODE"

Write-Host "=== Done ==="

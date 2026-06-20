$ErrorActionPreference = 'Continue'
Write-Host "=== Pushing to GitHub ==="
Write-Host "Remote URL:"
git remote -v
Write-Host ""
Write-Host "Running git push -u origin main..."
$env:GIT_TERMINAL_PROMPT = "0"
$output = & git push -u origin main 2>&1
$code = $LASTEXITCODE
Write-Host "Exit code: $code"
Write-Host "Output:"
$output | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host "Branch tracking:"
git branch -vv

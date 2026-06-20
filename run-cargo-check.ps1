$ErrorActionPreference = 'Continue'
Write-Host "=== Starting cargo check ==="
$out = & cargo check --manifest-path src-tauri/Cargo.toml 2>&1
$code = $LASTEXITCODE
Write-Host "=== Exit code: $code ==="
$out | Out-File -FilePath cargo-check-result.txt -Encoding utf8
Write-Host "=== Output written to cargo-check-result.txt ==="
Write-Host "Output lines: $($out.Count)"

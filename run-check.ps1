$ErrorActionPreference = 'SilentlyContinue'
$cargo = "$env:USERPROFILE\.cargo\bin\cargo.exe"
Write-Host "Running: $cargo check --manifest-path src-tauri\Cargo.toml"
Write-Host "Working directory: $(Get-Location)"
Write-Host "---OUTPUT START---"
& $cargo check --manifest-path src-tauri\Cargo.toml 2>&1 | ForEach-Object {
    Write-Host $_
    $_
} | Out-File -FilePath cargo-check-full.txt -Encoding utf8
$code = $LASTEXITCODE
Write-Host "---OUTPUT END---"
Write-Host "Exit code: $code"
Write-Host "Output saved to cargo-check-full.txt"

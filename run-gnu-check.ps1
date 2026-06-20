$ErrorActionPreference = 'SilentlyContinue'
$cargo = "$env:USERPROFILE\.cargo\bin\cargo.exe"
Write-Host "=== Cargo Check with GNU Toolchain ==="
Write-Host "Toolchain: $(rustup show active-toolchain)"
Write-Host ""

# Run cargo check and capture all output
$output = & $cargo check --manifest-path src-tauri\Cargo.toml 2>&1
$exitCode = $LASTEXITCODE

Write-Host "=== Exit Code: $exitCode ==="
Write-Host "=== Output Lines: $($output.Count) ==="
Write-Host ""

# Save full output
$output | Out-File -FilePath cargo-gnu-full.txt -Encoding utf8
Write-Host "Full output saved to cargo-gnu-full.txt"

# Show last 20 lines
Write-Host "=== Last 20 lines ==="
if ($output.Count -gt 20) {
    $output[-20..-1] | ForEach-Object { Write-Host $_ }
} else {
    $output | ForEach-Object { Write-Host $_ }
}

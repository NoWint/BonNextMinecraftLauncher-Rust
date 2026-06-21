# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BonNext, please report it privately by opening a GitHub Security Advisory or emailing security@bonnext.com. Do not open a public issue.

We take all security reports seriously and will respond within 48 hours.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Active |

## Security Model

### Authentication
- Microsoft OAuth 2.0 uses the **device authorization grant** flow. Access tokens and refresh tokens are stored locally on disk in the platform's application data directory (e.g., `~/Library/Application Support/bonnext/accounts.json` on macOS, `%APPDATA%/bonnext/accounts.json` on Windows, `~/.config/bonnext/accounts.json` on Linux). No tokens are transmitted to any server other than Microsoft's OAuth endpoints and Mojang's authentication API.
- Offline mode accounts use **deterministic v5 UUIDs** based on the username. No network requests are made during offline login.

### Network Security
- All HTTP requests use **HTTPS** (enforced via reqwest with rustls-tls).
- The client sends a `User-Agent: BonNext/1.0 (MinecraftLauncher)` header to comply with Mojang's CDN requirements.
- Download integrity is verified with **SHA-1 checksums** for all game files.
- Content Security Policy (CSP) is enforced to prevent XSS and unauthorized network access.

### Minecraft Process Security
- The Minecraft game process is spawned as a **child process** with the user's JVM. BonNext does not inject code into the Minecraft process.
- Log4j CVE-2021-44228 mitigation: `-Dlog4j2.formatMsgNoLookups=true` is always added to JVM arguments.
- Native libraries are extracted to a version-specific directory and loaded via `-Djava.library.path`.
- File path operations are validated to prevent path traversal attacks (Zip Slip protection).

### API Key Management
- The CurseForge API key can be configured via the `BONNEXT_CF_API_KEY` environment variable. If not set, a community default key is used.

## Dependencies

Dependencies are pinned via `Cargo.lock` (Rust) and `pnpm-lock.yaml` (Node.js). We recommend using `pnpm install --frozen-lockfile` and `cargo build --locked` for reproducible builds.

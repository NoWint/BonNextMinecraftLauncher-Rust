# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in BonNext, please report it privately by emailing the maintainers. Do not open a public issue.

We take all security reports seriously and will respond within 48 hours.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | ✅ Active |
| 0.1.x   | ❌ EOL |

## Security Model

### Authentication
- Microsoft OAuth 2.0 uses the **device authorization grant** flow. Access tokens and refresh tokens are stored locally on disk in `~/.local/share/bonnext/accounts.json` (or platform equivalent). No tokens are transmitted to any server other than Microsoft's OAuth endpoints and Mojang's authentication API.
- Offline mode accounts use **deterministic v5 UUIDs** based on the username. No network requests are made during offline login.

### Network Security
- All HTTP requests use **HTTPS** (enforced via reqwest with rustls-tls).
- The client sends a `User-Agent: BonNext/1.0 (MinecraftLauncher)` header to comply with Mojang's CDN requirements.
- Download integrity is verified with **SHA-1 checksums** for all game files.

### Minecraft Process Security
- The Minecraft game process is spawned as a **child process** with the user's JVM. BonNext does not inject code into the Minecraft process.
- Log4j CVE-2021-44228 mitigation: `-Dlog4j2.formatMsgNoLookups=true` is always added to JVM arguments.
- Native libraries are extracted to a version-specific directory and loaded via `-Djava.library.path`.

## Dependencies

Dependencies are pinned via `Cargo.lock` (Rust) and `pnpm-lock.yaml` (Node.js). We recommend using `pnpm install --frozen-lockfile` and `cargo build --locked` for reproducible builds.

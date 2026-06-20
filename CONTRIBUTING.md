# Contributing to BonNext

Thanks for your interest in contributing! BonNext is a next-generation Minecraft launcher built with Tauri v2, React 18, and Rust.

## Development Setup

**Prerequisites:** Rust 1.80+, Node.js 20+, pnpm 9+

```bash
git clone https://github.com/bonnext/bonnext.git
cd bonnext
pnpm install
pnpm tauri dev
```

## Project Structure

```
src/                    # React frontend (TypeScript + CSS Modules)
├── api.ts              # Typed Tauri invoke wrappers
├── stores/             # React Context state (auth, config, instance, toast)
├── pages/              # Page components (Login, Home, Instances, Mods, etc.)
├── components/         # Reusable UI components
├── hooks/              # Custom React hooks
└── styles/             # Global CSS and design tokens

src-tauri/src/          # Rust backend
├── lib.rs              # Tauri command registration
├── auth/               # Microsoft OAuth + offline auth
├── config.rs           # Application configuration
├── download/           # Download engine (queue, mirror, verify)
├── instance/           # Instance CRUD management
├── launch/             # Launch args, process spawner, state machine
├── loader/             # Fabric & Forge mod loader support
├── modrinth.rs         # Modrinth API integration
├── platform/           # Java detection, logging, paths
└── version/            # Version manifest, resolver, rule evaluation
```

## Development Workflow

### Quick Checks

```bash
# TypeScript type check
npx tsc --noEmit

# Rust compile check (fast, no codegen)
cargo check --manifest-path src-tauri/Cargo.toml

# Run Rust tests
cargo test --manifest-path src-tauri/Cargo.toml

# Full frontend build
pnpm build
```

### Running in Dev Mode

```bash
pnpm tauri dev
```

This starts the Vite dev server (port 1420, HMR on 1421) and the Tauri desktop window. Frontend changes hot-reload; Rust changes require restarting `pnpm tauri dev`.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org):

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature or functionality |
| `fix:` | Bug fix |
| `refactor:` | Code restructuring (no behavior change) |
| `style:` | UI/CSS/styling changes |
| `perf:` | Performance improvement |
| `docs:` | Documentation only |
| `test:` | Adding or updating tests |
| `chore:` | Build, dependencies, config |

Example: `feat: add Modrinth mod browser with one-click install`

## Code Style

### TypeScript
- Use functional components with hooks
- CSS Modules for component styles (`.module.css`)
- Types defined in `api.ts` or co-located with components
- Named exports only (no default exports except pages)
- No trailing semicolons (project convention)

### Rust
- `snake_case` for variables and functions
- `CamelCase` for types and structs (except JSON serialization structs matching external APIs)
- Use `thiserror` for error types
- All Tauri commands go through `lib.rs`
- Keep modules focused — single responsibility

## Before Submitting a PR

1. **Both type checks pass:**
   ```bash
   npx tsc --noEmit && cargo check --manifest-path src-tauri/Cargo.toml
   ```

2. **All tests pass:**
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml
   ```

3. **Test the feature in dev mode:** `pnpm tauri dev`

4. **No new warnings introduced** (check `cargo check` output)

## Pull Request Process

1. Create a feature branch from `main`
2. Make focused changes with clear conventional commit messages
3. Update the README if adding user-facing features
4. Push and open a PR describing what changed and why
5. PRs need one approving review before merging

## Design Principles

- **Performance first** — Use Rust for compute-intensive paths, React for UI
- **Type safety everywhere** — TypeScript strict mode, typed IPC wrappers
- **Graceful degradation** — Errors should never crash the app; use ErrorBoundary + toast fallbacks
- **Small bundle** — Tauri + Vite keeps the app lightweight (sub-10MB)
- **Neo-Tokyo aesthetic** — Dark theme, neon-yellow accents, clip-path geometry

## Code of Conduct

Be respectful, constructive, and collaborative. We're building something cool together.

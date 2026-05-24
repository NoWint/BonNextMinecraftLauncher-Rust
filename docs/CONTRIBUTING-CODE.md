# Contributing to BonNext

Thank you for your interest in contributing to BonNext! This guide covers the technical details you need to get started.

## Module Structure

### Backend (Rust — `src-tauri/src/commands/`)

Commands are organized by domain in the `commands/` directory:

| Module | Purpose |
|--------|---------|
| `auth.rs` | Authentication (offline, Microsoft OAuth) |
| `config.rs` | App configuration CRUD |
| `instance.rs` | Instance management, snapshots, crash diagnosis |
| `launch.rs` | Game launch, state machine |
| `version.rs` | Version manifest, downloads |
| `modrinth.rs` | Modrinth API integration |
| `curseforge.rs` | CurseForge API integration |
| `content.rs` | Installed content management, updates |
| `collections.rs` | User wishlist/collections |
| `search.rs` | Unified content search |
| `system.rs` | System info, hardware, disk usage |
| `server.rs` | Server ping |
| `social.rs` | Friends, Discord RPC |
| `network.rs` | LAN discovery, P2P, Web API |
| `cli.rs` | CLI mode, battery status |
| `news.rs` | Minecraft news |
| `world.rs` | World saves, log files |
| `optimization.rs` | Optimization presets |
| `achievement.rs` | Achievement system |
| `misc.rs` | Java detection, security, frame time, NLP search, etc. |

All commands are registered in `lib.rs` via `tauri::generate_handler![]`.

### Frontend (React — `src/`)

| Directory | Purpose |
|-----------|---------|
| `pages/` | Route-level page components |
| `components/layout/` | Sidebar, page transitions, decorations |
| `components/ui/` | Reusable UI components (Button, Modal, etc.) |
| `components/marketplace/` | Marketplace-specific components |
| `stores/` | React Context + useReducer state management |
| `hooks/` | Custom React hooks |
| `styles/` | Global CSS, design tokens, themes |
| `i18n/` | Internationalization |

## Naming Conventions

### Rust
- **Functions/variables:** `snake_case`
- **Types/structs:** `PascalCase`
- **Constants:** `SCREAMING_SNAKE_CASE`
- **Tauri commands:** `snake_case` (e.g., `get_frame_time_data`)
- **Module files:** `snake_case.rs`

### TypeScript
- **Functions/variables:** `camelCase`
- **Components/Interfaces/Types:** `PascalCase`
- **Constants:** `SCREAMING_SNAKE_CASE`
- **API methods:** `camelCase` (e.g., `getFrameTimeData`)
- **CSS class names (CSS Modules):** `camelCase` or `BEM__like`

## Testing Requirements

### Rust
- **Unit tests:** Add `#[cfg(test)] mod tests` at the bottom of each module
- **Integration tests:** Place in `src-tauri/tests/` directory
- Run with: `cargo test --manifest-path src-tauri/Cargo.toml`
- Critical paths that must have tests: config parsing, auth token handling, download verification, launch state transitions, version resolution

### Frontend
- **Unit tests:** Use Vitest with React Testing Library
- **Component tests:** Test rendering, user interactions, and state changes
- Run with: `pnpm test`
- All new UI components should include basic rendering tests

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, tooling, dependencies

### Scopes
- `backend`: Rust/Tauri backend
- `frontend`: React/TypeScript frontend
- `api`: Tauri command API changes
- `ui`: Visual/UI changes
- `auth`: Authentication
- `instance`: Instance management
- `download`: Download engine
- `launch`: Game launching
- `security`: Security features

### Examples
```
feat(backend): add frame time analysis from game logs
fix(frontend): resolve sidebar navigation flicker on route change
docs(api): document all Tauri commands
refactor(backend): extract FPS parsing into separate function
```

## Code Style

### Rust
- Run `cargo clippy --manifest-path src-tauri/Cargo.toml` and fix all warnings
- Run `cargo fmt --manifest-path src-tauri/Cargo.toml` before committing
- Follow `rustfmt` defaults
- Use `thiserror` for error types
- Prefer `?` operator over `match` for error propagation

### TypeScript / React
- ESLint + Prettier are configured in the project
- Run `pnpm lint` to check for issues
- Use CSS Modules (`.module.css`) for component styling — no inline styles except for dynamic values
- All new UI must use CSS Modules
- Use `em` units for sizing (base is 16px on `html`)
- Follow the Neo-Tokyo design system: yellow accent (#FFE600), clip-path corners, Bebas Neue headings

## PR Process

1. **Before submitting:** Ensure both `cargo check` and `npx tsc --noEmit` pass
2. **PR title:** Use conventional commit format
3. **PR description:** Include:
   - What changes were made and why
   - How to test the changes
   - Any breaking changes or migration steps
4. **Review:** At least one approval required before merge
5. **CI:** All checks must pass (type check, lint, build)

## Development Workflow

```bash
# Start development
pnpm install
pnpm tauri dev

# Quick checks
npx tsc --noEmit                              # TypeScript type check
cargo check --manifest-path src-tauri/Cargo.toml  # Rust compile check
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests

# Full verification
cargo check --manifest-path src-tauri/Cargo.toml 2>&1 | grep -E "^error|Finished" && echo "---" && npx tsc --noEmit 2>&1 | head -15

# Production build
pnpm tauri build
```

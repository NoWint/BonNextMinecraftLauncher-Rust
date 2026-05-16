# Contributing to BonNext

Thanks for your interest in contributing! BonNext is a next-generation Minecraft launcher built with Tauri, React, and Rust.

## Development Setup

```bash
git clone https://github.com/bonnext/bonnext.git
cd bonnext
pnpm install
pnpm tauri dev
```

**Prerequisites:** Rust 1.80+, Node.js 20+, pnpm 9+

## Project Structure

- `src/` — React frontend (TypeScript)
- `src-tauri/src/` — Rust backend (Tauri commands)
- `src-tauri/Cargo.toml` — Rust dependencies

See [README.md](README.md) for the full architecture.

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org):

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `style:` — UI/CSS changes
- `docs:` — documentation
- `chore:` — build, deps, config

## Before Submitting

1. Ensure the build passes:
   ```bash
   pnpm build              # TypeScript + Vite
   cargo check             # Rust
   ```

2. Test your changes in dev mode: `pnpm tauri dev`

3. Follow the existing code style — no trailing semicolons in TypeScript, snake_case in Rust.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Push and open a PR with a description of what changed and why
4. PRs need at least one review before merging

## Code of Conduct

Be respectful. We're building something cool together.

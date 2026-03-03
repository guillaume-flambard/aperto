# 🌐 APERTO - Universal Project Orchestrator

Analyze, test, and develop intelligently across all stacks.

## Installation

```bash
# Use without installing
npx aperto

# Or install globally
npm install -g aperto
```

## Usage

```bash
# Interactive mode (recommended)
npx aperto

# Analyze only
npx aperto analyze

# Run RED→GREEN workflow
npx aperto run

# Audit with report
npx aperto audit
```

## Supported Stacks

- **Backend:** Laravel, Express, Fastify, NestJS, Django, Ruby on Rails, Go, Rust
- **Frontend:** React, Vue.js, Next.js, Nuxt.js, Svelte
- **Mobile:** React Native (Expo), Flutter, Ionic
- **Full-stack:** Laravel + Inertia, Next.js, Nuxt.js

## How It Works

1. **Detection** - Automatically detects your stack
2. **Analysis** - Identifies routes, views, tests, and gaps
3. **Strategy** - Recommends best approach (YOLO, Progressive, Scope-First)
4. **RED Phase** - Generates failing tests
5. **GREEN Phase** - Implements features to pass tests
6. **Validation** - Ensures everything works

## Features

✅ **Universal** - Works on any stack
✅ **Safe** - Always creates git backup
✅ **Interactive** - Step-by-step guidance
✅ **Flexible** - Choose your approach
✅ **Reports** - Markdown, JSON, or console

## Example

```bash
cd my-laravel-project
npx aperto

# Aperto will:
# 1. Detect Laravel + React
# 2. Find 67 routes, 23 tests
# 3. Recommend Scope-First mode
# 4. Generate tests
# 5. Implement missing features
# 6. Validate everything works
```

## License

MIT

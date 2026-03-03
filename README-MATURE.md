# Aperto - Mature Production-Ready Version

## 🚀 What's New

### 1. Dry Run Mode (`-d`, `--dry-run`)
Preview all changes before applying them:
```bash
npx aperto --dry-run
npx aperto run --dry-run
npx aperto scope admin --dry-run
```

### 2. Pre-flight Checks (`doctor` command)
Validate your environment before running:
```bash
npx aperto doctor
```

Checks:
- Node.js version (>=18)
- Git installation
- Project type detection
- Test framework availability
- Configuration status

### 3. Better Error Handling
- Try-catch blocks around all operations
- Graceful degradation when git not available
- Informative error messages
- Stack traces in DEBUG mode

### 4. Enhanced CLI
New commands:
- `aperto doctor` - Run diagnostics
- `aperto config` - Show configuration
- `aperto scope [name]` - Work on specific scope

New options:
- `--dry-run` - Preview changes
- `--yes` - Skip confirmations
- `--mode [auto|safe|confident]` - Execution mode

### 5. Configuration Management
- Auto-created `.aperto/` directory
- `.aperto/config.json` - User preferences
- `.aperto/.gitignore` - Ignore backups
- Validation before initialization

### 6. Improved Logging
- Color-coded output
- Debug mode: `DEBUG=1 npx aperto`
- Progress indicators
- Clear summaries

## 📦 Installation & Usage

### Quick Start
```bash
# In your project directory
npx aperto init
npx aperto doctor
npx aperto --dry-run  # Preview
npx aperto            # Execute
```

### Commands

**Initialize**
```bash
npx aperto init
```

**Analyze**
```bash
npx aperto analyze                    # Console output
npx aperto analyze -f markdown        # Markdown report
npx aperto analyze -f json            # JSON report
```

**Run RED→GREEN Workflow**
```bash
npx aperto run                        # Auto mode
npx aperto run --mode safe            # Always confirm
npx aperto run --mode confident       # Skip confirmations
npx aperto run --dry-run              # Preview only
npx aperto run --yes                  # Auto-confirm all
```

**Work on Specific Scope**
```bash
npx aperto scopes                     # List scopes
npx aperto scope admin                # Work on admin scope
npx aperto scope admin --dry-run      # Preview only
```

**Audit**
```bash
npx aperto audit                      # Markdown report
npx aperto audit -f json              # JSON report
```

**Diagnostics**
```bash
npx aperto doctor                     # Check environment
npx aperto config                     # Show configuration
```

## 🔧 Supported Stacks

### Fully Supported
- **Laravel** - PHP, PHPUnit, Blade
- **React** - JS/TS, Jest/Vitest/Cypress/Playwright
- **Next.js** - Full-stack React
- **Vue** - Vue 2/3, Vitest
- **Nuxt** - Full-stack Vue
- **Flutter** - Dart, widget tests

### Partial Support (Base Adapter)
- Express.js
- Fastify
- NestJS
- Generic Node.js
- PHP (non-Laravel)
- Python
- Go
- Rust

## 🛡️ Safety Features

1. **Automatic Backups**
   - Creates git commit before changes
   - Skip with `--no-backup` (not recommended)

2. **Dry Run Mode**
   - Preview all changes
   - No file modifications
   - See what would be generated

3. **Confirmation Prompts**
   - Safe mode: always confirm
   - Progressive mode: confirm per scope
   - YOLO mode: single confirmation

4. **Pre-flight Checks**
   - Validate environment
   - Detect missing dependencies
   - Check configuration

5. **Error Recovery**
   - Graceful failures
   - Informative messages
   - Rollback guidance

## 📁 Project Structure

```
your-project/
├── .aperto/
│   ├── config.json          # Your configuration
│   └── .gitignore          # Ignore backups
├── src/                     # Your source code
└── ...
```

## 🐛 Debug Mode

Enable detailed logging:
```bash
DEBUG=1 npx aperto
DEBUG=1 npx aperto run --dry-run
```

## ⚙️ Configuration

After `npx aperto init`, edit `.aperto/config.json`:

```json
{
  "mode": "safe",
  "testFramework": "auto",
  "generateTests": true,
  "generateImplementations": true,
  "backupEnabled": true,
  "overwriteExisting": false
}
```

## 🔄 Workflow

1. **Analyze** - Detect stack and structure
2. **Strategy** - Recommend approach
3. **RED Phase** - Generate failing tests
4. **GREEN Phase** - Generate implementations
5. **VALIDATE** - Run tests
6. **Report** - Show results

## 📊 Example Output

```
🌐 APERTO - Universal Project Orchestrator

⚠️  Creating backup...
  ✅ Backup created

🔍 Analyzing project...
  Detected: laravel 10
  Analyzing project structure...

🔴 RED PHASE: Generating tests

  Creating: tests/Feature/Admin/DashboardTest.php
  Creating: tests/Feature/Admin/UsersTest.php

  ✅ Generated 2 test files

🟢 GREEN PHASE: Implementing features

  Creating view: resources/views/admin/dashboard.blade.php

  ✅ Generated 1 implementation files

✅ VALIDATE PHASE: Running tests

✅ All tests passing!

📊 Summary:
  Tests generated:    2
  Implementations:    1
  Mode:              safe
```

## 🚨 Troubleshooting

**"No project detected"**
```bash
# Make sure you're in project root
cd /path/to/your-project
npx aperto doctor
```

**"Tests fail to run"**
```bash
# Check test framework
npx aperto doctor
# Install missing dependencies
npm install  # or composer install
```

**"Git backup failed"**
```bash
# Initialize git
git init
git add .
git commit -m "Initial commit"
```

## 📚 Documentation

- `README.md` - Quick start guide
- `IMPLEMENTATION.md` - Technical details
- `CHANGELOG.md` - Version history

## 📝 License

MIT

## 🙏 Credits

Built by ByteCoded

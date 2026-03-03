# 🌐 APERTO - Universal Project Orchestrator

Analyze, test, and develop intelligently across all stacks. Now with **AI-powered** test generation and code analysis!

## ✨ New: AI-Powered Features

Aperto now integrates with LLMs (Kimi, OpenAI, Anthropic, or local) for intelligent code analysis:

- 🧠 **AI Test Generation** - Context-aware tests, not just templates
- 🔍 **Smart Refactoring** - Detect code smells and suggest improvements
- 📊 **Project Analysis** - Understand architecture and patterns
- 💰 **Cost Tracking** - Monitor API usage and costs
- ⚡ **Response Caching** - Save money by caching LLM responses

## Installation

```bash
# Use without installing
npx aperto

# Or install globally
npm install -g aperto

# Or install in project
npm install --save-dev aperto
```

## Quick Start

```bash
# Initialize with AI setup
npx aperto init

# Run with AI-powered analysis
npx aperto

# Or without AI (faster, free)
npx aperto --no-ai
```

## Usage

### Basic Commands

```bash
# Interactive mode with AI (default)
npx aperto

# Run RED→GREEN workflow
npx aperto run

# Analyze project
npx aperto analyze

# Audit without modifications
npx aperto audit

# Check environment
npx aperto doctor
```

### AI Commands

```bash
# AI-powered refactoring suggestions
npx aperto refactor

# Quick AI analysis
npx aperto ai

# Configure AI settings
npx aperto llm
```

## Configuration

### Setup AI/LLM

```bash
npx aperto init
```

You'll be prompted to:
1. Choose mode (safe/confident)
2. **Enable AI features** (optional)
3. Select LLM provider:
   - **Kimi** (Moonshot AI) - Recommended, great for code
   - **OpenAI** (GPT-4) - Fast and accurate
   - **Anthropic** (Claude) - Excellent reasoning
   - **Ollama** (Local) - Free, runs on your machine
4. Enter API key (not needed for Ollama)

### Manual Configuration

Edit `.aperto/config.json`:

```json
{
  "mode": "safe",
  "reportFormat": "markdown",
  "autoBackup": true,
  "llm": {
    "enabled": true,
    "provider": "kimi",
    "apiKey": "sk-your-key-here",
    "model": "kimi-latest",
    "cacheEnabled": true
  }
}
```

Or use environment variable:
```bash
export APERTO_LLM_API_KEY="sk-your-key-here"
```

## Supported Stacks

- **Backend:** Laravel, Express, Fastify, NestJS, Django, Ruby on Rails, Go, Rust
- **Frontend:** React, Vue.js, Next.js, Nuxt.js, Svelte
- **Mobile:** React Native (Expo), Flutter, Ionic
- **Full-stack:** Laravel + Inertia, Next.js, Nuxt.js

## How It Works

### Traditional Mode (Regex-based)
1. **Detection** - Automatically detects your stack
2. **Analysis** - Identifies routes, views, tests, and gaps
3. **Strategy** - Recommends best approach (YOLO, Progressive, Scope-First)
4. **RED Phase** - Generates tests using templates
5. **GREEN Phase** - Implements features to pass tests
6. **Validation** - Runs tests and shows results

### AI Mode (LLM-powered)
1. **Detection** - Stack detection
2. **Deep Analysis** - AI understands your code's intent and patterns
3. **Intelligent Tests** - AI generates context-aware tests with realistic scenarios
4. **Smart Refactoring** - AI suggests architectural improvements
5. **Validation** - Runs generated tests

## AI Features

### 🧠 Intelligent Test Generation

**Without AI (Template-based):**
```php
public function test_index() {
    $response = $this->get('/bookings');
    $response->assertStatus(200);
}
```

**With AI (Context-aware):**
```php
public function test_index_returns_paginated_bookings_with_eager_loaded_relations()
{
    // Arrange: Create bookings with relationships
    $route = Route::factory()->create();
    $bookings = Booking::factory()->count(15)->create([
        'route_id' => $route->id,
        'status' => 'confirmed'
    ]);
    
    // Act: Authenticated user requests bookings
    $response = $this->actingAs($this->user)
        ->getJson(route('bookings.index', ['page' => 1]));
    
    // Assert: Response structure and pagination
    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'reference', 'route', 'passengers', 'total_amount']
            ],
            'meta' => ['current_page', 'from', 'to', 'total']
        ])
        ->assertJsonCount(10, 'data');
}
```

### 🔍 Smart Refactoring

```bash
$ npx aperto refactor

🔍 AI-powered refactoring analysis...

📋 Refactoring Suggestions:

🔴 High Priority (3):
─────────────────────────────────────
1. BookingController@store (156 lines)
   Issue: Fat controller
   💡 Extract to BookingService
   ├─ Create app/Services/BookingCreationService.php
   ├─ Move business logic from controller
   └─ Add unit tests for service

🟡 Medium Priority (5):
─────────────────────────────────────
2. User model
   Issue: Relations without type hints
   💡 Add return types
   └─ public function bookings(): HasMany
```

### 💰 Cost Tracking

```bash
📊 LLM Session Stats:
  Provider: kimi (kimi-latest)
  Requests: 5
  Tokens: 12,450
  Cache hits: 2
  Cost: $0.18
```

## Examples

### Example 1: Laravel Project with AI

```bash
cd my-laravel-project

# Initialize with AI
npx aperto init
# → Enable AI? Yes
# → Provider? Kimi
# → API key? sk-...

# Run with AI
npx aperto

🌐 APERTO - Intelligent Orchestrator

🔍 Analyzing project...
✓ Detected: laravel 11

🧠 AI-powered analysis...
  [LLM Request] kimi...
  [LLM Response] 2.4s, 2,340 tokens

💡 AI Suggestions:
• Architecture: Service-based with Repository pattern
• Critical areas: Payment processing, Booking validation
• Test coverage: medium (45% coverage, 12 controllers without tests)

🔴 RED PHASE: Generating tests
  🧠 Using AI for intelligent test generation...
  🧠 AI analyzing BookingController...
  ✅ AI tests generated for BookingController
  🧠 AI analyzing PaymentController...
  ✅ AI tests generated for PaymentController
  
📊 Test Generation Stats:
   AI-generated: 12
   Template: 0

📊 LLM Session Stats:
  Provider: kimi (kimi-latest)
  Requests: 12
  Tokens: 15,230
  Cost: $0.23

✅ Generated 12 test files
```

### Example 2: Local LLM (Free)

```bash
# Install Ollama first: https://ollama.ai
ollama pull codellama

npx aperto init
# → Enable AI? Yes
# → Provider? Ollama (Local)
# → URL? http://localhost:11434
# → Model? codellama

npx aperto

🧠 AI-powered analysis...
  [LLM Request] ollama... (this may take longer)
  [LLM Response] 12.5s, 2,340 tokens

📊 LLM Session Stats:
  Provider: ollama (codellama)
  Cost: $0.00 ✨ (local is free!)
```

### Example 3: Without AI (Fast, Free)

```bash
npx aperto --no-ai

🔍 Analyzing project (regex mode)...

🔴 RED PHASE: Generating tests (templates)
  📝 Created: tests/Feature/BookingControllerTest.php
  📝 Created: tests/Feature/PaymentControllerTest.php
  
✅ Generated 12 test files (template-based)
```

## Options

```bash
# Dry run (preview only)
npx aperto --dry-run

# Skip AI even if configured
npx aperto --no-ai

# Force AI usage
npx aperto --ai

# Different modes
npx aperto --mode safe      # Always confirm
npx aperto --mode confident # Skip confirmations
```

## Advanced Usage

### CI/CD Integration

```yaml
# .github/workflows/tests.yml
- name: Generate missing tests
  run: npx aperto --yes --no-ai
  # Use --no-ai in CI for speed and cost

- name: Run tests
  run: php artisan test
```

### Custom Configuration

```javascript
// .apertorc.js
module.exports = {
  llm: {
    enabled: true,
    provider: 'kimi',
    model: 'kimi-latest',
    temperature: 0.2,  // More deterministic
    maxTokens: 4000,
    cacheEnabled: true,
    cacheDir: '.aperto/cache'
  }
};
```

## Troubleshooting

### AI not working?

```bash
# Check configuration
npx aperto config

# Test LLM connection
npx aperto llm

# Check API key
export APERTO_LLM_API_KEY="your-key"
```

### Too slow?

```bash
# Use local LLM (free, but slower)
npx aperto llm
# → Select Ollama

# Or disable AI
npx aperto --no-ai
```

### Too expensive?

```bash
# Enable caching (reuses previous responses)
npx aperto llm
# → Cache enabled: Yes

# Or use local LLM
npx aperto llm
# → Select Ollama (completely free)
```

## License

MIT

---

**Made with ❤️ by ByteCoded**

**Powered by:**
- LLM: Kimi (Moonshot AI), OpenAI, Anthropic, Ollama
- Testing: PHPUnit, Jest, Vitest, Cypress
- Stacks: Laravel, React, Vue, Flutter, and more

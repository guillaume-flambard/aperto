/**
 * LLM Client - Unified interface for multiple AI providers
 * Supports: Kimi, OpenAI, Anthropic, Ollama (local)
 */

const chalk = require('chalk');
const crypto = require('crypto');
const { LLMCache } = require('./cache');
const { KimiProvider } = require('./providers/kimi');
const { KimiCliProvider } = require('./providers/kimi-cli');
const { OpenAIProvider } = require('./providers/openai');
const { AnthropicProvider } = require('./providers/anthropic');
const { OllamaProvider } = require('./providers/ollama');

// Load .env file from .aperto/.env
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.aperto', '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^export\s+([A-Za-z0-9_]+)="([^"]*)"/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2];
        }
      });
    }
  } catch (e) {
    // Ignore errors
  }
}

// Load env file on module load
loadEnvFile();

class LLMClient {
  constructor(config = {}) {
    // Reload env file to get latest values
    loadEnvFile();
    
    this.config = {
      provider: config.provider || 'kimi',
      apiKey: config.apiKey || process.env.APERTO_LLM_API_KEY,
      model: config.model || this.getDefaultModel(config.provider),
      baseUrl: config.baseUrl || null,
      maxTokens: config.maxTokens || 4000,
      temperature: config.temperature || 0.3,
      cacheEnabled: config.cacheEnabled !== false,
      timeout: config.timeout || 60000,
      ...config
    };
    
    this.cache = new LLMCache();
    this.provider = this.createProvider();
    this.stats = {
      requests: 0,
      tokens: 0,
      cost: 0,
      cacheHits: 0
    };
  }

  getDefaultModel(provider) {
    const defaults = {
      kimi: 'kimi-k2-turbo-preview',
      openai: 'gpt-4',
      anthropic: 'claude-3-opus-20240229',
      ollama: 'codellama'
    };
    return defaults[provider] || 'kimi-k2-turbo-preview';
  }

  createProvider() {
    switch (this.config.provider) {
      case 'kimi':
        // Check if we have a real API key (not OAuth)
        const apiKey = this.config.apiKey || process.env.APERTO_LLM_API_KEY;
        const isOAuth = apiKey && apiKey.startsWith('eyJ'); // JWT format
        
        if (!apiKey || isOAuth) {
          console.log(chalk.gray('  [OAuth] No API key found, using Kimi CLI...'));
          return new KimiCliProvider(this.config);
        }
        return new KimiProvider(this.config);
      case 'kimi-cli':
        // Force use CLI provider
        return new KimiCliProvider(this.config);
      case 'openai':
        return new OpenAIProvider(this.config);
      case 'anthropic':
        return new AnthropicProvider(this.config);
      case 'ollama':
        return new OllamaProvider(this.config);
      default:
        throw new Error(`Unknown LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Send a prompt to the LLM with caching
   */
  async sendPrompt(prompt, options = {}) {
    const cacheKey = this.generateCacheKey(prompt, options);
    
    // Check cache
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        console.log(chalk.gray('  [Cache hit]'));
        return cached;
      }
    }

    try {
      console.log(chalk.gray(`  [LLM Request] ${this.config.provider}...`));
      
      const startTime = Date.now();
      const response = await this.provider.send(prompt, {
        maxTokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        ...options
      });
      
      const duration = Date.now() - startTime;
      
      // Update stats
      this.stats.requests++;
      this.stats.tokens += response.tokens || 0;
      this.stats.cost += response.cost || 0;
      
      console.log(chalk.gray(`  [LLM Response] ${duration}ms, ${response.tokens || '?'} tokens`));
      
      // Cache response
      if (this.config.cacheEnabled) {
        await this.cache.set(cacheKey, response);
      }
      
      return response;
    } catch (error) {
      console.error(chalk.red(`  [LLM Error] ${error.message}`));
      throw error;
    }
  }

  /**
   * Analyze a project structure
   */
  async analyzeProject(projectContext) {
    const prompt = this.buildProjectAnalysisPrompt(projectContext);
    const response = await this.sendPrompt(prompt, { maxTokens: 4000 });
    return this.parseProjectAnalysis(response.content);
  }

  /**
   * Generate intelligent tests for a controller
   */
  async generateTests(controllerContext) {
    const prompt = this.buildTestGenerationPrompt(controllerContext);
    const response = await this.sendPrompt(prompt, { maxTokens: 4000 });
    return this.parseTestResponse(response.content);
  }

  /**
   * Suggest refactoring improvements
   */
  async suggestRefactoring(codeContext) {
    const prompt = this.buildRefactoringPrompt(codeContext);
    const response = await this.sendPrompt(prompt, { maxTokens: 3000 });
    return this.parseRefactoringResponse(response.content);
  }

  /**
   * Generate implementation stub
   */
  async generateImplementation(context) {
    const prompt = this.buildImplementationPrompt(context);
    const response = await this.sendPrompt(prompt, { maxTokens: 3000 });
    return response.content;
  }

  buildProjectAnalysisPrompt(context) {
    return `Analyze this Laravel project structure and provide insights.

PROJECT STRUCTURE:
${JSON.stringify(context, null, 2)}

Provide analysis in this JSON format:
{
  "architecture": "MVC|Service|Repository|Action",
  "patterns": ["pattern1", "pattern2"],
  "criticalAreas": ["area1", "area2"],
  "testCoverage": "high|medium|low",
  "suggestions": ["suggestion1", "suggestion2"]
}`;
  }

  buildTestGenerationPrompt(context) {
    return `Generate comprehensive PHPUnit tests for this Laravel controller.

CONTROLLER: ${context.controllerName}
FILE PATH: ${context.controllerPath}

CODE:
\`\`\`php
${context.controllerCode}
\`\`\`

ROUTES USING THIS CONTROLLER:
${JSON.stringify(context.routes, null, 2)}

RELATED MODELS:
${JSON.stringify(context.models, null, 2)}

EXISTING TESTS:
${context.existingTests || 'None'}

Generate complete PHPUnit test class with:
1. Test for each public method
2. Edge cases (validation errors, auth failures, empty results)
3. Tests for relationships
4. Tests for authorization
5. Realistic factory data setup

Return ONLY the PHP code, no explanations.`;
  }

  buildRefactoringPrompt(context) {
    return `Analyze this code for refactoring opportunities.

FILE: ${context.filePath}
CODE:
\`\`\`php
${context.code}
\`\`\`

Identify:
1. Code smells
2. SOLID violations
3. Performance issues
4. Security concerns
5. Complexity issues

Provide suggestions in this format:
- Priority: high|medium|low
- Issue: description
- Solution: concrete refactoring steps
- Benefits: what improves

Format as JSON array.`;
  }

  buildImplementationPrompt(context) {
    return `Generate implementation code based on context.

TYPE: ${context.type} (controller|view|model|service)
PURPOSE: ${context.purpose}
REQUIREMENTS:
${JSON.stringify(context.requirements, null, 2)}

EXISTING PATTERNS IN PROJECT:
${context.projectPatterns || 'Standard Laravel'}

Generate production-ready code following Laravel best practices.
Return ONLY the code, no explanations.`;
  }

  parseProjectAnalysis(content) {
    try {
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { raw: content };
    } catch (e) {
      return { raw: content, error: 'Failed to parse JSON' };
    }
  }

  parseTestResponse(content) {
    // Extract PHP code from markdown or return as-is
    const codeMatch = content.match(/```php\s*([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return content.trim();
  }

  parseRefactoringResponse(content) {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [{ raw: content }];
    } catch (e) {
      return [{ raw: content }];
    }
  }

  generateCacheKey(prompt, options) {
    const data = JSON.stringify({ prompt, options });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  getStats() {
    return {
      ...this.stats,
      provider: this.config.provider,
      model: this.config.model
    };
  }

  printStats() {
    const stats = this.getStats();
    console.log(chalk.blue('\n📊 LLM Session Stats:'));
    console.log(`  Provider: ${stats.provider} (${stats.model})`);
    console.log(`  Requests: ${stats.requests}`);
    console.log(`  Tokens: ${stats.tokens.toLocaleString()}`);
    console.log(`  Cache hits: ${stats.cacheHits}`);
    if (stats.cost > 0) {
      console.log(`  Cost: $${stats.cost.toFixed(4)}`);
    }
    console.log('');
  }
}

module.exports = { LLMClient };

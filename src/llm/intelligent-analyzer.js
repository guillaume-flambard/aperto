/**
 * Intelligent Project Analyzer - Deep AI analysis of project structure
 * Understands business logic, patterns, and generates contextual tests
 */

const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

class IntelligentProjectAnalyzer {
  constructor(llmClient, projectPath) {
    this.llm = llmClient;
    this.projectPath = projectPath;
    this.projectContext = null;
  }

  /**
   * Deep analysis of the entire project using AI
   */
  async analyzeProject() {
    console.log(chalk.blue('\n🧠 Analyse intelligente du projet avec IA...\n'));
    
    // 1. Collect all relevant files
    const files = await this.collectProjectFiles();
    
    // 2. Send to AI for deep understanding
    const analysis = await this.deepAnalyzeWithAI(files);
    
    this.projectContext = analysis;
    
    return analysis;
  }

  async collectProjectFiles() {
    const files = {};
    
    // Collect files from key directories - REDUCED LIMITS for CLI compatibility
    const directories = [
      { path: 'app/Models', limit: 10 },
      { path: 'app/Services', limit: 5 },
      { path: 'app/Actions', limit: 5 },
      { path: 'app/Http/Controllers', limit: 10 }
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.projectPath, dir.path);
      const key = dir.path;
      files[key] = [];
      
      try {
        const phpFiles = await this.findPhpFiles(dirPath, dir.limit);
        
        for (const filePath of phpFiles) {
          try {
            const relativePath = path.relative(this.projectPath, filePath);
            // Only read first 50 lines to reduce size
            const content = await fs.readFile(filePath, 'utf8');
            const truncatedContent = content.split('\n').slice(0, 50).join('\n');
            files[key].push({ path: relativePath, content: truncatedContent });
          } catch (e) {}
        }
      } catch (e) {
        // Directory doesn't exist, skip
      }
    }
    
    return files;
  }

  async findPhpFiles(dirPath, limit) {
    const files = [];
    
    async function scan(currentPath) {
      if (files.length >= limit) return;
      
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= limit) break;
          
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            await scan(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.php')) {
            files.push(fullPath);
          }
        }
      } catch (e) {}
    }
    
    await scan(dirPath);
    return files;
  }

  async deepAnalyzeWithAI(files) {
    const prompt = this.buildDeepAnalysisPrompt(files);
    
    const response = await this.llm.sendPrompt(prompt, { maxTokens: 4000 });
    
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.log(chalk.yellow('⚠️  Could not parse AI analysis, using raw'));
    }
    
    return { raw: response.content };
  }

  buildDeepAnalysisPrompt(files) {
    return `Analyze the Laravel project at ${this.projectPath} and provide insights on:

1. BUSINESS DOMAINS - Main business areas
2. CRITICAL RULES - Key business rules to test  
3. PATTERNS - Architectural patterns used
4. MAIN ENTITIES - Key models and relationships
5. KEY SERVICES - Important business logic services
6. EDGE CASES - Complex scenarios
7. TESTING PRIORITIES - What to test first

Look at app/Models, app/Services, app/Enums, routes/, and tests/ directories.

Provide a concise summary focusing on the most important aspects for testing.`;
  }

  /**
   * Generate intelligent tests for a specific aspect
   */
  async generateIntelligentTests(target) {
    if (!this.projectContext) {
      await this.analyzeProject();
    }

    const prompt = `Generate comprehensive tests for ${target} based on this project context:

PROJECT CONTEXT:
${JSON.stringify(this.projectContext, null, 2)}

TARGET: ${target}

Generate tests that:
1. Test business logic, not just HTTP responses
2. Include edge cases specific to this domain
3. Test the critical rules identified
4. Use realistic test data
5. Test both happy path and error cases

Generate complete Pest PHP test code.`;

    const response = await this.llm.sendPrompt(prompt, { maxTokens: 4000 });
    
    return this.extractCode(response.content);
  }

  extractCode(content) {
    const codeMatch = content.match(/```php\s*([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1].trim();
    }
    return content.trim();
  }

  /**
   * Auto-detect what needs testing based on AI analysis
   */
  async autoDetectTestingNeeds() {
    if (!this.projectContext) {
      await this.analyzeProject();
    }

    const needs = [];
    
    // Check each critical rule
    for (const rule of this.projectContext.criticalRules || []) {
      needs.push({
        type: 'business_rule',
        target: rule.description,
        priority: rule.importance,
        strategy: rule.testStrategy
      });
    }

    // Check services
    for (const service of this.projectContext.keyServices || []) {
      needs.push({
        type: 'service',
        target: service,
        priority: 'high',
        strategy: `Test all public methods of ${service}`
      });
    }

    return needs;
  }
}

module.exports = { IntelligentProjectAnalyzer };

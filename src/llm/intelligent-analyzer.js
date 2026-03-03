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
    
    // Collect files from key directories
    const directories = [
      { path: 'app/Models', limit: 20 },
      { path: 'app/Services', limit: 15 },
      { path: 'app/Actions', limit: 10 },
      { path: 'app/ValueObjects', limit: 10 },
      { path: 'app/Http/Controllers', limit: 20 },
      { path: 'tests', limit: 15 }
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
            const content = await fs.readFile(filePath, 'utf8');
            files[key].push({ path: relativePath, content });
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
    return `Analyze this Laravel project deeply and extract:

1. BUSINESS DOMAINS - What are the main business areas?
2. CRITICAL RULES - What are the key business rules that MUST be tested?
3. PATTERNS - What architectural patterns are used?
4. ENTITIES - Main models and their relationships
5. SERVICES - Key business logic services
6. EDGE CASES - What complex scenarios exist?
7. TESTING GAPS - What critical logic is untested?

FILES:
${JSON.stringify(files, null, 2).substring(0, 15000)}

Respond in this JSON format:
{
  "businessDomains": ["domain1", "domain2"],
  "criticalRules": [
    {
      "description": "rule description",
      "importance": "high|medium|low",
      "testStrategy": "how to test this"
    }
  ],
  "patterns": ["pattern1", "pattern2"],
  "mainEntities": ["Entity1", "Entity2"],
  "keyServices": ["Service1", "Service2"],
  "edgeCases": ["case1", "case2"],
  "testingPriorities": ["priority1", "priority2"]
}`;
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

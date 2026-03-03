/**
 * EchoTravel-Aware Orchestrator
 * 
 * Version intelligente qui comprend vraiment le projet
 * et génère des tests adaptés aux règles métier
 */

const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { LLMClient } = require('./llm');
const { IntelligentProjectAnalyzer } = require('./llm/intelligent-analyzer');

class EchoTravelOrchestrator {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = options;
    this.llm = options.llmClient || null;
    this.analyzer = null;
  }

  async run() {
    console.log(chalk.blue.bold('\n🌐 APERTO - Analyse Intelligente EchoTravel\n'));
    
    // Initialize LLM if needed
    if (!this.llm && this.options.useAI !== false) {
      const config = await this.loadConfig();
      if (config?.llm?.enabled) {
        this.llm = new LLMClient(config.llm);
      }
    }

    if (!this.llm) {
      console.log(chalk.yellow('⚠️  IA non configurée. Utilisez: npx aperto llm\n'));
      return;
    }

    // Initialize analyzer
    this.analyzer = new IntelligentProjectAnalyzer(this.llm, this.projectPath);
    
    // Deep analysis
    console.log(chalk.cyan('🔍 Analyse approfondie du projet avec IA...\n'));
    const analysis = await this.analyzer.analyzeProject();
    
    // Display what AI understood
    this.displayAnalysis(analysis);
    
    // Auto-detect what needs testing
    const testingNeeds = await this.analyzer.autoDetectTestingNeeds();
    
    // Generate tests automatically
    if (testingNeeds.length > 0) {
      await this.generateTestsForNeeds(testingNeeds);
    }
  }

  displayAnalysis(analysis) {
    console.log(chalk.green('\n✅ Analyse IA terminée\n'));
    
    if (analysis.businessDomains) {
      console.log(chalk.blue('🏢 Domaines métier identifiés:'));
      analysis.businessDomains.forEach(d => console.log(`  • ${d}`));
    }
    
    if (analysis.criticalRules) {
      console.log(chalk.blue('\n⚠️  Règles critiques à tester:'));
      analysis.criticalRules
        .filter(r => r.importance === 'high')
        .forEach(r => console.log(`  • ${r.description}`));
    }
    
    if (analysis.patterns) {
      console.log(chalk.blue('\n🎨 Patterns détectés:'));
      analysis.patterns.forEach(p => console.log(`  • ${p}`));
    }
    
    console.log('');
  }

  async generateTestsForNeeds(needs) {
    console.log(chalk.blue(`\n🧪 Génération de ${needs.length} tests intelligents...\n`));
    
    for (const need of needs.slice(0, 5)) { // Limit to 5 for demo
      console.log(chalk.cyan(`\n  Génération: ${need.target}`));
      
      try {
        const testCode = await this.analyzer.generateIntelligentTests(need.target);
        
        if (testCode) {
          // Save test
          const testPath = this.determineTestPath(need);
          await this.saveTest(testPath, testCode);
          
          console.log(chalk.green(`  ✅ Test créé: ${testPath}`));
        }
      } catch (error) {
        console.log(chalk.red(`  ❌ Erreur: ${error.message}`));
      }
    }
  }

  determineTestPath(need) {
    if (need.type === 'service') {
      return `tests/Unit/${need.target}Test.php`;
    }
    return `tests/Feature/${need.target.replace(/\s+/g, '')}Test.php`;
  }

  async saveTest(testPath, code) {
    const fullPath = path.join(this.projectPath, testPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, code, 'utf8');
  }

  async loadConfig() {
    try {
      const configPath = path.join(this.projectPath, '.aperto/config.json');
      const content = await fs.readFile(configPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}

module.exports = { EchoTravelOrchestrator };

#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const aperto = require('../src/index');

const program = new Command();

program
  .name('aperto')
  .description('Universal Project Orchestrator')
  .version('1.0.0');

// Default command
program
  .command('start', { isDefault: true })
  .description('Start Aperto (default mode)')
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🌐 APERTO - Intelligent Orchestrator\n'));
      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  DRY RUN MODE - No changes will be made\n'));
      }
      
      const { ApertoOrchestrator } = require('../src/orchestrator');
      const orchestrator = new ApertoOrchestrator(process.cwd(), options);
      await orchestrator.run();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Smart command with AI
program
  .command('smart')
  .description('Deep AI analysis (understands business logic)')
  .option('-d, --dry-run', 'Preview without making changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🌐 APERTO - Intelligent Analysis\n'));
      console.log(chalk.gray('Deep analysis with artificial intelligence\n'));
      
      const { EchoTravelOrchestrator } = require('../src/echotravel-orchestrator');
      const orchestrator = new EchoTravelOrchestrator(process.cwd(), {
        ...options,
        useAI: true
      });
      await orchestrator.run();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Configure Aperto (interactive assistant)')
  .action(async () => {
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      const wizardPath = path.join(__dirname, 'setup-wizard.js');
      
      execSync(`node "${wizardPath}"`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze project')
  .option('-f, --format <type>', 'Format: console, markdown, json', 'console')
  .option('-o, --output <file>', 'Output file name')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔍 Analyzing project...\n'));
      await aperto.analyze(options.format, options.output);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Run command
program
  .command('run')
  .description('Execute RED→GREEN workflow')
  .option('-m, --mode <mode>', 'Mode: auto, safe, confident', 'auto')
  .option('-s, --scope <scope>', 'Target scope')
  .option('-d, --dry-run', 'Preview without making changes')
  .option('-y, --yes', 'Skip confirmations')
  .action(async (options) => {
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'));
      }
      console.log(chalk.blue('\n🚀 Starting workflow...\n'));
      await aperto.run(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Audit command
program
  .command('audit')
  .description('Audit project')
  .option('-o, --output <file>', 'Output file', 'APERTO_AUDIT')
  .option('-f, --format <type>', 'Format: markdown, json', 'markdown')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔍 Auditing project...\n'));
      await aperto.audit(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Scope command
program
  .command('scope [name]')
  .description('Work on specific scope')
  .option('-d, --dry-run', 'Preview without making changes')
  .action(async (name, options) => {
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'));
      }
      
      if (!name) {
        console.log(chalk.blue('\n📦 Available scopes:\n'));
        await aperto.listScopes();
      } else {
        console.log(chalk.blue(`\n🎯 Working on scope: ${name}\n`));
        await aperto.workOnScope(name, options);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Doctor command
program
  .command('doctor')
  .description('Diagnostics and checks')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔧 Running diagnostics...\n'));
      await aperto.doctor();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show configuration')
  .action(async () => {
    try {
      await aperto.showConfig();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// LLM config command
program
  .command('llm')
  .description('Configure AI')
  .action(async () => {
    try {
      await aperto.configLLM();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Refactor command
program
  .command('refactor')
  .description('AI-powered refactoring suggestions')
  .option('-a, --apply', 'Apply fixes')
  .option('-d, --dry-run', 'Preview without applying')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🔧 AI Refactoring\n'));
      
      const { LLMClient } = require('../src/llm');
      const { RefactoringAI } = require('../src/llm/refactoring-ai');
      const fs = require('fs').promises;
      
      let config = {};
      if (await fs.access('.aperto/config.json').then(() => true).catch(() => false)) {
        config = JSON.parse(await fs.readFile('.aperto/config.json', 'utf8'));
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  AI not configured. Run: npx aperto init'));
        return;
      }
      
      const llm = new LLMClient(config.llm);
      const refactorAI = new RefactoringAI(llm, process.cwd());
      
      const suggestions = await refactorAI.analyzeProject();
      refactorAI.displaySuggestions(suggestions);
      
      llm.printStats();
      
      if (options.apply) {
        console.log(chalk.yellow('\n⚠️  Applying fixes...'));
        
        for (const category of ['high', 'medium', 'low']) {
          for (const item of suggestions[category]) {
            const fix = await refactorAI.generateFix(item.file, item);
            if (fix) {
              await refactorAI.applyFix(item.file, fix, options.dryRun);
            }
          }
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// AI command
program
  .command('ai')
  .description('Quick AI analysis')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('\n🧠 Quick AI Analysis\n'));
      
      const { LLMClient } = require('../src/llm');
      const { AIAnalyzer } = require('../src/llm/analyzer');
      const fs = require('fs').promises;
      
      let config = {};
      if (await fs.access('.aperto/config.json').then(() => true).catch(() => false)) {
        config = JSON.parse(await fs.readFile('.aperto/config.json', 'utf8'));
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  AI not configured. Run: npx aperto init'));
        return;
      }
      
      const llm = new LLMClient(config.llm);
      const analyzer = new AIAnalyzer(llm, process.cwd());
      
      const context = {
        stack: { name: 'laravel' },
        files: 0,
        routes: [],
        controllers: [],
        models: []
      };
      
      const analysis = await analyzer.analyzeProject(context);
      
      if (analysis) {
        console.log(chalk.blue('\n🏗️  Architecture:'), analysis.architecture);
        console.log(chalk.blue('📊 Coverage:'), analysis.testCoverage);
        
        if (analysis.patterns?.length > 0) {
          console.log(chalk.blue('\n🎨 Patterns:'));
          analysis.patterns.forEach(p => console.log(`  • ${p}`));
        }
        
        if (analysis.criticalAreas?.length > 0) {
          console.log(chalk.blue('\n⚠️  Critical areas:'));
          analysis.criticalAreas.forEach(a => console.log(`  • ${a}`));
        }
        
        if (analysis.suggestions?.length > 0) {
          console.log(chalk.blue('\n💡 Suggestions:'));
          analysis.suggestions.forEach(s => console.log(`  • ${s}`));
        }
      }
      
      llm.printStats();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Global error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

program.parse();

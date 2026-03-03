#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const aperto = require('../src/index');

const program = new Command();

program
  .name('aperto')
  .description('Universal Project Orchestrator')
  .version('1.0.0');

// Default command - intelligent orchestrator
program
  .command('start', { isDefault: true })
  .description('Start Aperto intelligent orchestrator (default)')
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

// EchoTravel-specific intelligent command
program
  .command('smart')
  .description('Deep AI analysis for EchoTravel (auto-detects business logic)')
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🌐 APERTO - Analyse Intelligente EchoTravel\n'));
      console.log(chalk.gray('Cette commande utilise l\'IA pour comprendre votre projet en profondeur\n'));
      
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
  .description('Initialize Aperto configuration')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔧 Initializing Aperto...\n'));
      await aperto.init();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze project and show report')
  .option('-f, --format <type>', 'Report format: console, markdown, json', 'console')
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
  .option('-m, --mode <mode>', 'Execution mode: auto, safe, confident', 'auto')
  .option('-s, --scope <scope>', 'Target scope (for scope-first mode)')
  .option('-d, --dry-run', 'Show what would be done without making changes')
  .option('-y, --yes', 'Skip all confirmations (auto mode)')
  .action(async (options) => {
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'));
      }
      console.log(chalk.blue('\n🚀 Starting RED→GREEN workflow...\n'));
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
  .description('Audit project without modifications')
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
  .option('-d, --dry-run', 'Show what would be done without making changes')
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

// Doctor command - pre-flight checks
program
  .command('doctor')
  .description('Run pre-flight checks and diagnostics')
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
  .description('Show current configuration')
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
  .description('Configure AI/LLM settings')
  .action(async () => {
    try {
      await aperto.configLLM();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

// Refactor command - AI-powered refactoring
program
  .command('refactor')
  .description('AI-powered code refactoring suggestions')
  .option('-a, --apply', 'Apply suggested fixes (use with caution)')
  .option('-d, --dry-run', 'Show suggestions without applying')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🔧 APERTO - AI Refactoring\n'));
      
      const { LLMClient } = require('../src/llm');
      const { RefactoringAI } = require('../src/llm/refactoring-ai');
      const fs = require('fs-extra');
      
      // Load config to get LLM settings
      let config = {};
      if (await fs.pathExists('.aperto/config.json')) {
        config = await fs.readJson('.aperto/config.json');
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  AI features not enabled. Run: aperto init'));
        return;
      }
      
      const llm = new LLMClient(config.llm);
      const refactorAI = new RefactoringAI(llm, process.cwd());
      
      // Analyze project
      const suggestions = await refactorAI.analyzeProject();
      
      // Display suggestions
      refactorAI.displaySuggestions(suggestions);
      
      // Show LLM stats
      llm.printStats();
      
      // Apply fixes if requested
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
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// AI command - Quick AI analysis
program
  .command('ai')
  .description('Quick AI-powered analysis')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('\n🧠 APERTO - AI Quick Analysis\n'));
      
      const { LLMClient } = require('../src/llm');
      const { AIAnalyzer } = require('../src/llm/analyzer');
      const fs = require('fs-extra');
      
      // Load config
      let config = {};
      if (await fs.pathExists('.aperto/config.json')) {
        config = await fs.readJson('.aperto/config.json');
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  AI features not enabled. Run: aperto init'));
        return;
      }
      
      const llm = new LLMClient(config.llm);
      const analyzer = new AIAnalyzer(llm, process.cwd());
      
      // Basic project context
      const context = {
        stack: { name: 'laravel' },
        files: 0,
        routes: [],
        controllers: [],
        models: []
      };
      
      // AI analysis
      const analysis = await analyzer.analyzeProject(context);
      
      if (analysis) {
        console.log(chalk.blue('\n🏗️  Architecture:'), analysis.architecture);
        console.log(chalk.blue('📊 Test Coverage:'), analysis.testCoverage);
        
        if (analysis.patterns?.length > 0) {
          console.log(chalk.blue('\n🎨 Patterns detected:'));
          analysis.patterns.forEach(p => console.log(`  • ${p}`));
        }
        
        if (analysis.criticalAreas?.length > 0) {
          console.log(chalk.blue('\n⚠️  Critical areas:'));
          analysis.criticalAreas.forEach(a => console.log(`  • ${a}`));
        }
        
        if (analysis.suggestions?.length > 0) {
          console.log(chalk.blue('\n💡 AI Suggestions:'));
          analysis.suggestions.forEach(s => console.log(`  • ${s}`));
        }
      }
      
      llm.printStats();
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Global error handling
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Uncaught exception:'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

program.parse();

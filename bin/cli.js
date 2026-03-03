#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const aperto = require('../src/index');

const program = new Command();

program
  .name('aperto')
  .description('Orchestrateur Universel de Projets')
  .version('1.0.0');

// Commande par défaut
program
  .command('start', { isDefault: true })
  .description('Démarrer Aperto (mode par défaut)')
  .option('-d, --dry-run', 'Afficher ce qui serait fait sans modifier')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🌐 APERTO - Orchestrateur Intelligent\n'));
      if (options.dryRun) {
        console.log(chalk.yellow('⚠️  MODE DRY RUN - Aucune modification\n'));
      }
      
      const { ApertoOrchestrator } = require('../src/orchestrator');
      const orchestrator = new ApertoOrchestrator(process.cwd(), options);
      await orchestrator.run();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Commande intelligente
program
  .command('smart')
  .description('Analyse intelligente avec IA (comprend la logique métier)')
  .option('-d, --dry-run', 'Afficher sans modifier')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🌐 APERTO - Analyse Intelligente\n'));
      console.log(chalk.gray('Analyse approfondie avec intelligence artificielle\n'));
      
      const { EchoTravelOrchestrator } = require('../src/echotravel-orchestrator');
      const orchestrator = new EchoTravelOrchestrator(process.cwd(), {
        ...options,
        useAI: true
      });
      await orchestrator.run();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Configurer Aperto (assistant interactif)')
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
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Analyze command
program
  .command('analyze')
  .description('Analyser le projet')
  .option('-f, --format <type>', 'Format : console, markdown, json', 'console')
  .option('-o, --output <fichier>', 'Nom du fichier de sortie')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔍 Analyse du projet...\n'));
      await aperto.analyze(options.format, options.output);
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Run command
program
  .command('run')
  .description('Exécuter le workflow RED→GREEN')
  .option('-m, --mode <mode>', 'Mode : auto, safe, confident', 'auto')
  .option('-s, --scope <scope>', 'Scope cible')
  .option('-d, --dry-run', 'Afficher sans modifier')
  .option('-y, --yes', 'Ignorer les confirmations')
  .action(async (options) => {
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  MODE DRY RUN - Aucune modification\n'));
      }
      console.log(chalk.blue('\n🚀 Lancement du workflow...\n'));
      await aperto.run(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// Audit command
program
  .command('audit')
  .description('Auditer le projet')
  .option('-o, --output <fichier>', 'Fichier de sortie', 'APERTO_AUDIT')
  .option('-f, --format <type>', 'Format : markdown, json', 'markdown')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔍 Audit du projet...\n'));
      await aperto.audit(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Scope command
program
  .command('scope [name]')
  .description('Travailler sur un scope spécifique')
  .option('-d, --dry-run', 'Afficher sans modifier')
  .action(async (name, options) => {
    try {
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  MODE DRY RUN - Aucune modification\n'));
      }
      
      if (!name) {
        console.log(chalk.blue('\n📦 Scopes disponibles :\n'));
        await aperto.listScopes();
      } else {
        console.log(chalk.blue(`\n🎯 Traitement du scope : ${name}\n`));
        await aperto.workOnScope(name, options);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Doctor command
program
  .command('doctor')
  .description('Diagnostics et vérifications')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔧 Vérifications...\n'));
      await aperto.doctor();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Afficher la configuration')
  .action(async () => {
    try {
      await aperto.showConfig();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// LLM config command
program
  .command('llm')
  .description('Configurer l\'IA')
  .action(async () => {
    try {
      await aperto.configLLM();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Refactor command
program
  .command('refactor')
  .description('Suggestions de refactoring avec IA')
  .option('-a, --apply', 'Appliquer les corrections')
  .option('-d, --dry-run', 'Afficher sans appliquer')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n🔧 Refactoring avec IA\n'));
      
      const { LLMClient } = require('../src/llm');
      const { RefactoringAI } = require('../src/llm/refactoring-ai');
      const fs = require('fs').promises;
      
      let config = {};
      if (await fs.access('.aperto/config.json').then(() => true).catch(() => false)) {
        config = JSON.parse(await fs.readFile('.aperto/config.json', 'utf8'));
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  IA non configurée. Lancez : npx aperto init'));
        return;
      }
      
      const llm = new LLMClient(config.llm);
      const refactorAI = new RefactoringAI(llm, process.cwd());
      
      const suggestions = await refactorAI.analyzeProject();
      refactorAI.displaySuggestions(suggestions);
      
      llm.printStats();
      
      if (options.apply) {
        console.log(chalk.yellow('\n⚠️  Application des corrections...'));
        
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
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// AI command
program
  .command('ai')
  .description('Analyse rapide avec IA')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('\n🧠 Analyse IA rapide\n'));
      
      const { LLMClient } = require('../src/llm');
      const { AIAnalyzer } = require('../src/llm/analyzer');
      const fs = require('fs').promises;
      
      let config = {};
      if (await fs.access('.aperto/config.json').then(() => true).catch(() => false)) {
        config = JSON.parse(await fs.readFile('.aperto/config.json', 'utf8'));
      }
      
      if (!config.llm?.enabled) {
        console.log(chalk.yellow('⚠️  IA non configurée. Lancez : npx aperto init'));
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
        console.log(chalk.blue('\n🏗️  Architecture :'), analysis.architecture);
        console.log(chalk.blue('📊 Couverture :'), analysis.testCoverage);
        
        if (analysis.patterns?.length > 0) {
          console.log(chalk.blue('\n🎨 Patterns :'));
          analysis.patterns.forEach(p => console.log(`  • ${p}`));
        }
        
        if (analysis.criticalAreas?.length > 0) {
          console.log(chalk.blue('\n⚠️  Zones critiques :'));
          analysis.criticalAreas.forEach(a => console.log(`  • ${a}`));
        }
        
        if (analysis.suggestions?.length > 0) {
          console.log(chalk.blue('\n💡 Suggestions :'));
          analysis.suggestions.forEach(s => console.log(`  • ${s}`));
        }
      }
      
      llm.printStats();
    } catch (error) {
      console.error(chalk.red('\n❌ Erreur :'), error.message);
      process.exit(1);
    }
  });

// Gestion des erreurs globales
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Erreur non gérée :'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('\n❌ Exception :'), error.message);
  if (process.env.DEBUG) {
    console.error(error.stack);
  }
  process.exit(1);
});

program.parse();

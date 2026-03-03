const chalk = require('chalk');
const { createBackup } = require('./core/backup');
const { detectStack } = require('./core/detector');
const { analyzeProject } = require('./core/analyzer');
const { selectStrategy } = require('./core/strategist');
const { validateChanges } = require('./core/validator');
const { initPrompts, llmConfigPrompts } = require('./ui/prompts');
const { generateReport } = require('./reporters/report-generator');
const { AdapterFactory } = require('./adapters');
const { TestGenerator, ImplementationGenerator } = require('./generators');
const { LLMClient } = require('./llm');
const { IntelligentTestGenerator } = require('./llm/intelligent-test-generator');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

class Aperto {
  constructor() {
    this.config = null;
    this.projectInfo = null;
    this.adapter = null;
    this.adapterFactory = new AdapterFactory(process.cwd());
    this.dryRun = false;
    this.logger = {
      info: (msg) => console.log(chalk.blue(msg)),
      success: (msg) => console.log(chalk.green(msg)),
      warning: (msg) => console.log(chalk.yellow(msg)),
      error: (msg) => console.error(chalk.red(msg)),
      dryRun: (msg) => console.log(chalk.cyan(`[DRY RUN] ${msg}`)),
      debug: (msg) => {
        if (process.env.DEBUG) console.log(chalk.gray(`[DEBUG] ${msg}`));
      }
    };
  }

  async start(options = {}) {
    this.dryRun = options.dryRun || false;
    
    try {
      // Validate environment
      await this.validateEnvironment();
      
      // Step 1: Backup (unless dry run)
      if (!this.dryRun) {
        await this.ensureBackup();
      } else {
        this.logger.dryRun('Would create git backup');
      }

      // Step 2: Load or create config
      await this.loadConfig();

      // Step 3: Detect and analyze
      this.logger.info('\n🔍 Analyzing project...');
      this.projectInfo = await this.analyze('console');

      // Step 4: Select strategy
      const strategy = await selectStrategy(this.projectInfo);

      // Step 5: Execute
      if (this.dryRun) {
        this.logger.dryRun(`Would execute strategy: ${strategy.name}`);
      }
      
      await this.executeStrategy(strategy);

    } catch (error) {
      this.logger.error(`\n❌ Error: ${error.message}`);
      this.logger.debug(error.stack);
      throw error;
    }
  }

  async validateEnvironment() {
    const cwd = process.cwd();
    
    // Check if we're in a project directory
    const hasPackageJson = await fs.pathExists(path.join(cwd, 'package.json'));
    const hasComposerJson = await fs.pathExists(path.join(cwd, 'composer.json'));
    const hasPubspecYaml = await fs.pathExists(path.join(cwd, 'pubspec.yaml'));
    
    if (!hasPackageJson && !hasComposerJson && !hasPubspecYaml) {
      this.logger.warning('\n⚠️  Warning: No package.json, composer.json, or pubspec.yaml found');
      this.logger.info('Aperto works best in project directories with these files.\n');
      
      if (!this.dryRun) {
        const { proceed } = await require('inquirer').prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Continue anyway?',
          default: false
        }]);
        
        if (!proceed) {
          throw new Error('Aborted by user');
        }
      }
    }
  }

  async doctor() {
    const checks = [];
    
    this.logger.info('Running pre-flight checks...\n');
    
    // Check Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.split('.')[0].replace('v', ''));
    checks.push({
      name: 'Node.js version',
      status: nodeMajor >= 18 ? 'pass' : 'fail',
      message: nodeMajor >= 18 ? `${nodeVersion} ✓` : `${nodeVersion} (requires >=18)`
    });
    
    // Check Git
    try {
      execSync('git --version', { stdio: 'pipe' });
      checks.push({
        name: 'Git installed',
        status: 'pass',
        message: '✓'
      });
    } catch {
      checks.push({
        name: 'Git installed',
        status: 'warning',
        message: 'Not found (backups disabled)'
      });
    }
    
    // Check project type
    const stack = await detectStack(process.cwd());
    checks.push({
      name: 'Project type detected',
      status: 'pass',
      message: stack.name
    });
    
    // Check for test framework
    let hasTestFramework = false;
    if (await fs.pathExists('package.json')) {
      const pkg = await fs.readJson('package.json');
      hasTestFramework = !!(pkg.devDependencies?.jest || 
                           pkg.devDependencies?.vitest ||
                           pkg.scripts?.test);
    }
    checks.push({
      name: 'Test framework',
      status: hasTestFramework ? 'pass' : 'warning',
      message: hasTestFramework ? 'Found' : 'Not detected'
    });
    
    // Check .aperto directory
    const hasConfig = await fs.pathExists('.aperto/config.json');
    checks.push({
      name: 'Aperto configured',
      status: hasConfig ? 'pass' : 'warning',
      message: hasConfig ? '✓' : 'Run: npx aperto init'
    });
    
    // Display results
    console.log('');
    checks.forEach(check => {
      const icon = check.status === 'pass' ? chalk.green('✓') :
                   check.status === 'warning' ? chalk.yellow('⚠') : chalk.red('✗');
      const status = check.status === 'pass' ? chalk.green(check.status.toUpperCase()) :
                     check.status === 'warning' ? chalk.yellow(check.status.toUpperCase()) :
                     chalk.red(check.status.toUpperCase());
      console.log(`  ${icon} ${check.name.padEnd(25)} ${status} ${check.message}`);
    });
    
    const passed = checks.filter(c => c.status === 'pass').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const failed = checks.filter(c => c.status === 'fail').length;
    
    console.log('');
    console.log(chalk.blue(`Results: ${passed} passed, ${warnings} warnings, ${failed} failed\n`));
    
    if (failed > 0) {
      this.logger.error('Please fix the failed checks before continuing.\n');
      return false;
    }
    
    return true;
  }

  async showConfig() {
    await this.loadConfig();
    
    console.log(chalk.blue('\n⚙️  Current Configuration\n'));
    
    if (!this.config) {
      console.log(chalk.gray('  No configuration found.\n'));
      console.log(chalk.gray('  Run: npx aperto init\n'));
      return;
    }
    
    console.log(chalk.gray('  Configuration file: .aperto/config.json\n'));
    
    // Show general config
    console.log(chalk.cyan('General:'));
    Object.entries(this.config).forEach(([key, value]) => {
      if (key === 'llm') return; // Handle LLM separately
      
      const formattedValue = typeof value === 'boolean' ? 
        (value ? chalk.green('true') : chalk.red('false')) : 
        chalk.cyan(value);
      console.log(`  ${key.padEnd(20)} ${formattedValue}`);
    });
    
    // Show LLM config
    if (this.config.llm) {
      console.log(chalk.cyan('\nAI/LLM:'));
      const llm = this.config.llm;
      console.log(`  ${'enabled'.padEnd(20)} ${llm.enabled ? chalk.green('true') : chalk.red('false')}`);
      
      if (llm.enabled) {
        console.log(`  ${'provider'.padEnd(20)} ${chalk.cyan(llm.provider || 'kimi')}`);
        console.log(`  ${'model'.padEnd(20)} ${chalk.cyan(llm.model || 'default')}`);
        if (llm.baseUrl) {
          console.log(`  ${'baseUrl'.padEnd(20)} ${chalk.cyan(llm.baseUrl)}`);
        }
        console.log(`  ${'apiKey'.padEnd(20)} ${llm.apiKey ? chalk.green('✓ configured') : chalk.yellow('⚠ env var')}`);
      }
    }
    
    console.log('');
  }

  async configLLM() {
    await this.loadConfig();
    
    if (!this.config) {
      this.logger.error('\n❌ No configuration found. Run: npx aperto init\n');
      return;
    }
    
    console.log(chalk.blue('\n🔧 Configure AI/LLM Settings\n'));
    
    const llmConfig = await llmConfigPrompts(this.config.llm || {});
    
    this.config.llm = llmConfig;
    
    await fs.writeJson('.aperto/config.json', this.config, { spaces: 2 });
    
    this.logger.success('\n✅ LLM configuration updated!');
    
    // Test the configuration
    if (llmConfig.enabled) {
      console.log(chalk.blue('\n🧪 Testing LLM connection...'));
      
      try {
        const { LLMClient } = require('./llm');
        const llm = new LLMClient(llmConfig);
        
        // Quick validation
        const testResponse = await llm.sendPrompt('Hello', { maxTokens: 10 });
        
        this.logger.success('✅ LLM connection successful!');
        console.log(chalk.gray(`  Response: "${testResponse.content.substring(0, 50)}..."`));
        console.log(chalk.gray(`  Tokens: ${testResponse.tokens}`));
      } catch (error) {
        this.logger.error(`\n❌ LLM connection failed: ${error.message}`);
        console.log(chalk.yellow('Please check your API key and provider settings.\n'));
      }
    }
    
    console.log('');
  }

  async init() {
    // Check if already initialized
    if (await fs.pathExists('.aperto/config.json')) {
      this.logger.warning('\n⚠️  Aperto is already initialized in this project.\n');
      
      const { overwrite } = await require('inquirer').prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Overwrite existing configuration?',
        default: false
      }]);
      
      if (!overwrite) {
        this.logger.info('Keeping existing configuration.\n');
        return;
      }
    }
    
    this.logger.info('Setting up Aperto configuration...\n');
    
    // Run doctor first
    const healthy = await this.doctor();
    if (!healthy) {
      const { force } = await require('inquirer').prompt([{
        type: 'confirm',
        name: 'force',
        message: 'Some checks failed. Continue anyway?',
        default: false
      }]);
      
      if (!force) {
        throw new Error('Initialization aborted');
      }
    }
    
    const config = await initPrompts();
    
    await fs.ensureDir('.aperto');
    await fs.writeJson('.aperto/config.json', config, { spaces: 2 });
    
    // Create .gitignore for aperto
    const gitignorePath = '.aperto/.gitignore';
    if (!await fs.pathExists(gitignorePath)) {
      await fs.writeFile(gitignorePath, '# Aperto backups and reports\nbackup-*\n*.log\nreports/\n', 'utf8');
    }
    
    this.logger.success('\n✅ Configuration saved to .aperto/config.json');
    this.logger.info('You can now run: npx aperto\n');
  }

  async analyze(format = 'console', outputFile) {
    // Detect stack
    this.logger.info('Detecting stack...');
    const stack = await detectStack(process.cwd());
    this.logger.success(`  Detected: ${stack.name} ${stack.version || ''}`);
    
    // Analyze project
    this.logger.info('Analyzing project structure...');
    const analysis = await analyzeProject(process.cwd(), stack);
    
    // Generate report
    await generateReport(analysis, format, outputFile);
    
    return analysis;
  }

  async run(options = {}) {
    this.dryRun = options.dryRun || false;
    
    if (this.dryRun) {
      this.logger.info('\n🔍 DRY RUN MODE');
      this.logger.info('No changes will be made to your project\n');
    }
    
    // Ensure backup (unless dry run)
    if (!this.dryRun) {
      await this.ensureBackup();
    }
    
    // Load config
    await this.loadConfig();
    
    // Determine mode
    let mode = options.mode || this.config?.mode || 'safe';
    if (options.yes) {
      mode = 'confident';
    }
    
    // Get project info
    this.logger.info('\n🔍 Analyzing project...');
    const info = await this.analyze('console');
    
    // Execute RED→GREEN
    await this.executeRedGreen(info, mode, options.scope);
    
    if (this.dryRun) {
      this.logger.info('\n🔍 Dry run complete. No changes were made.\n');
      this.logger.info('To execute changes, run without --dry-run flag.\n');
    }
  }

  async audit(options = {}) {
    this.logger.info('\n🔍 Auditing project...\n');
    
    const info = await this.analyze(options.format, options.output);
    
    if (options.format === 'markdown' || options.format === 'json') {
      const filename = `${options.output}.${options.format === 'markdown' ? 'md' : 'json'}`;
      this.logger.success(`\n✅ Report saved: ${filename}`);
    }
  }

  async listScopes() {
    const info = await this.analyze('console');
    
    if (info.scopes && info.scopes.length > 0) {
      console.log('');
      info.scopes.forEach((scope, i) => {
        const status = scope.completion >= 80 ? chalk.green('✓') :
                      scope.completion >= 50 ? chalk.yellow('○') : chalk.red('✗');
        const completion = `${scope.completion || 0}%`.padStart(4);
        console.log(`  ${status} ${scope.name.padEnd(15)} ${completion} (${scope.routes?.length || scope.pages || 0} items)`);
      });
    } else {
      console.log(chalk.gray('  No scopes detected'));
    }
    console.log('');
    
    this.logger.info('Work on a specific scope:');
    this.logger.info('  npx aperto scope <name>\n');
  }

  async workOnScope(scopeName, options = {}) {
    this.dryRun = options.dryRun || false;
    
    if (!this.dryRun) {
      await this.ensureBackup();
    }
    
    await this.loadConfig();
    
    const info = await this.analyze('console');
    const scope = info.scopes?.find(s => s.name === scopeName);
    
    if (!scope) {
      this.logger.error(`\n❌ Scope "${scopeName}" not found\n`);
      this.logger.info('Available scopes:');
      info.scopes?.forEach(s => console.log(`  - ${s.name}`));
      console.log('');
      return;
    }
    
    await this.executeRedGreen({ ...info, targetScope: scope }, 'safe', scopeName);
  }

  async ensureBackup() {
    if (await fs.pathExists('.git')) {
      this.logger.info('\n⚠️  Creating backup...');
      try {
        await createBackup();
        this.logger.success('  ✅ Backup created');
      } catch (error) {
        this.logger.error('  ❌ Failed to create backup');
        this.logger.debug(error.message);
        
        const { proceed } = await require('inquirer').prompt([{
          type: 'confirm',
          name: 'proceed',
          message: 'Continue without backup?',
          default: false
        }]);
        
        if (!proceed) {
          throw new Error('Aborted: backup required');
        }
      }
    } else {
      this.logger.warning('\n⚠️  No git repository found - backup disabled');
      this.logger.info('  Consider initializing git: git init\n');
    }
  }

  async loadConfig() {
    if (await fs.pathExists('.aperto/config.json')) {
      try {
        this.config = await fs.readJson('.aperto/config.json');
        this.logger.debug('Configuration loaded');
      } catch (error) {
        this.logger.warning('Failed to load configuration');
        this.config = null;
      }
    }
  }

  async executeStrategy(strategy) {
    this.logger.info(`\n🎯 Executing: ${strategy.name}\n`);
    
    switch (strategy.type) {
      case 'yolo':
        await this.executeYolo();
        break;
      case 'progressive':
        await this.executeProgressive();
        break;
      case 'scope-first':
        await this.executeScopeFirst(strategy.targetScope);
        break;
      case 'audit':
        await this.audit({ format: 'markdown', output: 'APERTO_AUDIT' });
        break;
      default:
        this.logger.warning('Unknown strategy');
    }
  }

  async executeRedGreen(info, mode, targetScope) {
    const scope = targetScope ? info.scopes?.find(s => s.name === targetScope) : info.scopes?.[0];
    
    if (!scope) {
      this.logger.error('\n❌ No scope to work on\n');
      return;
    }

    // Initialize adapter for the stack
    if (!this.adapter) {
      this.logger.info('Initializing stack adapter...');
      this.adapter = await this.adapterFactory.createAdapter(info.stack);
      this.adapter.structure = await this.adapter.detectStructure();
      this.logger.success('  ✓ Adapter ready');
    }

    // RED Phase - Generate Tests
    console.log(chalk.red('\n🔴 RED PHASE: Generating tests\n'));
    
    if (this.dryRun) {
      this.logger.dryRun(`Would generate tests for scope: ${scope.name}`);
      this.logger.dryRun(`  - Mode: ${mode}`);
      this.logger.dryRun(`  - Stack: ${info.stack.name}`);
    }
    
    let testFiles = [];
    const useAI = this.config?.llm?.enabled && this.config?.llm?.provider !== 'ollama';
    
    if (useAI) {
      // Use AI-powered test generation
      console.log(chalk.cyan('  🧠 Using AI for intelligent test generation...\n'));
      
      try {
        const llm = new LLMClient(this.config.llm);
        const aiTestGenerator = new IntelligentTestGenerator(
          process.cwd(),
          this.adapter,
          {
            overwrite: mode === 'confident',
            dryRun: this.dryRun,
            llmClient: llm,
            useAI: true
          }
        );
        
        testFiles = await aiTestGenerator.generateTestsForScope(scope);
        
        // Write test files
        for (const testCase of testFiles) {
          const result = await aiTestGenerator.writeTestFile(testCase);
          if (!result.skipped) {
            aiTestGenerator.generatedFiles.push(result);
          }
        }
        
        // Show AI stats
        const stats = aiTestGenerator.getSummary();
        console.log(chalk.blue(`\n  📊 Test Generation Stats:`));
        console.log(`     AI-generated: ${stats.aiGenerated}`);
        console.log(`     Template: ${stats.templateGenerated}`);
        
        llm.printStats();
      } catch (error) {
        console.log(chalk.yellow(`  ⚠️  AI generation failed: ${error.message}`));
        console.log(chalk.yellow('  Falling back to template generation...\n'));
        useAI = false;
      }
    }
    
    if (!useAI) {
      // Use traditional test generation
      const testGenerator = new TestGenerator(process.cwd(), this.adapter, {
        overwrite: mode === 'confident',
        dryRun: this.dryRun
      });
      
      testFiles = await testGenerator.generateTestsForScope(scope);
    }
    
    if (testFiles.length === 0) {
      this.logger.warning('\n  ⚠️  No new tests needed - all routes already have tests\n');
    } else {
      this.logger.success(`\n  ✅ Generated ${testFiles.length} test files\n`);
    }

    // Confirm before GREEN (in safe mode)
    if (mode === 'safe' && testFiles.length > 0 && !this.dryRun) {
      const { proceed } = await require('inquirer').prompt([{
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed to implementation?',
        default: true
      }]);
      
      if (!proceed) {
        this.logger.info('\nAborted. No changes made.\n');
        return;
      }
    }

    // GREEN Phase - Generate Implementations
    console.log(chalk.green('\n🟢 GREEN PHASE: Implementing features\n'));
    
    if (this.dryRun) {
      this.logger.dryRun('Would generate missing implementations');
    }
    
    const implGenerator = new ImplementationGenerator(process.cwd(), this.adapter, {
      overwrite: mode === 'confident',
      dryRun: this.dryRun
    });
    
    const implFiles = await implGenerator.generateImplementationsForScope(scope);
    
    if (implFiles.length === 0) {
      this.logger.info('  No missing implementations found\n');
    } else {
      this.logger.success(`\n  ✅ Generated ${implFiles.length} implementation files\n`);
    }

    // VALIDATE Phase - Run Tests
    if (!this.dryRun) {
      console.log(chalk.blue('\n✅ VALIDATE PHASE: Running tests\n'));
      
      const results = await validateChanges(scope, info.stack);
      
      if (results.success) {
        this.logger.success(`\n✅ All tests passing!`);
        if (results.coverage) {
          console.log(chalk.blue(`Coverage: ${results.coverage.before}% → ${results.coverage.after}%\n`));
        }
      } else {
        this.logger.error(`\n❌ ${results.failures?.length || 0} tests failed`);
        this.logger.info('Run: npx aperto analyze for details\n');
      }
    } else {
      this.logger.dryRun('Would run test suite');
    }

    // Show summary
    console.log(chalk.blue('\n📊 Summary:\n'));
    console.log(`  Tests generated:    ${testFiles.length}`);
    console.log(`  Implementations:    ${implFiles.length}`);
    if (!this.dryRun) {
      console.log(`  Mode:              ${mode}`);
    } else {
      console.log(chalk.cyan(`  Mode:              DRY RUN (no changes made)`));
    }
    console.log('');
  }

  async executeYolo() {
    this.logger.warning('\n🚀 YOLO MODE: All changes at once\n');
    
    if (!this.dryRun) {
      const { confirm } = await require('inquirer').prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.red('⚠️  This will make many changes at once. Are you sure?'),
        default: false
      }]);
      
      if (!confirm) {
        this.logger.info('Aborted.\n');
        return;
      }
    }
    
    const info = await this.analyze('console');
    await this.executeRedGreen(info, this.dryRun ? 'safe' : 'confident');
  }

  async executeProgressive() {
    this.logger.info('\n📊 PROGRESSIVE MODE: Feature by feature\n');
    const info = await this.analyze('console');
    
    if (!info.scopes || info.scopes.length === 0) {
      this.logger.warning('No scopes detected. Nothing to do.\n');
      return;
    }
    
    for (let i = 0; i < info.scopes.length; i++) {
      const scope = info.scopes[i];
      this.logger.info(`\n📦 [${i + 1}/${info.scopes.length}] Processing scope: ${scope.name}\n`);
      await this.executeRedGreen({ ...info, scopes: [scope] }, this.dryRun ? 'safe' : 'safe', scope.name);
      
      if (i < info.scopes.length - 1 && !this.dryRun) {
        const { next } = await require('inquirer').prompt([{
          type: 'confirm',
          name: 'next',
          message: 'Continue to next scope?',
          default: true
        }]);
        
        if (!next) {
          this.logger.info('\nStopped by user.\n');
          break;
        }
      }
    }
  }

  async executeScopeFirst(targetScope) {
    if (targetScope) {
      await this.workOnScope(targetScope);
    } else {
      const info = await this.analyze('console');
      const criticalScope = info.scopes?.find(s => s.priority >= 70);
      
      if (criticalScope) {
        this.logger.info(`\n🎯 Starting with critical scope: ${criticalScope.name}\n`);
        await this.workOnScope(criticalScope.name);
      } else {
        this.logger.warning('\n⚠️  No critical scope found.\n');
        this.logger.info('Run: npx aperto scopes\n');
      }
    }
  }
}

module.exports = new Aperto();

#!/usr/bin/env node
/**
 * Aperto Setup Wizard - Interactive step-by-step setup
 * No complex questions, just simple choices
 */

const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class SetupWizard {
  constructor() {
    this.projectPath = process.cwd();
    this.config = {
      mode: 'safe',
      reportFormat: 'markdown',
      autoBackup: true,
      llm: {
        enabled: true,
        provider: 'kimi',
        apiKey: null,
        cacheEnabled: true
      }
    };
  }

  async run() {
    this.printBanner();
    
    // Check if already configured
    if (await this.isAlreadyConfigured()) {
      await this.handleExistingConfig();
      return;
    }
    
    // Step by step guide
    await this.step1_DetectProject();
    await this.step2_ChooseMode();
    await this.step3_ChooseAIProvider();
    await this.step4_ConfigureAPIKey();
    await this.step5_TestConfiguration();
    await this.step6_SaveConfiguration();
    
    this.printSuccess();
  }

  printBanner() {
    console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║  🌐 APERTO - Setup Wizard                              ║'));
    console.log(chalk.blue.bold('║  Interactive configuration assistant                   ║'));
    console.log(chalk.blue.bold('╚════════════════════════════════════════════════════════╝\n'));
  }

  async isAlreadyConfigured() {
    try {
      await fs.access(path.join(this.projectPath, '.aperto/config.json'));
      return true;
    } catch {
      return false;
    }
  }

  async handleExistingConfig() {
    console.log(chalk.yellow('\n⚠️  Aperto is already configured in this project.\n'));
    console.log(chalk.gray('Available options:'));
    console.log('  1. View current configuration');
    console.log('  2. Reconfigure (erases current config)');
    console.log('  3. Cancel\n');
    
    const choice = await this.askQuestion('What would you like to do? (1/2/3) : ');
    
    switch(choice.trim()) {
      case '1':
        await this.showCurrentConfig();
        break;
      case '2':
        console.log(chalk.yellow('\nReconfiguring...\n'));
        await this.run();
        break;
      case '3':
        console.log(chalk.gray('\nConfiguration kept.\n'));
        break;
      default:
        console.log(chalk.red('\nInvalid option.\n'));
    }
  }

  async showCurrentConfig() {
    try {
      const configPath = path.join(this.projectPath, '.aperto/config.json');
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      console.log(chalk.blue('\n📋 Current configuration:\n'));
      console.log(JSON.stringify(config, null, 2));
      console.log('');
    } catch {
      console.log(chalk.red('\n❌ Unable to read configuration.\n'));
    }
  }

  async step1_DetectProject() {
    console.log(chalk.blue('\n📍 Step 1/6 : Project Detection\n'));
    
    // Detect project type
    const isLaravel = await this.fileExists('artisan');
    const isReact = await this.fileExists('package.json');
    const hasComposer = await this.fileExists('composer.json');
    
    if (isLaravel && hasComposer) {
      console.log(chalk.green('✅ Laravel project detected'));
      
      // Try to detect more info
      try {
        const composerJson = JSON.parse(await fs.readFile('composer.json', 'utf8'));
        const laravelVersion = composerJson.require?.['laravel/framework'] || 'unknown';
        console.log(chalk.gray(`   Laravel version: ${laravelVersion}`));
      } catch {}
    } else if (isReact) {
      console.log(chalk.green('✅ Node.js project detected'));
    } else {
      console.log(chalk.yellow('⚠️  Project type not detected'));
    }
    
    console.log(chalk.gray(`   Path: ${this.projectPath}`));
    await this.wait(1000);
  }

  async step2_ChooseMode() {
    console.log(chalk.blue('\n⚙️  Step 2/6 : Operating Mode\n'));
    console.log(chalk.gray('When Aperto generates code, should it ask for confirmation?\n'));
    console.log('  1. ' + chalk.bold('Safe Mode') + ' (recommended)');
    console.log('     • Asks confirmation before each action');
    console.log('     • Safer to start with');
    console.log('     • Full control over generated code\n');
    
    console.log('  2. ' + chalk.bold('Confident Mode'));
    console.log('     • Generates automatically without asking');
    console.log('     • Faster');
    console.log('     • For experienced users\n');
    
    const choice = await this.askQuestion('Your choice (1 or 2) [1] : ');
    
    if (choice.trim() === '2') {
      this.config.mode = 'confident';
      console.log(chalk.yellow('   → Confident Mode selected'));
    } else {
      this.config.mode = 'safe';
      console.log(chalk.green('   → Safe Mode selected'));
    }
    
    await this.wait(500);
  }

  async step3_ChooseAIProvider() {
    console.log(chalk.blue('\n🤖 Step 3/6 : AI Provider\n'));
    console.log(chalk.gray('Aperto uses AI to generate intelligent tests.\n'));
    console.log(chalk.gray('Choose your provider:\n'));
    
    console.log('  1. ' + chalk.bold('Kimi (Moonshot AI)') + chalk.green(' ★ Recommended'));
    console.log('     • Optimized for code');
    console.log('     • Fast and accurate');
    console.log('     • ~$0.10-0.20 per analysis\n');
    
    console.log('  2. ' + chalk.bold('OpenAI (GPT-4)'));
    console.log('     • Very performant');
    console.log('     • More expensive (~$0.30-0.50)');
    console.log('     • Excellent quality\n');
    
    console.log('  3. ' + chalk.bold('Ollama (Local)'));
    console.log('     • Free (uses your PC)');
    console.log('     • Slower');
    console.log('     • Requires installation\n');
    
    const choice = await this.askQuestion('Your choice (1, 2 or 3) [1] : ');
    
    switch(choice.trim()) {
      case '2':
        this.config.llm.provider = 'openai';
        console.log(chalk.green('   → OpenAI selected'));
        break;
      case '3':
        this.config.llm.provider = 'ollama';
        console.log(chalk.green('   → Ollama selected'));
        break;
      default:
        this.config.llm.provider = 'kimi';
        console.log(chalk.green('   → Kimi selected'));
    }
    
    await this.wait(500);
  }

  async step4_ConfigureAPIKey() {
    console.log(chalk.blue('\n🔑 Step 4/6 : API Key Configuration\n'));
    
    if (this.config.llm.provider === 'ollama') {
      console.log(chalk.gray('Ollama works locally, no API key needed.\n'));
      console.log(chalk.yellow('⚠️  Make sure Ollama is installed:'));
      console.log('   brew install ollama  # macOS');
      console.log('   ollama pull codellama\n');
      return;
    }
    
    const provider = this.config.llm.provider === 'kimi' ? 'Kimi' : 'OpenAI';
    console.log(chalk.gray(`You need a ${provider} API key.\n`));
    
    // Check if already configured in env
    const envKey = process.env.APERTO_LLM_API_KEY;
    if (envKey) {
      console.log(chalk.green('✅ API key found in environment variables'));
      this.config.llm.apiKey = envKey;
      return;
    }
    
    console.log(chalk.cyan('How to get your key:'));
    if (this.config.llm.provider === 'kimi') {
      console.log('  1. Go to https://platform.moonshot.cn/');
      console.log('  2. Create an account or log in');
      console.log('  3. Generate an API key');
      console.log('  4. Copy the key (starts with sk-kimi-...)\n');
    } else {
      console.log('  1. Go to https://platform.openai.com/');
      console.log('  2. Go to API Keys');
      console.log('  3. Create a new key');
      console.log('  4. Copy the key (starts with sk-...)\n');
    }
    
    console.log(chalk.yellow('You can:'));
    console.log('  1. Enter the key now');
    console.log('  2. Configure later (AI will be disabled)\n');
    
    const choice = await this.askQuestion('Your choice (1 or 2) [1] : ');
    
    if (choice.trim() === '2') {
      console.log(chalk.yellow('\n   → Configuration postponed'));
      console.log(chalk.gray('   You can configure later with: npx aperto llm'));
      this.config.llm.enabled = false;
      return;
    }
    
    // Ask for key
    const apiKey = await this.askQuestion(`\nPaste your ${provider} API key : `);
    
    if (apiKey.trim()) {
      this.config.llm.apiKey = apiKey.trim();
      console.log(chalk.green('   → API key configured'));
    } else {
      console.log(chalk.yellow('\n   → No key provided'));
      console.log(chalk.gray('   AI will be disabled. Configure later with: npx aperto llm'));
      this.config.llm.enabled = false;
    }
    
    await this.wait(500);
  }

  async step5_TestConfiguration() {
    console.log(chalk.blue('\n🧪 Step 5/6 : Testing Configuration\n'));
    
    if (!this.config.llm.enabled || !this.config.llm.apiKey) {
      console.log(chalk.yellow('⚠️  Test skipped (AI disabled or key not configured)'));
      return;
    }
    
    console.log(chalk.gray('Testing AI connection...'));
    
    try {
      // Simple test with curl
      const provider = this.config.llm.provider;
      const apiKey = this.config.llm.apiKey;
      
      if (provider === 'kimi') {
        // Test Kimi
        execSync(`curl -s -o /dev/null -w "%{http_code}" https://api.moonshot.cn/v1/models -H "Authorization: Bearer ${apiKey}"`);
      } else {
        // Test OpenAI
        execSync(`curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models -H "Authorization: Bearer ${apiKey}"`);
      }
      
      console.log(chalk.green('✅ Connection successful!'));
    } catch (error) {
      console.log(chalk.red('\n❌ Connection error'));
      console.log(chalk.gray('   API key seems invalid.'));
      console.log(chalk.gray('   AI will be disabled, you can reconfigure later.\n'));
      this.config.llm.enabled = false;
    }
    
    await this.wait(500);
  }

  async step6_SaveConfiguration() {
    console.log(chalk.blue('\n💾 Step 6/6 : Saving Configuration\n'));
    
    try {
      // Create .aperto directory
      await fs.mkdir(path.join(this.projectPath, '.aperto'), { recursive: true });
      
      // Save config
      const configPath = path.join(this.projectPath, '.aperto/config.json');
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
      
      // Create .gitignore
      const gitignorePath = path.join(this.projectPath, '.aperto/.gitignore');
      await fs.writeFile(gitignorePath, '# Aperto backups and reports\nbackup-*\n*.log\nreports/\ncache/\n', 'utf8');
      
      console.log(chalk.green('✅ Configuration saved!'));
      console.log(chalk.gray(`   File: ${configPath}`));
    } catch (error) {
      console.log(chalk.red('\n❌ Error saving configuration:'));
      console.log(chalk.gray(`   ${error.message}\n`));
      throw error;
    }
    
    await this.wait(500);
  }

  printSuccess() {
    console.log(chalk.green.bold('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║  ✅ Setup completed successfully!                      ║'));
    console.log(chalk.green.bold('╚════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.blue('🚀 Next steps:\n'));
    
    if (this.config.llm.enabled) {
      console.log('  ' + chalk.bold('1. Run intelligent analysis'));
      console.log('     ' + chalk.cyan('npx aperto smart'));
      console.log('     ' + chalk.gray('→ Deep AI analysis\n'));
      
      console.log('  ' + chalk.bold('2. View configuration'));
      console.log('     ' + chalk.cyan('npx aperto config\n'));
      
      console.log('  ' + chalk.bold('3. Get help'));
      console.log('     ' + chalk.cyan('npx aperto --help\n'));
    } else {
      console.log('  ' + chalk.yellow('⚠️  AI not configured'));
      console.log('     ' + chalk.cyan('npx aperto llm'));
      console.log('     ' + chalk.gray('→ To configure AI\n'));
      
      console.log('  ' + chalk.bold('Use without AI:'));
      console.log('     ' + chalk.cyan('npx aperto --no-ai'));
      console.log('     ' + chalk.gray('→ Basic mode (free)\n'));
    }
    
    console.log(chalk.gray('Documentation:'));
    console.log(chalk.gray('  • Full guide    : APERTO-GUIDE.md'));
    console.log(chalk.gray('  • Smart mode    : APERTO-SMART.md'));
    console.log(chalk.gray('  • Troubleshoot  : APERTO-API-KEY.md\n'));
  }

  // Utilities
  async askQuestion(question) {
    return new Promise((resolve) => {
      process.stdout.write(chalk.cyan(question));
      process.stdin.once('data', (data) => {
        resolve(data.toString());
      });
    });
  }

  async fileExists(filePath) {
    try {
      await fs.access(path.join(this.projectPath, filePath));
      return true;
    } catch {
      return false;
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run wizard
const wizard = new SetupWizard();
wizard.run().catch(error => {
  console.error(chalk.red('\n❌ Error:'), error.message);
  process.exit(1);
});

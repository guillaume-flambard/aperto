#!/usr/bin/env node
/**
 * Aperto Setup Wizard - Guide interactif étape par étape
 * Pas de questions complexes, juste des choix simples
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
    
    // Vérifier si déjà configuré
    if (await this.isAlreadyConfigured()) {
      await this.handleExistingConfig();
      return;
    }
    
    // Guide étape par étape
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
    console.log(chalk.blue.bold('║  🌐 APERTO - Configuration Guidée                      ║'));
    console.log(chalk.blue.bold('║  Assistant de configuration pas à pas                  ║'));
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
    console.log(chalk.yellow('\n⚠️  Aperto est déjà configuré dans ce projet.\n'));
    console.log(chalk.gray('Options disponibles :'));
    console.log('  1. Voir la configuration actuelle');
    console.log('  2. Reconfigurer (efface la config actuelle)');
    console.log('  3. Annuler\n');
    
    const choice = await this.askQuestion('Que souhaitez-vous faire ? (1/2/3) : ');
    
    switch(choice.trim()) {
      case '1':
        await this.showCurrentConfig();
        break;
      case '2':
        console.log(chalk.yellow('\nReconfiguration...\n'));
        await this.run();
        break;
      case '3':
        console.log(chalk.gray('\nConfiguration conservée.\n'));
        break;
      default:
        console.log(chalk.red('\nOption invalide.\n'));
    }
  }

  async showCurrentConfig() {
    try {
      const configPath = path.join(this.projectPath, '.aperto/config.json');
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      console.log(chalk.blue('\n📋 Configuration actuelle :\n'));
      console.log(JSON.stringify(config, null, 2));
      console.log('');
    } catch {
      console.log(chalk.red('\n❌ Impossible de lire la configuration.\n'));
    }
  }

  async step1_DetectProject() {
    console.log(chalk.blue('\n📍 Étape 1/6 : Détection du projet\n'));
    
    // Détecter le type de projet
    const isLaravel = await this.fileExists('artisan');
    const isReact = await this.fileExists('package.json');
    const hasComposer = await this.fileExists('composer.json');
    
    if (isLaravel && hasComposer) {
      console.log(chalk.green('✅ Projet Laravel détecté'));
      
      // Essayer de détecter plus d'infos
      try {
        const composerJson = JSON.parse(await fs.readFile('composer.json', 'utf8'));
        const laravelVersion = composerJson.require?.['laravel/framework'] || 'inconnue';
        console.log(chalk.gray(`   Version Laravel : ${laravelVersion}`));
      } catch {}
    } else if (isReact) {
      console.log(chalk.green('✅ Projet Node.js détecté'));
    } else {
      console.log(chalk.yellow('⚠️  Type de projet non détecté'));
    }
    
    console.log(chalk.gray(`   Chemin : ${this.projectPath}`));
    await this.wait(1000);
  }

  async step2_ChooseMode() {
    console.log(chalk.blue('\n⚙️  Étape 2/6 : Mode de fonctionnement\n'));
    console.log(chalk.gray('Quand Aperto génère du code, il doit demander confirmation ?\n'));
    console.log('  1. ' + chalk.bold('Mode Safe') + ' (recommandé)');
    console.log('     • Demande confirmation avant chaque action');
    console.log('     • Plus sûr pour commencer');
    console.log('     • Contrôle total sur ce qui est généré\n');
    
    console.log('  2. ' + chalk.bold('Mode Confident'));
    console.log('     • Génère automatiquement sans demander');
    console.log('     • Plus rapide');
    console.log('     • Pour les utilisateurs expérimentés\n');
    
    const choice = await this.askQuestion('Votre choix (1 ou 2) [1] : ');
    
    if (choice.trim() === '2') {
      this.config.mode = 'confident';
      console.log(chalk.yellow('   → Mode Confident sélectionné'));
    } else {
      this.config.mode = 'safe';
      console.log(chalk.green('   → Mode Safe sélectionné'));
    }
    
    await this.wait(500);
  }

  async step3_ChooseAIProvider() {
    console.log(chalk.blue('\n🤖 Étape 3/6 : Fournisseur d\'IA\n'));
    console.log(chalk.gray('Aperto utilise l\'IA pour générer des tests intelligents.\n'));
    console.log(chalk.gray('Choisissez votre fournisseur :\n'));
    
    console.log('  1. ' + chalk.bold('Kimi (Moonshot AI)') + chalk.green(' ★ Recommandé'));
    console.log('     • Optimisé pour le code');
    console.log('     • Rapide et précis');
    console.log('     • ~$0.10-0.20 par analyse\n');
    
    console.log('  2. ' + chalk.bold('OpenAI (GPT-4)'));
    console.log('     • Très performant');
    console.log('     • Plus cher (~$0.30-0.50)');
    console.log('     • Excellente qualité\n');
    
    console.log('  3. ' + chalk.bold('Ollama (Local)'));
    console.log('     • Gratuit (utilise votre PC)');
    console.log('     • Plus lent');
    console.log('     • Nécessite installation\n');
    
    const choice = await this.askQuestion('Votre choix (1, 2 ou 3) [1] : ');
    
    switch(choice.trim()) {
      case '2':
        this.config.llm.provider = 'openai';
        console.log(chalk.green('   → OpenAI sélectionné'));
        break;
      case '3':
        this.config.llm.provider = 'ollama';
        console.log(chalk.green('   → Ollama sélectionné'));
        break;
      default:
        this.config.llm.provider = 'kimi';
        console.log(chalk.green('   → Kimi sélectionné'));
    }
    
    await this.wait(500);
  }

  async step4_ConfigureAPIKey() {
    console.log(chalk.blue('\n🔑 Étape 4/6 : Configuration de la clé API\n'));
    
    if (this.config.llm.provider === 'ollama') {
      console.log(chalk.gray('Ollama fonctionne en local, pas besoin de clé API.\n'));
      console.log(chalk.yellow('⚠️  Assurez-vous qu\'Ollama est installé :'));
      console.log('   brew install ollama  # macOS');
      console.log('   ollama pull codellama\n');
      return;
    }
    
    const provider = this.config.llm.provider === 'kimi' ? 'Kimi' : 'OpenAI';
    console.log(chalk.gray(`Vous avez besoin d'une clé API ${provider}.\n`));
    
    // Vérifier si déjà configurée dans env
    const envKey = process.env.APERTO_LLM_API_KEY;
    if (envKey) {
      console.log(chalk.green('✅ Clé API trouvée dans les variables d\'environnement'));
      this.config.llm.apiKey = envKey;
      return;
    }
    
    console.log(chalk.cyan('Comment obtenir votre clé :'));
    if (this.config.llm.provider === 'kimi') {
      console.log('  1. Allez sur https://platform.moonshot.cn/');
      console.log('  2. Créez un compte ou connectez-vous');
      console.log('  3. Générez une clé API');
      console.log('  4. Copiez la clé (commence par sk-kimi-...)\n');
    } else {
      console.log('  1. Allez sur https://platform.openai.com/');
      console.log('  2. Allez dans API Keys');
      console.log('  3. Créez une nouvelle clé');
      console.log('  4. Copiez la clé (commence par sk-...)\n');
    }
    
    console.log(chalk.yellow('Vous pouvez :'));
    console.log('  1. Entrer la clé maintenant');
    console.log('  2. Configurer plus tard (l\'IA sera désactivée)\n');
    
    const choice = await this.askQuestion('Votre choix (1 ou 2) [1] : ');
    
    if (choice.trim() === '2') {
      console.log(chalk.yellow('\n   → Configuration reportée'));
      console.log(chalk.gray('   Vous pourrez configurer plus tard avec : npx aperto llm'));
      this.config.llm.enabled = false;
      return;
    }
    
    // Demander la clé
    const apiKey = await this.askQuestion(`\nCollez votre clé API ${provider} : `);
    
    if (apiKey.trim()) {
      this.config.llm.apiKey = apiKey.trim();
      console.log(chalk.green('   → Clé API configurée'));
    } else {
      console.log(chalk.yellow('\n   → Aucune clé fournie'));
      console.log(chalk.gray('   L\'IA sera désactivée. Configurez plus tard avec : npx aperto llm'));
      this.config.llm.enabled = false;
    }
    
    await this.wait(500);
  }

  async step5_TestConfiguration() {
    console.log(chalk.blue('\n🧪 Étape 5/6 : Test de la configuration\n'));
    
    if (!this.config.llm.enabled || !this.config.llm.apiKey) {
      console.log(chalk.yellow('⚠️  Test ignoré (IA désactivée ou clé non configurée)'));
      return;
    }
    
    console.log(chalk.gray('Test de connexion à l\'IA...'));
    
    try {
      // Test simple avec curl
      const provider = this.config.llm.provider;
      const apiKey = this.config.llm.apiKey;
      
      if (provider === 'kimi') {
        // Test Kimi
        execSync(`curl -s -o /dev/null -w "%{http_code}" https://api.moonshot.cn/v1/models -H "Authorization: Bearer ${apiKey}"`);
      } else {
        // Test OpenAI
        execSync(`curl -s -o /dev/null -w "%{http_code}" https://api.openai.com/v1/models -H "Authorization: Bearer ${apiKey}"`);
      }
      
      console.log(chalk.green('✅ Connexion réussie !'));
    } catch (error) {
      console.log(chalk.red('\n❌ Erreur de connexion'));
      console.log(chalk.gray('   La clé API semble invalide.'));
      console.log(chalk.gray('   L\'IA sera désactivée, vous pourrez reconfigurer plus tard.\n'));
      this.config.llm.enabled = false;
    }
    
    await this.wait(500);
  }

  async step6_SaveConfiguration() {
    console.log(chalk.blue('\n💾 Étape 6/6 : Sauvegarde de la configuration\n'));
    
    try {
      // Créer le dossier .aperto
      await fs.mkdir(path.join(this.projectPath, '.aperto'), { recursive: true });
      
      // Sauvegarder la config
      const configPath = path.join(this.projectPath, '.aperto/config.json');
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
      
      // Créer le .gitignore
      const gitignorePath = path.join(this.projectPath, '.aperto/.gitignore');
      await fs.writeFile(gitignorePath, '# Aperto backups and reports\nbackup-*\n*.log\nreports/\ncache/\n', 'utf8');
      
      console.log(chalk.green('✅ Configuration sauvegardée !'));
      console.log(chalk.gray(`   Fichier : ${configPath}`));
    } catch (error) {
      console.log(chalk.red('\n❌ Erreur lors de la sauvegarde :'));
      console.log(chalk.gray(`   ${error.message}\n`));
      throw error;
    }
    
    await this.wait(500);
  }

  printSuccess() {
    console.log(chalk.green.bold('\n╔════════════════════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║  ✅ Configuration terminée avec succès !               ║'));
    console.log(chalk.green.bold('╚════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.blue('🚀 Prochaines étapes :\n'));
    
    if (this.config.llm.enabled) {
      console.log('  ' + chalk.bold('1. Lancer l\'analyse intelligente'));
      console.log('     ' + chalk.cyan('npx aperto smart'));
      console.log('     ' + chalk.gray('→ Analyse profonde avec IA\n'));
      
      console.log('  ' + chalk.bold('2. Voir la configuration'));
      console.log('     ' + chalk.cyan('npx aperto config\n'));
      
      console.log('  ' + chalk.bold('3. Obtenir de l\'aide'));
      console.log('     ' + chalk.cyan('npx aperto --help\n'));
    } else {
      console.log('  ' + chalk.yellow('⚠️  L\'IA n\'est pas configurée'));
      console.log('     ' + chalk.cyan('npx aperto llm'));
      console.log('     ' + chalk.gray('→ Pour configurer l\'IA\n'));
      
      console.log('  ' + chalk.bold('Utilisation sans IA :'));
      console.log('     ' + chalk.cyan('npx aperto --no-ai'));
      console.log('     ' + chalk.gray('→ Mode basique (gratuit)\n'));
    }
    
    console.log(chalk.gray('Documentation :'));
    console.log(chalk.gray('  • Guide complet    : APERTO-GUIDE.md'));
    console.log(chalk.gray('  • Mode intelligent : APERTO-SMART.md'));
    console.log(chalk.gray('  • Troubleshooting  : APERTO-API-KEY.md\n'));
  }

  // Utilitaires
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

// Lancer le wizard
const wizard = new SetupWizard();
wizard.run().catch(error => {
  console.error(chalk.red('\n❌ Erreur :'), error.message);
  process.exit(1);
});

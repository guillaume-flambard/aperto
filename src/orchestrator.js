const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');
const ora = require('ora');
const inquirer = require('inquirer');

/**
 * Aperto Orchestrator
 * 
 * Analyse intelligente du code existant et suggestions
 * de tests et implémentations manquantes basées sur le contexte réel.
 */

class ApertoOrchestrator {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = options;
    this.analysis = {
      routes: [],
      controllers: [],
      models: [],
      views: [],
      existingTests: [],
      suggestions: []
    };
  }

  async analyze() {
    console.log(chalk.blue.bold('\n🔍 Analyse intelligente du projet\n'));
    
    const spinner = ora('Analyse du code existant...').start();
    
    try {
      // 1. Analyser les routes
      await this.analyzeRoutes();
      
      // 2. Analyser les controllers
      await this.analyzeControllers();
      
      // 3. Analyser les modèles
      await this.analyzeModels();
      
      // 4. Analyser les tests existants
      await this.analyzeExistingTests();
      
      // 5. Générer des suggestions intelligentes
      this.generateSuggestions();
      
      spinner.succeed('Analyse terminée');
      
      return this.analysis;
    } catch (error) {
      spinner.fail('Erreur lors de l\'analyse');
      throw error;
    }
  }

  async analyzeRoutes() {
    const routesPath = path.join(this.projectPath, 'routes');
    if (!await fs.pathExists(routesPath)) return;

    const routeFiles = await globby('routes/*.php', { cwd: this.projectPath });

    for (const file of routeFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.php');

      // Patterns Laravel
      const patterns = [
        // Route::get('/path', [Controller::class, 'method'])
        /Route::(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([^\]]+)\s*\]/g,
        // Route::resource('name', Controller::class)
        /Route::resource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^\)]+)\)/g,
        // Route::group
        /Route::(middleware|prefix|group)\s*\(/g
      ];

      let match;
      while ((match = patterns[0].exec(content)) !== null) {
        const method = match[1];
        const path = match[2];
        const controllerMatch = match[3].match(/([A-Za-z]+Controller)/);
        const controller = controllerMatch ? controllerMatch[1] : 'Unknown';
        const actionMatch = match[3].match(/['"](\w+)['"]/);
        const action = actionMatch ? actionMatch[1] : 'index';

        this.analysis.routes.push({
          file: fileName,
          method,
          path,
          controller,
          action,
          type: this.detectRouteType(fileName, path),
          fullDefinition: match[0]
        });
      }
    }
  }

  detectRouteType(fileName, path) {
    if (fileName === 'api' || path.startsWith('api/')) return 'api';
    if (fileName === 'admin' || path.includes('admin')) return 'admin';
    if (path.includes('auth') || path.includes('login') || path.includes('register')) return 'auth';
    return 'public';
  }

  async analyzeControllers() {
    const controllerPaths = [
      'app/Http/Controllers/**/*.php',
      'app/Http/Controllers/*.php'
    ];

    const files = await globby(controllerPaths, { cwd: this.projectPath });

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const controllerName = path.basename(file, '.php');

      // Extraire les méthodes
      const methodMatches = content.match(/public function (?!__construct)(\w+)/g) || [];
      const methods = methodMatches.map(m => m.replace('public function ', ''));

      // Détecter les validations
      const hasValidation = content.includes('validate(') || content.includes('FormRequest');
      
      // Détecter les autorisations
      const hasAuthorization = content.includes('authorize(') || content.includes('can(') || content.includes('middleware');
      
      // Détecter les relations
      const usesEloquent = content.includes('Model::') || content.includes('->find(') || content.includes('->where(');
      
      // Détecter les views retournées
      const viewMatches = content.match(/return view\(['"]([^'"]+)['"]\)/g) || [];
      const views = viewMatches.map(v => v.match(/view\(['"]([^'"]+)['"]\)/)[1]);

      // Détecter les redirections
      const redirectMatches = content.match(/return redirect\(['"]([^'"]+)['"]\)/g) || [];
      const redirects = redirectMatches.map(r => r.match(/redirect\(['"]([^'"]+)['"]\)/)[1]);

      this.analysis.controllers.push({
        name: controllerName,
        path: file,
        methods,
        hasValidation,
        hasAuthorization,
        usesEloquent,
        views,
        redirects,
        isResource: methods.includes('index') && methods.includes('store'),
        scope: this.detectControllerScope(file)
      });
    }
  }

  detectControllerScope(filePath) {
    if (filePath.includes('Admin')) return 'admin';
    if (filePath.includes('Auth')) return 'auth';
    if (filePath.includes('Api')) return 'api';
    return 'public';
  }

  async analyzeModels() {
    const modelPaths = [
      'app/Models/**/*.php',
      'app/*.php'
    ];

    const files = await globby(modelPaths, { cwd: this.projectPath });

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      if (!content.includes('extends Model')) continue;

      const modelName = path.basename(file, '.php');

      // Détecter les relations
      const relationMatches = content.match(/public function \w+\(\)\s*\{\s*return \$this->(hasMany|belongsTo|hasOne|belongsToMany)/g) || [];
      
      // Détecter les casts
      const castMatch = content.match(/protected \$casts = \[([^\]]+)\]/);
      const casts = castMatch ? castMatch[1].split(',').map(c => c.trim()) : [];
      
      // Détecter les fillables
      const fillableMatch = content.match(/protected \$fillable = \[([^\]]+)\]/);
      const fillables = fillableMatch ? fillableMatch[1].split(',').map(f => f.trim().replace(/['"]/g, '')) : [];

      this.analysis.models.push({
        name: modelName,
        path: file,
        hasRelations: relationMatches.length > 0,
        relationCount: relationMatches.length,
        casts,
        fillables,
        hasFactory: content.includes('HasFactory')
      });
    }
  }

  async analyzeExistingTests() {
    const testPaths = [
      'tests/Feature/**/*.php',
      'tests/Unit/**/*.php'
    ];

    const files = await globby(testPaths, { cwd: this.projectPath });

    for (const file of files) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const testMethods = content.match(/public function test_\w+/g) || [];
      
      // Détecter quel controller est testé
      const controllerMatch = content.match(/class (\w+)Test/);
      const testedController = controllerMatch ? controllerMatch[1].replace('Test', '') : null;

      this.analysis.existingTests.push({
        path: file,
        controller: testedController,
        testCount: testMethods.length,
        type: file.includes('Feature') ? 'feature' : 'unit'
      });
    }
  }

  generateSuggestions() {
    // Suggestion 1: Controllers sans tests
    for (const controller of this.analysis.controllers) {
      const hasTests = this.analysis.existingTests.some(t => 
        t.controller === controller.name
      );

      if (!hasTests) {
        this.analysis.suggestions.push({
          type: 'missing_tests',
          priority: controller.scope === 'admin' || controller.scope === 'auth' ? 'high' : 'medium',
          controller: controller.name,
          scope: controller.scope,
          methods: controller.methods,
          reason: `Le controller ${controller.name} n'a aucun test`,
          suggestedTests: this.generateTestSuggestions(controller)
        });
      }
    }

    // Suggestion 2: Routes sans controllers
    for (const route of this.analysis.routes) {
      const hasController = this.analysis.controllers.some(c => 
        c.name === route.controller
      );

      if (!hasController) {
        this.analysis.suggestions.push({
          type: 'missing_controller',
          priority: 'high',
          route: route,
          reason: `La route ${route.method} ${route.path} référence un controller inexistant: ${route.controller}`,
          suggestedImplementation: this.generateControllerSuggestion(route)
        });
      }
    }

    // Suggestion 3: Controllers sans views
    for (const controller of this.analysis.controllers) {
      if (controller.views.length === 0 && !controller.isResource) {
        // Vérifier si c'est un controller API ou si les views sont implicites
        const hasReturnView = controller.methods.some(m => {
          // Ce serait mieux de parser le contenu, mais on fait simple
          return ['index', 'create', 'edit', 'show'].includes(m);
        });

        if (hasReturnView) {
          this.analysis.suggestions.push({
            type: 'missing_views',
            priority: 'medium',
            controller: controller.name,
            scope: controller.scope,
            reason: `Le controller ${controller.name} n'a pas de views associées`,
            suggestedViews: this.generateViewSuggestions(controller)
          });
        }
      }
    }

    // Suggestion 4: Models sans factories (pour les tests)
    for (const model of this.analysis.models) {
      if (!model.hasFactory) {
        this.analysis.suggestions.push({
          type: 'missing_factory',
          priority: 'low',
          model: model.name,
          reason: `Le model ${model.name} n'utilise pas HasFactory - les tests seront plus difficiles`,
          suggestedFix: `Ajouter 'use HasFactory;' dans ${model.name}`
        });
      }
    }
  }

  generateTestSuggestions(controller) {
    const suggestions = [];

    for (const method of controller.methods) {
      const testName = `test_${method.toLowerCase()}_`;
      
      let testDescription = '';
      let assertions = [];

      switch (method.toLowerCase()) {
        case 'index':
          testDescription = 'peut afficher la liste';
          assertions = ['assertStatus(200)', 'assertViewIs(...)'];
          break;
        case 'create':
          testDescription = 'peut afficher le formulaire de création';
          assertions = ['assertStatus(200)', 'assertViewIs(...)'];
          break;
        case 'store':
          testDescription = 'peut créer une ressource';
          assertions = ['assertRedirect(...)', 'assertDatabaseHas(...)'];
          if (controller.hasValidation) {
            assertions.push('assertSessionHasErrors() // pour validation');
          }
          break;
        case 'show':
          testDescription = 'peut afficher une ressource';
          assertions = ['assertStatus(200)', 'assertViewIs(...)'];
          break;
        case 'edit':
          testDescription = 'peut afficher le formulaire d\'édition';
          assertions = ['assertStatus(200)', 'assertViewIs(...)'];
          break;
        case 'update':
          testDescription = 'peut mettre à jour une ressource';
          assertions = ['assertRedirect(...)', 'assertDatabaseHas(...)'];
          break;
        case 'destroy':
          testDescription = 'peut supprimer une ressource';
          assertions = ['assertRedirect(...)', 'assertDeleted(...)'];
          break;
        default:
          testDescription = 'fonctionne correctement';
          assertions = ['assertStatus(200)'];
      }

      suggestions.push({
        method,
        testName: testName + testDescription.replace(/\s+/g, '_'),
        description: testDescription,
        assertions,
        needsAuth: controller.hasAuthorization || controller.scope === 'admin',
        needsValidation: controller.hasValidation && method === 'store'
      });
    }

    return suggestions;
  }

  generateControllerSuggestion(route) {
    return {
      name: route.controller,
      namespace: `App\\Http\\Controllers`,
      methods: [route.action],
      suggestedContent: this.generateControllerTemplate(route)
    };
  }

  generateControllerTemplate(route) {
    return `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Http\\Request;

class ${route.controller} extends Controller
{
    public function ${route.action}(Request $request)
    {
        // TODO: Implémenter la logique
        return view('${route.controller.toLowerCase().replace('controller', '')}.${route.action}');
    }
}`;
  }

  generateViewSuggestions(controller) {
    return controller.methods
      .filter(m => ['index', 'create', 'edit', 'show'].includes(m))
      .map(method => ({
        name: `${controller.name.toLowerCase().replace('controller', '')}/${method}.blade.php`,
        suggestedContent: this.generateViewTemplate(controller, method)
      }));
  }

  generateViewTemplate(controller, method) {
    return `@extends('layouts.app')

@section('content')
<div class="container">
    <h1>${controller.name} - ${method}</h1>
    <!-- TODO: Contenu de la vue ${method} -->
</div>
@endsection`;
  }

  async presentSuggestions() {
    console.log(chalk.blue.bold('\n📋 Suggestions\n'));

    if (this.analysis.suggestions.length === 0) {
      console.log(chalk.green('✅ Excellent ! Aucune suggestion - tout semble complet.\n'));
      return;
    }

    // Grouper par priorité
    const highPriority = this.analysis.suggestions.filter(s => s.priority === 'high');
    const mediumPriority = this.analysis.suggestions.filter(s => s.priority === 'medium');
    const lowPriority = this.analysis.suggestions.filter(s => s.priority === 'low');

    if (highPriority.length > 0) {
      console.log(chalk.red.bold('🔴 Priorité Haute :\n'));
      for (const suggestion of highPriority) {
        await this.presentSuggestion(suggestion);
      }
    }

    if (mediumPriority.length > 0) {
      console.log(chalk.yellow.bold('\n🟡 Priorité Moyenne :\n'));
      for (const suggestion of mediumPriority) {
        await this.presentSuggestion(suggestion);
      }
    }

    if (lowPriority.length > 0) {
      console.log(chalk.gray.bold('\n⚪ Priorité Basse :\n'));
      for (const suggestion of lowPriority) {
        await this.presentSuggestion(suggestion);
      }
    }
  }

  async presentSuggestion(suggestion) {
    console.log(chalk.cyan('─────────────────────────────────────'));
    console.log(chalk.bold(suggestion.reason));
    console.log(chalk.gray(`Type: ${suggestion.type}`));
    
    if (suggestion.type === 'missing_tests') {
      console.log(chalk.gray(`Controller: ${suggestion.controller}`));
      console.log(chalk.gray(`Méthodes: ${suggestion.methods.join(', ')}`));
      console.log(chalk.gray(`\nTests suggérés (${suggestion.suggestedTests.length}):`));
      suggestion.suggestedTests.forEach(test => {
        console.log(chalk.gray(`  • ${test.testName}`));
        console.log(chalk.gray(`    Assertions: ${test.assertions.join(', ')}`));
      });
    } else if (suggestion.type === 'missing_controller') {
      console.log(chalk.gray(`Route: ${suggestion.route.method.toUpperCase()} ${suggestion.route.path}`));
      console.log(chalk.gray(`Controller manquant: ${suggestion.route.controller}`));
    } else if (suggestion.type === 'missing_views') {
      console.log(chalk.gray(`Controller: ${suggestion.controller}`));
      console.log(chalk.gray(`Views suggérées:`));
      suggestion.suggestedViews.forEach(view => {
        console.log(chalk.gray(`  • ${view.name}`));
      });
    }

    // Demander à l'utilisateur ce qu'il veut faire
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'Que souhaitez-vous faire ?',
      choices: [
        { name: '✅ Générer tout', value: 'generate_all' },
        { name: '👀 Voir le code suggéré', value: 'preview' },
        { name: '⏭️  Passer', value: 'skip' },
        { name: '🛑 Arrêter', value: 'stop' }
      ]
    }]);

    switch (action) {
      case 'generate_all':
        await this.generateForSuggestion(suggestion);
        break;
      case 'preview':
        this.previewSuggestion(suggestion);
        break;
      case 'skip':
        console.log(chalk.gray('  → Passé\n'));
        break;
      case 'stop':
        throw new Error('Arrêt demandé par l\'utilisateur');
    }
  }

  previewSuggestion(suggestion) {
    console.log(chalk.blue('\n👀 Aperçu du code suggéré :\n'));
    
    if (suggestion.type === 'missing_tests') {
      const testCode = this.generateTestFileContent(suggestion);
      console.log(chalk.gray(testCode));
    } else if (suggestion.type === 'missing_controller') {
      console.log(chalk.gray(suggestion.suggestedImplementation.suggestedContent));
    } else if (suggestion.type === 'missing_views') {
      suggestion.suggestedViews.forEach(view => {
        console.log(chalk.yellow(`\n// ${view.name}`));
        console.log(chalk.gray(view.suggestedContent));
      });
    }
    
    console.log('');
  }

  generateTestFileContent(suggestion) {
    const testMethods = suggestion.suggestedTests.map(test => {
      const authSetup = test.needsAuth ? 
        `$user = User::factory()->create();\n        $response = $this->actingAs($user)->` : 
        '$response = $this->';
      
      return `
    /** @test */
    public function ${test.testName}()
    {
        ${authSetup}${suggestion.controller.toLowerCase().replace('controller', '')}();
        
        ${test.assertions.map(a => `$response->${a};`).join('\n        ')}
    }`;
    }).join('\n');

    return `<?php

namespace Tests\\Feature\\${suggestion.scope.charAt(0).toUpperCase() + suggestion.scope.slice(1)};

use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;
use App\\Models\\User;

class ${suggestion.controller}Test extends TestCase
{
    use RefreshDatabase;
    ${testMethods}
}`;
  }

  async generateForSuggestion(suggestion) {
    console.log(chalk.green(`\n📝 Génération pour ${suggestion.controller || suggestion.route?.controller}...`));
    
    if (suggestion.type === 'missing_tests') {
      await this.generateTests(suggestion);
    } else if (suggestion.type === 'missing_controller') {
      await this.generateController(suggestion);
    } else if (suggestion.type === 'missing_views') {
      await this.generateViews(suggestion);
    }
  }

  async generateTests(suggestion) {
    const testPath = path.join(
      this.projectPath, 
      'tests', 
      'Feature', 
      suggestion.scope.charAt(0).toUpperCase() + suggestion.scope.slice(1),
      `${suggestion.controller}Test.php`
    );

    const content = this.generateTestFileContent(suggestion);
    
    await fs.ensureDir(path.dirname(testPath));
    await fs.writeFile(testPath, content, 'utf8');
    
    console.log(chalk.green(`  ✅ Test créé: tests/Feature/${suggestion.scope}/${suggestion.controller}Test.php`));
  }

  async generateController(suggestion) {
    const controllerPath = path.join(
      this.projectPath,
      'app',
      'Http',
      'Controllers',
      `${suggestion.suggestedImplementation.name}.php`
    );

    await fs.writeFile(controllerPath, suggestion.suggestedImplementation.suggestedContent, 'utf8');
    
    console.log(chalk.green(`  ✅ Controller créé: app/Http/Controllers/${suggestion.suggestedImplementation.name}.php`));
  }

  async generateViews(suggestion) {
    for (const view of suggestion.suggestedViews) {
      const viewPath = path.join(this.projectPath, 'resources', 'views', view.name);
      await fs.ensureDir(path.dirname(viewPath));
      await fs.writeFile(viewPath, view.suggestedContent, 'utf8');
      
      console.log(chalk.green(`  ✅ View créée: resources/views/${view.name}`));
    }
  }

  async run() {
    try {
      await this.analyze();
      await this.presentSuggestions();
      
      console.log(chalk.green.bold('\n✨ Analyse terminée !\n'));
    } catch (error) {
      if (error.message === 'Arrêt demandé par l\'utilisateur') {
        console.log(chalk.yellow('\n⏹️  Arrêt demandé.\n'));
      } else {
        throw error;
      }
    }
  }
}

module.exports = { ApertoOrchestrator };

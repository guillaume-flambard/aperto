const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class LaravelAdapter {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async detectStructure() {
    const structure = {
      routes: [],
      controllers: [],
      models: [],
      views: [],
      tests: [],
      scopes: [],
      hasPassport: false,
      hasSanctum: false,
      hasInertia: false,
      hasLivewire: false
    };

    // Check for auth packages
    const composerPath = path.join(this.projectPath, 'composer.json');
    if (await fs.pathExists(composerPath)) {
      const composer = await fs.readJson(composerPath);
      structure.hasPassport = !!composer.require?.['laravel/passport'];
      structure.hasSanctum = !!composer.require?.['laravel/sanctum'];
      structure.hasInertia = !!composer.require?.['inertiajs/inertia-laravel'];
      structure.hasLivewire = !!composer.require?.['livewire/livewire'];
    }

    // Detect routes
    await this.detectRoutes(structure);

    // Detect controllers
    await this.detectControllers(structure);

    // Detect models
    await this.detectModels(structure);

    // Detect views
    await this.detectViews(structure);

    // Detect tests
    await this.detectTests(structure);

    // Detect scopes
    structure.scopes = this.detectScopes(structure);

    return structure;
  }

  async detectRoutes(structure) {
    const routesPath = path.join(this.projectPath, 'routes');
    if (!await fs.pathExists(routesPath)) return;

    const routeFiles = await globby('routes/*.php', { cwd: this.projectPath });

    for (const file of routeFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.php');

      // Parse different route patterns
      const patterns = [
        // Route::get('/path', [Controller::class, 'method'])
        /Route::([a-z]+)\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[\s*([^\]]+)\s*\]/g,
        // Route::view('/path', 'view.name')
        /Route::view\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/g,
        // Route::resource('name', Controller::class)
        /Route::resource\s*\(\s*['"]([^'"]+)['"]\s*,\s*([^\)]+)\)/g
      ];

      let match;
      while ((match = patterns[0].exec(content)) !== null) {
        structure.routes.push({
          file: fileName,
          method: match[1],
          path: match[2],
          controller: this.extractController(match[3]),
          type: this.getRouteType(fileName, match[2])
        });
      }
    }
  }

  extractController(controllerStr) {
    const match = controllerStr.match(/([A-Za-z]+Controller)/);
    return match ? match[1] : 'Unknown';
  }

  getRouteType(fileName, path) {
    if (fileName === 'api' || path.startsWith('api/')) return 'api';
    if (fileName === 'admin' || path.startsWith('admin/')) return 'admin';
    if (path.startsWith('auth/') || path.includes('login') || path.includes('register')) return 'auth';
    return 'public';
  }

  async detectControllers(structure) {
    const controllerFiles = await globby(['app/Http/Controllers/**/*.php'], {
      cwd: this.projectPath
    });

    for (const file of controllerFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const controllerName = path.basename(file, '.php');

      // Extract methods
      const methodMatches = content.match(/public function (?!__construct)(\w+)/g) || [];
      const methods = methodMatches.map(m => m.replace('public function ', ''));

      structure.controllers.push({
        name: controllerName,
        path: file,
        methods,
        isResource: methods.includes('index') && methods.includes('store')
      });
    }
  }

  async detectModels(structure) {
    const modelFiles = await globby(['app/Models/**/*.php', 'app/*.php'], {
      cwd: this.projectPath
    });

    for (const file of modelFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      if (content.includes('extends Model')) {
        const modelName = path.basename(file, '.php');
        
        // Check for relationships
        const hasRelations = content.match(/public function \w+\(\)\s*\{\s*return \$this->(hasMany|belongsTo|hasOne|belongsToMany)/);
        
        structure.models.push({
          name: modelName,
          path: file,
          hasRelations: !!hasRelations
        });
      }
    }
  }

  async detectViews(structure) {
    const viewPaths = [
      'resources/views/**/*.blade.php',
      'resources/views/**/*.php'
    ];

    const viewFiles = await globby(viewPaths, { cwd: this.projectPath });

    for (const file of viewFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      
      // Detect view type
      let type = 'blade';
      if (structure.hasInertia && content.includes('@inertia')) {
        type = 'inertia';
      } else if (structure.hasLivewire && content.includes('@livewire')) {
        type = 'livewire';
      }

      structure.views.push({
        path: file,
        type,
        hasLayout: content.includes('@extends') || content.includes('extends') || content.includes('layout')
      });
    }
  }

  async detectTests(structure) {
    const testPaths = [
      'tests/Feature/**/*.php',
      'tests/Unit/**/*.php',
      'tests/Browser/**/*.php'
    ];

    const testFiles = await globby(testPaths, { cwd: this.projectPath });

    for (const file of testFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const testMethods = content.match(/public function test_\w+|public function \w+_test|function\s*\(\s*\)/g) || [];
      
      structure.tests.push({
        path: file,
        type: file.includes('Feature') ? 'feature' : file.includes('Browser') ? 'dusk' : 'unit',
        count: testMethods.length
      });
    }
  }

  detectScopes(structure) {
    const scopes = [];

    // Group routes by type
    const adminRoutes = structure.routes.filter(r => r.type === 'admin');
    const apiRoutes = structure.routes.filter(r => r.type === 'api');
    const authRoutes = structure.routes.filter(r => r.type === 'auth');
    const publicRoutes = structure.routes.filter(r => r.type === 'public');

    // Create scope objects
    if (adminRoutes.length > 0) {
      scopes.push({
        name: 'admin',
        type: 'admin',
        routes: adminRoutes.length,
        controllers: this.countUniqueControllers(adminRoutes),
        priority: 95,
        risk: 'high'
      });
    }

    if (apiRoutes.length > 0) {
      scopes.push({
        name: 'api',
        type: 'api',
        routes: apiRoutes.length,
        controllers: this.countUniqueControllers(apiRoutes),
        priority: 80,
        risk: 'medium'
      });
    }

    if (authRoutes.length > 0) {
      scopes.push({
        name: 'auth',
        type: 'auth',
        routes: authRoutes.length,
        controllers: this.countUniqueControllers(authRoutes),
        priority: 85,
        risk: 'high'
      });
    }

    if (publicRoutes.length > 0) {
      scopes.push({
        name: 'public',
        type: 'public',
        routes: publicRoutes.length,
        controllers: this.countUniqueControllers(publicRoutes),
        priority: 60,
        risk: 'low'
      });
    }

    return scopes.sort((a, b) => b.priority - a.priority);
  }

  countUniqueControllers(routes) {
    const controllers = new Set(routes.map(r => r.controller));
    return controllers.size;
  }

  // Test generation for Laravel
  async generateTestsForScope(scope, options = {}) {
    const tests = [];
    const routesInScope = this.structure.routes.filter(r => r.type === scope.name);

    for (const route of routesInScope) {
      const testCases = this.generateTestCasesForRoute(route);
      tests.push(...testCases);
    }

    return tests;
  }

  generateTestCasesForRoute(route) {
    const tests = [];
    const baseName = `${route.type}_${route.controller}_${route.method}`;

    // Basic access test
    tests.push({
      name: `test_${baseName}_is_accessible`,
      description: `Verify ${route.path} is accessible`,
      method: route.method,
      path: route.path,
      assertions: ['assertStatus(200)'],
      needsAuth: route.type === 'admin' || route.type === 'auth'
    });

    // Method-specific tests
    switch (route.method.toLowerCase()) {
      case 'post':
        tests.push({
          name: `test_${baseName}_validates_input`,
          description: `Verify ${route.path} validates input`,
          method: 'post',
          path: route.path,
          assertions: ['assertSessionHasErrors'],
          needsAuth: true
        });
        break;
      case 'delete':
        tests.push({
          name: `test_${baseName}_deletes_resource`,
          description: `Verify ${route.path} deletes resource`,
          method: 'delete',
          path: route.path,
          assertions: ['assertDeleted'],
          needsAuth: true
        });
        break;
    }

    // Auth tests for protected routes
    if (route.type === 'admin' || route.type === 'auth') {
      tests.push({
        name: `test_${baseName}_requires_authentication`,
        description: `Verify ${route.path} requires authentication`,
        method: route.method,
        path: route.path,
        assertions: ['assertRedirect(route("login"))'],
        needsAuth: false,
        guest: true
      });
    }

    return tests;
  }

  // Generate test file content
  generateTestFile(testCases, scope) {
    const imports = `<?php

namespace Tests\\Feature;

use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Illuminate\\Foundation\\Testing\\WithFaker;
use Tests\\TestCase;
use App\\Models\\User;
`;

    const classDeclaration = `
class ${this.toPascalCase(scope)}Test extends TestCase
{
    use RefreshDatabase;

`;

    const methods = testCases.map(test => {
      return `    /**
     * ${test.description}
     */
    public function ${test.name}()
    {
        ${test.guest ? '' : '$user = User::factory()->create();'}
        
        $response = $this${test.guest ? '' : '->actingAs($user)'}->${test.method}('${test.path}');
        
        ${test.assertions.map(a => `$response->${a};`).join('\n        ')}
    }

`;
    }).join('');

    return imports + classDeclaration + methods + '}';
  }

  toPascalCase(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
  }
}

module.exports = { LaravelAdapter };

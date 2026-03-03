const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class BaseAdapter {
  constructor(projectPath, stack) {
    this.projectPath = projectPath;
    this.stack = stack;
  }

  async detectStructure() {
    const structure = {
      routes: [],
      views: [],
      controllers: [],
      tests: [],
      scopes: [],
      files: 0
    };

    // Generic file detection
    structure.files = await this.countFiles();
    
    // Detect source files
    await this.detectSourceFiles(structure);
    
    // Detect tests
    await this.detectTests(structure);
    
    // Detect scopes based on file organization
    structure.scopes = this.detectScopes(structure);

    return structure;
  }

  async countFiles() {
    try {
      const files = await globby(['**/*', '!**/node_modules/**', '!**/vendor/**', 
        '!**/.git/**', '!**/dist/**', '!**/build/**'], {
        cwd: this.projectPath,
        onlyFiles: true
      });
      return files.length;
    } catch (e) {
      return 0;
    }
  }

  async detectSourceFiles(structure) {
    // Detect based on common patterns
    const extensions = this.getSourceExtensions();
    
    for (const ext of extensions) {
      const files = await globby(`**/*.${ext}`, { cwd: this.projectPath });
      
      for (const file of files) {
        const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
        const scope = this.detectFileScope(file);
        
        structure.views.push({
          path: file,
          type: ext,
          scope,
          hasTests: false
        });
      }
    }
  }

  getSourceExtensions() {
    const stackExtensions = {
      'nodejs': ['js', 'ts', 'jsx', 'tsx'],
      'express': ['js', 'ts'],
      'fastify': ['js', 'ts'],
      'nestjs': ['ts'],
      'php': ['php'],
      'python': ['py'],
      'go': ['go'],
      'rust': ['rs'],
      'scala-play': ['scala'],
      'generic': ['js', 'ts', 'php', 'py']
    };

    return stackExtensions[this.stack.name] || stackExtensions['generic'];
  }

  detectFileScope(filePath) {
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('admin')) return 'admin';
    if (normalizedPath.includes('auth') || normalizedPath.includes('login')) return 'auth';
    if (normalizedPath.includes('api')) return 'api';
    if (normalizedPath.includes('test') || normalizedPath.includes('spec')) return 'test';
    return 'main';
  }

  async detectTests(structure) {
    const patterns = [
      '**/*.test.*',
      '**/*.spec.*',
      '**/test/**/*',
      '**/tests/**/*'
    ];

    const testFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of testFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      
      // Try to count test functions based on language
      const testCount = this.countTestFunctions(content);

      structure.tests.push({
        path: file,
        type: 'unit',
        count: testCount
      });

      // Mark related views as having tests
      const relatedView = this.findRelatedView(file, structure);
      if (relatedView) {
        relatedView.hasTests = true;
      }
    }
  }

  countTestFunctions(content) {
    // Generic test patterns
    const patterns = [
      /function\s+test\w+/g,
      /it\s*\(/g,
      /test\s*\(/g,
      /def\s+test_/g,  // Python
      /func\s+Test\w+/g  // Go
    ];

    let count = 0;
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    });

    return count;
  }

  findRelatedView(testFile, structure) {
    const testName = path.basename(testFile, path.extname(testFile))
      .replace('.test', '')
      .replace('.spec', '');
    
    return structure.views.find(view => 
      view.path.includes(testName) || 
      testFile.includes(path.basename(view.path, path.extname(view.path)))
    );
  }

  detectScopes(structure) {
    const scopes = [];

    // Group by scope
    const scopeGroups = {};
    structure.views.forEach(view => {
      if (!scopeGroups[view.scope]) {
        scopeGroups[view.scope] = [];
      }
      scopeGroups[view.scope].push(view);
    });

    // Create scope objects
    Object.entries(scopeGroups).forEach(([name, views]) => {
      const untestedViews = views.filter(v => !v.hasTests);
      const priority = this.calculateScopePriority(name, views, untestedViews);

      scopes.push({
        name,
        type: name,
        views: views.length,
        tested: views.length - untestedViews.length,
        untested: untestedViews.length,
        priority,
        risk: this.calculateRisk(name, untestedViews.length, views.length)
      });
    });

    return scopes.sort((a, b) => b.priority - a.priority);
  }

  calculateScopePriority(name, allViews, untestedViews) {
    const basePriority = {
      'admin': 95,
      'auth': 90,
      'api': 85,
      'main': 60
    };

    const base = basePriority[name] || 50;
    const coverage = allViews.length > 0 ? (untestedViews.length / allViews.length) : 0;
    
    return Math.round(base + (coverage * 10));
  }

  calculateRisk(scopeName, untested, total) {
    const coverage = total > 0 ? (untested / total) : 0;
    
    if (['admin', 'auth', 'api'].includes(scopeName) && coverage > 0.3) {
      return 'high';
    } else if (coverage > 0.5) {
      return 'medium';
    }
    return 'low';
  }

  // Default test generation
  async generateTestsForScope(scope, options = {}) {
    const tests = [];
    const viewsInScope = this.structure.views.filter(v => 
      v.scope === scope.name && !v.hasTests
    );

    for (const view of viewsInScope) {
      const testFile = this.generateTest(view, options);
      tests.push(testFile);
    }

    return tests;
  }

  generateTest(view, options) {
    const ext = path.extname(view.path);
    const baseName = path.basename(view.path, ext);
    const testFileName = `${baseName}.test${ext}`;

    return {
      name: testFileName,
      path: path.join('tests', testFileName),
      content: this.generateTestContent(view),
      view: view.path,
      scope: view.scope
    };
  }

  generateTestContent(view) {
    return `// Test file for ${view.path}
// Generated by Aperto

describe('${path.basename(view.path)}', () => {
  it('should exist', () => {
    // TODO: Add actual test implementation
    expect(true).toBe(true);
  });

  it('should function correctly', () => {
    // TODO: Add actual test implementation
    expect(true).toBe(true);
  });
});
`;
  }
}

module.exports = { BaseAdapter };

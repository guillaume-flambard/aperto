const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class VueAdapter {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async detectStructure() {
    const structure = {
      routes: [],
      pages: [],
      components: [],
      composables: [],
      stores: [],
      tests: [],
      scopes: [],
      framework: 'vue', // vue, nuxt
      hasTypeScript: false,
      hasRouter: false,
      hasPinia: false,
      hasVuex: false,
      testFramework: 'vitest' // vitest, jest, cypress, playwright
    };

    // Check package.json for framework details
    const pkgPath = path.join(this.projectPath, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJson(pkgPath);
      
      if (pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt) {
        structure.framework = 'nuxt';
      }
      
      structure.hasTypeScript = !!(pkg.devDependencies?.typescript || pkg.dependencies?.typescript);
      structure.hasRouter = !!(pkg.dependencies?.['vue-router'] || structure.framework === 'nuxt');
      structure.hasPinia = !!pkg.dependencies?.pinia;
      structure.hasVuex = !!pkg.dependencies?.vuex;
      
      // Detect test framework
      if (pkg.devDependencies?.jest) {
        structure.testFramework = 'jest';
      } else if (pkg.devDependencies?.cypress) {
        structure.testFramework = 'cypress';
      } else if (pkg.devDependencies?.['@playwright/test']) {
        structure.testFramework = 'playwright';
      }
    }

    // Detect pages
    await this.detectPages(structure);

    // Detect components
    await this.detectComponents(structure);

    // Detect composables (Vue 3) or mixins (Vue 2)
    await this.detectComposables(structure);

    // Detect stores
    await this.detectStores(structure);

    // Detect existing tests
    await this.detectTests(structure);

    // Detect scopes
    structure.scopes = this.detectScopes(structure);

    return structure;
  }

  async detectPages(structure) {
    const patterns = structure.framework === 'nuxt'
      ? ['pages/**/*.vue', 'app/pages/**/*.vue']
      : ['src/views/**/*.vue', 'src/pages/**/*.vue', 'views/**/*.vue'];

    const pageFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of pageFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.vue');

      // Detect scope based on path
      const scope = this.detectPageScope(file);

      // Check for async data fetching
      const hasDataFetching = content.includes('asyncData') || 
                             content.includes('fetch(') ||
                             content.includes('useFetch') ||
                             content.includes('onMounted');

      // Check for auth requirements
      const requiresAuth = content.includes('middleware') || 
                          content.includes('auth') ||
                          content.includes('requiresAuth');

      structure.pages.push({
        path: file,
        name: fileName,
        hasDataFetching,
        requiresAuth,
        scope,
        hasTests: false
      });

      structure.routes.push({
        path: file,
        type: scope,
        page: fileName
      });
    }
  }

  detectPageScope(filePath) {
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('admin')) return 'admin';
    if (normalizedPath.includes('auth') || normalizedPath.includes('login')) return 'auth';
    if (normalizedPath.includes('dashboard')) return 'dashboard';
    if (normalizedPath.includes('profile') || normalizedPath.includes('user')) return 'user';
    return 'public';
  }

  async detectComponents(structure) {
    const patterns = [
      'src/components/**/*.vue',
      'components/**/*.vue'
    ];

    const componentFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of componentFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.vue');

      // Detect component features
      const hasProps = content.includes('defineProps') || content.includes('props:');
      const hasEmits = content.includes('defineEmits') || content.includes('emits:');
      const usesSetup = content.includes('<script setup>') || content.includes('setup()');
      const usesComposition = content.includes('ref(') || content.includes('reactive(');

      structure.components.push({
        path: file,
        name: fileName,
        hasProps,
        hasEmits,
        usesSetup,
        usesComposition,
        scope: this.detectPageScope(file)
      });
    }
  }

  async detectComposables(structure) {
    const patterns = [
      'src/composables/**/*.{js,ts}',
      'composables/**/*.{js,ts}'
    ];

    const composableFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of composableFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, path.extname(file));

      // Verify it's a composable
      if (!fileName.startsWith('use')) continue;

      structure.composables.push({
        path: file,
        name: fileName,
        returns: this.extractComposableReturns(content)
      });
    }
  }

  extractComposableReturns(content) {
    const returns = [];
    const returnMatch = content.match(/return\s*\{([^}]+)\}/);
    if (returnMatch) {
      const returnObj = returnMatch[1];
      const properties = returnObj.match(/(\w+):/g) || [];
      properties.forEach(prop => {
        returns.push(prop.replace(':', ''));
      });
    }
    return returns;
  }

  async detectStores(structure) {
    const patterns = structure.hasPinia
      ? ['src/stores/**/*.{js,ts}', 'stores/**/*.{js,ts}']
      : ['src/store/**/*.{js,ts}', 'store/**/*.{js,ts}'];

    const storeFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of storeFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, path.extname(file));

      structure.stores.push({
        path: file,
        name: fileName,
        type: structure.hasPinia ? 'pinia' : 'vuex'
      });
    }
  }

  async detectTests(structure) {
    const patterns = [
      '**/__tests__/**/*.{test,spec}.{js,ts}',
      '**/*.{test,spec}.{js,ts}',
      'cypress/e2e/**/*.{js,ts}',
      'tests/**/*.{test,spec}.{js,ts}'
    ];

    const testFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of testFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const testCount = (content.match(/it\s*\(|test\s*\(|describe\s*\(/g) || []).length;

      structure.tests.push({
        path: file,
        type: file.includes('e2e') || file.includes('cypress') ? 'e2e' : 'unit',
        count: testCount
      });

      // Mark pages that have tests
      const relatedPage = this.findRelatedPage(file, structure);
      if (relatedPage) {
        relatedPage.hasTests = true;
      }
    }
  }

  findRelatedPage(testFile, structure) {
    const testName = path.basename(testFile, path.extname(testFile))
      .replace('.test', '')
      .replace('.spec', '');
    
    return structure.pages.find(page => 
      page.name === testName || 
      testFile.includes(page.name)
    );
  }

  detectScopes(structure) {
    const scopes = [];

    // Group by scope
    const scopeGroups = {};
    structure.pages.forEach(page => {
      if (!scopeGroups[page.scope]) {
        scopeGroups[page.scope] = [];
      }
      scopeGroups[page.scope].push(page);
    });

    // Create scope objects
    Object.entries(scopeGroups).forEach(([name, pages]) => {
      const untestedPages = pages.filter(p => !p.hasTests);
      const priority = this.calculateScopePriority(name, pages, untestedPages);

      scopes.push({
        name,
        type: name,
        pages: pages.length,
        tested: pages.length - untestedPages.length,
        untested: untestedPages.length,
        priority,
        risk: this.calculateRisk(name, untestedPages.length, pages.length)
      });
    });

    return scopes.sort((a, b) => b.priority - a.priority);
  }

  calculateScopePriority(name, allPages, untestedPages) {
    const basePriority = {
      'admin': 95,
      'auth': 90,
      'dashboard': 85,
      'user': 70,
      'public': 50
    };

    const base = basePriority[name] || 50;
    const coverage = allPages.length > 0 ? (untestedPages.length / allPages.length) : 0;
    
    return Math.round(base + (coverage * 10));
  }

  calculateRisk(scopeName, untested, total) {
    const coverage = total > 0 ? (untested / total) : 0;
    
    if (['admin', 'auth'].includes(scopeName) && coverage > 0.3) {
      return 'high';
    } else if (coverage > 0.5) {
      return 'medium';
    }
    return 'low';
  }

  // Test generation for Vue
  async generateTestsForScope(scope, options = {}) {
    const tests = [];
    const pagesInScope = this.structure.pages.filter(p => p.scope === scope.name && !p.hasTests);

    for (const page of pagesInScope) {
      const testFile = this.generatePageTest(page, options);
      tests.push(testFile);
    }

    return tests;
  }

  generatePageTest(page, options) {
    const ext = this.structure.hasTypeScript ? 'ts' : 'js';
    const testExt = '.spec.';
    const fileName = `${page.name}${testExt}${ext}`;

    let content;
    if (this.structure.testFramework === 'cypress') {
      content = this.generateCypressTest(page);
    } else if (this.structure.testFramework === 'playwright') {
      content = this.generatePlaywrightTest(page);
    } else {
      content = this.generateVitestTest(page);
    }

    return {
      name: fileName,
      path: path.join(page.path, '..', fileName),
      content,
      page: page.name,
      scope: page.scope
    };
  }

  generateVitestTest(page) {
    const imports = `import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ${page.name} from './${page.name}.vue';`;

    return `${imports}

describe('${page.name}', () => {
  it('renders correctly', () => {
    const wrapper = mount(${page.name});
    expect(wrapper.exists()).toBe(true);
  });

  ${page.hasDataFetching ? `
  it('fetches data on mount', async () => {
    const wrapper = mount(${page.name});
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false);
  });
  ` : ''}

  ${page.requiresAuth ? `
  it('requires authentication', () => {
    const wrapper = mount(${page.name});
    expect(wrapper.find('[data-testid="login-required"]').exists()).toBe(true);
  });
  ` : ''}
});
`;
  }

  generateCypressTest(page) {
    return `describe('${page.name} Page', () => {
  it('loads successfully', () => {
    cy.visit('/${page.name.toLowerCase()}');
    cy.get('[data-testid="page-container"]').should('exist');
  });

  ${page.requiresAuth ? `
  it('redirects to login when not authenticated', () => {
    cy.visit('/${page.name.toLowerCase()}');
    cy.url().should('include', '/login');
  });
  ` : ''}
});
`;
  }

  generatePlaywrightTest(page) {
    return `import { test, expect } from '@playwright/test';

test('${page.name} page loads', async ({ page }) => {
  await page.goto('/${page.name.toLowerCase()}');
  await expect(page.getByTestId('page-container')).toBeVisible();
});

${page.requiresAuth ? `
test('requires authentication', async ({ page }) => {
  await page.goto('/${page.name.toLowerCase()}');
  await expect(page).toHaveURL(/login/);
});
` : ''}
`;
  }
}

module.exports = { VueAdapter };

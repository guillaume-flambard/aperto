const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class ReactAdapter {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async detectStructure() {
    const structure = {
      routes: [],
      pages: [],
      components: [],
      hooks: [],
      tests: [],
      scopes: [],
      framework: 'react', // react, nextjs, remix
      hasTypeScript: false,
      hasRouter: false,
      testFramework: 'jest' // jest, vitest, cypress, playwright
    };

    // Check package.json for framework details
    const pkgPath = path.join(this.projectPath, 'package.json');
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJson(pkgPath);
      
      if (pkg.dependencies?.next) {
        structure.framework = 'nextjs';
      }
      
      structure.hasTypeScript = !!(pkg.devDependencies?.typescript || pkg.dependencies?.typescript);
      structure.hasRouter = !!(pkg.dependencies?.['react-router-dom'] || pkg.dependencies?.next);
      
      // Detect test framework
      if (pkg.devDependencies?.vitest) {
        structure.testFramework = 'vitest';
      } else if (pkg.devDependencies?.cypress) {
        structure.testFramework = 'cypress';
      } else if (pkg.devDependencies?.['@playwright/test']) {
        structure.testFramework = 'playwright';
      }
    }

    // Detect pages/routes
    await this.detectPages(structure);

    // Detect components
    await this.detectComponents(structure);

    // Detect hooks
    await this.detectHooks(structure);

    // Detect existing tests
    await this.detectTests(structure);

    // Detect scopes
    structure.scopes = this.detectScopes(structure);

    return structure;
  }

  async detectPages(structure) {
    const patterns = structure.framework === 'nextjs' 
      ? ['src/app/**/*.{js,jsx,ts,tsx}', 'app/**/*.{js,jsx,ts,tsx}', 'src/pages/**/*.{js,jsx,ts,tsx}', 'pages/**/*.{js,jsx,ts,tsx}']
      : ['src/pages/**/*.{js,jsx,ts,tsx}', 'src/screens/**/*.{js,jsx,ts,tsx}', 'pages/**/*.{js,jsx,ts,tsx}'];

    const pageFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of pageFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, path.extname(file));
      
      // Skip layout and loading files
      if (['layout', 'loading', 'error', 'not-found', 'template'].includes(fileName)) {
        continue;
      }

      // Detect if it's an API route (Next.js)
      const isApiRoute = file.includes('/api/') || file.includes('\\api\\');

      // Detect if page uses data fetching
      const hasDataFetching = content.includes('getStaticProps') || 
                             content.includes('getServerSideProps') ||
                             content.includes('fetch(') ||
                             content.includes('useEffect');

      // Detect scope based on path
      const scope = this.detectPageScope(file);

      structure.pages.push({
        path: file,
        name: fileName,
        isApiRoute,
        hasDataFetching,
        scope,
        hasTests: false // Will be updated later
      });

      if (!isApiRoute) {
        structure.routes.push({
          path: file,
          type: scope,
          page: fileName
        });
      }
    }
  }

  detectPageScope(filePath) {
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('admin')) return 'admin';
    if (normalizedPath.includes('auth') || normalizedPath.includes('login') || normalizedPath.includes('register')) return 'auth';
    if (normalizedPath.includes('api')) return 'api';
    if (normalizedPath.includes('dashboard')) return 'dashboard';
    if (normalizedPath.includes('profile') || normalizedPath.includes('user')) return 'user';
    return 'public';
  }

  async detectComponents(structure) {
    const patterns = [
      'src/components/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}'
    ];

    const componentFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of componentFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, path.extname(file));

      // Detect component type
      let type = 'functional';
      if (content.includes('class ')) {
        type = 'class';
      } else if (content.includes('React.forwardRef')) {
        type = 'forwardRef';
      }

      // Check for props
      const hasProps = content.includes('props') || content.match(/\{\s*\w+\s*\}/);

      // Check for state
      const hasState = content.includes('useState') || content.includes('this.state');

      structure.components.push({
        path: file,
        name: fileName,
        type,
        hasProps,
        hasState,
        scope: this.detectPageScope(file)
      });
    }
  }

  async detectHooks(structure) {
    const patterns = [
      'src/hooks/**/*.{js,ts}',
      'hooks/**/*.{js,ts}'
    ];

    const hookFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of hookFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, path.extname(file));

      // Verify it's actually a hook (starts with 'use')
      if (!fileName.startsWith('use')) continue;

      structure.hooks.push({
        path: file,
        name: fileName,
        dependencies: this.extractHookDependencies(content)
      });
    }
  }

  extractHookDependencies(content) {
    const deps = [];
    const patterns = [
      /useState\s*\(/g,
      /useEffect\s*\(/g,
      /useContext\s*\(/g,
      /useCallback\s*\(/g,
      /useMemo\s*\(/g,
      /useRef\s*\(/g
    ];

    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        deps.push(pattern.toString().match(/use\w+/)?.[0] || 'hook');
      }
    });

    return [...new Set(deps)];
  }

  async detectTests(structure) {
    const patterns = [
      '**/__tests__/**/*.{test,spec}.{js,jsx,ts,tsx}',
      '**/*.{test,spec}.{js,jsx,ts,tsx}',
      'cypress/e2e/**/*.{js,ts}',
      'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'
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
      'api': 85,
      'dashboard': 80,
      'user': 70,
      'public': 50
    };

    const base = basePriority[name] || 50;
    const coverage = allPages.length > 0 ? (untestedPages.length / allPages.length) : 0;
    
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

  // Test generation for React
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
    const ext = this.structure.hasTypeScript ? 'tsx' : 'jsx';
    const testExt = this.structure.testFramework === 'vitest' ? '.test.' : '.spec.';
    const fileName = `${page.name}${testExt}${ext}`;

    let content;
    if (this.structure.testFramework === 'cypress') {
      content = this.generateCypressTest(page);
    } else if (this.structure.testFramework === 'playwright') {
      content = this.generatePlaywrightTest(page);
    } else {
      content = this.generateJestVitestTest(page);
    }

    return {
      name: fileName,
      path: path.join(page.path, '..', fileName),
      content,
      page: page.name,
      scope: page.scope
    };
  }

  generateJestVitestTest(page) {
    const imports = this.structure.testFramework === 'vitest' 
      ? `import { describe, it, expect } from 'vitest';`
      : `import { render, screen } from '@testing-library/react';`;

    return `${imports}
import { render, screen } from '@testing-library/react';
import ${page.name} from './${page.name}';

describe('${page.name}', () => {
  it('renders correctly', () => {
    render(<${page.name} />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  ${page.hasDataFetching ? `
  it('fetches and displays data', async () => {
    render(<${page.name} />);
    // Add data fetching test
    expect(await screen.findByTestId('data-loaded')).toBeInTheDocument();
  });
  ` : ''}

  ${page.scope === 'admin' || page.scope === 'auth' ? `
  it('requires authentication', () => {
    // Add auth check test
    render(<${page.name} />);
    expect(screen.getByText(/login|sign in/i)).toBeInTheDocument();
  });
  ` : ''}
});
`;
  }

  generateCypressTest(page) {
    return `describe('${page.name} Page', () => {
  it('loads successfully', () => {
    cy.visit('/${page.name.toLowerCase()}');
    cy.get('[data-testid="main"]').should('exist');
  });

  ${page.scope === 'admin' || page.scope === 'auth' ? `
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
  await expect(page.getByTestId('main')).toBeVisible();
});

${page.scope === 'admin' || page.scope === 'auth' ? `
test('requires authentication', async ({ page }) => {
  await page.goto('/${page.name.toLowerCase()}');
  await expect(page).toHaveURL(/login/);
});
` : ''}
`;
  }
}

module.exports = { ReactAdapter };

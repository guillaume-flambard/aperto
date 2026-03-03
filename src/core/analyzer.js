const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

async function analyzeProject(projectPath, stack) {
  const analysis = {
    stack,
    timestamp: new Date().toISOString(),
    files: await countFiles(projectPath),
    scopes: [],
    routes: [],
    views: [],
    tests: [],
    summary: {}
  };

  // Analyze based on stack
  switch (stack.name) {
    case 'laravel':
      await analyzeLaravel(projectPath, analysis);
      break;
    case 'react-native':
    case 'flutter':
      await analyzeMobile(projectPath, stack.name, analysis);
      break;
    case 'nextjs':
    case 'nuxt':
      await analyzeFullstack(projectPath, stack.name, analysis);
      break;
    case 'fastify':
    case 'express':
    case 'nestjs':
      await analyzeApi(projectPath, stack.name, analysis);
      break;
    default:
      await analyzeGeneric(projectPath, analysis);
  }

  // Calculate metrics
  analysis.summary = calculateSummary(analysis);

  return analysis;
}

async function countFiles(projectPath) {
  const files = await globby(['**/*', '!**/node_modules/**', '!**/vendor/**', 
    '!**/.git/**', '!**/dist/**', '!**/build/**', '!**/.aperto/**'], {
    cwd: projectPath,
    onlyFiles: true
  });
  return files.length;
}

async function analyzeLaravel(projectPath, analysis) {
  // Routes
  if (await fs.pathExists(path.join(projectPath, 'routes'))) {
    const routeFiles = await globby('routes/*.php', { cwd: projectPath });
    for (const file of routeFiles) {
      const content = await fs.readFile(path.join(projectPath, file), 'utf8');
      const routes = content.match(/Route::[a-z]+\s*\(/g) || [];
      analysis.routes.push(...routes.map(() => ({
        file: path.basename(file),
        count: routes.length
      })));
    }
  }

  // Views
  if (await fs.pathExists(path.join(projectPath, 'resources/views'))) {
    const views = await globby('resources/views/**/*.blade.php', { cwd: projectPath });
    analysis.views = views.map(v => ({ path: v, type: 'blade' }));
  }

  // Tests
  if (await fs.pathExists(path.join(projectPath, 'tests'))) {
    const tests = await globby('tests/**/*.php', { cwd: projectPath });
    analysis.tests = tests.map(t => ({ path: t, type: 'phpunit' }));
  }

  // Detect scopes
  analysis.scopes = detectScopesLaravel(analysis);
}

async function analyzeMobile(projectPath, type, analysis) {
  if (type === 'react-native') {
    // Screens
    const screens = await globby(['src/screens/**/*.{js,jsx,ts,tsx}', 
      'app/**/*.{js,jsx,ts,tsx}', 'screens/**/*.{js,jsx,ts,tsx}'], { 
      cwd: projectPath 
    });
    analysis.views = screens.map(s => ({ path: s, type: 'screen' }));

    // Navigation
    const nav = await globby(['src/navigation/**/*.{js,jsx,ts,tsx}', 
      'navigation/**/*.{js,jsx,ts,tsx}'], { cwd: projectPath });
    analysis.routes = nav.map(n => ({ path: n, type: 'navigation' }));
  } else if (type === 'flutter') {
    // Dart files
    const files = await globby('lib/**/*.dart', { cwd: projectPath });
    const screens = files.filter(f => f.includes('screen') || f.includes('page') || f.includes('view'));
    analysis.views = screens.map(s => ({ path: s, type: 'screen' }));
  }

  analysis.scopes = [
    { name: 'screens', type: 'view', count: analysis.views.length },
    { name: 'api', type: 'data', count: 0 }
  ];
}

async function analyzeFullstack(projectPath, type, analysis) {
  if (type === 'nextjs') {
    // Pages
    const pages = await globby(['src/app/**/*.{js,jsx,ts,tsx}', 
      'app/**/*.{js,jsx,ts,tsx}', 'pages/**/*.{js,jsx,ts,tsx}'], { 
      cwd: projectPath 
    });
    analysis.views = pages.map(p => ({ path: p, type: 'page' }));

    // API routes
    const apiRoutes = await globby(['src/app/api/**/*.{js,ts}', 
      'app/api/**/*.{js,ts}', 'pages/api/**/*.{js,ts}'], { cwd: projectPath });
    analysis.routes = apiRoutes.map(r => ({ path: r, type: 'api' }));
  }

  analysis.scopes = detectScopesFullstack(analysis);
}

async function analyzeApi(projectPath, type, analysis) {
  const routePattern = type === 'nestjs' ? 'src/**/*controller.{ts,js}' : 
                       'src/routes/**/*.{ts,js}';
  
  const routes = await globby([routePattern, 'routes/**/*.{ts,js}'], { 
    cwd: projectPath 
  });
  
  analysis.routes = routes.map(r => ({ path: r, type: 'endpoint' }));
  analysis.scopes = [{ name: 'api', type: 'api', count: routes.length }];
}

async function analyzeGeneric(projectPath, analysis) {
  // Generic analysis
  const htmlFiles = await globby('**/*.html', { cwd: projectPath });
  const jsFiles = await globby('**/*.{js,ts}', { cwd: projectPath });
  
  analysis.views = htmlFiles.map(h => ({ path: h, type: 'html' }));
  analysis.routes = [];
  analysis.scopes = [{ name: 'main', type: 'generic', count: htmlFiles.length }];
}

function detectScopesLaravel(analysis) {
  const scopes = [];
  
  // Check for admin routes
  const adminRoutes = analysis.routes.filter(r => 
    r.file?.includes('admin') || JSON.stringify(r).includes('admin')
  );
  if (adminRoutes.length > 0) {
    scopes.push({
      name: 'admin',
      type: 'admin',
      routes: adminRoutes.length,
      priority: 95,
      completion: calculateCompletion(adminRoutes.length, analysis.tests.length)
    });
  }
  
  // Check for API routes
  const apiRoutes = analysis.routes.filter(r => 
    r.file?.includes('api') || JSON.stringify(r).includes('api')
  );
  if (apiRoutes.length > 0) {
    scopes.push({
      name: 'api',
      type: 'api',
      routes: apiRoutes.length,
      priority: 70,
      completion: calculateCompletion(apiRoutes.length, analysis.tests.length)
    });
  }
  
  // Public routes
  const publicRoutes = analysis.routes.length - adminRoutes.length - apiRoutes.length;
  if (publicRoutes > 0) {
    scopes.push({
      name: 'public',
      type: 'public',
      routes: publicRoutes,
      priority: 60,
      completion: calculateCompletion(publicRoutes, analysis.tests.length)
    });
  }
  
  return scopes.sort((a, b) => b.priority - a.priority);
}

function detectScopesFullstack(analysis) {
  const scopes = [];
  
  // Group by path patterns
  const adminViews = analysis.views.filter(v => v.path.includes('admin'));
  const authViews = analysis.views.filter(v => 
    v.path.includes('auth') || v.path.includes('login')
  );
  const publicViews = analysis.views.filter(v => 
    !v.path.includes('admin') && !v.path.includes('auth')
  );
  
  if (adminViews.length > 0) {
    scopes.push({ name: 'admin', type: 'admin', count: adminViews.length, priority: 90 });
  }
  if (authViews.length > 0) {
    scopes.push({ name: 'auth', type: 'auth', count: authViews.length, priority: 80 });
  }
  if (publicViews.length > 0) {
    scopes.push({ name: 'public', type: 'public', count: publicViews.length, priority: 50 });
  }
  
  return scopes;
}

function calculateCompletion(routes, tests) {
  if (routes === 0) return 100;
  return Math.min(100, Math.round((tests / routes) * 100));
}

function calculateSummary(analysis) {
  const totalRoutes = analysis.routes.reduce((acc, r) => acc + (r.count || 1), 0);
  const totalTests = analysis.tests.length;
  const totalViews = analysis.views.length;
  
  return {
    totalRoutes,
    totalTests,
    totalViews,
    coverage: totalRoutes > 0 ? Math.round((totalTests / totalRoutes) * 100) : 0,
    criticalScopes: analysis.scopes.filter(s => s.priority >= 70).length,
    incompleteScopes: analysis.scopes.filter(s => (s.completion || 0) < 50).length
  };
}

module.exports = { analyzeProject };

const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

async function detectStack(projectPath) {
  const indicators = [];
  let stack = 'generic';
  let version = null;

  // Priority: Backend frameworks first
  if (await fs.pathExists(path.join(projectPath, 'composer.json'))) {
    const composer = await fs.readJson(path.join(projectPath, 'composer.json'));
    if (composer.require?.['laravel/framework']) {
      stack = 'laravel';
      version = composer.require['laravel/framework'].replace(/^[^\d]*/, '').split('.')[0];
      indicators.push('Laravel');
    } else {
      stack = 'php';
      indicators.push('PHP');
    }
  } else if (await fs.pathExists(path.join(projectPath, 'build.sbt'))) {
    stack = 'scala-play';
    indicators.push('Scala/Play');
  } else if (await fs.pathExists(path.join(projectPath, 'Cargo.toml'))) {
    stack = 'rust';
    indicators.push('Rust');
  } else if (await fs.pathExists(path.join(projectPath, 'go.mod'))) {
    stack = 'go';
    indicators.push('Go');
  } else if (await fs.pathExists(path.join(projectPath, 'requirements.txt')) || 
             await fs.pathExists(path.join(projectPath, 'setup.py'))) {
    stack = 'python';
    indicators.push('Python');
  } else if (await fs.pathExists(path.join(projectPath, 'pubspec.yaml'))) {
    stack = 'flutter';
    indicators.push('Flutter');
  } else if (await fs.pathExists(path.join(projectPath, 'package.json'))) {
    const pkg = await fs.readJson(path.join(projectPath, 'package.json'));
    
    if (pkg.dependencies?.['react-native'] || 
        (await fs.pathExists(path.join(projectPath, 'android')) && 
         await fs.pathExists(path.join(projectPath, 'ios')))) {
      stack = 'react-native';
      indicators.push('React Native');
    } else if (pkg.dependencies?.['@nestjs/core']) {
      stack = 'nestjs';
      indicators.push('NestJS');
    } else if (pkg.dependencies?.fastify) {
      stack = 'fastify';
      indicators.push('Fastify');
    } else if (pkg.dependencies?.express) {
      stack = 'express';
      indicators.push('Express');
    } else if (pkg.dependencies?.next) {
      stack = 'nextjs';
      indicators.push('Next.js');
    } else if (pkg.dependencies?.vue || pkg.dependencies?.nuxt) {
      stack = pkg.dependencies?.nuxt ? 'nuxt' : 'vue';
      indicators.push(pkg.dependencies?.nuxt ? 'Nuxt.js' : 'Vue.js');
    } else if (pkg.dependencies?.svelte || pkg.dependencies?.['@sveltejs/kit']) {
      stack = 'svelte';
      indicators.push('Svelte');
    } else {
      stack = 'nodejs';
      indicators.push('Node.js');
    }
  }

  return {
    name: stack,
    version,
    indicators,
    isFullstack: ['laravel', 'nextjs', 'nuxt', 'svelte'].includes(stack)
  };
}

module.exports = { detectStack };

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

class ImplementationGenerator {
  constructor(projectPath, adapter, options = {}) {
    this.projectPath = projectPath;
    this.adapter = adapter;
    this.options = options;
    this.generatedFiles = [];
  }

  async generateImplementationsForScope(scope) {
    const spinner = ora(`Generating implementations for ${scope.name} scope...`).start();
    
    try {
      // Find routes that need implementations
      const missingImplementations = await this.findMissingImplementations(scope);
      
      if (!missingImplementations || missingImplementations.length === 0) {
        spinner.succeed(`No missing implementations found in ${scope.name}`);
        return [];
      }

      // Generate implementations
      const generatedFiles = [];
      
      for (const item of missingImplementations) {
        const filePath = await this.generateImplementation(item);
        if (filePath) {
          generatedFiles.push(filePath);
        }
      }

      this.generatedFiles.push(...generatedFiles);
      
      spinner.succeed(`Generated ${generatedFiles.length} implementation files`);
      
      return generatedFiles;
    } catch (error) {
      spinner.fail(`Failed to generate implementations: ${error.message}`);
      throw error;
    }
  }

  async findMissingImplementations(scope) {
    const missing = [];

    // Use adapter to find what's missing
    if (this.adapter.structure) {
      // Check for controllers without views
      if (this.adapter.structure.controllers) {
        for (const controller of this.adapter.structure.controllers) {
          const hasViews = this.adapter.structure.views.some(v => 
            v.path.toLowerCase().includes(controller.name.toLowerCase())
          );
          
          if (!hasViews) {
            missing.push({
              type: 'view',
              controller: controller.name,
              scope: scope.name,
              reason: 'Controller exists but no view found'
            });
          }
        }
      }

      // Check for routes without controllers (Laravel specific)
      if (this.adapter.structure.routes) {
        for (const route of this.adapter.structure.routes) {
          if (route.type === scope.name) {
            const hasController = this.adapter.structure.controllers.some(c => 
              c.name === route.controller
            );
            
            if (!hasController) {
              missing.push({
                type: 'controller',
                route: route,
                scope: scope.name,
                reason: 'Route defined but controller not found'
              });
            }
          }
        }
      }
    }

    return missing;
  }

  async generateImplementation(item) {
    switch (item.type) {
      case 'view':
        return this.generateView(item);
      case 'controller':
        return this.generateController(item);
      default:
        return null;
    }
  }

  async generateView(item) {
    // Laravel-specific view generation
    if (this.adapter.constructor.name === 'LaravelAdapter') {
      return this.generateLaravelView(item);
    }
    
    // React view generation
    if (this.adapter.constructor.name === 'ReactAdapter') {
      return this.generateReactView(item);
    }
    
    // Vue view generation
    if (this.adapter.constructor.name === 'VueAdapter') {
      return this.generateVueView(item);
    }

    return null;
  }

  async generateLaravelView(item) {
    const viewName = this.toSnakeCase(item.controller).replace('_controller', '');
    const viewPath = path.join('resources', 'views', item.scope, `${viewName}.blade.php`);
    const fullPath = path.join(this.projectPath, viewPath);

    // Check if exists
    const fileExists = await fs.pathExists(fullPath);
    if (fileExists && !this.options.overwrite) {
      if (this.options.dryRun) {
        console.log(chalk.cyan(`  [DRY RUN] Would skip (exists): ${viewPath}`));
      } else {
        console.log(chalk.gray(`  Skipping view (exists): ${viewPath}`));
      }
      return null;
    }

    if (this.options.dryRun) {
      console.log(chalk.cyan(`  [DRY RUN] Would create view: ${viewPath}`));
      return {
        path: viewPath,
        name: `${viewName}.blade.php`,
        type: 'view',
        scope: item.scope
      };
    }

    // Generate view content
    const content = `@extends('layouts.app')

@section('content')
<div class="container">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">{{ __('${this.toTitleCase(viewName)}') }}</div>

                <div class="card-body">
                    @if (session('status'))
                        <div class="alert alert-success" role="alert">
                            {{ session('status') }}
                        </div>
                    @endif

                    <!-- Content goes here -->
                    <p>${this.toTitleCase(viewName)} content�E/p>
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
`;

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');

    console.log(chalk.green(`  Creating view: ${viewPath}`));

    return {
      path: viewPath,
      name: `${viewName}.blade.php`,
      type: 'view',
      scope: item.scope
    };
  }

  async generateReactView(item) {
    const ext = this.adapter.structure.hasTypeScript ? 'tsx' : 'jsx';
    const pageName = item.controller.replace('Controller', 'Page');
    const pagePath = path.join('src', 'pages', item.scope, `${pageName}.${ext}`);
    const fullPath = path.join(this.projectPath, pagePath);

    if (await fs.pathExists(fullPath) && !this.options.overwrite) {
      console.log(chalk.gray(`  Skipping page (exists): ${pagePath}`));
      return null;
    }

    const content = this.adapter.structure.hasTypeScript 
      ? this.generateReactPageTS(pageName)
      : this.generateReactPageJS(pageName);

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');

    console.log(chalk.green(`  Creating page: ${pagePath}`));

    return {
      path: pagePath,
      name: `${pageName}.${ext}`,
      type: 'page',
      scope: item.scope
    };
  }

  generateReactPageJS(pageName) {
    return `import React from 'react';

const ${pageName} = () => {
  return (
    <div className="container">
      <h1>${pageName}</h1>
      <p>This is the ${pageName} component.</p>
    </div>
  );
};

export default ${pageName};
`;
  }

  generateReactPageTS(pageName) {
    return `import React from 'react';

interface ${pageName}Props {
  // Add props here
}

const ${pageName}: React.FC<${pageName}Props> = () => {
  return (
    <div className="container">
      <h1>${pageName}</h1>
      <p>This is the ${pageName} component.</p>
    </div>
  );
};

export default ${pageName};
`;
  }

  async generateVueView(item) {
    const pageName = item.controller.replace('Controller', 'Page');
    const pagePath = path.join('src', 'views', item.scope, `${pageName}.vue`);
    const fullPath = path.join(this.projectPath, pagePath);

    if (await fs.pathExists(fullPath) && !this.options.overwrite) {
      console.log(chalk.gray(`  Skipping view (exists): ${pagePath}`));
      return null;
    }

    const content = `<template>
  <div class="container">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const title = ref('${pageName}')
const description = ref('This is the ${pageName} page')
</script>

<style scoped>
.container {
  padding: 20px;
}
</style>
`;

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');

    console.log(chalk.green(`  Creating view: ${pagePath}`));

    return {
      path: pagePath,
      name: `${pageName}.vue`,
      type: 'view',
      scope: item.scope
    };
  }

  async generateController(item) {
    // Laravel controller generation
    if (this.adapter.constructor.name === 'LaravelAdapter') {
      return this.generateLaravelController(item);
    }

    return null;
  }

  async generateLaravelController(item) {
    const controllerName = item.route.controller;
    const controllerPath = path.join('app', 'Http', 'Controllers', item.scope, `${controllerName}.php`);
    const fullPath = path.join(this.projectPath, controllerPath);

    if (await fs.pathExists(fullPath) && !this.options.overwrite) {
      console.log(chalk.gray(`  Skipping controller (exists): ${controllerPath}`));
      return null;
    }

    const content = `<?php

namespace App\\Http\\Controllers\\${this.toPascalCase(item.scope)};

use App\\Http\\Controllers\\Controller;
use Illuminate\\Http\\Request;

class ${controllerName} extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return view('${item.scope}.${this.toSnakeCase(controllerName).replace('_controller', '')}');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
`;

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');

    console.log(chalk.green(`  Creating controller: ${controllerPath}`));

    return {
      path: controllerPath,
      name: `${controllerName}.php`,
      type: 'controller',
      scope: item.scope
    };
  }

  toPascalCase(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }

  toTitleCase(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  getSummary() {
    return {
      totalGenerated: this.generatedFiles.length,
      files: this.generatedFiles
    };
  }
}

module.exports = { ImplementationGenerator };

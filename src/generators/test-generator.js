const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

class TestGenerator {
  constructor(projectPath, adapter, options = {}) {
    this.projectPath = projectPath;
    this.adapter = adapter;
    this.options = options;
    this.generatedFiles = [];
  }

  async generateTestsForScope(scope) {
    const spinner = ora(`Generating tests for ${scope.name} scope...`).start();
    
    try {
      // Get test cases from adapter
      const testCases = await this.adapter.generateTestsForScope(scope, this.options);
      
      if (!testCases || testCases.length === 0) {
        spinner.succeed(`No new tests needed for ${scope.name}`);
        return [];
      }

      // Generate actual test files
      const generatedFiles = [];
      
      for (const testCase of testCases) {
        const filePath = await this.writeTestFile(testCase);
        if (filePath) {
          generatedFiles.push(filePath);
        }
      }

      this.generatedFiles.push(...generatedFiles);
      
      spinner.succeed(`Generated ${generatedFiles.length} test files for ${scope.name}`);
      
      return generatedFiles;
    } catch (error) {
      spinner.fail(`Failed to generate tests: ${error.message}`);
      throw error;
    }
  }

  async writeTestFile(testCase) {
    const fullPath = path.join(this.projectPath, testCase.path);
    
    // Check if file already exists
    const fileExists = await fs.pathExists(fullPath);
    
    if (fileExists) {
      if (this.options.overwrite) {
        if (this.options.dryRun) {
          console.log(chalk.cyan(`  [DRY RUN] Would overwrite: ${testCase.path}`));
        } else {
          console.log(chalk.yellow(`  Overwriting: ${testCase.path}`));
        }
      } else {
        console.log(chalk.gray(`  Skipping (exists): ${testCase.path}`));
        return null;
      }
    } else {
      if (this.options.dryRun) {
        console.log(chalk.cyan(`  [DRY RUN] Would create: ${testCase.path}`));
      } else {
        console.log(chalk.green(`  Creating: ${testCase.path}`));
      }
    }
    
    // If dry run, don't actually write the file
    if (this.options.dryRun) {
      return {
        path: testCase.path,
        name: testCase.name,
        scope: testCase.scope,
        target: testCase.page || testCase.view || testCase.route
      };
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(fullPath));
    
    // Write the file
    await fs.writeFile(fullPath, testCase.content, 'utf8');
    
    return {
      path: testCase.path,
      name: testCase.name,
      scope: testCase.scope,
      target: testCase.page || testCase.view || testCase.route
    };
  }

  async generateMissingControllerTests(structure, scope) {
    // For Laravel: Generate tests for controllers without tests
    if (this.adapter.constructor.name === 'LaravelAdapter') {
      return this.generateLaravelControllerTests(structure, scope);
    }
    
    // For other stacks, this would be implemented per adapter
    return [];
  }

  async generateLaravelControllerTests(structure, scope) {
    const tests = [];
    
    // Find controllers in scope that don't have tests
    const controllersInScope = structure.controllers.filter(c => {
      const controllerRoutes = structure.routes.filter(r => 
        r.controller === c.name && r.type === scope.name
      );
      return controllerRoutes.length > 0;
    });

    for (const controller of controllersInScope) {
      const hasTests = structure.tests.some(t => 
        t.path.toLowerCase().includes(controller.name.toLowerCase())
      );

      if (!hasTests) {
        const testFile = await this.generateControllerTest(controller, scope);
        if (testFile) {
          tests.push(testFile);
        }
      }
    }

    return tests;
  }

  async generateControllerTest(controller, scope) {
    const fileName = `${controller.name}Test.php`;
    const testPath = path.join('tests', 'Feature', scope.name, fileName);
    const fullPath = path.join(this.projectPath, testPath);

    // Check if exists
    if (await fs.pathExists(fullPath) && !this.options.overwrite) {
      return null;
    }

    // Generate test content
    const content = this.generateLaravelTestContent(controller, scope);

    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf8');

    console.log(chalk.green(`  Creating controller test: ${testPath}`));

    return {
      path: testPath,
      name: fileName,
      scope: scope.name,
      target: controller.name
    };
  }

  generateLaravelTestContent(controller, scope) {
    const testMethods = controller.methods.map(method => {
      return `
    /**
     * Test ${method} method is accessible
     */
    public function test_${method.toLowerCase()}_is_accessible()
    {
        $user = User::factory()->create();
        
        $response = $this->actingAs($user)->${this.getHttpMethod(method)}(route('${controller.name.toLowerCase()}.${method.toLowerCase()}'));
        
        $response->assertStatus(200);
    }`;
    }).join('\n');

    return `<?php

namespace Tests\\Feature\\${this.toPascalCase(scope.name)};

use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;
use App\\Models\\User;

class ${controller.name}Test extends TestCase
{
    use RefreshDatabase;
${testMethods}
}
`;
  }

  getHttpMethod(controllerMethod) {
    const methodMap = {
      'index': 'get',
      'show': 'get',
      'create': 'get',
      'edit': 'get',
      'store': 'post',
      'update': 'put',
      'destroy': 'delete'
    };
    return methodMap[controllerMethod.toLowerCase()] || 'get';
  }

  toPascalCase(str) {
    return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
  }

  getSummary() {
    return {
      totalGenerated: this.generatedFiles.length,
      files: this.generatedFiles
    };
  }
}

module.exports = { TestGenerator };

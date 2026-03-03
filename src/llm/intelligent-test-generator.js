/**
 * Intelligent Test Generator - AI-powered test generation
 * Falls back to template-based generation if AI unavailable
 */

const chalk = require('chalk');
const ora = require('ora');
const path = require('path');

class IntelligentTestGenerator {
  constructor(projectPath, adapter, options = {}) {
    this.projectPath = projectPath;
    this.adapter = adapter;
    this.options = options;
    this.llm = options.llmClient || null;
    this.useAI = options.useAI !== false && this.llm !== null;
    this.generatedFiles = [];
  }

  async generateTestsForScope(scope) {
    console.log(chalk.blue(`\n🧪 Generating tests for ${scope.name} scope...`));
    
    // Collect context
    const controllers = this.adapter.structure?.controllers?.filter(c => 
      c.scope === scope.name
    ) || [];
    
    const routes = this.adapter.structure?.routes?.filter(r => 
      r.type === scope.name
    ) || [];
    
    const models = this.adapter.structure?.models || [];
    
    const tests = [];
    
    for (const controller of controllers) {
      // Check if already has tests
      const hasTests = this.adapter.structure?.tests?.some(t => 
        t.path.toLowerCase().includes(controller.name.toLowerCase())
      );
      
      if (hasTests && !this.options.overwrite) {
        console.log(chalk.gray(`  Skipping ${controller.name} (tests exist)`));
        continue;
      }

      let testContent;
      
      if (this.useAI) {
        // Generate with AI
        testContent = await this.generateWithAI(controller, routes, models);
      } else {
        // Generate with templates
        testContent = this.generateWithTemplate(controller, routes);
      }

      if (testContent) {
        const testPath = path.join(
          'tests',
          'Feature',
          scope.name.charAt(0).toUpperCase() + scope.name.slice(1),
          `${controller.name}Test.php`
        );

        tests.push({
          path: testPath,
          name: `${controller.name}Test.php`,
          content: testContent,
          controller: controller.name,
          aiGenerated: this.useAI
        });
      }
    }
    
    return tests;
  }

  async generateWithAI(controller, routes, models) {
    const spinner = ora(`  🧠 AI analyzing ${controller.name}...`).start();
    
    try {
      // Build context for AI
      const context = {
        controllerName: controller.name,
        controllerPath: path.join(this.projectPath, controller.path),
        routes: routes.filter(r => r.controller === controller.name),
        models: models,
        methods: controller.methods,
        hasValidation: controller.hasValidation,
        hasAuthorization: controller.hasAuthorization
      };

      // Read controller content
      const fs = require('fs-extra');
      const content = await fs.readFile(context.controllerPath, 'utf8');
      context.controllerCode = content;

      // Generate with AI
      const { AIAnalyzer } = require('./analyzer');
      const analyzer = new AIAnalyzer(this.llm, this.projectPath);
      
      const testCases = await analyzer.generateTestCases(
        controller,
        routes,
        models,
        null
      );

      spinner.succeed(`  ✅ AI tests generated for ${controller.name}`);
      
      return testCases?.content || null;
    } catch (error) {
      spinner.fail(`  ❌ AI generation failed: ${error.message}`);
      console.log(chalk.yellow('  Falling back to template generation...'));
      return this.generateWithTemplate(controller, routes);
    }
  }

  generateWithTemplate(controller, routes) {
    // Use adapter's template generation
    const testCases = this.adapter.generateTestCasesForRoute?.(
      routes.find(r => r.controller === controller.name) || routes[0]
    ) || [];

    if (testCases.length === 0) {
      return null;
    }

    return this.buildTestFile(controller, testCases);
  }

  buildTestFile(controller, testCases) {
    const scope = controller.scope || 'public';
    const scopeNamespace = scope.charAt(0).toUpperCase() + scope.slice(1);

    const testMethods = testCases.map(test => {
      const authSetup = test.needsAuth ? 
        `$user = User::factory()->create();\n        $response = $this->actingAs($user)->` : 
        '$response = $this->';

      return `
    /** @test */
    public function ${test.testName || `test_${test.method || 'action'}`}()
    {
        ${authSetup}${test.method || 'get'}('${test.path || '/'}');
        
        ${test.assertions?.map(a => `$response->${a};`).join('\n        ') || '$response->assertStatus(200);'}
    }`;
    }).join('\n');

    return `<?php

namespace Tests\\Feature\\${scopeNamespace};

use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;
use App\\Models\\User;

class ${controller.name}Test extends TestCase
{
    use RefreshDatabase;
${testMethods}
}`;
  }

  async writeTestFile(testCase) {
    const fs = require('fs-extra');
    const fullPath = path.join(this.projectPath, testCase.path);
    
    await fs.ensureDir(path.dirname(fullPath));
    
    const fileExists = await fs.pathExists(fullPath);
    
    if (fileExists) {
      if (this.options.overwrite) {
        console.log(chalk.yellow(`  Overwriting: ${testCase.path}`));
      } else if (this.options.dryRun) {
        console.log(chalk.cyan(`  [DRY RUN] Would skip (exists): ${testCase.path}`));
        return { path: testCase.path, skipped: true };
      } else {
        console.log(chalk.gray(`  Skipping (exists): ${testCase.path}`));
        return { path: testCase.path, skipped: true };
      }
    }

    if (this.options.dryRun) {
      console.log(chalk.cyan(`  [DRY RUN] Would create: ${testCase.path}`));
      return {
        path: testCase.path,
        name: testCase.name,
        aiGenerated: testCase.aiGenerated
      };
    }

    await fs.writeFile(fullPath, testCase.content, 'utf8');
    
    const icon = testCase.aiGenerated ? '🧠' : '📝';
    console.log(chalk.green(`  ${icon} Created: ${testCase.path}`));
    
    return {
      path: testCase.path,
      name: testCase.name,
      aiGenerated: testCase.aiGenerated
    };
  }

  getSummary() {
    const aiCount = this.generatedFiles.filter(f => f.aiGenerated).length;
    const templateCount = this.generatedFiles.length - aiCount;
    
    return {
      total: this.generatedFiles.length,
      aiGenerated: aiCount,
      templateGenerated: templateCount,
      files: this.generatedFiles
    };
  }
}

module.exports = { IntelligentTestGenerator };

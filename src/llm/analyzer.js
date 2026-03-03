/**
 * AI Analyzer - Intelligent project analysis using LLM
 */

const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');

class AIAnalyzer {
  constructor(llmClient, projectPath) {
    this.llm = llmClient;
    this.projectPath = projectPath;
  }

  /**
   * Analyze entire project structure with AI
   */
  async analyzeProject(context) {
    console.log(chalk.blue('\n🧠 AI-powered project analysis...'));
    
    const spinner = ora('Sending project to AI for deep analysis...').start();
    
    try {
      // Prepare context for AI
      const aiContext = this.prepareProjectContext(context);
      
      // Send to LLM
      const response = await this.llm.analyzeProject(aiContext);
      
      spinner.succeed('AI analysis complete');
      
      return {
        architecture: response.architecture || 'Unknown',
        patterns: response.patterns || [],
        criticalAreas: response.criticalAreas || [],
        testCoverage: response.testCoverage || 'unknown',
        suggestions: response.suggestions || [],
        aiInsights: response.raw || null
      };
    } catch (error) {
      spinner.fail(`AI analysis failed: ${error.message}`);
      console.log(chalk.yellow('Falling back to regex-based analysis...'));
      return null;
    }
  }

  /**
   * Analyze a specific controller with AI
   */
  async analyzeController(controller, routes, models) {
    const controllerPath = path.join(this.projectPath, controller.path);
    
    try {
      const content = await fs.readFile(controllerPath, 'utf8');
      
      const context = {
        controllerName: controller.name,
        controllerPath: controller.path,
        controllerCode: content,
        routes: routes.filter(r => r.controller === controller.name),
        models: models,
        methods: controller.methods
      };

      const prompt = `Analyze this Laravel controller and provide insights:

Controller: ${context.controllerName}
Methods: ${context.methods.join(', ')}

CODE:
\`\`\`php
${content}
\`\`\`

Provide JSON response:
{
  "businessLogic": "description of what this controller does",
  "complexity": "simple|medium|high",
  "testPriority": "low|medium|high|critical",
  "keyScenarios": ["scenario1", "scenario2"],
  "edgeCases": ["edge1", "edge2"],
  "suggestedTestCases": ["test1", "test2"]
}`;

      const response = await this.llm.sendPrompt(prompt, { maxTokens: 2000 });
      
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Return raw if parsing fails
      }
      
      return { raw: response.content };
    } catch (error) {
      console.log(chalk.yellow(`  Could not analyze ${controller.name}: ${error.message}`));
      return null;
    }
  }

  /**
   * Generate intelligent test cases for a controller
   */
  async generateTestCases(controller, routes, models, existingTests) {
    console.log(chalk.blue(`  🧠 Generating intelligent tests for ${controller.name}...`));
    
    const controllerPath = path.join(this.projectPath, controller.path);
    
    try {
      const content = await fs.readFile(controllerPath, 'utf8');
      
      const context = {
        controllerName: controller.name,
        controllerPath: controller.path,
        controllerCode: content,
        routes: routes.filter(r => r.controller === controller.name),
        models: models,
        methods: controller.methods,
        existingTests: existingTests
      };

      const testCode = await this.llm.generateTests(context);
      
      return {
        fileName: `${controller.name}Test.php`,
        content: testCode,
        controller: controller.name
      };
    } catch (error) {
      console.log(chalk.yellow(`  Failed to generate tests: ${error.message}`));
      return null;
    }
  }

  /**
   * Suggest refactoring for code
   */
  async suggestRefactoring(filePath, code) {
    try {
      const context = {
        filePath,
        code
      };

      const suggestions = await this.llm.suggestRefactoring(context);
      
      return suggestions.map(s => ({
        priority: s.priority || 'medium',
        issue: s.issue || s.Issue || 'Unknown issue',
        solution: s.solution || s.Solution || '',
        benefits: s.benefits || s.Benefits || ''
      }));
    } catch (error) {
      console.log(chalk.yellow(`  Could not analyze ${filePath}: ${error.message}`));
      return [];
    }
  }

  /**
   * Generate implementation code
   */
  async generateImplementation(type, context) {
    try {
      const code = await this.llm.generateImplementation({
        type,
        ...context
      });
      
      return code;
    } catch (error) {
      console.log(chalk.yellow(`  Failed to generate implementation: ${error.message}`));
      return null;
    }
  }

  /**
   * Prepare project context for AI analysis
   */
  prepareProjectContext(context) {
    return {
      stack: context.stack?.name || 'unknown',
      totalFiles: context.files,
      routes: context.routes?.slice(0, 50), // Limit to avoid token overflow
      controllers: context.controllers?.map(c => ({
        name: c.name,
        methods: c.methods,
        scope: c.scope
      })).slice(0, 30),
      models: context.models?.map(m => ({
        name: m.name,
        hasRelations: m.hasRelations,
        hasFactory: m.hasFactory
      })).slice(0, 20),
      scopes: context.scopes,
      summary: context.summary
    };
  }

  /**
   * Batch analyze multiple controllers
   */
  async analyzeControllersBatch(controllers, routes, models, onProgress) {
    const results = [];
    
    for (let i = 0; i < controllers.length; i++) {
      const controller = controllers[i];
      
      if (onProgress) {
        onProgress(i + 1, controllers.length, controller.name);
      }
      
      const analysis = await this.analyzeController(controller, routes, models);
      
      if (analysis) {
        results.push({
          controller: controller.name,
          analysis
        });
      }
    }
    
    return results;
  }
}

module.exports = { AIAnalyzer };

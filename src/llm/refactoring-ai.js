/**
 * Refactoring AI - Intelligent code refactoring suggestions
 */

const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class RefactoringAI {
  constructor(llmClient, projectPath) {
    this.llm = llmClient;
    this.projectPath = projectPath;
    this.suggestions = [];
  }

  /**
   * Analyze entire project for refactoring opportunities
   */
  async analyzeProject(options = {}) {
    console.log(chalk.blue('\n🔍 AI-powered refactoring analysis...\n'));
    
    const spinner = ora('Scanning codebase...').start();
    
    try {
      // Collect all PHP files
      const files = await globby(['app/**/*.php', 'routes/*.php'], {
        cwd: this.projectPath,
        absolute: false
      });

      spinner.succeed(`Found ${files.length} files to analyze`);
      
      // Analyze each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const spinner = ora(`[${i + 1}/${files.length}] Analyzing ${file}...`).start();
        
        try {
          const suggestions = await this.analyzeFile(file);
          
          if (suggestions.length > 0) {
            this.suggestions.push({
              file,
              suggestions
            });
            spinner.succeed(`Found ${suggestions.length} issues in ${file}`);
          } else {
            spinner.succeed(`${file} - clean`);
          }
        } catch (error) {
          spinner.fail(`Failed to analyze ${file}`);
        }
      }

      return this.categorizeSuggestions();
    } catch (error) {
      console.error(chalk.red('Analysis failed:'), error.message);
      return [];
    }
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath) {
    const fullPath = path.join(this.projectPath, filePath);
    const content = await fs.readFile(fullPath, 'utf8');

    // Skip if file is too large (>100KB)
    if (content.length > 100000) {
      return [];
    }

    const prompt = `Analyze this PHP/Laravel code for refactoring opportunities.

FILE: ${filePath}
CODE:
\`\`\`php
${content}
\`\`\`

Identify issues in these categories:
1. Code smells (duplication, long methods, etc.)
2. SOLID violations
3. Laravel best practice violations
4. Security issues
5. Performance issues
6. Missing type hints or return types

Return JSON array:
[
  {
    "priority": "high|medium|low",
    "category": "code_smell|solid|laravel|security|performance|typing",
    "issue": "description of the issue",
    "line": "approximate line number or method name",
    "solution": "how to fix it",
    "benefits": "what improves"
  }
]

Return empty array [] if no issues found.`;

    try {
      const response = await this.llm.sendPrompt(prompt, { maxTokens: 2000 });
      
      // Try to parse JSON
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed : [];
      }
      
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Categorize suggestions by priority
   */
  categorizeSuggestions() {
    const high = [];
    const medium = [];
    const low = [];

    for (const fileSuggestion of this.suggestions) {
      for (const suggestion of fileSuggestion.suggestions) {
        const item = {
          file: fileSuggestion.file,
          ...suggestion
        };

        switch (suggestion.priority) {
          case 'high':
            high.push(item);
            break;
          case 'medium':
            medium.push(item);
            break;
          case 'low':
            low.push(item);
            break;
        }
      }
    }

    return {
      high,
      medium,
      low,
      total: high.length + medium.length + low.length
    };
  }

  /**
   * Display refactoring suggestions
   */
  displaySuggestions(categorized) {
    console.log(chalk.blue.bold('\n📋 Refactoring Suggestions\n'));

    if (categorized.total === 0) {
      console.log(chalk.green('✅ No refactoring issues found!\n'));
      return;
    }

    // High priority
    if (categorized.high.length > 0) {
      console.log(chalk.red.bold(`🔴 High Priority (${categorized.high.length}):`));
      console.log(chalk.red('─'.repeat(50)));
      
      for (const item of categorized.high) {
        this.displaySuggestion(item);
      }
      console.log('');
    }

    // Medium priority
    if (categorized.medium.length > 0) {
      console.log(chalk.yellow.bold(`🟡 Medium Priority (${categorized.medium.length}):`));
      console.log(chalk.yellow('─'.repeat(50)));
      
      for (const item of categorized.medium) {
        this.displaySuggestion(item);
      }
      console.log('');
    }

    // Low priority
    if (categorized.low.length > 0) {
      console.log(chalk.gray.bold(`⚪ Low Priority (${categorized.low.length}):`));
      console.log(chalk.gray('─'.repeat(50)));
      
      for (const item of categorized.low) {
        this.displaySuggestion(item);
      }
      console.log('');
    }

    // Summary
    console.log(chalk.blue('📊 Summary:'));
    console.log(`  Total issues: ${categorized.total}`);
    console.log(chalk.red(`  High: ${categorized.high.length}`));
    console.log(chalk.yellow(`  Medium: ${categorized.medium.length}`));
    console.log(chalk.gray(`  Low: ${categorized.low.length}`));
    console.log('');
  }

  displaySuggestion(item) {
    const categoryIcon = this.getCategoryIcon(item.category);
    
    console.log(`\n${categoryIcon} ${chalk.bold(item.file)}`);
    console.log(`   Issue: ${item.issue}`);
    if (item.line) {
      console.log(`   Location: ${item.line}`);
    }
    console.log(`   Solution: ${item.solution}`);
    if (item.benefits) {
      console.log(`   Benefits: ${item.benefits}`);
    }
  }

  getCategoryIcon(category) {
    const icons = {
      code_smell: '🔧',
      solid: '🏗️',
      laravel: '🎨',
      security: '🔒',
      performance: '⚡',
      typing: '📝'
    };
    return icons[category] || '💡';
  }

  /**
   * Generate refactored code for a specific suggestion
   */
  async generateFix(filePath, issue) {
    console.log(chalk.blue(`\n🔧 Generating fix for ${filePath}...`));
    
    const fullPath = path.join(this.projectPath, filePath);
    const content = await fs.readFile(fullPath, 'utf8');

    const prompt = `Refactor this code to fix the following issue:

ISSUE: ${issue.issue}
SOLUTION: ${issue.solution}

FILE: ${filePath}
CURRENT CODE:
\`\`\`php
${content}
\`\`\`

Provide the complete refactored code. Only return the code, no explanations.`;

    try {
      const response = await this.llm.sendPrompt(prompt, { maxTokens: 4000 });
      
      // Extract code from markdown if present
      const codeMatch = response.content.match(/```php\s*([\s\S]*?)```/);
      if (codeMatch) {
        return codeMatch[1].trim();
      }
      
      return response.content.trim();
    } catch (error) {
      console.error(chalk.red('Failed to generate fix:'), error.message);
      return null;
    }
  }

  /**
   * Apply a fix (dry-run or actual)
   */
  async applyFix(filePath, newCode, dryRun = true) {
    const fullPath = path.join(this.projectPath, filePath);
    
    if (dryRun) {
      console.log(chalk.cyan(`\n[DRY RUN] Would update: ${filePath}`));
      console.log(chalk.gray('First 500 chars of new code:'));
      console.log(newCode.substring(0, 500) + '...\n');
      return true;
    }

    try {
      // Backup original
      const backupPath = `${fullPath}.backup`;
      await fs.copy(fullPath, backupPath);
      
      // Write new code
      await fs.writeFile(fullPath, newCode, 'utf8');
      
      console.log(chalk.green(`✅ Updated: ${filePath}`));
      console.log(chalk.gray(`   Backup saved to: ${filePath}.backup`));
      
      return true;
    } catch (error) {
      console.error(chalk.red(`❌ Failed to update ${filePath}:`), error.message);
      return false;
    }
  }
}

module.exports = { RefactoringAI };
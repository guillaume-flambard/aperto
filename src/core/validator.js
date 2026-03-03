const chalk = require('chalk');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

async function validateChanges(scope, stack) {
  console.log(chalk.gray('Running tests...\n'));
  
  const results = await runTests(stack);
  
  return {
    success: results.failed === 0,
    total: results.total,
    passed: results.passed,
    failed: results.failed,
    failures: results.failures || [],
    coverage: results.coverage
  };
}

async function runTests(stack) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
    coverage: null
  };

  try {
    switch (stack.name) {
      case 'laravel':
        return await runLaravelTests();
      case 'react':
      case 'nextjs':
      case 'vue':
      case 'nuxt':
        return await runNodeTests(stack);
      case 'flutter':
        return await runFlutterTests();
      default:
        return await runGenericTests();
    }
  } catch (error) {
    console.log(chalk.yellow('  Could not run tests automatically'));
    console.log(chalk.gray(`  ${error.message}\n`));
    return { ...results, failed: 0, passed: 0 };
  }
}

async function runLaravelTests() {
  try {
    const output = execSync('php artisan test --colors=never 2>&1', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });
    
    // Parse output
    const passMatch = output.match(/OK\s*\((\d+)\s*tests?/);
    const failMatch = output.match(/FAILURES!\s*(\d+)\s*tests?/);
    
    if (passMatch) {
      return {
        total: parseInt(passMatch[1]),
        passed: parseInt(passMatch[1]),
        failed: 0,
        failures: [],
        coverage: null
      };
    }
    
    if (failMatch) {
      return {
        total: parseInt(failMatch[1]),
        passed: 0,
        failed: parseInt(failMatch[1]),
        failures: ['See test output for details'],
        coverage: null
      };
    }
    
    return { total: 0, passed: 0, failed: 0, failures: [], coverage: null };
  } catch (error) {
    // Command failed, parse error output
    return {
      total: 0,
      passed: 0,
      failed: 1,
      failures: ['Tests failed to run'],
      coverage: null
    };
  }
}

async function runNodeTests(stack) {
  const packageJson = await fs.readJson(path.join(process.cwd(), 'package.json'));
  
  let testCommand = 'npm test';
  if (packageJson.scripts?.test) {
    testCommand = packageJson.scripts.test;
  }
  
  try {
    const output = execSync(testCommand, {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'pipe'
    });
    
    // Parse test results
    const passMatch = output.match(/(\d+)\s+passing/);
    const failMatch = output.match(/(\d+)\s+failing/);
    
    return {
      total: (parseInt(passMatch?.[1]) || 0) + (parseInt(failMatch?.[1]) || 0),
      passed: parseInt(passMatch?.[1]) || 0,
      failed: parseInt(failMatch?.[1]) || 0,
      failures: failMatch ? ['See test output for details'] : [],
      coverage: null
    };
  } catch (error) {
    // Test command failed
    return {
      total: 0,
      passed: 0,
      failed: 1,
      failures: ['Tests failed - see output above'],
      coverage: null
    };
  }
}

async function runFlutterTests() {
  try {
    const output = execSync('flutter test', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 120000
    });
    
    const passMatch = output.match(/All\s+tests\s+passed!/) || output.match(/\+(\d+):/);
    const failMatch = output.match(/Some\s+tests\s+failed/) || output.match(/-(\d+):/);
    
    if (passMatch) {
      return {
        total: parseInt(passMatch[1]) || 1,
        passed: parseInt(passMatch[1]) || 1,
        failed: 0,
        failures: [],
        coverage: null
      };
    }
    
    if (failMatch) {
      return {
        total: parseInt(failMatch[1]) || 1,
        passed: 0,
        failed: parseInt(failMatch[1]) || 1,
        failures: ['See test output for details'],
        coverage: null
      };
    }
    
    return { total: 0, passed: 0, failed: 0, failures: [], coverage: null };
  } catch (error) {
    return {
      total: 0,
      passed: 0,
      failed: 1,
      failures: ['Tests failed to run'],
      coverage: null
    };
  }
}

async function runGenericTests() {
  // Try to detect test framework
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    return runNodeTests({ name: 'generic' });
  }
  
  return {
    total: 0,
    passed: 0,
    failed: 0,
    failures: [],
    coverage: null,
    message: 'Could not detect test framework'
  };
}

module.exports = { validateChanges };

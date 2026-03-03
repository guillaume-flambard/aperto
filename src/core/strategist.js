const inquirer = require('inquirer');
const chalk = require('chalk');

async function selectStrategy(projectInfo) {
  const strategies = calculateStrategies(projectInfo);
  
  console.log(chalk.blue('\n💡 Strategy Recommendations:\n'));
  
  strategies.forEach((strategy, i) => {
    const emoji = strategy.type === 'yolo' ? '🚀' :
                  strategy.type === 'scope-first' ? '🎯' :
                  strategy.type === 'progressive' ? '📊' : '🔍';
    
    console.log(chalk.white(`${i + 1}. ${emoji} ${strategy.name}`));
    console.log(chalk.gray(`   Confidence: ${Math.round(strategy.confidence * 100)}%`));
    console.log(chalk.gray(`   ${strategy.reason}`));
    console.log(chalk.gray(`   Estimated: ${strategy.duration} | Risk: ${strategy.risk}\n`));
  });
  
  const { selected } = await inquirer.prompt([{
    type: 'list',
    name: 'selected',
    message: 'Choose your approach:',
    choices: strategies.map((s, i) => ({
      name: `${s.name} (${s.risk} risk)`,
      value: s
    }))
  }]);
  
  return selected;
}

function calculateStrategies(info) {
  const strategies = [];
  
  // YOLO Strategy
  const yoloScore = calculateYoloScore(info);
  if (yoloScore > 0.4) {
    strategies.push({
      type: 'yolo',
      name: 'YOLO - All at once',
      confidence: yoloScore,
      reason: 'New project or acceptable full refactor',
      duration: '2-3 days',
      risk: 'High'
    });
  }
  
  // Progressive Strategy
  const progressiveScore = calculateProgressiveScore(info);
  strategies.push({
    type: 'progressive',
    name: 'Progressive - Feature by feature',
    confidence: progressiveScore,
    reason: 'Safe approach for existing production projects',
    duration: '1-2 weeks',
    risk: 'Low'
  });
  
  // Scope-First Strategy
  const scopeFirstScore = calculateScopeFirstScore(info);
  if (scopeFirstScore > 0.5) {
    const criticalScope = info.scopes?.find(s => s.priority >= 70);
    strategies.push({
      type: 'scope-first',
      name: 'Scope-First - One scope at a time',
      confidence: scopeFirstScore,
      reason: criticalScope ? 
        `Critical scope "${criticalScope.name}" identified` : 
        'Multiple clear scopes detected',
      duration: '2-4 days per scope',
      risk: 'Medium',
      targetScope: criticalScope?.name
    });
  }
  
  // Audit Strategy (always available)
  strategies.push({
    type: 'audit',
    name: 'Audit only - Read only',
    confidence: 1.0,
    reason: 'Analysis without modifications',
    duration: '5 minutes',
    risk: 'None'
  });
  
  return strategies.sort((a, b) => b.confidence - a.confidence);
}

function calculateYoloScore(info) {
  let score = 0;
  
  // Small project
  if (info.files < 100) score += 0.3;
  
  // No tests yet
  if (info.summary.coverage === 0) score += 0.3;
  
  // Low complexity
  if (info.scopes?.length <= 2) score += 0.2;
  
  // Not in production (heuristic)
  if (info.files < 200) score += 0.2;
  
  return Math.min(1, score);
}

function calculateProgressiveScore(info) {
  let score = 0.7; // Base score
  
  // Large project
  if (info.files > 200) score += 0.1;
  
  // Existing tests
  if (info.summary.coverage > 0) score += 0.1;
  
  // Multiple scopes
  if (info.scopes?.length > 2) score += 0.1;
  
  return Math.min(1, score);
}

function calculateScopeFirstScore(info) {
  let score = 0;
  
  // Multiple scopes
  if (info.scopes?.length >= 2) score += 0.3;
  
  // Critical scope exists
  const criticalScope = info.scopes?.find(s => s.priority >= 70);
  if (criticalScope) score += 0.4;
  
  // Incomplete scopes
  const incomplete = info.scopes?.filter(s => (s.completion || 0) < 50);
  if (incomplete?.length > 0) score += 0.3;
  
  return Math.min(1, score);
}

module.exports = { selectStrategy };

const { execSync } = require('child_process');
const chalk = require('chalk');

async function createBackup() {
  try {
    // Check if git repo
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    
    // Check for uncommitted changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    
    if (status.trim()) {
      // Stage all changes
      execSync('git add -A');
      
      // Create commit
      const timestamp = new Date().toISOString().split('T')[0];
      execSync(`git commit -m "Backup before Aperto - ${timestamp}"`);
      
      return true;
    }
    
    return true; // No changes to backup
  } catch (error) {
    console.log(chalk.yellow('\n⚠️  Could not create git backup'));
    console.log(chalk.gray('Make sure you\'re in a git repository\n'));
    return false;
  }
}

module.exports = { createBackup };

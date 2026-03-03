const inquirer = require('inquirer');

async function initPrompts() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'Choose confirmation mode:',
      choices: [
        { name: 'Safe - Ask before each action', value: 'safe' },
        { name: 'Confident - Minimal questions', value: 'confident' }
      ],
      default: 'safe'
    },
    {
      type: 'list',
      name: 'reportFormat',
      message: 'Choose report format:',
      choices: [
        { name: 'Markdown file', value: 'markdown' },
        { name: 'JSON file', value: 'json' },
        { name: 'Console only', value: 'console' }
      ],
      default: 'markdown'
    },
    {
      type: 'confirm',
      name: 'autoBackup',
      message: 'Always create git backup?',
      default: true
    }
  ]);
  
  return answers;
}

module.exports = { initPrompts };

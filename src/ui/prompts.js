const inquirer = require('inquirer');
const chalk = require('chalk');

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
    },
    {
      type: 'confirm',
      name: 'enableAI',
      message: chalk.cyan('Enable AI-powered features?') + '\n   This uses LLM APIs for intelligent test generation and code analysis.\n   You\'ll need an API key (Kimi, OpenAI, or Anthropic).',
      default: true
    }
  ]);

  // If AI is enabled, ask for LLM configuration
  if (answers.enableAI) {
    const llmConfig = await inquirer.prompt([
      {
        type: 'list',
        name: 'llmProvider',
        message: 'Choose LLM provider:',
        choices: [
          { name: 'Kimi (Moonshot AI) - Recommended', value: 'kimi' },
          { name: 'OpenAI (GPT-4)', value: 'openai' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
          { name: 'Ollama (Local - free)', value: 'ollama' }
        ],
        default: 'kimi'
      }
    ]);

    // Get API key for cloud providers
    if (llmConfig.llmProvider !== 'ollama') {
      const keyAnswer = await inquirer.prompt([
        {
          type: 'password',
          name: 'llmApiKey',
          message: `Enter your ${llmConfig.llmProvider} API key:`,
          mask: '*'
        }
      ]);
      llmConfig.llmApiKey = keyAnswer.llmApiKey;
    } else {
      // Ollama configuration
      const ollamaConfig = await inquirer.prompt([
        {
          type: 'input',
          name: 'ollamaUrl',
          message: 'Ollama server URL:',
          default: 'http://localhost:11434'
        },
        {
          type: 'input',
          name: 'ollamaModel',
          message: 'Model name:',
          default: 'codellama'
        }
      ]);
      llmConfig.ollamaUrl = ollamaConfig.ollamaUrl;
      llmConfig.ollamaModel = ollamaConfig.ollamaModel;
    }

    answers.llm = {
      enabled: true,
      provider: llmConfig.llmProvider,
      apiKey: llmConfig.llmApiKey || null,
      baseUrl: llmConfig.ollamaUrl || null,
      model: llmConfig.ollamaModel || null
    };
  } else {
    answers.llm = {
      enabled: false
    };
  }

  return answers;
}

async function llmConfigPrompts(currentConfig = {}) {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'enableAI',
      message: 'Enable AI-powered features?',
      default: currentConfig.enabled !== false
    }
  ]);

  if (!answers.enableAI) {
    return { enabled: false };
  }

  const providerAnswer = await inquirer.prompt([
    {
      type: 'list',
      name: 'provider',
      message: 'Choose LLM provider:',
      choices: [
        { name: 'Kimi (Moonshot AI)', value: 'kimi' },
        { name: 'OpenAI (GPT-4)', value: 'openai' },
        { name: 'Anthropic (Claude)', value: 'anthropic' },
        { name: 'Ollama (Local)', value: 'ollama' }
      ],
      default: currentConfig.provider || 'kimi'
    }
  ]);

  let config = {
    enabled: true,
    provider: providerAnswer.provider
  };

  if (config.provider !== 'ollama') {
    const keyAnswer = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'API key (leave empty to use APERTO_LLM_API_KEY env var):',
        mask: '*'
      }
    ]);
    if (keyAnswer.apiKey) {
      config.apiKey = keyAnswer.apiKey;
    }
  } else {
    const ollamaAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Ollama URL:',
        default: currentConfig.baseUrl || 'http://localhost:11434'
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model:',
        default: currentConfig.model || 'codellama'
      }
    ]);
    config.baseUrl = ollamaAnswers.baseUrl;
    config.model = ollamaAnswers.model;
  }

  return config;
}

module.exports = { initPrompts, llmConfigPrompts };

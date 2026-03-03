/**
 * OpenAI Provider - Integration with OpenAI API
 */

const https = require('https');

class OpenAIProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gpt-4';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
    this.timeout = config.timeout || 60000;
  }

  async send(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured. Set APERTO_LLM_API_KEY or config.llm.apiKey');
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer specializing in Laravel, PHP, React, Vue, and testing. Generate production-quality code following best practices.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.3,
      ...options
    };

    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(requestBody);
      
      const requestOptions = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(requestData)
        },
        timeout: this.timeout
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(`OpenAI API error: ${response.error.message}`));
              return;
            }

            const message = response.choices[0].message;
            
            // Pricing estimates (as of 2024)
            const pricing = {
              'gpt-4': 0.03,
              'gpt-4-turbo': 0.01,
              'gpt-3.5-turbo': 0.0015
            };
            const pricePer1K = pricing[this.model] || 0.03;
            
            resolve({
              content: message.content,
              tokens: response.usage?.total_tokens || 0,
              promptTokens: response.usage?.prompt_tokens || 0,
              completionTokens: response.usage?.completion_tokens || 0,
              cost: (response.usage?.total_tokens || 0) * (pricePer1K / 1000)
            });
          } catch (error) {
            reject(new Error(`Failed to parse OpenAI response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`OpenAI request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('OpenAI request timeout'));
      });

      req.write(requestData);
      req.end();
    });
  }

  async validate() {
    try {
      await this.send('Hello', { maxTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = { OpenAIProvider };

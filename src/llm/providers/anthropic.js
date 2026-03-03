/**
 * Anthropic Provider - Integration with Claude API
 */

const https = require('https');

class AnthropicProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-opus-20240229';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.timeout = config.timeout || 60000;
  }

  async send(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured. Set APERTO_LLM_API_KEY or config.llm.apiKey');
    }

    const requestBody = {
      model: this.model,
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.3,
      system: 'You are an expert software engineer specializing in Laravel, PHP, React, Vue, and testing. Generate production-quality code following best practices.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      ...options
    };

    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(requestBody);
      
      const requestOptions = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
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
              reject(new Error(`Anthropic API error: ${response.error.message}`));
              return;
            }

            const content = response.content?.[0]?.text || '';
            
            // Claude pricing (as of 2024)
            const pricing = {
              'claude-3-opus-20240229': 0.015,
              'claude-3-sonnet-20240229': 0.003,
              'claude-3-haiku-20240307': 0.00025
            };
            const pricePer1K = pricing[this.model] || 0.015;
            
            resolve({
              content,
              tokens: response.usage?.input_tokens + response.usage?.output_tokens || 0,
              promptTokens: response.usage?.input_tokens || 0,
              completionTokens: response.usage?.output_tokens || 0,
              cost: ((response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)) * (pricePer1K / 1000)
            });
          } catch (error) {
            reject(new Error(`Failed to parse Anthropic response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Anthropic request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Anthropic request timeout'));
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

module.exports = { AnthropicProvider };

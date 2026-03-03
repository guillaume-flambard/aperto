/**
 * Kimi Provider - Integration with Moonshot AI's Kimi LLM
 * API Docs: https://platform.moonshot.cn/
 */

const https = require('https');

class KimiProvider {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'kimi-latest';
    this.baseUrl = config.baseUrl || 'https://api.moonshot.cn';
    this.timeout = config.timeout || 60000;
  }

  async send(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Kimi API key not configured. Set APERTO_LLM_API_KEY or config.llm.apiKey');
    }

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer specializing in Laravel, PHP, and testing. Generate production-quality code following best practices.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.3,
      top_p: 0.9,
      ...options
    };

    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(requestBody);
      
      const requestOptions = {
        hostname: 'api.moonshot.cn',
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
              reject(new Error(`Kimi API error: ${response.error.message}`));
              return;
            }

            if (!response.choices || !response.choices[0]) {
              reject(new Error('Invalid response from Kimi API'));
              return;
            }

            const message = response.choices[0].message;
            
            resolve({
              content: message.content,
              tokens: response.usage?.total_tokens || 0,
              promptTokens: response.usage?.prompt_tokens || 0,
              completionTokens: response.usage?.completion_tokens || 0,
              // Cost estimation (Kimi pricing as of 2024)
              cost: (response.usage?.total_tokens || 0) * 0.000015 // ~$0.015 per 1K tokens
            });
          } catch (error) {
            reject(new Error(`Failed to parse Kimi response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Kimi request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Kimi request timeout'));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * Validate API key by making a test request
   */
  async validate() {
    try {
      await this.send('Hello', { maxTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = { KimiProvider };

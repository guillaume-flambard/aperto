/**
 * Ollama Provider - Integration with local Ollama instance
 * For running LLMs locally (Llama2, CodeLlama, etc.)
 */

const http = require('http');

class OllamaProvider {
  constructor(config) {
    this.model = config.model || 'codellama';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.timeout = config.timeout || 120000; // Longer timeout for local models
  }

  async send(prompt, options = {}) {
    const url = new URL(this.baseUrl);
    
    const requestBody = {
      model: this.model,
      prompt: prompt,
      system: 'You are an expert software engineer specializing in Laravel, PHP, React, Vue, and testing. Generate production-quality code following best practices.',
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        num_predict: options.maxTokens || 4000,
        ...options
      }
    };

    return new Promise((resolve, reject) => {
      const requestData = JSON.stringify(requestBody);
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || 11434,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        },
        timeout: this.timeout
      };

      const client = url.protocol === 'https:' ? require('https') : http;
      
      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (response.error) {
              reject(new Error(`Ollama error: ${response.error}`));
              return;
            }

            // Local models are free!
            resolve({
              content: response.response,
              tokens: response.eval_count || 0,
              promptTokens: response.prompt_eval_count || 0,
              completionTokens: (response.eval_count || 0) - (response.prompt_eval_count || 0),
              cost: 0 // Local is free
            });
          } catch (error) {
            reject(new Error(`Failed to parse Ollama response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Ollama request failed: ${error.message}. Make sure Ollama is running at ${this.baseUrl}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Ollama request timeout. Local models may be slower.'));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * List available models
   */
  async listModels() {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl);
      
      const requestOptions = {
        hostname: url.hostname,
        port: url.port || 11434,
        path: '/api/tags',
        method: 'GET',
        timeout: this.timeout
      };

      const client = url.protocol === 'https:' ? require('https') : http;
      
      const req = client.request(requestOptions, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response.models || []);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
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

module.exports = { OllamaProvider };

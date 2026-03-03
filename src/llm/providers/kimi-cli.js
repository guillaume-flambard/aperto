/**
 * Kimi CLI Provider - Integration with Kimi Code CLI (using OAuth)
 * 
 * This provider shells out to the `kimi` CLI command, which handles
 * OAuth authentication automatically. This allows Aperto to use
 * Kimi CLI's existing authentication without needing API keys.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class KimiCliProvider {
  constructor(config) {
    this.model = config.model || 'kimi-k2-turbo-preview';
    this.timeout = config.timeout || 120000;
    this.baseUrl = config.baseUrl || 'https://api.moonshot.ai';
  }

  /**
   * Check if Kimi CLI is installed and authenticated
   */
  async checkCliAvailable() {
    return new Promise((resolve) => {
      const kimi = spawn('kimi', ['--version'], { stdio: 'pipe' });
      let output = '';
      
      kimi.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      kimi.on('close', (code) => {
        resolve(code === 0 && output.includes('kimi'));
      });
      
      kimi.on('error', () => {
        resolve(false);
      });
    });
  }

  async send(prompt, options = {}) {
    // Check if CLI is available
    const isAvailable = await this.checkCliAvailable();
    if (!isAvailable) {
      throw new Error('Kimi CLI not found or not authenticated. Run: kimi login');
    }

    const maxTokens = options.maxTokens || 4000;
    
    return new Promise((resolve, reject) => {
      // Build the kimi command with proper arguments
      const args = [
        '--print',
        '--output-format', 'text',
        '--max-steps-per-turn', '1',
        '--prompt', prompt
      ];

      const kimi = spawn('kimi', args, {
        timeout: this.timeout,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      kimi.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      kimi.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      kimi.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Kimi CLI exited with code ${code}: ${stderr || stdout}`));
          return;
        }

        // Parse the output
        // Kimi CLI outputs structured text, we need to extract the actual response
        const content = this.parseKimiOutput(stdout);
        
        resolve({
          content: content,
          tokens: this.estimateTokens(content),
          promptTokens: this.estimateTokens(prompt),
          completionTokens: this.estimateTokens(content),
          cost: 0 // Cannot calculate cost with CLI
        });
      });

      kimi.on('error', (error) => {
        reject(new Error(`Failed to run Kimi CLI: ${error.message}`));
      });
    });
  }

  /**
   * Parse Kimi CLI output to extract the actual response
   */
  parseKimiOutput(output) {
    // Kimi CLI outputs structured data with TextPart containing the response
    // The text content can span multiple lines and include special characters
    
    // Extract all TextPart text fields - handle multiline content
    const textParts = [];
    
    // Match TextPart with multiline text (using non-greedy match for text field)
    const textPartRegex = /text=['"]([\s\S]*?)['"],?\s*\n/g;
    let match;
    
    while ((match = textPartRegex.exec(output)) !== null) {
      // Clean up the extracted text
      let text = match[1]
        .replace(/\\n/g, '\n')  // Unescape newlines
        .replace(/\\"/g, '"')  // Unescape quotes
        .replace(/\\'/g, "'");  // Unescape single quotes
      textParts.push(text);
    }
    
    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    // Fallback: Try to extract everything after the first TextPart header
    const textIndex = output.indexOf('text=');
    if (textIndex !== -1) {
      // Find the end of the text value
      let start = textIndex + 5; // Skip 'text='
      let quote = output[start];
      if (quote === '"' || quote === "'") {
        start++;
        let end = start;
        let escaped = false;
        
        while (end < output.length) {
          if (escaped) {
            escaped = false;
          } else if (output[end] === '\\') {
            escaped = true;
          } else if (output[end] === quote) {
            break;
          }
          end++;
        }
        
        return output.substring(start, end)
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\'/g, "'");
      }
    }

    // Last resort: return cleaned raw output
    return output
      .split('\n')
      .filter(line => !line.match(/^(TurnBegin|TurnEnd|StepBegin|StatusUpdate|TokenUsage|ThinkPart)/))
      .filter(line => !line.match(/^\s*\w+Part\(/))
      .filter(line => !line.match(/^\s*(type|think|text|encrypted)=/))
      .filter(line => line.trim().length > 0)
      .join('\n')
      .trim();
  }

  /**
   * Rough token estimation (very approximate)
   */
  estimateTokens(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate by checking if CLI works
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

module.exports = { KimiCliProvider };

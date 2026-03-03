/**
 * Kimi CLI Provider - Integration with Kimi Code CLI (using OAuth)
 * 
 * This provider shells out to the `kimi` CLI command, which handles
 * OAuth authentication automatically. This allows Aperto to use
 * Kimi CLI's existing authentication without needing API keys.
 */

const { spawn } = require('child_process');

class KimiCliProvider {
  constructor(config) {
    this.model = config.model || 'kimi-k2-turbo-preview';
    this.timeout = config.timeout || 300000; // 5 minutes for full analysis
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

    return new Promise((resolve, reject) => {
      // Build the kimi command with proper arguments
      // Note: Removed --max-steps-per-turn to allow Kimi to complete the full analysis naturally
      const args = [
        '--print',
        '--output-format', 'text',
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
        const content = this.parseKimiOutput(stdout);
        
        resolve({
          content: content,
          tokens: this.estimateTokens(content),
          promptTokens: this.estimateTokens(prompt),
          completionTokens: this.estimateTokens(content),
          cost: 0
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
    // Find TextPart sections and extract the text field
    const textParts = [];
    let pos = 0;
    
    while (true) {
      // Find TextPart
      const textPartIndex = output.indexOf('TextPart(', pos);
      if (textPartIndex === -1) break;
      
      // Find text= within this TextPart
      const textFieldIndex = output.indexOf('text=', textPartIndex);
      if (textFieldIndex === -1) break;
      
      // Get the quote character (" or ')
      let valueStart = textFieldIndex + 5;
      const quote = output[valueStart];
      if (quote !== '"' && quote !== "'") break;
      
      valueStart++; // Move past opening quote
      
      // Parse the string value handling escapes
      let value = '';
      let escaped = false;
      let i = valueStart;
      
      while (i < output.length) {
        const char = output[i];
        
        if (escaped) {
          // Handle escape sequences
          switch (char) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '"': value += '"'; break;
            case "'": value += "'"; break;
            default: value += char; break;
          }
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          // End of string
          break;
        } else {
          value += char;
        }
        i++;
      }
      
      textParts.push(value);
      pos = i + 1; // Continue after this TextPart
    }
    
    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    // Fallback: just return everything after the prompt
    const lines = output.split('\n');
    let result = [];
    let inTextPart = false;
    
    for (const line of lines) {
      if (line.includes('TextPart(')) {
        inTextPart = true;
      }
      if (inTextPart && line.trim() && !line.match(/^(TextPart|type=|think=|encrypted=|\))/)) {
        // Extract content from text field lines
        const match = line.match(/text=["'](.+)["']/);
        if (match) {
          result.push(match[1].replace(/\\n/g, '\n'));
        }
      }
      if (line.trim() === ')' && inTextPart) {
        inTextPart = false;
      }
    }
    
    if (result.length > 0) {
      return result.join('\n');
    }

    // Last resort: return raw output minus metadata
    return output
      .replace(/^TurnBegin[\s\S]*?StepBegin\(n=1\)\n/, '')
      .replace(/ThinkPart\([\s\S]*?\)\n/, '')
      .replace(/TextPart\(\s*type='text',\s*text="/, '')
      .replace(/"\s*\)\nStatusUpdate[\s\S]*?TurnEnd\(\)/, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();
  }

  /**
   * Rough token estimation
   */
  estimateTokens(text) {
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

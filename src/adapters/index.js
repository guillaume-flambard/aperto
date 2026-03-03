const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class AdapterFactory {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async createAdapter(stack) {
    switch (stack.name) {
      case 'laravel':
        const { LaravelAdapter } = require('./laravel-adapter');
        return new LaravelAdapter(this.projectPath);
      
      case 'react':
      case 'nextjs':
        const { ReactAdapter } = require('./react-adapter');
        return new ReactAdapter(this.projectPath);
      
      case 'vue':
      case 'nuxt':
        const { VueAdapter } = require('./vue-adapter');
        return new VueAdapter(this.projectPath);
      
      case 'flutter':
        const { FlutterAdapter } = require('./flutter-adapter');
        return new FlutterAdapter(this.projectPath);
      
      default:
        // Use base adapter for generic stacks
        const { BaseAdapter } = require('./base-adapter');
        return new BaseAdapter(this.projectPath, stack);
    }
  }
}

module.exports = { AdapterFactory };

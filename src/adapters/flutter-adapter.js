const fs = require('fs-extra');
const path = require('path');
const { globby } = require('globby');

class FlutterAdapter {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async detectStructure() {
    const structure = {
      screens: [],
      widgets: [],
      models: [],
      services: [],
      routes: [],
      tests: [],
      scopes: [],
      hasRiverpod: false,
      hasBloc: false,
      hasProvider: false,
      testFramework: 'flutter_test'
    };

    // Check pubspec.yaml
    const pubspecPath = path.join(this.projectPath, 'pubspec.yaml');
    if (await fs.pathExists(pubspecPath)) {
      const yaml = require('js-yaml');
      const content = await fs.readFile(pubspecPath, 'utf8');
      const pubspec = yaml.load(content);

      structure.hasRiverpod = !!pubspec.dependencies?.flutter_riverpod || !!pubspec.dependencies?.hooks_riverpod;
      structure.hasBloc = !!pubspec.dependencies?.flutter_bloc;
      structure.hasProvider = !!pubspec.dependencies?.provider;
    }

    // Detect screens/pages
    await this.detectScreens(structure);

    // Detect widgets
    await this.detectWidgets(structure);

    // Detect models
    await this.detectModels(structure);

    // Detect services
    await this.detectServices(structure);

    // Detect existing tests
    await this.detectTests(structure);

    // Detect scopes
    structure.scopes = this.detectScopes(structure);

    return structure;
  }

  async detectScreens(structure) {
    const patterns = [
      'lib/screens/**/*.dart',
      'lib/pages/**/*.dart',
      'lib/views/**/*.dart',
      'lib/presentation/**/*.dart'
    ];

    const screenFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of screenFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.dart');

      // Detect if it's a StatefulWidget or StatelessWidget
      const isStateful = content.includes('extends StatefulWidget');
      
      // Check for route parameters
      const hasRouteParams = content.includes('ModalRoute') || content.includes('arguments');

      // Detect scope
      const scope = this.detectScreenScope(file);

      structure.screens.push({
        path: file,
        name: fileName,
        isStateful,
        hasRouteParams,
        scope,
        hasTests: false
      });

      structure.routes.push({
        path: file,
        type: scope,
        name: fileName
      });
    }
  }

  detectScreenScope(filePath) {
    const normalizedPath = filePath.toLowerCase();
    if (normalizedPath.includes('admin')) return 'admin';
    if (normalizedPath.includes('auth') || normalizedPath.includes('login')) return 'auth';
    if (normalizedPath.includes('profile')) return 'profile';
    if (normalizedPath.includes('home')) return 'home';
    return 'main';
  }

  async detectWidgets(structure) {
    const patterns = [
      'lib/widgets/**/*.dart',
      'lib/components/**/*.dart',
      'lib/shared/**/*.dart'
    ];

    const widgetFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of widgetFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.dart');

      structure.widgets.push({
        path: file,
        name: fileName,
        isStateful: content.includes('extends StatefulWidget'),
        hasProps: content.includes('final') || content.includes('required this')
      });
    }
  }

  async detectModels(structure) {
    const patterns = [
      'lib/models/**/*.dart',
      'lib/domain/**/*.dart',
      'lib/data/models/**/*.dart'
    ];

    const modelFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of modelFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.dart');

      // Check if it's a data class
      const isDataClass = content.includes('factory') || content.includes('fromJson');

      structure.models.push({
        path: file,
        name: fileName,
        isDataClass
      });
    }
  }

  async detectServices(structure) {
    const patterns = [
      'lib/services/**/*.dart',
      'lib/repositories/**/*.dart',
      'lib/data/repositories/**/*.dart'
    ];

    const serviceFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of serviceFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const fileName = path.basename(file, '.dart');

      structure.services.push({
        path: file,
        name: fileName,
        hasApiCalls: content.includes('http') || content.includes('dio')
      });
    }
  }

  async detectTests(structure) {
    const patterns = [
      'test/**/*_test.dart',
      'integration_test/**/*_test.dart'
    ];

    const testFiles = await globby(patterns, { cwd: this.projectPath });

    for (const file of testFiles) {
      const content = await fs.readFile(path.join(this.projectPath, file), 'utf8');
      const testCount = (content.match(/test\s*\(|group\s*\(/g) || []).length;

      structure.tests.push({
        path: file,
        type: file.includes('integration') ? 'integration' : 'unit',
        count: testCount
      });

      // Mark screens that have tests
      const relatedScreen = this.findRelatedScreen(file, structure);
      if (relatedScreen) {
        relatedScreen.hasTests = true;
      }
    }
  }

  findRelatedScreen(testFile, structure) {
    const testName = path.basename(testFile, '_test.dart');
    
    return structure.screens.find(screen => 
      screen.name.toLowerCase() === testName.toLowerCase() || 
      testFile.toLowerCase().includes(screen.name.toLowerCase())
    );
  }

  detectScopes(structure) {
    const scopes = [];

    // Group by scope
    const scopeGroups = {};
    structure.screens.forEach(screen => {
      if (!scopeGroups[screen.scope]) {
        scopeGroups[screen.scope] = [];
      }
      scopeGroups[screen.scope].push(screen);
    });

    // Create scope objects
    Object.entries(scopeGroups).forEach(([name, screens]) => {
      const untestedScreens = screens.filter(s => !s.hasTests);
      const priority = this.calculateScopePriority(name, screens, untestedScreens);

      scopes.push({
        name,
        type: name,
        screens: screens.length,
        tested: screens.length - untestedScreens.length,
        untested: untestedScreens.length,
        priority,
        risk: this.calculateRisk(name, untestedScreens.length, screens.length)
      });
    });

    return scopes.sort((a, b) => b.priority - a.priority);
  }

  calculateScopePriority(name, allScreens, untestedScreens) {
    const basePriority = {
      'admin': 95,
      'auth': 90,
      'profile': 80,
      'home': 70,
      'main': 50
    };

    const base = basePriority[name] || 50;
    const coverage = allScreens.length > 0 ? (untestedScreens.length / allScreens.length) : 0;
    
    return Math.round(base + (coverage * 10));
  }

  calculateRisk(scopeName, untested, total) {
    const coverage = total > 0 ? (untested / total) : 0;
    
    if (['admin', 'auth'].includes(scopeName) && coverage > 0.3) {
      return 'high';
    } else if (coverage > 0.5) {
      return 'medium';
    }
    return 'low';
  }

  // Test generation for Flutter
  async generateTestsForScope(scope, options = {}) {
    const tests = [];
    const screensInScope = this.structure.screens.filter(s => s.scope === scope.name && !s.hasTests);

    for (const screen of screensInScope) {
      const testFile = this.generateScreenTest(screen, options);
      tests.push(testFile);
    }

    return tests;
  }

  generateScreenTest(screen, options) {
    const fileName = `${screen.name.toLowerCase()}_test.dart`;

    return {
      name: fileName,
      path: path.join('test', 'screens', fileName),
      content: this.generateTestContent(screen),
      screen: screen.name,
      scope: screen.scope
    };
  }

  generateTestContent(screen) {
    const imports = `import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import '${screen.path.replace('lib/', '').replace('.dart', '')}';`;

    const mainTest = `
void main() {
  group('${screen.name}', () {
    testWidgets('renders correctly', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ${screen.name}(),
        ),
      );
      
      expect(find.byType(${screen.name}), findsOneWidget);
    });

    ${screen.isStateful ? `
    testWidgets('handles state changes', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ${screen.name}(),
        ),
      );
      
      // Test state changes
      await tester.pump();
      expect(find.byType(${screen.name}), findsOneWidget);
    });
    ` : ''}

    ${screen.scope === 'admin' || screen.scope === 'auth' ? `
    testWidgets('shows authentication required', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ${screen.name}(),
        ),
      );
      
      expect(find.text('Please log in'), findsOneWidget);
    });
    ` : ''}
  });
}
`;

    return imports + mainTest;
  }
}

module.exports = { FlutterAdapter };

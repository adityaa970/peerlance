const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const f = path.join(dir, file);
    const stat = fs.statSync(f);
    if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('assets') && !file.includes('__tests__')) { 
      results = results.concat(walk(f));
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      results.push(f);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'app')).concat(walk(path.join(__dirname, 'components')));

// Calculate relative path from file to hooks directory
function getHooksPath(filePath) {
  let relativePath = path.relative(path.dirname(filePath), path.join(__dirname, 'hooks', 'useTheme'));
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  return relativePath.replace(/\\/g, '/');
}

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  if (!code.includes('Colors')) return;

  try {
    const ast = babel.parseSync(code, {
      filename: file,
      presets: ['@babel/preset-typescript', '@babel/preset-react'],
      plugins: []
    });

    let transformed = false;
    let hasColorsImport = false;
    let hasCreateStyles = false;
    
    // Find Colors import
    babel.traverse(ast, {
      ImportDeclaration(p) {
        if (p.node.source.value.includes('constants/Colors')) {
          const idx = p.node.specifiers.findIndex(s => s.local.name === 'Colors');
          if (idx !== -1) {
            hasColorsImport = true;
            p.node.specifiers.splice(idx, 1);
            transformed = true;
            if (p.node.specifiers.length === 0) {
              p.remove();
            }
          }
        }
      },
      VariableDeclarator(p) {
        // Find const styles = StyleSheet.create(...)
        if (
          p.node.id.name === 'styles' &&
          p.node.init &&
          p.node.init.type === 'CallExpression' &&
          p.node.init.callee.object && p.node.init.callee.object.name === 'StyleSheet' &&
          p.node.init.callee.property && p.node.init.callee.property.name === 'create'
        ) {
          hasCreateStyles = true;
          
          // Rename styles to createStyles
          p.node.id.name = 'createStyles';
          
          // Wrap with arrow function (Colors: any) =>
          const arrowFunc = babel.types.arrowFunctionExpression(
            [babel.types.identifier('Colors')],
            p.node.init
          );
          p.node.init = arrowFunc;
          transformed = true;
        }
      },
      Function(p) {
        // Inject into main React components
        if (p.node.id && p.node.id.name) {
          const firstChar = p.node.id.name.charAt(0);
          if (firstChar === firstChar.toUpperCase() && p.parent.type === 'ExportDefaultDeclaration' || p.node.id.name.includes('Screen') || p.node.id.name.endsWith('Card') || p.parent.type === 'ExportNamedDeclaration') {
            
            // Look if it returns JSX
            let returnsJSX = false;
            p.traverse({
              JSXElement() { returnsJSX = true; },
              JSXFragment() { returnsJSX = true; }
            });
            
            if (returnsJSX) {
              const blk = p.node.body.body || [];
              // Inject 'const { colors: Colors } = useTheme();'
              const injectTheme = babel.types.variableDeclaration('const', [
                babel.types.variableDeclarator(
                  babel.types.identifier('{ colors: Colors }'),
                  babel.types.callExpression(babel.types.identifier('useTheme'), [])
                )
              ]);
              
              // Inject 'const styles = React.useMemo(() => createStyles(Colors), [Colors]);' (if createStyles exists)
              // Wait, since we are doing this per component, we only inject styles if we see a styles reference in the component!
              let usesStyles = false;
              p.traverse({
                Identifier(ip) { if (ip.node.name === 'styles') usesStyles = true; }
              });

              let injectStyles = null;
              if (usesStyles) {
                 // But wait, the identifier will be changed when we rename to createStyles previously?
                 // No, we only modified the declaration of `styles` earlier.
                 injectStyles = babel.template.statement.ast('const styles = React.useMemo(() => createStyles(Colors), [Colors]);');
              }
              
              if (injectTheme) {
                blk.unshift(injectTheme);
                if (injectStyles) blk.splice(1, 0, injectStyles);
                transformed = true;
              }
            }
          }
        }
      }
    });

    if (hasColorsImport) {
      // Add import { useTheme } from '../hooks/useTheme'
      const hooksPath = getHooksPath(file);
      const importTheme = babel.template.statement.ast(`import { useTheme } from '${hooksPath}';`);
      ast.program.body.unshift(importTheme);
    }
    
    // Add import React if needed for React.useMemo
    
    if (transformed) {
      const generated = require('@babel/generator').default(ast, {}, code).code;
      fs.writeFileSync(file, generated);
      console.log('Transformed:', file);
    }
  } catch (err) {
    console.log('Error in', file, err);
  }
});

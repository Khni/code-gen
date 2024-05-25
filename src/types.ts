import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to infer types from expressions
function inferTypeFromExpression(expression: ts.Expression): string | null {
  if (ts.isObjectLiteralExpression(expression)) {
    const properties = expression.properties.map(prop => {
      if (ts.isPropertyAssignment(prop)) {
        const key = prop.name.getText();
        const value = inferTypeFromExpression(prop.initializer);
        return `${key}: ${value}`;
      }
      return null;
    }).filter(Boolean);
    return `{ ${properties.join(', ')} }`;
  } else if (ts.isNumericLiteral(expression)) {
    return 'number';
  } else if (ts.isStringLiteral(expression)) {
    return 'string';
  } else if (expression.kind === ts.SyntaxKind.TrueKeyword || expression.kind === ts.SyntaxKind.FalseKeyword) {
    return 'boolean';
  } else if (ts.isArrayLiteralExpression(expression)) {
    const elementTypes = expression.elements.map(inferTypeFromExpression);
    const uniqueElementTypes = Array.from(new Set(elementTypes));
    return `Array<${uniqueElementTypes.join(' | ')}>`;
  } else if (ts.isUnionTypeNode(expression)) {
    const unionTypes = expression.types.map(type => inferTypeFromExpression(type));
    return unionTypes.join(' | ');
  } else if (ts.isTypeReferenceNode(expression) && ts.isIdentifier(expression.typeName)) {
    return expression.typeName.text;
  }
  return null;
}

// Function to parse files and generate types
export function parseFilesAndGenerateTypes(servicesDirectory: string, outputFile: string) {
  const serviceDirPath = path.resolve(servicesDirectory);
  const files = fs.readdirSync(serviceDirPath)
    .filter(file => file.endsWith('Services.ts') && fs.lstatSync(path.join(serviceDirPath, file)).isFile());
  const types: string[] = [];

  files.forEach(file => {
    const filePath = path.join(serviceDirPath, file);
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.ES6,
      true
    );

    ts.forEachChild(sourceFile, node => {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(declaration => {
          if (ts.isVariableDeclaration(declaration) && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
            const functionName = declaration.name.getText(sourceFile);
            const returnType = inferReturnType(declaration.initializer.body);
            if (returnType) {
              types.push(`type ${functionName}ReturnType = ${returnType};`);
            }
          }
        });
      }
    });
  });

  const outputFilePath = path.resolve(outputFile);
  const outputDir = path.dirname(outputFilePath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFilePath, types.join('\n'), 'utf8');
  console.log(`Types file has been generated at ${outputFilePath}.`);
}

function inferReturnType(node: ts.Node): string | null {
  if (ts.isBlock(node)) {
    const returnStatement = node.statements.find(ts.isReturnStatement);
    if (returnStatement && returnStatement.expression) {
      return inferTypeFromExpression(returnStatement.expression);
    }
  }
  return null;
}
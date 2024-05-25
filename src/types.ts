console.log("ts-type-watcher script started");

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

// Helper function to unwrap Promise type
function unwrapPromiseType(typeNode: ts.TypeNode): string {
  const typeText = typeNode.getText();
  const promiseMatch = typeText.match(/^Promise<(.*)>$/);
  if (promiseMatch) {
    return promiseMatch[1];
  }
  return typeText;
}

// Function to extract return type from function signature
function extractReturnType(
  node: ts.FunctionLikeDeclarationBase
): string | null {
  if (node.type) {
    return unwrapPromiseType(node.type);
  }
  return null;
}

// Helper function to parse model types from Prisma index.d.ts file
function parsePrismaModels(indexFilePath: string): Record<string, string> {
  if (!fs.existsSync(indexFilePath)) {
    console.error(`Prisma index file not found at ${indexFilePath}`);
    process.exit(1);
  }

  const sourceCode = fs.readFileSync(indexFilePath, "utf8");
  const sourceFile = ts.createSourceFile(
    indexFilePath,
    sourceCode,
    ts.ScriptTarget.ES2015,
    true
  );

  const modelTypes: Record<string, string> = {};

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const modelName = node.name.getText();
      const members = node.members
        .map((member) => {
          if (ts.isPropertySignature(member) && member.name) {
            const memberName = member.name.getText();
            const memberType = member.type ? member.type.getText() : "any";
            return `${memberName}: ${memberType}`;
          }
          return null;
        })
        .filter(Boolean)
        .join("; ");

      if (members) {
        modelTypes[modelName] = `{ ${members} }`;
      }
    }
  });

  return modelTypes;
}

// Function to parse files and generate types
export function parseFilesAndGenerateTypes(
  servicesDirectory: string,
  outputFile: string,
  prismaIndexFile: string
) {
  const modelTypes = parsePrismaModels(prismaIndexFile);

  const serviceDirPath = path.resolve(servicesDirectory);
  const files = fs
    .readdirSync(serviceDirPath)
    .filter(
      (file) =>
        file.endsWith("Services.ts") &&
        fs.lstatSync(path.join(serviceDirPath, file)).isFile()
    );

  const types: string[] = [];

  files.forEach((file) => {
    const filePath = path.join(serviceDirPath, file);
    const sourceCode = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.ES2015,
      true
    );

    ts.forEachChild(sourceFile, (node) => {
      if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach((declaration) => {
          if (
            ts.isVariableDeclaration(declaration) &&
            declaration.initializer &&
            ts.isArrowFunction(declaration.initializer)
          ) {
            const functionName = declaration.name.getText(sourceFile);
            let returnType = extractReturnType(declaration.initializer);

            if (returnType) {
              const mappedType = returnType.replace(/(\w+)/g, (match) => {
                return modelTypes[match] || match;
              });

              types.push(`type ${functionName}ReturnType = ${mappedType};`);
              console.log(`Extracted type for ${functionName}: ${mappedType}`);
            } else {
              console.log(`Could not extract type for ${functionName}`);
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

  fs.writeFileSync(outputFilePath, types.join("\n"), "utf8");
  console.log(`Types file has been generated at ${outputFilePath}.`);
}

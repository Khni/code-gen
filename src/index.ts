import * as chokidar from 'chokidar';
import { parseFilesAndGenerateTypes } from './types';
import { loadConfig } from './config';
import * as path from 'path';

const configPath = path.resolve(process.cwd(), 'ts-type-watcher-config.json');
const config = loadConfig(configPath);

if (!config) {
  console.error('Failed to load configuration.');
  process.exit(1);
}

const servicesPattern = `${config.servicesDirectory}/**/*Services.ts`;
const watcher = chokidar.watch(servicesPattern, {
  persistent: true,
});

watcher.on('add', filePath => handleFileChange(filePath));
watcher.on('change', filePath => handleFileChange(filePath));
watcher.on('unlink', filePath => handleFileChange(filePath));

function handleFileChange(filePath: string) {
  console.log(`File ${filePath} has been changed. Regenerating types...`);
  parseFilesAndGenerateTypes(config.servicesDirectory, config.outputFile);
}

console.log('Watching for file changes...');
import * as fs from "fs";
import * as path from "path";

export interface Config {
  servicesDirectory: string;
  outputFile: string;
  prismaIndexFile: string;
}

export function loadConfig(configPath: string): Config | null {
  if (!fs.existsSync(configPath)) {
    console.error(`Configuration file not found at ${configPath}`);
    return null;
  }

  const configFile = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configFile) as Config;
}

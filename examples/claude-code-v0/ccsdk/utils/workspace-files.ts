import { promises as fs } from "fs";
import * as path from "path";

const IGNORED_FILES = new Set<string>(["CLAUDE.MD"]);
const IGNORED_DIRECTORIES = new Set<string>([".agent"]);

const pathSegments = (filePath: string): string[] => {
  const normalized = path.normalize(filePath).replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean);
};

const shouldSkipDirectory = (directoryName: string): boolean => {
  return IGNORED_DIRECTORIES.has(directoryName);
};

const shouldSkipFile = (fileName: string): boolean => {
  return IGNORED_FILES.has(fileName);
};

export const isWorkspaceFileAllowed = (filePath: string): boolean => {
  const segments = pathSegments(filePath);

  if (segments.some((segment) => IGNORED_DIRECTORIES.has(segment))) {
    return false;
  }

  const fileName = segments.at(-1);
  if (!fileName) {
    return false;
  }

  return !IGNORED_FILES.has(fileName);
};

export async function readWorkspaceFiles(
  rootDir: string,
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entry.name)) {
          continue;
        }

        await walk(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!isWorkspaceFileAllowed(path.relative(rootDir, entryPath))) {
        continue;
      }

      const relativePath = path.relative(rootDir, entryPath);
      files[relativePath] = await fs.readFile(entryPath, "utf8");
    }
  }

  await walk(rootDir);

  return files;
}

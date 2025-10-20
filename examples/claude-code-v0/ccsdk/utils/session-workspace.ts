import { promises as fs } from "fs";
import * as path from "path";

export const getSessionWorkspacePath = (sessionId: string): string => {
  return path.join(process.cwd(), ".agent", sessionId);
};

export const ensureSessionWorkspace = async (
  sessionId: string,
): Promise<string> => {
  const sessionDir = getSessionWorkspacePath(sessionId);

  await fs.mkdir(sessionDir, { recursive: true });

  const templateDir = path.join(process.cwd(), "agent");

  try {
    await fs.access(templateDir);
    await copyTemplateDirectory(templateDir, sessionDir);
  } catch {
    // ignore missing template dir so session workspaces still initialize
  }

  return sessionDir;
};

const copyTemplateDirectory = async (
  sourceDir: string,
  targetDir: string,
): Promise<void> => {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);

      if (entry.isDirectory()) {
        await fs.mkdir(targetPath, { recursive: true });
        await copyTemplateDirectory(sourcePath, targetPath);
        return;
      }

      if (!entry.isFile()) {
        return;
      }

      try {
        await fs.access(targetPath);
      } catch {
        await fs.copyFile(sourcePath, targetPath);
      }
    }),
  );
};

import fs from "node:fs";
import path from "node:path";

import type { CheckResult, Plugin, PluginGenerateContext, PluginMetadata } from "@hprabhash/shared";
import { ProjectWriter, mergeEnvFile, type EnvFileEntry } from "@hprabhash/template-engine";
import { execa } from "execa";

const metadata: PluginMetadata = {
  id: "postgresql",
  name: "PostgreSQL",
  category: "database",
  version: "0.1.0",
  description: "Local dev instance via Docker Compose",
};

/** Not a placeholder — genuinely works the moment `docker compose up -d` runs, matching the docker-compose.yml below. */
const DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/app_dev";

const DOCKER_COMPOSE_CONTENT = `services:
  postgres:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
`;

function readIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : null;
}

async function checkDockerAvailable(): Promise<CheckResult[]> {
  try {
    const result = await execa("docker", ["--version"], { reject: false });
    if (result.exitCode === 0) {
      return [];
    }
  } catch {
    // fall through to the warning below
  }
  return [
    {
      id: "docker",
      label: "docker",
      status: "warn",
      message: "Not found on PATH — needed to run the generated docker-compose.yml.",
    },
  ];
}

const postgresPlugin: Plugin = {
  register: () => metadata,

  questions: () => [],

  validate: () => ({ valid: true, problems: [] }),

  doctor: (): Promise<CheckResult[]> => checkDockerAvailable(),

  generate: (context: PluginGenerateContext): Promise<void> =>
    Promise.resolve().then(() => {
      const writer = new ProjectWriter(context.projectDir);
      try {
        writer.writeFile("docker-compose.yml", DOCKER_COMPOSE_CONTENT);

        const envEntries: EnvFileEntry[] = [
          {
            key: "DATABASE_URL",
            value: DATABASE_URL,
            comment: "PostgreSQL connection string — `docker compose up -d` to start it locally.",
          },
        ];

        const envPath = path.join(context.projectDir, ".env");
        const envExamplePath = path.join(context.projectDir, ".env.example");
        writer.patchFile(".env", mergeEnvFile(readIfExists(envPath), envEntries));
        writer.patchFile(".env.example", mergeEnvFile(readIfExists(envExamplePath), envEntries));
      } catch (error) {
        writer.rollback();
        throw error;
      }
      writer.commit();
    }),

  // No install()/postInstall() — nothing to run without a live decision from
  // the user about where Postgres actually runs.
};

export default postgresPlugin;

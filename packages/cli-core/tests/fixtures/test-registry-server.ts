import { createHash } from "node:crypto";
import http from "node:http";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export const WIDGET_FILES: Record<string, Record<string, string>> = {
  "1.0.0": {
    "package.json": '{"name":"widget","version":"1.0.0"}\n',
    "README.md": "Widget v1.0.0\n",
  },
  "1.1.0": {
    "package.json": '{"name":"widget","version":"1.1.0"}\n',
    "README.md": "Widget v1.1.0\n",
  },
  "9.9.9": {
    "package.json": '{"name":"widget","version":"9.9.9"}\n',
  },
};

export interface TestRegistryServer {
  url: string;
  close: () => Promise<void>;
}

/**
 * A real `node:http` server serving a small fixture registry — one template
 * ("widget", versions 1.0.0/1.1.0) plus a "9.9.9" version whose served files
 * deliberately don't match the checksum its own manifest.json declares, to
 * exercise checksum-rejection. Used by both the integration test (talking to
 * `registry-client.ts`/`template-cache.ts` directly) and the e2e test
 * (talking to the built CLI via `--registry-url`) — a real TCP server, not an
 * in-process mock, so both can reach it identically.
 */
export function startTestRegistryServer(): Promise<TestRegistryServer> {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter((segment) => segment.length > 0);

    if (url.pathname === "/templates.json") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          templates: [
            {
              id: "widget",
              name: "Widget",
              description: "A test widget template.",
              latest: "1.1.0",
              versions: ["1.0.0", "1.1.0"],
            },
          ],
        }),
      );
      return;
    }

    if (parts[0] === "templates" && parts[3] === "manifest.json") {
      const id = parts[1];
      const version = parts[2];
      const files = id === "widget" ? WIDGET_FILES[version ?? ""] : undefined;
      if (!files) {
        res.writeHead(404);
        res.end();
        return;
      }
      const checksums: Record<string, string> = {};
      for (const [relPath, content] of Object.entries(files)) {
        checksums[relPath] = sha256(content);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ files: checksums }));
      return;
    }

    if (parts[0] === "templates" && parts[3] === "files") {
      const id = parts[1];
      const version = parts[2];
      const relPath = parts.slice(4).join("/");
      const files = id === "widget" ? WIDGET_FILES[version ?? ""] : undefined;
      const content = files?.[relPath];
      if (content === undefined) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(version === "9.9.9" ? "CORRUPTED — does not match the declared checksum" : content);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/templates.json`,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => {
              res();
            });
          }),
      });
    });
  });
}

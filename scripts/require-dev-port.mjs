import net from "node:net";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 3000;

function readPort(rawPort) {
  const parsed = Number.parseInt(rawPort ?? `${DEFAULT_PORT}`, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid dev port: ${rawPort ?? ""}`);
  }

  return parsed;
}

export async function assertDevPortAvailable(rawPort = `${DEFAULT_PORT}`) {
  const port = readPort(rawPort);
  const available = await isPortAvailable(port);

  if (available) {
    return port;
  }

  const message = [
    "",
    `[dev-port] Port ${port} is already in use.`,
    `[dev-port] Stop the existing local dashboard server and run this command again.`,
    `[dev-port] The local app must run on http://localhost:${port} so the browser and API always point to the same runtime.`,
    "",
  ].join("\n");

  throw new Error(message);
}

export async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once("error", error => {
      if (error && typeof error === "object" && "code" in error) {
        const code = String(error.code);
        if (code === "EADDRINUSE") {
          resolve(false);
          return;
        }
      }

      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen({
      port,
      exclusive: true,
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertDevPortAvailable(process.argv[2]).catch(error => {
    console.error(
      error instanceof Error ? error.message : "Unable to verify the dev port."
    );
    process.exitCode = 1;
  });
}

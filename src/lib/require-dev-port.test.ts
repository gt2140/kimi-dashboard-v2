import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";

const activeServers = new Set<net.Server>();

async function loadPortGuardModule() {
  // @ts-expect-error The runtime script is exercised directly in tests.
  return (await import("../../scripts/require-dev-port.mjs")) as {
    assertDevPortAvailable: (rawPort?: string) => Promise<number>;
    isPortAvailable: (port: number) => Promise<boolean>;
  };
}

afterEach(async () => {
  await Promise.all(
    [...activeServers].map(
      server =>
        new Promise<void>(resolve => {
          server.close(() => resolve());
        })
    )
  );
  activeServers.clear();
});

async function occupyRandomPort() {
  const server = net.createServer();
  activeServers.add(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP address for the test server.");
  }

  return address.port;
}

describe("require-dev-port", () => {
  it("reports a free port as available", async () => {
    const { isPortAvailable } = await loadPortGuardModule();
    const port = await occupyRandomPort();
    await new Promise<void>(resolve => {
      const server = [...activeServers][0];
      server.close(() => {
        activeServers.delete(server);
        resolve();
      });
    });

    await expect(isPortAvailable(port)).resolves.toBe(true);
  });

  it("reports an occupied port as unavailable", async () => {
    const { isPortAvailable } = await loadPortGuardModule();
    const port = await occupyRandomPort();

    await expect(isPortAvailable(port)).resolves.toBe(false);
  });

  it("throws a readable error when the required dev port is occupied", async () => {
    const { assertDevPortAvailable } = await loadPortGuardModule();
    const port = await occupyRandomPort();

    await expect(assertDevPortAvailable(`${port}`)).rejects.toThrow(
      `Port ${port} is already in use.`
    );
  });
});

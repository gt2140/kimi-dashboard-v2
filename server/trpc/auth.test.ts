import { beforeEach, describe, expect, it, vi } from "vitest";
import { Session } from "../../contracts/constants.js";
import { authenticateRequest } from "./auth.js";

const {
  verifySessionToken,
  findUserByUnionId,
  upsertUser,
} = vi.hoisted(() => ({
  verifySessionToken: vi.fn(),
  findUserByUnionId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("../kimi/session.js", () => ({
  signSessionToken: vi.fn(),
  verifySessionToken,
}));

vi.mock("../queries/users.js", () => ({
  findUserByUnionId,
  upsertUser,
}));

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to Supabase bearer auth when the legacy cookie is stale", async () => {
    verifySessionToken.mockResolvedValue(null);
    upsertUser.mockResolvedValue(undefined);
    findUserByUnionId.mockImplementation(async (unionId: string) => {
      if (unionId === "supabase:sb-user-1") {
        return {
          id: 7,
          unionId,
          email: "gaston@example.com",
          name: "Gaston",
        };
      }

      return null;
    });

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "sb-user-1",
            email: "gaston@example.com",
            user_metadata: { full_name: "Gaston" },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    const user = await authenticateRequest(
      new Headers({
        cookie: `${Session.cookieName}=stale-session`,
        authorization: "Bearer supabase-token",
      }),
    );

    expect(verifySessionToken).toHaveBeenCalledWith("stale-session");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(user).toEqual(
      expect.objectContaining({
        id: 7,
        unionId: "supabase:sb-user-1",
      }),
    );

    fetchMock.mockRestore();
  });
});

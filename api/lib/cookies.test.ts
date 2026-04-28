import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

describe("getSessionCookieOptions", () => {
  it("uses lax cookies on localhost", () => {
    const headers = new Headers({
      host: "localhost:3000",
    });

    expect(getSessionCookieOptions(headers)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: false,
    });
  });

  it("uses secure none cookies outside localhost", () => {
    const headers = new Headers({
      host: "aura.example.com",
    });

    expect(getSessionCookieOptions(headers)).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "None",
      secure: true,
    });
  });
});

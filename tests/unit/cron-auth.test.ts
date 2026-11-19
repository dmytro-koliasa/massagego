import { describe, expect, it } from "vitest";
import { authorizeCron, type CronAuthEnv } from "@/lib/cron-auth";

function requestWithAuth(authorization: string | null): Request {
  const headers = new Headers();
  if (authorization !== null) headers.set("authorization", authorization);
  return new Request("http://test/api/cron/notifications", { headers });
}

describe("authorizeCron (#116)", () => {
  it("rejects when secret is missing in every environment", () => {
    const env: CronAuthEnv = { secret: null };
    expect(authorizeCron(requestWithAuth("Bearer anything"), env)).toBe(false);
    expect(authorizeCron(requestWithAuth(null), env)).toBe(false);
  });

  it("rejects empty secret", () => {
    expect(
      authorizeCron(requestWithAuth("Bearer "), { secret: "" }),
    ).toBe(false);
  });

  it("rejects missing or wrong Bearer token", () => {
    const env: CronAuthEnv = { secret: "s3cret" };
    expect(authorizeCron(requestWithAuth(null), env)).toBe(false);
    expect(authorizeCron(requestWithAuth("Bearer wrong"), env)).toBe(false);
    expect(authorizeCron(requestWithAuth("s3cret"), env)).toBe(false);
  });

  it("accepts the correct Bearer token", () => {
    const env: CronAuthEnv = { secret: "s3cret" };
    expect(authorizeCron(requestWithAuth("Bearer s3cret"), env)).toBe(true);
  });
});

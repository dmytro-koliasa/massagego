import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts?: Record<string, string>;
};

function readPackageJson(): PackageJson {
  const file = path.resolve(process.cwd(), "package.json");
  return JSON.parse(readFileSync(file, "utf8")) as PackageJson;
}

describe("package.json scripts (#112)", () => {
  it("keeps build free of prisma migrate deploy", () => {
    const { scripts } = readPackageJson();
    const build = scripts?.build ?? "";

    expect(build).toContain("prisma generate");
    expect(build).toContain("next build");
    expect(build.toLowerCase()).not.toContain("migrate");
  });

  it("exposes an explicit migrate command", () => {
    const { scripts } = readPackageJson();
    expect(scripts?.["db:migrate"]).toMatch(/prisma migrate deploy/);
    expect(scripts?.["db:migrate:test"]).toBeTruthy();
  });

  it("does not reintroduce migrate via prebuild/postbuild hooks", () => {
    const { scripts } = readPackageJson();
    for (const name of ["prebuild", "postbuild", "prestart", "poststart"] as const) {
      const value = scripts?.[name];
      if (!value) continue;
      expect(value.toLowerCase()).not.toContain("migrate");
    }
  });
});

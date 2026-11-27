import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** WCAG 2.x A/AA tags (incl. 2.2 where supported by axe-core). */
export const WCAG_AA_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

export type SanitizedViolation = {
  id: string;
  impact: string | null | undefined;
  description: string;
  helpUrl: string;
  nodes: number;
  /** CSS targets only — no page text / PII. */
  targets: string[][];
};

export type AxeScanSummary = {
  label: string;
  url: string;
  violationCount: number;
  seriousOrCritical: SanitizedViolation[];
  otherViolations: SanitizedViolation[];
};

type AxeNode = { target: unknown };
type AxeViolation = {
  id: string;
  impact?: string | null;
  description: string;
  helpUrl: string;
  nodes: AxeNode[];
};

function sanitizeViolation(v: AxeViolation): SanitizedViolation {
  return {
    id: v.id,
    impact: v.impact,
    description: v.description,
    helpUrl: v.helpUrl,
    nodes: v.nodes.length,
    targets: v.nodes.map((n) => {
      const t = n.target;
      if (Array.isArray(t)) return t.map(String);
      return [String(t)];
    }),
  };
}

export function isSeriousOrCritical(v: {
  impact?: string | null;
}): boolean {
  return v.impact === "critical" || v.impact === "serious";
}

/**
 * Wait until entrance animations / fonts settle so axe color-contrast is not
 * measured against mid-fade opacity (home `.animate-fade-up` is 0.9s + delay).
 */
export async function waitForA11yPaintStable(page: Page): Promise<void> {
  // Cap fonts.ready — it can hang under parallel Chromium load.
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
    ]);
  });
  await page.waitForFunction(
    () => {
      const nodes = document.querySelectorAll(".animate-fade-up");
      if (nodes.length === 0) return true;
      return [...nodes].every(
        (el) => Number(getComputedStyle(el).opacity) >= 0.99,
      );
    },
    undefined,
    { timeout: 5_000 },
  ).catch(() => {
    /* pages without the animation, or reduced-motion, still scan */
  });
}

/**
 * Run axe against the current page (WCAG A/AA tags only — not best-practice noise).
 * Does not claim full WCAG conformance.
 */
export async function scanPageWcagAa(
  page: Page,
  label: string,
): Promise<AxeScanSummary> {
  await waitForA11yPaintStable(page);

  const raw = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();

  const sanitized = (raw.violations as AxeViolation[]).map(sanitizeViolation);
  const seriousOrCritical = sanitized.filter(isSeriousOrCritical);
  const otherViolations = sanitized.filter((v) => !isSeriousOrCritical(v));

  return {
    label,
    url: page.url(),
    violationCount: sanitized.length,
    seriousOrCritical,
    otherViolations,
  };
}

/** Write sanitized JSON under docs/quality (git-friendly; no HTML snippets). */
export function writeAxeSummary(
  summary: AxeScanSummary,
  fileName: string,
): string {
  const dir = path.resolve(process.cwd(), "docs", "quality");
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, fileName);
  fs.writeFileSync(full, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return full;
}

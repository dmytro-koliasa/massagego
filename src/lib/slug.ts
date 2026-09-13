import { prisma } from "@/lib/prisma";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ye",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "yi",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "yu",
  я: "ya",
  ы: "y",
  э: "e",
  ъ: "",
  ё: "yo",
};

const SLUG_MAX_LENGTH = 60;

/** Turn a display name into a URL-safe latin slug base. */
export function slugifyName(value: string) {
  const lowered = value.trim().toLowerCase();
  let out = "";

  for (const char of lowered) {
    if (CYRILLIC_TO_LATIN[char] !== undefined) {
      out += CYRILLIC_TO_LATIN[char];
      continue;
    }
    if (/[a-z0-9]/.test(char)) {
      out += char;
      continue;
    }
    if (/\s|-|_/.test(char) || char === "'" || char === "’") {
      out += "-";
    }
  }

  return out
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-$/g, "");
}

export function buildSlugBase(parts: Array<string | null | undefined>) {
  for (const part of parts) {
    const slug = part ? slugifyName(part) : "";
    if (slug) return slug;
  }
  return "masseur";
}

/** Find a unique slug, appending -2, -3, … when needed. */
export async function allocateUniqueSlug(
  baseInput: string,
  options?: { excludeUserId?: string },
) {
  const base = (baseInput || "masseur")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-$/g, "") || "masseur";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, SLUG_MAX_LENGTH - 4)}-${attempt + 1}`;

    const existing = await prisma.user.findFirst({
      where: {
        slug: candidate,
        ...(options?.excludeUserId
          ? { NOT: { id: options.excludeUserId } }
          : {}),
      },
      select: { id: true },
    });

    if (!existing) return candidate;
  }

  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

/**
 * Backfill unique public slugs for masseur users that don't have one yet.
 * Run: node scripts/backfill-masseur-slugs.js
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CYRILLIC_TO_LATIN = {
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

function slugifyName(value) {
  const lowered = String(value || "")
    .trim()
    .toLowerCase();
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
    .slice(0, 60)
    .replace(/-$/g, "");
}

async function allocateUniqueSlug(baseInput, used) {
  const base = (baseInput || "masseur").slice(0, 60).replace(/-$/g, "") || "masseur";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 56)}-${attempt + 1}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `${base.slice(0, 40)}-${Date.now().toString(36)}`;
  used.add(fallback);
  return fallback;
}

async function main() {
  const masseurs = await prisma.user.findMany({
    where: { portal: "masseur" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      nameUk: true,
      slug: true,
      email: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const used = new Set(
    masseurs.map((user) => user.slug).filter(Boolean),
  );

  let updated = 0;
  for (const user of masseurs) {
    if (user.slug) continue;

    const base =
      slugifyName(user.nameEn) ||
      slugifyName(user.nameUk) ||
      slugifyName(user.name) ||
      slugifyName(user.email.split("@")[0]) ||
      `masseur-${user.id.slice(-6)}`;

    const slug = await allocateUniqueSlug(base, used);
    await prisma.user.update({
      where: { id: user.id },
      data: { slug },
    });
    updated += 1;
    console.log(`${user.email} -> /client/masseur/${slug}`);
  }

  console.log(`Done. Assigned ${updated} slug(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

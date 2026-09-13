const { PrismaClient } = require("@prisma/client");
const { hash } = require("bcryptjs");

const prisma = new PrismaClient();

const MASSEURS = [
  {
    email: "test.masseur.kyiv@example.com",
    nameEn: "Olena Kyiv",
    nameUk: "Олена Київська",
    city: "Київ",
    address: "вул. Хрещатик, 10",
  },
  {
    email: "test.masseur.lviv@example.com",
    nameEn: "Andriy Lviv",
    nameUk: "Андрій Львівський",
    city: "Львів",
    address: "пл. Ринок, 1",
  },
  {
    email: "test.masseur.odesa@example.com",
    nameEn: "Maria Odesa",
    nameUk: "Марія Одеська",
    city: "Одеса",
    address: "вул. Дерибасівська, 5",
  },
  {
    email: "test.masseur.kharkiv@example.com",
    nameEn: "Dmytro Kharkiv",
    nameUk: "Дмитро Харківський",
    city: "Харків",
    address: "вул. Сумська, 22",
  },
  {
    email: "test.masseur.dnipro@example.com",
    nameEn: "Iryna Dnipro",
    nameUk: "Ірина Дніпровська",
    city: "Дніпро",
    address: "пр. Дмитра Яворницького, 3",
  },
  {
    email: "test.masseur.vinnytsia@example.com",
    nameEn: "Serhii Vinnytsia",
    nameUk: "Сергій Вінницький",
    city: "Вінниця",
    address: "вул. Соборна, 15",
  },
  {
    email: "test.masseur.poltava@example.com",
    nameEn: "Kateryna Poltava",
    nameUk: "Катерина Полтавська",
    city: "Полтава",
    address: "вул. Небесної Сотні, 8",
  },
  {
    email: "test.masseur.chernihiv@example.com",
    nameEn: "Taras Chernihiv",
    nameUk: "Тарас Чернігівський",
    city: "Чернігів",
    address: "пр. Миру, 12",
  },
  {
    email: "test.masseur.ivano@example.com",
    nameEn: "Natalia Ivano-Frankivsk",
    nameUk: "Наталія Івано-Франківська",
    city: "Івано-Франківськ",
    address: "вул. Незалежності, 4",
  },
  {
    email: "test.masseur.uzhhorod@example.com",
    nameEn: "Bohdan Uzhhorod",
    nameUk: "Богдан Ужгородський",
    city: "Ужгород",
    address: "пл. Корятовича, 2",
  },
];

async function main() {
  const passwordHash = await hash("password123", 12);
  let created = 0;
  let skipped = 0;

  for (const item of MASSEURS) {
    const existing = await prisma.user.findUnique({
      where: {
        email_portal: { email: item.email, portal: "masseur" },
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.user.create({
      data: {
        email: item.email,
        name: item.nameUk,
        nameEn: item.nameEn,
        nameUk: item.nameUk,
        slug: item.nameEn
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        city: item.city,
        address: item.address,
        passwordHash,
        portal: "masseur",
        descriptionEn: `Test masseur profile in ${item.city}.`,
        descriptionUk: `Тестовий профіль масажиста в місті ${item.city}.`,
        massageTypes: JSON.stringify(["classic", "relaxing"]),
      },
    });
    created += 1;
  }

  const total = await prisma.user.count({ where: { portal: "masseur" } });
  console.log(
    JSON.stringify({ created, skipped, totalMasseurs: total }, null, 2),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

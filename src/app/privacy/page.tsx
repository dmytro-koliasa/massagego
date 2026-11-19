import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Locale } from '@/lib/i18n';

function readLocale(value: string | undefined): Locale {
  return value === 'uk' || value === 'en' ? value : 'en';
}

const copy = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 19 November 2026',
    intro:
      'This Privacy Policy explains how MassageGo (“we”, “us”) collects and uses personal data when you use our website and booking service. It is a product statement for the current implementation and may be updated after legal review.',
    sections: [
      {
        h: '1. Who we are',
        p: 'MassageGo is a platform that connects massage therapists (masseurs) and clients for scheduling sessions. Contact for privacy questions should be made through the support channels published on the site once available.',
      },
      {
        h: '2. Data we collect',
        p: 'Depending on your role we may store: name, email address, phone number, city and address details, preferred language, timezone (masseurs), profile and gallery images, passwords (hashed), booking details (time, massage type, cancellation reason), and notification preferences.',
      },
      {
        h: '3. Why we use data',
        p: 'We use personal data to create and secure accounts, show masseur profiles, create and manage bookings, send transactional notices, optional phone confirmation, prevent abuse (rate limits), and operate and improve the service.',
      },
      {
        h: '4. Email notifications',
        p: 'Transactional emails (new booking, confirmation, cancellations) are sent through our email provider (for example Resend). Message content does not include phone numbers. You can adjust per-event email preferences in Notifications, subject to keeping at least one channel on for critical events.',
      },
      {
        h: '5. Telegram',
        p: 'Connecting Telegram is optional. If you connect, we store your Telegram chat identifier and send the same booking events to that chat when enabled. Telegram is an independent service and processes messages under its own terms. You may disconnect in the app or with /disconnect in the bot. Optional phone confirmation uses Telegram’s “share contact” feature: we check that the contact belongs to your Telegram account and matches the phone on your MassageGo account, then store a “phone confirmed” mark. Confirmation is not required to register or book.',
      },
      {
        h: '6. Sharing',
        p: 'We share data with processors needed to run the service (hosting, database, email, Telegram when connected, authentication providers such as Google if you use them). Masseur phone numbers are public on profiles by product design. We do not sell personal data.',
      },
      {
        h: '7. Retention',
        p: 'Cancelled bookings without a retention hold are hard-deleted about 7 days after cancellation. Completed bookings without a hold are hard-deleted about 3 months after the session start. In-app notification inbox rows are removed after about 30 days. Notification delivery log rows (outbox) that have finished or permanently failed are removed after about 7 days; rows still in the retry window are kept for up to about 48 hours. Abuse-prevention rate-limit counters are stored with hashed identifiers and purged about a day after their sliding window ends. Self-service account deletion anonymises your profile (name, phone, email, photos, address, descriptions), ends sessions and Telegram linking, and cancels a client’s future bookings with notice to masseurs. Copies in hosting backups may remain until those backups expire; that retention is reviewed under our legal process (P-2) and is not purged by the application job.',
      },
      {
        h: '8. Your choices',
        p: 'You can update profile data, notification preferences, disconnect Telegram, delete your account in the profile, and request support for access or erasure where applicable under GDPR or other laws that may apply. Formal legal review of retention and rights wording is planned before production use with real users.',
      },
      {
        h: '9. Security',
        p: 'We use hashed passwords, session cookies per portal, HTTPS in production, and access controls on server routes. No method of transmission or storage is completely secure.',
      },
      {
        h: '10. Changes',
        p: 'We may update this policy as the product changes. The “Last updated” date above will change when we do.',
      },
    ],
    back: 'Back to home',
  },
  uk: {
    title: 'Політика конфіденційності',
    updated: 'Оновлено: 19 листопада 2026',
    intro:
      'Ця Політика пояснює, як MassageGo («ми») збирає та використовує персональні дані під час користування сайтом і сервісом бронювання. Це продуктова заява для поточної реалізації; після юридичного огляду текст може бути оновлений.',
    sections: [
      {
        h: '1. Хто ми',
        p: 'MassageGo — платформа, що з’єднує масажистів і клієнтів для планування сеансів. Контакти з питань конфіденційності будуть опубліковані на сайті, коли з’явиться канал підтримки.',
      },
      {
        h: '2. Які дані збираємо',
        p: 'Залежно від ролі ми можемо зберігати: ім’я, email, телефон, місто та адресу, мову інтерфейсу, часовий пояс (для масажистів), фото профілю й галереї, паролі (хеш), дані бронювань (час, тип масажу, причина скасування) і налаштування сповіщень.',
      },
      {
        h: '3. Навіщо використовуємо дані',
        p: 'Дані потрібні для створення й захисту акаунтів, показу профілів масажистів, створення й керування бронюваннями, транзакційних сповіщень, опційного підтвердження телефону, запобігання зловживанням і роботи сервісу.',
      },
      {
        h: '4. Email-сповіщення',
        p: 'Транзакційні листи (нове бронювання, підтвердження, скасування) надсилаються через email-провайдера (наприклад Resend). У текстах немає номерів телефонів. Налаштування можна змінити в «Сповіщеннях», залишаючи хоча б один канал для важливих подій.',
      },
      {
        h: '5. Telegram',
        p: 'Підключення Telegram необов’язкове. Після підключення ми зберігаємо ідентифікатор чату й надсилаємо туди ті самі події бронювання, якщо канал увімкнено. Telegram — окремий сервіс зі своїми умовами. Від’єднати можна в застосунку або командою /disconnect у боті. Опційне підтвердження телефону використовує «поділитися контактом»: ми перевіряємо, що контакт належить вашому акаунту Telegram і збігається з телефоном у MassageGo, після чого зберігаємо позначку «телефон підтверджено». Підтвердження не потрібне для реєстрації чи бронювання.',
      },
      {
        h: '6. Передача даних',
        p: 'Ми передаємо дані процесорам, потрібним для роботи сервісу (хостинг, база даних, email, Telegram після підключення, провайдери входу на кшталт Google). Телефон масажиста публічний у профілі за рішенням продукту. Ми не продаємо персональні дані.',
      },
      {
        h: '7. Зберігання',
        p: 'Скасовані бронювання без hold видаляються приблизно через 7 днів після скасування. Завершені бронювання без hold — приблизно через 3 місяці після початку сеансу. Рядки in-app inbox видаляються приблизно через 30 днів. Журнал доставки сповіщень (outbox) після успіху або остаточної помилки — приблизно через 7 днів; рядки в вікні повторів зберігаються до близько 48 годин. Лічильники антизловживань зберігаються з хешованими ідентифікаторами й очищаються приблизно через день після кінця вікна. Самостійне видалення акаунта анонімізує профіль (ім’я, телефон, email, фото, адресу, описи), завершує сесії й Telegram і скасовує майбутні бронювання клієнта з повідомленням масажистам. Копії в резервних копіях хостингу можуть лишатися до закінчення їхнього строку; це розглядається в юридичному процесі (P-2) і не чиститься job застосунку.',
      },
      {
        h: '8. Ваші можливості',
        p: 'Ви можете оновлювати профіль, налаштування сповіщень, від’єднувати Telegram, видалити акаунт у профілі та звертатися щодо доступу чи видалення даних, якщо це передбачено GDPR чи іншими застосовними законами. Юридичний огляд формулювань заплановано до роботи з реальними користувачами.',
      },
      {
        h: '9. Безпека',
        p: 'Ми використовуємо хешовані паролі, окремі cookie сесій для portal, HTTPS у продакшені та перевірки доступу на сервері. Жоден спосіб передачі чи зберігання не є абсолютно безпечним.',
      },
      {
        h: '10. Зміни',
        p: 'Ми можемо оновлювати цю політику разом із продуктом. Дата «Оновлено» зміниться при оновленні тексту.',
      },
    ],
    back: 'На головну',
  },
} as const;

export default async function PrivacyPage() {
  const cookieStore = await cookies();
  const locale = readLocale(cookieStore.get('serein-locale')?.value);
  const c = copy[locale];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-[15px] py-10">
      <h1 className="font-display text-4xl tracking-[-0.03em] text-foreground">
        {c.title}
      </h1>
      <p className="mt-2 text-sm text-muted">{c.updated}</p>
      <p className="mt-6 text-sm leading-relaxed text-foreground">{c.intro}</p>
      <div className="mt-8 space-y-6">
        {c.sections.map((section) => (
          <section key={section.h}>
            <h2 className="text-lg font-semibold text-foreground">{section.h}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{section.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-10">
        <Link href="/" className="text-sm text-accent underline-offset-2 hover:underline">
          {c.back}
        </Link>
      </p>
    </main>
  );
}

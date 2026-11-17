import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Locale } from '@/lib/i18n';

function readLocale(value: string | undefined): Locale {
  return value === 'uk' || value === 'en' ? value : 'en';
}

const copy = {
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: 17 November 2026',
    intro:
      'These Terms govern use of MassageGo by masseurs and clients. They describe the current product rules and may be updated after legal review before production use with real users.',
    sections: [
      {
        h: '1. Service',
        p: 'MassageGo provides tools to create profiles, publish availability, and book massage sessions between masseurs and clients. We are not a party to the massage service itself and do not employ masseurs or guarantee session quality.',
      },
      {
        h: '2. Accounts',
        p: 'Client and masseur portals are separate accounts. You must provide accurate information, keep credentials secure, and use only one identity per portal unless the product explicitly allows otherwise. You are responsible for activity under your account.',
      },
      {
        h: '3. Bookings and cancellations',
        p: 'Bookings follow the lead-time, window, and cancellation cutoff rules configured for each masseur and enforced by the application. Clients may need to give a cancellation reason. Walk-in bookings created by masseurs may not trigger client notifications.',
      },
      {
        h: '4. Notifications',
        p: 'Email is the primary notification channel. Telegram is optional after you connect the bot from the app. Critical events require at least one channel to remain enabled. Notices are informational and do not include phone numbers in message bodies.',
      },
      {
        h: '5. Phone confirmation',
        p: 'Optional phone confirmation via Telegram marks that the shared contact matches the phone on your account. It is not required to register or book. Masseurs may confirm a phone for their own account; the client “phone confirmed” mark is shown to masseurs on booking details.',
      },
      {
        h: '6. Acceptable use',
        p: 'You must not abuse the service, attempt unauthorized access, scrape personal data, spam, or post unlawful or harmful content. We may rate-limit sensitive actions and may later introduce administrator blocking under separate product rules.',
      },
      {
        h: '7. Content and profiles',
        p: 'You are responsible for profile text and images you upload. Masseur contact details that the product marks as public (including phone) may be visible to clients.',
      },
      {
        h: '8. Availability',
        p: 'We aim for reasonable uptime but do not warrant uninterrupted service. Features depending on third parties (email, Telegram, maps, hosting) may be unavailable when those providers are.',
      },
      {
        h: '9. Liability',
        p: 'To the extent permitted by law, MassageGo is provided “as is” for scheduling facilitation. We are not liable for disputes between masseurs and clients, missed sessions, or third-party service failures beyond what mandatory law requires.',
      },
      {
        h: '10. Changes',
        p: 'We may change these Terms as the product evolves. Continued use after an update constitutes acceptance of the revised Terms when they are published with a new “Last updated” date.',
      },
    ],
    back: 'Back to home',
  },
  uk: {
    title: 'Умови використання',
    updated: 'Оновлено: 17 листопада 2026',
    intro:
      'Ці Умови регулюють користування MassageGo масажистами та клієнтами. Вони описують поточні правила продукту й можуть бути оновлені після юридичного огляду перед роботою з реальними користувачами.',
    sections: [
      {
        h: '1. Сервіс',
        p: 'MassageGo надає інструменти для профілів, доступності та бронювання сеансів між масажистами й клієнтами. Ми не є стороною самого масажу, не наймаємо масажистів і не гарантуємо якість сеансу.',
      },
      {
        h: '2. Облікові записи',
        p: 'Портали клієнта й масажиста — окремі акаунти. Потрібно надавати точні дані, зберігати доступ і не використовувати чужі акаунти. Ви відповідаєте за дії у своєму обліковому записі.',
      },
      {
        h: '3. Бронювання та скасування',
        p: 'Бронювання підпорядковуються правилам lead-time, вікна й cutoff скасування кожного масажиста. Клієнту може знадобитися причина скасування. Walk-in від масажиста може не надсилати сповіщення клієнту.',
      },
      {
        h: '4. Сповіщення',
        p: 'Email — основний канал. Telegram опційний після підключення бота з застосунку. Для важливих подій має лишатися увімкненим хоча б один канал. Сповіщення інформаційні й не містять телефонів у тексті.',
      },
      {
        h: '5. Підтвердження телефону',
        p: 'Опційне підтвердження через Telegram позначає, що спільний контакт збігається з телефоном у акаунті. Воно не потрібне для реєстрації чи бронювання. Масажисти можуть підтвердити свій телефон; позначку клієнта бачить масажист у деталях бронювання.',
      },
      {
        h: '6. Прийнятне використання',
        p: 'Заборонено зловживати сервісом, намагатися отримати несанкціонований доступ, збирати чужі дані, спамити чи публікувати незаконний контент. Ми можемо обмежувати частоту чутливих дій; блокування адміністратором з’явиться окремими правилами.',
      },
      {
        h: '7. Контент і профілі',
        p: 'Ви відповідаєте за текст і зображення профілю. Контакти масажиста, які продукт робить публічними (зокрема телефон), можуть бути видимі клієнтам.',
      },
      {
        h: '8. Доступність',
        p: 'Ми прагнемо стабільної роботи, але не гарантуємо безперервність. Функції, що залежать від третіх сторін (email, Telegram, карти, хостинг), можуть бути недоступні через них.',
      },
      {
        h: '9. Відповідальність',
        p: 'Наскільки дозволяє закон, MassageGo надається «як є» для організації розкладу. Ми не відповідаємо за суперечки між масажистом і клієнтом, пропущені сеанси чи збої третіх сторін понад вимоги обов’язкового права.',
      },
      {
        h: '10. Зміни',
        p: 'Ми можемо змінювати Умови разом із продуктом. Подальше користування після публікації оновлення з новою датою означає прийняття оновлених Умов.',
      },
    ],
    back: 'На головну',
  },
} as const;

export default async function TermsPage() {
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

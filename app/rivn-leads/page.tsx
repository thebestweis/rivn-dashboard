import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "RIVN Leads | Горячие заявки из Telegram",
  description:
    "RIVN Leads 24/7 находит сообщения в Telegram, где люди ищут специалистов, подрядчиков и услуги, и присылает заявки прямо в Telegram.",
};

const telegramUrl = "https://t.me/thebestweis";

const leadExamples = [
  "Ищу таргетолога для запуска рекламы",
  "Нужен специалист по Яндекс.Директу",
  "Кто может настроить CRM?",
  "Посоветуйте монтажера для Reels",
  "Нужен SMM для ведения Telegram-канала",
  "Ищем подрядчика по лендингу",
];

const audiences = [
  "Директологам",
  "Таргетологам",
  "SMM-специалистам",
  "CRM-интеграторам",
  "Дизайнерам и разработчикам",
  "Монтажерам",
  "Агентствам",
  "Малому бизнесу с услугами по всей России",
];

const solutionSteps = [
  {
    title: "Настраиваем вашу нишу",
    text: "Подбираем ключевые слова, стоп-слова и базу Telegram-чатов, где могут появляться реальные запросы.",
  },
  {
    title: "Мониторим Telegram 24/7",
    text: "Система постоянно отслеживает доступные чаты и сообщества, а не только тогда, когда у вас есть время.",
  },
  {
    title: "Присылаем лиды в Telegram",
    text: "Найденные заявки приходят в отдельную беседу, чтобы вы или менеджер могли быстро отреагировать.",
  },
];

const benefits = [
  "Человек уже сформулировал потребность",
  "Заявка приходит из живого общения",
  "Telegram привычен для быстрой коммуникации",
  "Можно реагировать раньше конкурентов",
  "Не нужно вручную мониторить десятки чатов",
  "Система работает постоянно",
];

const setupItems = [
  "подбираем базу Telegram-чатов",
  "добавляем ключевые слова",
  "добавляем стоп-слова",
  "отсекаем мусорные запросы",
  "подключаем отдельную Telegram-беседу для заявок",
  "помогаем запустить первые тесты",
];

const pricingItems = [
  "доступ к RIVN Leads",
  "настройка проекта",
  "мониторинг Telegram-чатов",
  "заявки в Telegram",
  "ключевые слова и стоп-слова",
  "статистика по лидам",
  "поддержка запуска",
];

const faqs = [
  {
    question: "Что считается заявкой?",
    answer:
      "Лид — это сообщение в Telegram, где человек уже ищет услугу, специалиста или подрядчика. Например: «нужен директолог» или «посоветуйте CRM-интегратора».",
  },
  {
    question: "Из каких чатов приходят лиды?",
    answer:
      "Мы работаем с Telegram-чатами и сообществами, к которым есть доступ: бизнес-клубами, нишевыми группами, чатами предпринимателей и профессиональными обсуждениями.",
  },
  {
    question: "Можно ли настроить под мою нишу?",
    answer:
      "Да. Для каждой ниши отдельно настраиваются ключевые слова, стоп-слова и база чатов, чтобы система находила более релевантные сообщения.",
  },
  {
    question: "Нужно ли мне самому сидеть в Telegram-чатах?",
    answer:
      "Нет. RIVN Leads мониторит чаты 24/7 и присылает найденные заявки в отдельную Telegram-беседу.",
  },
  {
    question: "Будут ли заявки приходить сразу в мой Telegram?",
    answer:
      "Да. Новые лиды приходят в Telegram, чтобы вы или менеджер могли быстро открыть сообщение и отреагировать.",
  },
  {
    question: "Есть ли бесплатный период?",
    answer:
      "По демо покажем, как инструмент работает на вашей нише, и поможем понять, насколько он подходит под вашу модель продаж.",
  },
  {
    question: "Сколько стоит?",
    answer:
      "RIVN Leads доступен в максимальной подписке RIVN OS Growth за 9 900 ₽/мес.",
  },
  {
    question: "Это отдельный продукт или часть RIVN OS?",
    answer:
      "Это инструмент внутри экосистемы RIVN OS. Он помогает находить горячие заявки, а дальше их можно обрабатывать в привычной системе управления.",
  },
];

function CtaLink({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <a
      href={telegramUrl}
      target="_blank"
      rel="noreferrer"
      className={variant === "primary" ? styles.primaryCta : styles.secondaryCta}
    >
      {children}
      <ArrowRight size={18} />
    </a>
  );
}

function WaveBackground() {
  return (
    <div className={styles.waveBox} aria-hidden>
      <svg viewBox="0 0 1440 320" className={styles.waveSvg}>
        <path
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.1"
          d="M0,194 C120,132 240,132 360,194 C480,256 600,256 720,194 C840,132 960,132 1080,194 C1200,256 1320,256 1440,194"
        />
        <path
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1.1"
          d="M0,224 C120,162 240,162 360,224 C480,286 600,286 720,224 C840,162 960,162 1080,224 C1200,286 1320,286 1440,224"
        />
        <path
          fill="none"
          stroke="rgba(111,90,255,0.95)"
          strokeWidth="1.5"
          className={styles.waveAccent}
          d="M0,252 C120,190 240,190 360,252 C480,314 600,314 720,252 C840,190 960,190 1080,252 C1200,314 1320,314 1440,252"
        />
      </svg>
    </div>
  );
}

function LeadMockup() {
  return (
    <div className={styles.mockupShell}>
      <div className={styles.mockupTop}>
        <div>
          <div className={styles.mockupKicker}>Telegram мониторинг</div>
          <div className={styles.mockupTitle}>Новая заявка найдена</div>
        </div>
        <div className={styles.mockupStatus}>
          <span />
          online
        </div>
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <div className={styles.chatAvatar}>БЧ</div>
          <div>
            <div className={styles.chatName}>Бизнес-чат предпринимателей</div>
            <div className={styles.chatMeta}>1 842 участника · активное обсуждение</div>
          </div>
        </div>

        <div className={styles.messageBubble}>
          <div className={styles.messageAuthor}>@market_owner</div>
          <p>
            Ищу директолога для B2B-компании в строительной нише. Нужен опыт с
            заявками на услуги.
          </p>
          <div className={styles.highlightLine}>
            <Target size={14} />
            Ключевой запрос подсвечен как потенциальный лид
          </div>
        </div>
      </div>

      <div className={styles.leadCard}>
        <div className={styles.leadCardHead}>
          <div>
            <div className={styles.leadBadge}>Потенциальный лид</div>
            <h3>Ищу директолога для B2B-компании</h3>
          </div>
          <div className={styles.leadFire}>🔥</div>
        </div>
        <div className={styles.leadRows}>
          <div>
            <span>Контакт</span>
            <strong>@market_owner</strong>
          </div>
          <div>
            <span>Источник</span>
            <strong>Бизнес-чат</strong>
          </div>
          <div>
            <span>Статус</span>
            <strong>Отправлено в Telegram</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RivnLeadsPage() {
  return (
    <main className={styles.page}>
      <section id="hero" className={styles.heroWrap}>
        <div className={styles.gridOverlay} />
        <div className={styles.glowCenter} />
        <div className={styles.glowRight} />
        <WaveBackground />

        <div className={styles.container}>
          <header className={styles.header}>
            <Link href="/" className={styles.brand}>
              <div className={styles.brandIcon}>
                <Image
                  src="/rivn-logo-icon.png"
                  alt="RIVN OS"
                  width={36}
                  height={36}
                  className={styles.brandLogoImage}
                />
              </div>
              <div>
                <div className={styles.brandLabel}>RIVN OS</div>
                <div className={styles.brandName}>RIVN Leads</div>
              </div>
            </Link>

            <nav className={styles.nav} aria-label="Навигация по лендингу">
              <a href="#how" className={styles.navLink}>
                Как работает
              </a>
              <a href="#examples" className={styles.navLink}>
                Примеры
              </a>
              <a href="#pricing" className={styles.navLink}>
                Стоимость
              </a>
              <a href="#faq" className={styles.navLink}>
                Вопросы
              </a>
            </nav>

            <div className={styles.headerActions}>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.secondaryHeaderBtn}
              >
                Демо
              </a>
              <a
                href={telegramUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.primaryHeaderBtn}
              >
                Подключить
              </a>
            </div>
          </header>

          <div className={styles.hero}>
            <div className={styles.badge}>
              <span className={styles.badgeNew}>Новый инструмент</span>
              горячие заявки из Telegram без ручного мониторинга
            </div>

            <h1 className={styles.heroTitle}>
              Горячие заявки из Telegram
              <br />в одном месте
            </h1>

            <p className={styles.heroText}>
              RIVN Leads 24/7 находит сообщения, где люди уже ищут
              специалистов, подрядчиков и услуги, и присылает их вам прямо в
              Telegram.
            </p>

            <div className={styles.heroActions}>
              <CtaLink>Оставить заявку</CtaLink>
              <CtaLink variant="secondary">Посмотреть демо</CtaLink>
            </div>

            <p className={styles.heroMicro}>
              Для digital-специалистов, фрилансеров и малого бизнеса, которые
                  продают услуги по всей России.
            </p>

            <div className={styles.heroBottom}>
              <div className={styles.stats}>
                <div className={styles.statItem}>
                  <div className={styles.statNumber}>24/7</div>
                  <div className={styles.statLabelGreen}>мониторинг Telegram</div>
                </div>
                <div className={styles.statItem}>
                  <div className={styles.statNumber}>9 900 ₽</div>
                  <div className={styles.statLabelPurple}>RIVN OS Growth</div>
                </div>
              </div>
              <div className={styles.controlCard}>
                <div className={styles.controlBadge}>Бизнес-смысл</div>
                <p className={styles.controlText}>
                  Ваши клиенты уже пишут в Telegram. RIVN Leads помогает
                  увидеть эти сообщения вовремя.
                </p>
              </div>
            </div>

            <LeadMockup />
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.problemsSection}`}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            Реклама дорожает.
            <br />А клиенты всё равно ищут подрядчиков в Telegram.
          </h2>
          <p className={styles.sectionText}>
            Лиды из рекламы становятся дороже, конкуренция растёт, а горячие
            запросы в чатах быстро забирают те, кто увидел их первым.
          </p>
        </div>

        <div className={styles.problemGrid}>
          {[
            "Заявки из рекламы становятся дороже",
            "Конкуренты реагируют быстрее",
            "Вручную сидеть в десятках чатов невозможно",
            "Многие горячие запросы проходят мимо",
          ].map((item) => (
            <article key={item} className={styles.problemCard}>
              <div className={styles.problemIcon}>✦</div>
              <h3>{item}</h3>
              <p>
                Это не проблема спроса. Спрос есть, но он часто появляется там,
                где его сложно вовремя заметить вручную.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className={`${styles.container} ${styles.solutionSection}`}>
        <div className={styles.solutionCard}>
          <div className={styles.solutionGlow} />
          <div className={styles.sectionEyebrow}>Решение</div>
          <h2 className={styles.solutionTitle}>
            RIVN Leads делает мониторинг Telegram за вас
          </h2>
          <p className={styles.solutionText}>
            Мы не продаём “парсер”. Мы даём понятный рабочий инструмент:
            находить тёплые сообщения, быстро получать их в Telegram и не
            пропускать клиентов.
          </p>

          <div className={styles.stepGrid}>
            {solutionSteps.map((step, index) => (
              <article key={step.title} className={styles.stepCard}>
                <div className={styles.stepNumber}>0{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>

          <div className={styles.solutionActions}>
            <CtaLink>Подключить RIVN Leads</CtaLink>
          </div>
        </div>
      </section>

      <section id="examples" className={`${styles.container} ${styles.valueSection}`}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Примеры лидов</div>
          <h2 className={styles.sectionTitleSmall}>
            Лид — это сообщение, где человек уже ищет услугу
          </h2>
          <p className={styles.sectionText}>
            Такие запросы теплее, потому что человек уже сформулировал
            потребность и ищет, кому её передать.
          </p>
        </div>

        <div className={styles.leadExampleGrid}>
          {leadExamples.map((lead, index) => (
            <article key={lead} className={styles.leadExampleCard}>
              <div className={styles.leadExampleTop}>
                <span>чат #{index + 1}</span>
                <MessageCircle size={16} />
              </div>
              <p>«{lead}»</p>
              <div className={styles.leadExampleMeta}>
                <Sparkles size={14} />
                найдено как потенциальная заявка
              </div>
            </article>
          ))}
        </div>

        <div className={styles.centerAction}>
          <CtaLink>Написать в Telegram</CtaLink>
        </div>
      </section>

      <section className={`${styles.container} ${styles.capabilitiesSection}`}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Для кого</div>
          <h2 className={styles.sectionTitleSmall}>Кому подойдет RIVN Leads</h2>
        </div>

        <div className={styles.audienceGrid}>
          {audiences.map((item) => (
            <div key={item} className={styles.audienceCard}>
              <Check size={18} />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className={`${styles.container} ${styles.showcaseSection}`}>
        <div className={styles.showcaseShell}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Почему это работает</h2>
            <p className={styles.sectionText}>
              Telegram — среда живой коммуникации. Там люди спрашивают совета,
              ищут подрядчиков и часто готовы быстро перейти к диалогу.
            </p>
          </div>

          <div className={styles.benefitGrid}>
            {benefits.map((item) => (
              <article key={item} className={styles.benefitCard}>
                <Zap size={18} />
                <span>{item}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.projectSection}`}>
        <div className={styles.projectGrid}>
          <div>
            <div className={styles.sectionEyebrow}>Как выглядит заявка</div>
            <h2 className={styles.sectionTitleSmall}>
              Все лиды приходят в вашу Telegram-беседу
            </h2>
            <p className={styles.sectionTextLeft}>
              Можно сразу отвечать человеку или передать лид менеджеру. Главное
              — заявка не теряется в потоке чатов.
            </p>
          </div>

          <article className={styles.bigLeadCard}>
            <div className={styles.leadBadge}>🔥 Потенциальный лид</div>
            <h3>
              Ищу директолога для B2B-компании в строительной нише. Нужен опыт
              с заявками на услуги.
            </h3>
            <dl>
              <div>
                <dt>Контакты</dt>
                <dd>@username</dd>
              </div>
              <div>
                <dt>Источник</dt>
                <dd>Бизнес-чат предпринимателей</dd>
              </div>
              <div>
                <dt>Ссылка</dt>
                <dd>Открыть сообщение</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section className={`${styles.container} ${styles.setupSection}`}>
        <div className={styles.setupCard}>
          <div>
            <div className={styles.sectionEyebrow}>Настройка под клиента</div>
            <h2 className={styles.sectionTitleSmall}>
              Мы настраиваем систему под вашу нишу
            </h2>
          </div>

          <div className={styles.setupList}>
            {setupItems.map((item) => (
              <div key={item} className={styles.setupItem}>
                <Check size={16} />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className={`${styles.container} ${styles.pricingSection}`}>
        <div className={styles.pricingCard}>
          <div className={styles.pricingContent}>
            <div className={styles.sectionEyebrow}>Тариф</div>
            <h2>RIVN Leads доступен в RIVN OS Growth</h2>
            <p>
              Максимальная подписка для тех, кто хочет не только управлять
              бизнесом, но и быстрее находить новые заявки.
            </p>
          </div>

          <div className={styles.pricePanel}>
            <div className={styles.price}>9 900 ₽</div>
            <div className={styles.priceSub}>в месяц</div>
            <div className={styles.priceList}>
              {pricingItems.map((item) => (
                <div key={item}>
                  <Check size={16} />
                  {item}
                </div>
              ))}
            </div>
            <CtaLink>Подключить RIVN Leads</CtaLink>
          </div>
        </div>
      </section>

      <section className={`${styles.container} ${styles.demoSection}`}>
        <div className={styles.demoCard}>
          <Clock3 size={26} />
          <h2>Хотите увидеть, как это работает на вашей нише?</h2>
          <p>
            Напишите нам в Telegram, и мы покажем демо: как находятся заявки,
            как они приходят в чат и как можно настроить поиск под ваши услуги.
          </p>
          <CtaLink>Записаться на демо</CtaLink>
        </div>
      </section>

      <section id="faq" className={`${styles.container} ${styles.faqSection}`}>
        <div className={styles.faqGrid}>
          <div>
            <div className={styles.sectionEyebrow}>FAQ</div>
            <h2 className={styles.sectionTitleSmall}>Коротко о главном</h2>
            <p className={styles.faqText}>
              Если остались вопросы — напишите в Telegram. Покажем, как
              инструмент может работать именно в вашей нише.
            </p>
            <CtaLink>Задать вопрос</CtaLink>
          </div>

          <div className={styles.faqList}>
            {faqs.map((item, index) => (
              <details key={item.question} className={styles.faqItem} open={index === 0}>
                <summary>
                  <span>{item.question}</span>
                  <span className={styles.faqToggle}>+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <div className={styles.container}>
          <div className={styles.finalCard}>
            <Send size={28} />
            <h2>Подключить RIVN Leads</h2>
            <p>
              Ваши клиенты уже пишут в Telegram. RIVN Leads помогает увидеть
              эти сообщения вовремя.
            </p>
            <CtaLink>Подключить RIVN Leads</CtaLink>
            <span>
              Работаем с Telegram-чатами и сообществами, к которым есть доступ.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

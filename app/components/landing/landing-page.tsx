"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import styles from "./landing-page.module.css";

export default function LandingPage() {
  const logos = ["Агентства", "Фрилансеры", "Digital", "Маркетинг", "Продажи", "Аналитика"];

  const problems = [
    {
      title: "Не видно реальную прибыль",
      description:
        "Выручка есть, движение денег есть, но ты не понимаешь, сколько на самом деле остаётся после расходов, выплат команде и обязательств.",
    },
    {
      title: "Платежи живут в хаосе",
      description:
        "Кто должен оплатить, когда должен оплатить и что уже просрочено — всё это приходится держать в голове, перепроверять вручную и постоянно дожимать.",
    },
    {
      title: "Бизнес держится на памяти",
      description:
        "Задачи, договорённости, дедлайны, статусы клиентов и детали по проектам завязаны на тебе, а не на системе.",
    },
    {
      title: "Сервисы не связаны между собой",
      description:
        "Таблицы, чаты, заметки и таск-трекеры существуют отдельно. В итоге вместо управляемой системы получается набор разрозненных костылей.",
    },
    {
      title: "Ты постоянно тушишь пожары",
      description:
        "День уходит не на стратегию и рост, а на срочные вопросы, потери в коммуникации и ручное удержание порядка.",
    },
    {
      title: "Нет цельной картины бизнеса",
      description:
        "Ты не видишь в одном месте деньги, клиентов, загрузку команды и динамику проекта, а значит не можешь быстро принимать сильные решения.",
    },
  ];

  const capabilities = [
    {
      title: "Финансы",
      description:
        "Контроль прибыли, расходов, выплат, налогов и графика оплат без ручных расчётов и постоянной сверки таблиц.",
    },
    {
      title: "Клиенты",
      description:
        "Видно, кто в работе, на каком этапе находится проект, когда ожидается оплата и где появляются риски.",
    },
    {
      title: "Проекты",
      description:
        "Все задачи и ключевые точки по проектам собраны в одной структуре, чтобы ничего не терялось и не зависело от памяти.",
    },
    {
      title: "Команда",
      description:
        "Прозрачная загрузка сотрудников, контроль ответственности и понимание, кто действительно двигает результат.",
    },
    {
      title: "Аналитика",
      description:
        "Ты быстро видишь, что происходит в бизнесе сейчас, где узкие места и какие решения дадут максимальный эффект.",
    },
    {
      title: "AI-помощник",
      description:
        "Находит слабые места, помогает замечать потери и подсказывает, куда смотреть в первую очередь для роста.",
    },
  ];

  const showcaseCards = [
    {
      eyebrow: "Финансовый контроль",
      title: "Все деньги бизнеса в одном месте",
      description:
        "План-факт, оплаты клиентов, обязательства, расходы, прибыль и точки просадки — без ручной сборки из разных таблиц.",
    },
    {
      eyebrow: "Управление проектами",
      title: "Каждый клиент и каждая задача под контролем",
      description:
        "Статусы, дедлайны, сотрудники и приоритеты собраны в единой системе, а не разбросаны по чатам и заметкам.",
    },
    {
      eyebrow: "Команда и рост",
      title: "Понимай, что происходит, и принимай решения быстрее",
      description:
        "Загрузка команды, динамика показателей и сигналы по проблемным зонам видны сразу, без долгого ручного анализа.",
    },
  ];

  const plans = [
    {
      name: "Базовый",
      price: "500 ₽",
      featured: false,
      subtitle: "Для фрилансеров и специалистов",
      items: [
        "Клиенты и проекты",
        "Финансы и платежи",
        "Аналитика бизнеса",
        "14 дней бесплатно",
      ],
    },
    {
      name: "Расширенный",
      price: "750 ₽",
      featured: true,
      subtitle: "Для роста и командной работы",
      items: [
        "Всё из базового",
        "Добавление сотрудников",
        "Контроль процессов",
        "Командная работа",
      ],
    },
    {
      name: "AI",
      price: "3 000 ₽",
      featured: false,
      subtitle: "Для масштабирования",
      items: ["Всё из расширенного", "AI-помощник", "Рекомендации по росту", "Поиск слабых мест"],
    },
  ];

  const faqItems = [
    {
      q: "Это сложно?",
      a: "Нет. Интерфейс сделан так, чтобы ты быстро разобрался и начал работать без долгого внедрения.",
      open: true,
    },
    {
      q: "Нужно ли долго настраивать?",
      a: "Нет. Базовая логика уже заложена, поэтому запуск не превращается в длинный и дорогой процесс внедрения.",
      open: false,
    },
    {
      q: "Подойдёт ли мне RIVN OS?",
      a: "Да, если у тебя есть клиенты, проекты, платежи и необходимость держать всё под контролем без лишнего хаоса.",
      open: false,
    },
    {
      q: "Будет ли бизнес-клуб?",
      a: "Да, в будущем мы планируем закрытое сообщество для пользователей. На старте фокус остаётся на сильном продукте и реальной полезности системы.",
      open: false,
    },
  ];

  const fadeUp = {
    initial: { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  };

  return (
    <main className={styles.page}>
      <section className={styles.heroWrap}>
        <div className={styles.gridOverlay} />
        <motion.div
          animate={{ x: ["-8%", "8%", "-8%"], y: [0, 18, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className={styles.glowCenter}
        />
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className={styles.glowRight}
        />

        <div className={styles.waveBox}>
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
            <motion.path
              fill="none"
              stroke="rgba(111,90,255,0.95)"
              strokeWidth="1.5"
              d="M0,252 C120,190 240,190 360,252 C480,314 600,314 720,252 C840,190 960,190 1080,252 C1200,314 1320,314 1440,252"
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>

        <div className={styles.container}>
          <motion.header {...fadeUp} className={styles.header}>
            <div className={styles.brand}>
              <div className={styles.brandIcon}>R</div>
              <div>
                <div className={styles.brandLabel}>Операционная система бизнеса</div>
                <div className={styles.brandName}>RIVN OS</div>
              </div>
            </div>

            <nav className={styles.nav}>
              <a href="#hero" className={styles.navLink}>
                Главная
              </a>
              <a href="#capabilities" className={styles.navLink}>
                Возможности
              </a>
              <a href="#showcase" className={styles.navLink}>
                Как это работает
              </a>
              <a href="#pricing" className={styles.navLink}>
                Тарифы
              </a>
              <a href="#faq" className={styles.navLink}>
                Вопросы
              </a>
            </nav>

            <div className={styles.headerActions}>
              <Link href="/login" className={styles.secondaryHeaderBtn}>
                Telegram основателя
              </Link>
              <Link href="/login" className={styles.primaryHeaderBtn}>
                Поддержка
              </Link>
            </div>
          </motion.header>

          <section id="hero" className={styles.hero}>
            <motion.div {...fadeUp} className={styles.badge}>
              <span className={styles.badgeNew}>Новый продукт</span>
              Система управления для агентств, фрилансеров и digital-команд
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.08 }}
              className={styles.heroTitle}
            >
              RIVN OS — операционная система
              <br />
              для агентств и digital-команд.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.14 }}
              className={styles.heroText}
            >
              Контроль клиентов, проектов, финансов, команды и ключевых показателей в одном
              пространстве. Всё, что нужно для управления и роста бизнеса, без хаоса и
              разрозненных сервисов.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.22 }}
              className={styles.heroActions}
            >
              <Link href="/login" className={styles.primaryCta}>
                Попробовать бесплатно 14 дней
              </Link>
              <Link href="/login" className={styles.secondaryCta}>
                Посмотреть как работает
              </Link>
            </motion.div>

            <div className={styles.heroBottom}>
              <motion.div
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.3 }}
                className={styles.stats}
              >
                <div className={styles.statItem}>
                  <div className={styles.statNumber}>49+</div>
                  <div className={styles.statLabelGreen}>агентств уже используют</div>
                </div>

                <div className={styles.statItem}>
                  <div className={styles.statNumber}>20 000+</div>
                  <div className={styles.statLabelPurple}>действий отслеживается в системе</div>
                </div>
              </motion.div>

              <motion.div
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.34 }}
                animate={{ y: [0, -6, 0] }}
                className={styles.controlCard}
              >
                <div className={styles.controlBadge}>Полный контроль</div>
                <p className={styles.controlText}>
                  Простая снаружи и сильная внутри система, которая даёт владельцу бизнеса
                  контроль, ясность и скорость в принятии решений.
                </p>
              </motion.div>
            </div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.38 }}
              className={styles.logoRow}
            >
              {logos.map((logo) => (
                <div key={logo} className={styles.logoPill}>
                  {logo}
                </div>
              ))}
            </motion.div>
          </section>
        </div>
      </section>

      <motion.section
        id="problems"
        {...fadeUp}
        className={`${styles.container} ${styles.problemsSection}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            Почему бизнес
            <br />
            не растёт
          </h2>
          <p className={styles.sectionText}>
            У большинства фрилансеров, digital-специалистов и агентств проблема не в опыте и
            не в количестве клиентов. Проблема в том, что рост идёт поверх хаоса, а не поверх
            системы.
          </p>
        </div>

        <div className={styles.problemGrid}>
          {problems.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className={styles.problemCard}
            >
              <div className={styles.problemIcon}>✦</div>
              <h3 className={styles.problemTitle}>{item.title}</h3>
              <p className={styles.problemText}>{item.description}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="solution"
        {...fadeUp}
        className={`${styles.container} ${styles.solutionSection}`}
      >
        <div className={styles.solutionCard}>
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.28, 0.42, 0.28] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className={styles.solutionGlow}
          />
          <h2 className={styles.solutionTitle}>
            RIVN OS — это
            <br />
            операционная система бизнеса
          </h2>
          <p className={styles.solutionText}>
            Ты видишь в одном месте финансы, клиентов, задачи, команду и точки роста. Не ещё
            один сервис, а основу, на которой можно спокойно масштабировать бизнес.
          </p>

          <div className={styles.solutionActions}>
            <Link href="/login" className={styles.primaryCta}>
              Начать бесплатно
            </Link>
            <Link href="/login" className={styles.secondaryCta}>
              Как это работает
            </Link>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="capabilities"
        {...fadeUp}
        className={`${styles.container} ${styles.capabilitiesSection}`}
      >
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Что даёт система</div>
          <h2 className={styles.sectionTitleSmall}>Всё, что нужно для управления бизнесом</h2>
          <p className={styles.sectionText}>
            Контроль прибыли, расходов, клиентов, проектов, сотрудников и ключевых показателей —
            в одном интерфейсе, без ручной сборки из разных сервисов.
          </p>
        </div>

        <div className={styles.capabilityGrid}>
          {capabilities.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className={styles.capabilityCard}
            >
              <div className={styles.capabilityIcon}>✦</div>
              <h3 className={styles.capabilityTitle}>{item.title}</h3>
              <p className={styles.capabilityText}>{item.description}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        id="showcase"
        {...fadeUp}
        className={`${styles.container} ${styles.showcaseSection}`}
      >
        <div className={styles.showcaseShell}>
          <motion.div
            aria-hidden
            animate={{ x: ["-8%", "8%", "-8%"], y: [0, 14, 0], opacity: [0.18, 0.28, 0.18] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            className={styles.showcaseTopGlow}
          />
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Как выглядит система в работе</h2>
            <p className={styles.sectionText}>
              Вместо абстрактных обещаний — конкретные зоны контроля, которые собирают бизнес в
              единую рабочую структуру.
            </p>
          </div>

          <div className={styles.showcaseList}>
            {showcaseCards.map((card, index) => (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 24, scale: 0.985 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6 }}
                className={styles.showcaseCard}
              >
                <motion.div
                  aria-hidden
                  animate={{ opacity: [0.1, 0.2, 0.1], scale: [1, 1.05, 1] }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.4,
                  }}
                  className={styles.showcaseCardGlow}
                />

                <div className={styles.showcaseContent}>
                  <div className={styles.showcaseEyebrow}>{card.eyebrow}</div>
                  <h3 className={styles.showcaseTitle}>{card.title}</h3>
                  <p className={styles.showcaseText}>{card.description}</p>
                  <Link href="/login" className={styles.showcaseLink}>
                    Смотреть внутри системы
                  </Link>
                </div>

                <motion.div
                  whileHover={{ scale: 1.018, rotateX: 1.2, rotateY: -1.8 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className={styles.showcasePreview}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className={styles.showcasePreviewGlow} />
                  <div className={styles.previewTop}>
                    <span>RIVN OS</span>
                    <span>{card.eyebrow}</span>
                  </div>

                  {index === 0 ? (
                    <div className={styles.previewStack}>
                      <div className={styles.financeStatGrid}>
                        <div className={styles.financeStatPurple}>
                          <div className={styles.previewLabel}>Выручка</div>
                          <div className={styles.previewNumber}>426 000 ₽</div>
                          <div className={styles.previewAccentGreen}>+12.4% к месяцу</div>
                        </div>
                        <div className={styles.financeStatGreen}>
                          <div className={styles.previewLabel}>Прибыль</div>
                          <div className={styles.previewNumber}>182 400 ₽</div>
                          <div className={styles.previewAccentGreen}>Рентабельность 42%</div>
                        </div>
                        <div className={styles.financeStatNeutral}>
                          <div className={styles.previewLabel}>Расходы</div>
                          <div className={styles.previewNumber}>243 600 ₽</div>
                          <div className={styles.previewAccentRose}>ФОТ и сервисы</div>
                        </div>
                      </div>

                      <div className={styles.previewPanel}>
                        <div className={styles.previewPanelHead}>
                          <div>
                            <div className={styles.previewPanelLabel}>Движение прибыли</div>
                            <div className={styles.previewPanelTitle}>План / факт по месяцам</div>
                          </div>
                          <div className={styles.previewPill}>Апрель</div>
                        </div>

                        <div className={styles.chartBars}>
                          {[48, 62, 58, 76, 88, 94, 72, 108].map((h, idx) => (
                            <motion.div
                              key={idx}
                              whileHover={{ scaleY: 1.03 }}
                              transition={{ duration: 0.2 }}
                              className={styles.chartGroup}
                            >
                              <div
                                className={styles.chartBarMuted}
                                style={{ height: `${h * 0.9}px` }}
                              />
                              <div className={styles.chartBarActive} style={{ height: `${h}px` }} />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : index === 1 ? (
                    <div className={styles.previewStack}>
                      <div className={styles.projectGrid}>
                        <div className={styles.previewPanel}>
                          <div className={styles.previewPanelHead}>
                            <div>
                              <div className={styles.previewPanelLabel}>Проекты</div>
                              <div className={styles.previewPanelTitle}>Активные клиенты</div>
                            </div>
                            <div className={styles.previewMeta}>12 в работе</div>
                          </div>

                          <div className={styles.projectList}>
                            {[
                              ["KRAFFIK", "Дизайн и трафик", "В работе"],
                              ["Waylo", "Аналитика и рост", "Ожидает оплату"],
                              ["300LUX", "Сопровождение", "Стабильно"],
                            ].map(([name, desc, status]) => (
                              <motion.div
                                key={name}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.2 }}
                                className={styles.projectItem}
                              >
                                <div>
                                  <div className={styles.projectName}>{name}</div>
                                  <div className={styles.projectDesc}>{desc}</div>
                                </div>
                                <div className={styles.projectStatus}>{status}</div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        <div className={styles.previewPanel}>
                          <div className={styles.previewPanelLabel}>Задачи на сегодня</div>
                          <div className={styles.taskList}>
                            {[
                              "Созвон с клиентом",
                              "Подтвердить оплату",
                              "Обновить отчёт",
                              "Назначить дедлайн",
                            ].map((task) => (
                              <motion.div
                                key={task}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.2 }}
                                className={styles.taskItem}
                              >
                                <div className={styles.taskDot} />
                                {task}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.previewStack}>
                      <div className={styles.teamGrid}>
                        <div className={styles.previewPanel}>
                          <div className={styles.previewPanelLabel}>Команда</div>
                          <div className={styles.teamList}>
                            {[
                              ["Дмитрий", "6 проектов", "92%"],
                              ["Антон", "4 проекта", "81%"],
                              ["Иван", "3 проекта", "67%"],
                            ].map(([name, load, perf]) => (
                              <motion.div
                                key={name}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.2 }}
                                className={styles.teamItem}
                              >
                                <div className={styles.teamHead}>
                                  <span>{name}</span>
                                  <span className={styles.teamPerf}>{perf}</span>
                                </div>
                                <div className={styles.teamMeta}>{load}</div>
                                <div className={styles.teamBarTrack}>
                                  <div className={styles.teamBarFill} style={{ width: perf }} />
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        <div className={styles.previewPanelPurple}>
                          <div className={styles.previewPanelLabel}>AI-сигналы</div>
                          <div className={styles.signalList}>
                            {[
                              "У клиента Waylo риск просрочки оплаты",
                              "Маржинальность снизилась на 8%",
                              "Проект 300LUX можно масштабировать",
                            ].map((signal) => (
                              <motion.div
                                key={signal}
                                whileHover={{ x: 4 }}
                                transition={{ duration: 0.2 }}
                                className={styles.signalItem}
                              >
                                {signal}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="pricing"
        {...fadeUp}
        className={`${styles.container} ${styles.pricingSection}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Простой доступ к системе управления</h2>
          <p className={styles.sectionText}>
            14 дней бесплатно, чтобы спокойно собрать систему под себя. Дальше — понятный тариф
            под твой текущий масштаб и формат работы.
          </p>
        </div>

        <div className={styles.pricingGrid}>
          {plans.map((plan, index) => (
            <motion.article
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ""}`}
            >
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.planSubtitle}>{plan.subtitle}</div>
              <div className={styles.planPrice}>{plan.price}</div>
              <div className={styles.planPeriod}>в месяц</div>

              <ul className={styles.planList}>
                {plan.items.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>

              <Link
                href="/login"
                className={`${styles.planButton} ${plan.featured ? styles.planButtonFeatured : ""}`}
              >
                Начать бесплатно
              </Link>
            </motion.article>
          ))}
        </div>

        <div className={styles.pricingNote}>
          Окупается быстрее, чем большинство разовых операционных ошибок. Один сохранённый
          клиент уже делает систему выгодной.
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.valueSection}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            Ты начинаешь управлять бизнесом,
            <br />
            а не выживать в нём
          </h2>
          <p className={styles.sectionText}>
            Меньше ручного контроля, меньше потерь и меньше операционного шума. Больше ясности,
            больше скорости и больше пространства для роста.
          </p>
        </div>

        <div className={styles.valueGrid}>
          <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueHeroCard}>
            <div className={styles.valueHeroGlowA} />
            <div className={styles.valueHeroGlowB} />
            <div className={styles.valueHeroOverlay} />
            <div className={styles.valueHeroContent}>
              <div className={styles.valueLabel}>Результат</div>
              <h3 className={styles.valueHeroTitle}>Порядок в процессах, деньгах и управлении</h3>
            </div>
          </motion.div>

          <div className={styles.valueSideGrid}>
            <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueCard}>
              <div className={styles.valueLabel}>Контроль</div>
              <h3 className={styles.valueCardTitle}>Прозрачная система вместо хаоса</h3>
              <p className={styles.valueCardText}>
                Ты больше не держишь бизнес в голове. Система показывает, что происходит сейчас,
                где появляются риски и на что стоит обратить внимание в первую очередь.
              </p>
              <Link href="/login" className={styles.inlineLink}>
                Начать бесплатно →
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueCardPurple}>
              <div className={styles.valueLabel}>Рост</div>
              <h3 className={styles.valueCardTitle}>Масштабирование без потери контроля</h3>
              <p className={styles.valueCardText}>
                Когда процессы, деньги и команда собраны в одной системе, становится легче расти
                без потери качества, скорости и управляемости.
              </p>
              <Link href="/login" className={styles.inlineLink}>
                Начать бесплатно →
              </Link>
            </motion.div>
          </div>
        </div>

        <div className={styles.centerAction}>
          <Link href="/login" className={styles.primaryCta}>
            Попробовать бесплатно
          </Link>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.reviewsSection}`}
      >
        <div className={styles.reviewsShell}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Что говорят пользователи</h2>
            <p className={styles.sectionText}>
              После запуска здесь появятся реальные кейсы пользователей, чтобы лендинг
              подтверждал не только обещание продукта, но и его практический результат.
            </p>
          </div>

          <div className={styles.reviewGrid}>
            {[1, 2].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className={styles.reviewCard}
              >
                <div className={styles.reviewThumb} />
                <div className={styles.reviewPlay}>▶</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="faq"
        {...fadeUp}
        className={`${styles.container} ${styles.faqSection}`}
      >
        <div className={styles.faqGrid}>
          <div>
            <h2 className={styles.sectionTitle}>
              Частые
              <br />
              вопросы
            </h2>
            <p className={styles.faqText}>
              Здесь мы заранее снимаем ключевые сомнения, чтобы решение о старте принималось
              быстро и без лишнего напряжения.
            </p>
            <Link href="/login" className={styles.primaryCta}>
              Попробовать бесплатно
            </Link>
          </div>

          <div className={styles.faqList}>
            {faqItems.map((item, index) => (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                whileHover={{ y: -2 }}
                className={styles.faqItem}
              >
                <div className={styles.faqHead}>
                  <div>
                    <h3 className={styles.faqQuestion}>{item.q}</h3>
                    {item.open ? <p className={styles.faqAnswer}>{item.a}</p> : null}
                  </div>
                  <div className={styles.faqToggle}>{item.open ? "−" : "+"}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerLeft}>
              <div className={styles.footerLead}>Оставайся на связи</div>
              <div className={styles.footerBrand}>
                <div className={styles.footerBrandIcon}>R</div>
                <div>
                  <div className={styles.footerBrandName}>RIVN OS</div>
                  <div className={styles.footerBrandText}>
                    Операционная система для агентств, фрилансеров и digital-команд.
                  </div>
                </div>
              </div>
              <p className={styles.footerDescription}>
                RIVN OS объединяет клиентов, финансы, аналитику, задачи и команду в одной
                системе, чтобы владелец бизнеса видел картину целиком и принимал решения
                быстрее.
              </p>
            </div>

            <div className={styles.footerRight}>
              <div className={styles.footerInputRow}>
                <input
                  type="email"
                  placeholder="Введите ваш email"
                  className={styles.footerInput}
                />
                <button className={styles.footerArrow}>↗</button>
              </div>

              <div className={styles.footerIcons}>
                {["tg", "vk", "yt", "in"].map((icon) => (
                  <button key={icon} className={styles.footerIconBtn}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <div>©2026 Все права защищены. RIVN OS</div>
            <div className={styles.footerLinks}>
              <a href="#">Условия использования</a>
              <a href="#">Политика конфиденциальности</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
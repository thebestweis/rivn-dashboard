"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import styles from "./avito-academy.module.css";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const problems = [
  {
    title: "Нет системы",
    description:
      "Большинство изучает Авито урывками: немного про объявления, немного про тексты, немного про продажи. В итоге знаний много, а результата нет.",
  },
  {
    title: "Нет клиентов",
    description:
      "Человек вроде что-то умеет, но не понимает, где искать заказчиков, как писать первым и как переводить диалог в оплату.",
  },
  {
    title: "Нет сильного результата",
    description:
      "Без аналитики, упаковки и нормальной стратегии клиент не продлевается. А значит специалист постоянно вынужден искать новых людей с нуля.",
  },
];

const launchSteps = [
  {
    day: "День 1",
    title: "Анализ и стратегия",
    description:
      "Брифинг, анализ ниши, спроса и конкурентов. Понимание, за счёт чего проект будет забирать внимание и заявки.",
  },
  {
    day: "День 2",
    title: "Упаковка",
    description:
      "Подготовка объявлений, креативов, офферов и структуры автозагрузки. Сборка сильной маркетинговой упаковки под запуск.",
  },
  {
    day: "День 3",
    title: "Запуск",
    description:
      "Техническая реализация, публикация, старт рекламной кампании и первые данные, на которых уже можно принимать решения.",
  },
];

const resultCards = [
  {
    eyebrow: "Навык",
    title: "Становишься сильным авитологом",
    description:
      "Ты закрываешь Авито под ключ: анализ, упаковка, тексты, креативы, запуск, ведение, общение с клиентом и рост результата.",
  },
  {
    eyebrow: "Деньги",
    title: "Выходишь на реальный доход",
    description:
      "Сначала продаёшь проекты по 10–15 тысяч рублей, затем переходишь к чекам 20–40 тысяч и собираешь стабильный пул клиентов.",
  },
  {
    eyebrow: "Рост",
    title: "Получаешь систему, а не хаос",
    description:
      "Ты понимаешь, как искать клиентов, как продавать свои услуги, как удерживать заказчика и как строить нормальную профессиональную работу.",
  },
];

const program = [
  "Фундамент Авито и логика площадки",
  "Анализ ниши, спроса и конкурентов",
  "Маркетинговая упаковка проекта",
  "Продающие тексты и сильные креативы",
  "Масспостинг и вывод объявлений в топ",
  "Запуск проекта по системе за 3 дня",
  "Работа с клиентом и ведение под ключ",
  "Поиск клиентов и продажа своих услуг",
  "Скрипты переписки без лишних звонков",
  "Удержание клиента и рост чека",
];

const moneySteps = [
  { value: "1 клиент", text: "25 тыс. ₽ / мес." },
  { value: "3 клиента", text: "75 тыс. ₽ / мес." },
  { value: "5 клиентов", text: "125 тыс. ₽ / мес." },
];

export default function AvitoAcademyPage() {
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

        <motion.div
          animate={{ x: [0, -24, 0], y: [0, 22, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className={styles.glowLeft}
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
          <section className={styles.hero}>
            <motion.div {...fadeUp} className={styles.badge}>
              <span className={styles.badgeNew}>Новая профессия</span>
              Онлайн-презентация обучения по профессии авитолог
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.08 }}
              className={styles.heroTitle}
            >
              RIVN AVITO ACADEMY —
              <br />
              система подготовки
              <br />
              сильных авитологов.
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.14 }}
              className={styles.heroText}
            >
              Не курс ради теории. Практическая система, которая за 60 дней даёт тебе
              сильный навык, первого клиента и понятный путь к доходу на ведении проектов.
            </motion.p>

            <div className={styles.heroBottom}>
              <motion.div
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.22 }}
                className={styles.stats}
              >
                <div className={styles.statItem}>
                  <div className={styles.statNumber}>60</div>
                  <div className={styles.statLabelGreen}>дней до первого клиента</div>
                </div>

                <div className={styles.statItem}>
                  <div className={styles.statNumber}>70 000+</div>
                  <div className={styles.statLabelPurple}>реальный ориентир по доходу</div>
                </div>
              </motion.div>

              <motion.div
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.28 }}
                animate={{ y: [0, -6, 0] }}
                className={styles.controlCard}
              >
                <div className={styles.controlBadge}>Практика и контроль</div>
                <p className={styles.controlText}>
                  Реальные кейсы, проверка домашних заданий, наставничество, песочница,
                  скрипты продаж и доведение до первого клиента.
                </p>
              </motion.div>
            </div>
          </section>
        </div>
      </section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.problemSection}`}
      >
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Проблема рынка</div>
          <h2 className={styles.sectionTitle}>
            Почему большинство
            <br />
            так и не начинает зарабатывать
          </h2>
          <p className={styles.sectionText}>
            Главная проблема слабых специалистов не в том, что они мало стараются.
            Проблема в отсутствии системы, практики и реального понимания, как приводить
            клиенту результат и превращать навык в деньги.
          </p>
        </div>

        <div className={styles.problemGrid}>
          {problems.map((item, index) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
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
            Это не просто обучение.
            <br />
            Это система выхода в профессию.
          </h2>
          <p className={styles.solutionText}>
            Здесь человек не просто “что-то узнаёт про Авито”, а получает рабочую модель:
            как анализировать ниши, как собирать сильную упаковку, как запускать проекты,
            как искать клиентов, продавать себя и строить нормальный доход на услуге.
          </p>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.resultSection}`}
      >
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Результат</div>
          <h2 className={styles.sectionTitle}>
            Что человек получает
            <br />
            на выходе
          </h2>
        </div>

        <div className={styles.showcaseList}>
          {resultCards.map((card, index) => (
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
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.launchSection}`}
      >
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Фирменная методика</div>
          <h2 className={styles.sectionTitle}>
            Запуск проекта
            <br />
            за 3 дня
          </h2>
          <p className={styles.sectionText}>
            Это одно из ключевых преимуществ программы. Вместо размазанной теории человек
            получает понятный алгоритм быстрого запуска реального проекта.
          </p>
        </div>

        <div className={styles.capabilityGrid}>
          {launchSteps.map((item, index) => (
            <motion.article
              key={item.day}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className={styles.capabilityCard}
            >
              <div className={styles.capabilityIcon}>{item.day}</div>
              <h3 className={styles.capabilityTitle}>{item.title}</h3>
              <p className={styles.capabilityText}>{item.description}</p>
            </motion.article>
          ))}
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.programSection}`}
      >
        <div className={styles.programShell}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionEyebrow}>Программа</div>
            <h2 className={styles.sectionTitle}>
              Всё, что нужно
              <br />
              сильному авитологу
            </h2>
            <p className={styles.sectionText}>
              Обучение построено так, чтобы человек не разваливался между “контентом” и
              “реальной работой”, а шаг за шагом собирал полноценную профессиональную систему.
            </p>
          </div>

          <div className={styles.programGrid}>
            {program.map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.03 }}
                whileHover={{ x: 4 }}
                className={styles.programItem}
              >
                <div className={styles.programIndex}>
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className={styles.programText}>{item}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.practiceSection}`}
      >
        <div className={styles.valueGrid}>
          <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueHeroCard}>
            <div className={styles.valueHeroGlowA} />
            <div className={styles.valueHeroGlowB} />
            <div className={styles.valueHeroOverlay} />
            <div className={styles.valueHeroContent}>
              <div className={styles.valueLabel}>Практика</div>
              <h3 className={styles.valueHeroTitle}>
                Основа обучения — не теория, а реальная работа руками
              </h3>
            </div>
          </motion.div>

          <div className={styles.valueSideGrid}>
            <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueCard}>
              <div className={styles.valueLabel}>Разборы</div>
              <h3 className={styles.valueCardTitle}>Проверка 3–4 раза в неделю</h3>
              <p className={styles.valueCardText}>
                Домашние задания не остаются без обратной связи. Ученик получает конкретные
                правки, чтобы быстро расти, а не закреплять ошибки.
              </p>
            </motion.div>

            <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueCardPurple}>
              <div className={styles.valueLabel}>Реальность</div>
              <h3 className={styles.valueCardTitle}>Кейсы, песочница и реальные проекты</h3>
              <p className={styles.valueCardText}>
                Можно учиться на реальных задачах, видеть живую работу и получать доступ к
                понятной среде, где безопасно нарабатывать опыт.
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.moneySection}`}
      >
        <div className={styles.sectionHead}>
          <div className={styles.sectionEyebrow}>Монетизация</div>
          <h2 className={styles.sectionTitle}>
            Как навык превращается
            <br />
            в доход
          </h2>
          <p className={styles.sectionText}>
  Экономика здесь простая и понятная. Один проект может приносить около 25 000 ₽,
  а дальше доход растёт не за счёт магии, а за счёт количества клиентов и сильной системной работы.
</p>
        </div>

        <div className={styles.moneyGrid}>
          {moneySteps.map((item, index) => (
            <motion.div
              key={item.value}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              whileHover={{ y: -5, scale: 1.01 }}
              className={styles.moneyCard}
            >
              <div className={styles.moneyValue}>{item.value}</div>
              <div className={styles.moneyText}>{item.text}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section
  {...fadeUp}
  className={`${styles.container} ${styles.authorSection}`}
>
  <div className={styles.authorShell}>
    <div className={styles.authorGrid}>
      <div className={styles.authorVisual}>
        <div className={styles.authorImageWrap}>
          <Image
            src="/Моя ава.jpg"
            alt="Автор обучения"
            fill
            className={styles.authorImage}
          />
        </div>
      </div>

      <div className={styles.authorContent}>
        <div className={styles.sectionEyebrow}>Кто ведёт обучение</div>
        <h2 className={styles.sectionTitle}>
          Обучение ведёт практик,
          <br />
          а не теоретик
        </h2>

        <p className={styles.sectionText}>
          Я не пересказываю чужие материалы и не продаю красивую теорию.
          Я сам прошёл большой путь в маркетинге, глубоко работаю с продвижением,
          умею собирать сильную упаковку, запускать проекты, выводить объявления
          в топ и превращать навык в реальные деньги.
        </p>

        <div className={styles.authorFacts}>
          <div className={styles.authorFactCard}>
            <div className={styles.authorFactValue}>6+ лет</div>
            <div className={styles.authorFactText}>практического опыта в маркетинге и продвижении</div>
          </div>

          <div className={styles.authorFactCard}>
            <div className={styles.authorFactValue}>Практика</div>
            <div className={styles.authorFactText}>реальные кейсы, живая работа и системный подход</div>
          </div>

          <div className={styles.authorFactCard}>
            <div className={styles.authorFactValue}>Результат</div>
            <div className={styles.authorFactText}>помощь с первыми клиентами, продажей услуг и ростом чека</div>
          </div>
        </div>

        <div className={styles.authorQuote}>
          Здесь задача не “пройти обучение”, а выйти из него человеком, который
          умеет делать результат, продавать свои услуги и работать как сильный авитолог.
        </div>
      </div>
    </div>
  </div>
</motion.section>

      <motion.section
  {...fadeUp}
  className={`${styles.container} ${styles.finalSection}`}
>
  <div className={styles.finalCard}>
    <motion.div
      animate={{ scale: [1, 1.06, 1], opacity: [0.2, 0.35, 0.2] }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      className={styles.finalGlow}
    />
    <div className={styles.finalEyebrow}>Финальная точка</div>
    <h2 className={styles.finalTitle}>
      Через 60 дней человек выходит
      <br />
      не просто с теорией, а с профессией.
    </h2>
    <p className={styles.finalText}>
      Сильный навык. Готовые кейсы. Практический опыт. Понимание рынка.
      Скрипты продаж. Первые клиенты, которые уже платят деньги.
      И понятная система роста в Авито как в полноценной профессии.
    </p>
  </div>
</motion.section>
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
} from "framer-motion";
import styles from "./landing-page.module.css";

type MoneyLeak = {
  leak: string;
  loss: string;
  fix: string;
  metric: string;
};

type LossLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const lossSystemCenter = [68, 39] as const;
const lossSystemPositions = [
  [68, 18, 54],
  [81, 30, 54],
  [81, 50, 54],
  [68, 62, 54],
  [55, 50, 54],
  [55, 30, 54],
] as const;

function LossBubble({
  item,
  index,
  active,
  systemMode,
  progress,
  onActivate,
  bubbleRef,
}: {
  item: MoneyLeak;
  index: number;
  active: boolean;
  systemMode: boolean;
  progress: MotionValue<number>;
  onActivate: () => void;
  bubbleRef: (node: HTMLButtonElement | null) => void;
}) {
  const chaosPositions = [
    [10, 80, 76],
    [72, 29, 88],
    [38, 74, 66],
    [84, 66, 78],
    [64, 21, 60],
    [15, 78, 70],
  ];
  const [chaosX, chaosY, chaosSize] = chaosPositions[index];
  const [systemX, systemY, systemSize] = lossSystemPositions[index];
  const left = useTransform(progress, [0.08, 0.48], [`${chaosX}%`, `${systemX}%`]);
  const top = useTransform(progress, [0.08, 0.48], [`${chaosY}%`, `${systemY}%`]);
  const width = useTransform(progress, [0.08, 0.48], [chaosSize, systemSize]);
  const height = useTransform(progress, [0.08, 0.48], [chaosSize, systemSize]);
  const problemOpacity = useTransform(progress, [0, 0.24, 0.34], [1, 0.72, 0]);
  const solutionOpacity = useTransform(progress, [0.34, 0.48, 1], [0, 0.92, 1]);

  return (
    <motion.button
      ref={bubbleRef}
      type="button"
      className={`${styles.morphBubble} ${systemMode ? styles.morphBubbleSystem : styles.morphBubbleChaos} ${active ? styles.morphBubbleActive : ""}`}
      data-leak-index={index}
      style={{ left, top, width, height }}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
    >
      <span className={styles.morphBubbleGlow} />
      <span className={styles.morphBubbleDot} />
      <motion.span className={styles.morphTooltip} style={{ opacity: active && !systemMode ? problemOpacity : 0 }}>
        <strong>{item.leak}</strong>
        <em>{item.loss}</em>
      </motion.span>
      <motion.span className={styles.morphSolution} style={{ opacity: solutionOpacity }}>
        <strong>{item.metric}</strong>
        <em>{item.fix}</em>
      </motion.span>
    </motion.button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RealDashboardPreview() {
  const kpis = [
    ["Выручка", "426 000 ₽", "+12.4%", "revenue"],
    ["Прибыль", "182 400 ₽", "маржа 42%", "profit"],
    ["ФОТ", "98 000 ₽", "23% от выручки", "payroll"],
    ["LTV", "74 200 ₽", "+8.1%", "ltv"],
  ];

  const tasks = [
    ["Созвон с клиентом", "Сегодня", "active"],
    ["Подтвердить оплату", "Просрочено", "danger"],
    ["Обновить отчёт", "В работе", "active"],
    ["Назначить дедлайн", "Сегодня", "active"],
  ];

  const clients = [
    ["Altura", "182 000 ₽", "в работе"],
    ["Neonix", "96 000 ₽", "ждём оплату"],
    ["Velaris", "148 000 ₽", "стабильно"],
  ];

  return (
    <div className={styles.realDashboard}>
      <div className={styles.realDashboardTop}>
        <div>
          <span>RIVN OS</span>
          <strong>Дашборд</strong>
        </div>
        <div className={styles.realDashboardFilters}>
          <span>30 дней</span>
          <span>90 дней</span>
          <span>Всё</span>
        </div>
      </div>

      <div className={styles.realDashboardGrid}>
        <div className={styles.realOverviewCard}>
          <div className={styles.realOverviewHead}>
            <div>
              <span>Ключевые показатели</span>
              <strong>Состояние бизнеса</strong>
            </div>
            <em>Апрель</em>
          </div>
          <div className={styles.realBubbleField}>
            {Array.from({ length: 18 }, (_, index) => (
              <i
                key={index}
                style={{
                  left: `${12 + ((index * 17) % 72)}%`,
                  top: `${18 + ((index * 29) % 58)}%`,
                  width: 8 + (index % 4) * 5,
                  height: 8 + (index % 4) * 5,
                  animationDelay: `${index * -0.32}s`,
                }}
              />
            ))}
          </div>
          <div className={styles.realGlassPanel}>
            <div>
              <span>Прибыль</span>
              <strong>182 400 ₽</strong>
            </div>
            <div>
              <span>Активные клиенты</span>
              <strong>14</strong>
            </div>
          </div>
        </div>

        <div className={styles.realKpiGrid}>
          {kpis.map(([label, value, delta, tone]) => (
            <div key={label} className={`${styles.realKpiCard} ${styles[`realKpi_${tone}`]}`}>
              <span>{label}</span>
              <strong>{value}</strong>
              <em>{delta}</em>
            </div>
          ))}
        </div>

        <div className={styles.realChartCard}>
          <div className={styles.realCardHead}>
            <span>Финансовая динамика</span>
            <strong>План / факт</strong>
          </div>
          <div className={styles.realLineChart}>
            {[42, 58, 51, 68, 62, 82, 74, 92].map((height, index) => (
              <i key={index} style={{ height: `${height}%`, animationDelay: `${index * 0.08}s` }} />
            ))}
          </div>
        </div>

        <div className={styles.realTasksCard}>
          <div className={styles.realCardHead}>
            <span>Активные задачи</span>
            <strong>На сегодня</strong>
          </div>
          <div className={styles.realTaskList}>
            {tasks.map(([task, status, tone]) => (
              <div key={task} className={styles.realTaskItem}>
                <i className={tone === "danger" ? styles.realTaskDanger : ""} />
                <span>{task}</span>
                <em>{status}</em>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.realClientsCard}>
          <div className={styles.realCardHead}>
            <span>Клиенты и оплаты</span>
            <strong>Под контролем</strong>
          </div>
          {clients.map(([name, revenue, status]) => (
            <div key={name} className={styles.realClientRow}>
              <div>
                <strong>{name}</strong>
                <span>{status}</span>
              </div>
              <em>{revenue}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const renderLegacyLandingSections = false;
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
      title: "Дашборд",
      description:
        "Главный экран бизнеса: выручка, прибыль, ФОТ, активные клиенты, LTV, план-факт и тревожные сигналы в одном месте.",
    },
    {
      title: "Клиенты",
      description:
        "База клиентов с проектами, оплатами, маржинальностью, историей работы и пониманием, кого нужно продлить.",
    },
    {
      title: "Проекты",
      description:
        "Каждый клиент превращается в управляемый проект: этапы, сроки, ответственные, задачи и статус выполнения.",
    },
    {
      title: "Задачи",
      description:
        "Рабочий слой для себя и команды: задачи, подзадачи, приоритеты, дедлайны и контроль просрочек.",
    },
    {
      title: "Финансы",
      description:
        "Плановые счета, фактические оплаты, расходы, ФОТ, налоги и чистая прибыль без ручной сборки таблиц.",
    },
    {
      title: "Аналитика",
      description:
        "LTV, средний чек, стабильная выручка, прогноз и эффективность клиентов, чтобы решения принимались по цифрам.",
    },
  ];

  const showcaseCards = [
    {
      eyebrow: "Реальный дашборд",
      title: "Главный экран, который показывает здоровье бизнеса",
      description:
        "На входе пользователь видит те же зоны контроля: выручку, прибыль, ФОТ, активных клиентов, LTV, план-факт, задачи и сигналы.",
    },
    {
      eyebrow: "Проекты и задачи",
      title: "Каждый клиент разложен на этапы, задачи и ответственных",
      description:
        "Проект не живёт в голове: видно статусы, дедлайны, следующие действия, оплаты и задачи команды.",
    },
    {
      eyebrow: "Команда и сигналы",
      title: "Видно загрузку, риски и точки роста до того, как они стали проблемой",
      description:
        "RIVN OS подсвечивает просрочки, падение маржи, перегрузку и клиентов, которых нужно вернуть в работу.",
    },
  ];

  const plans = [
  {
    name: "BASIC",
    price: "990 ₽",
    featured: false,
    subtitle: "Для фрилансеров и digital-специалистов",
    items: [
      "Клиенты, проекты и задачи",
      "Финансы, оплаты и расходы",
      "Базовая аналитика бизнеса",
      "14 дней бесплатно",
    ],
  },
  {
    name: "TEAM",
    price: "4 990 ₽",
    featured: true,
    subtitle: "Для команд и небольших агентств",
    items: [
      "Всё из BASIC",
      "Команда и роли сотрудников",
      "Контроль процессов и дедлайнов",
      "Расширенная управленческая аналитика",
    ],
  },
  {
    name: "STRATEGY",
    price: "9 990 ₽",
    featured: false,
    subtitle: "Для роста, стратегии и RIVN Leads",
    items: [
      "Всё из TEAM",
      "RIVN Leads и заявки из Telegram",
      "Стратегические отчёты и прогнозы",
      "Приоритетная доработка функционала",
    ],
  },
];

  const faqItems = [
  {
    q: "Это сложно?",
    a: "Нет. Интерфейс сделан так, чтобы ты быстро разобрался и начал работать без долгого внедрения.",
  },
  {
    q: "Нужно ли долго настраивать?",
    a: "Нет. Базовая логика уже заложена, поэтому запуск не превращается в длинный и дорогой процесс внедрения.",
  },
  {
    q: "Подойдёт ли мне RIVN OS?",
    a: "Да, если у тебя есть клиенты, проекты, платежи и необходимость держать всё под контролем без лишнего хаоса.",
  },
  {
    q: "Будет ли бизнес-клуб?",
    a: "Да, в будущем мы планируем закрытое сообщество для пользователей. На старте фокус остаётся на сильном продукте и реальной полезности системы.",
  },
];

const [openFaqIndex, setOpenFaqIndex] = useState<number>(0);
const [activeImpactIndex, setActiveImpactIndex] = useState<number>(2);
const [impactAutoplayEnabled, setImpactAutoplayEnabled] = useState(true);
const [activeLeakIndex, setActiveLeakIndex] = useState<number | null>(0);
const [lossStageVisible, setLossStageVisible] = useState(false);
const [lossSystemMode, setLossSystemMode] = useState(false);
const [lossLines, setLossLines] = useState<LossLine[]>([]);
const lossSectionRef = useRef<HTMLElement | null>(null);
const lossSceneRef = useRef<HTMLDivElement | null>(null);
const lossBubbleRefs = useRef<Array<HTMLButtonElement | null>>([]);
const lossProgress = useMotionValue(0);
const chaosOpacity = useTransform(lossProgress, [0, 0.24, 0.46], [1, 0.74, 0.08]);
const chaosScale = useTransform(lossProgress, [0, 0.46], [1, 0.92]);
const systemOpacity = useTransform(lossProgress, [0.28, 0.4, 0.52], [0, 0.78, 1]);
const systemScale = useTransform(lossProgress, [0.28, 0.52], [0.92, 1]);
const systemLineScale = useTransform(lossProgress, [0.3, 0.52], [0, 1]);
const introY = useTransform(lossProgress, [0, 0.48], [0, -8]);
const introOpacity = useTransform(lossProgress, [0, 0.34, 0.5], [1, 0.76, 0.92]);
const stageOpacity = useTransform(lossProgress, [0, 1], [1, 1]);

const moneyLeaks = [
  {
    leak: "Счёт не выставлен",
    loss: "оплата зависла в переписке и не попала в контроль",
    fix: "RIVN OS фиксирует оплаты, статусы и напоминания, чтобы деньги не терялись между чатами.",
    metric: "Оплаты",
  },
  {
    leak: "Клиент не продлён",
    loss: "нет следующего касания, задачи или триггера",
    fix: "Мы показываем ценность клиента, историю касаний и моменты, когда пора возвращать его в работу.",
    metric: "LTV",
  },
  {
    leak: "Задачи живут в голове",
    loss: "сроки завязаны на памяти и ручном контроле",
    fix: "Проекты раскладываются на задачи, подзадачи, ответственных и понятные этапы без ручного хаоса.",
    metric: "Сроки",
  },
  {
    leak: "ФОТ и налоги отдельно",
    loss: "прибыль кажется больше, чем есть на самом деле",
    fix: "RIVN OS собирает расходы, ФОТ, налоги и выплаты, чтобы вы видели чистую прибыль.",
    metric: "Прибыль",
  },
  {
    leak: "Заявки теряются",
    loss: "лиды не доходят до клиента, задачи и оплаты",
    fix: "Заявка превращается в клиента, сделку, задачи и понятный путь до оплаты внутри системы.",
    metric: "Лиды",
  },
  {
    leak: "Нет прогноза",
    loss: "непонятно, сколько денег будет дальше",
    fix: "Мы считаем прогноз выручки в 3 сценариях, чтобы вы понимали следующий месяц заранее.",
    metric: "Прогноз",
  },
];

const leakParticles = Array.from({ length: 42 }, (_, index) => ({
  x: 8 + ((index * 19) % 82),
  y: 10 + ((index * 31) % 74),
  targetX: 18 + (index % 7) * 10.5,
  targetY: 20 + Math.floor(index / 7) * 9.5,
  size: 6 + (index % 5) * 2,
}));

const activeLeak = activeLeakIndex === null ? moneyLeaks[0] : moneyLeaks[activeLeakIndex];

const productAdvantages = [
  {
    label: "Гибкость",
    title: "Функционал можно быстро доработать под ваш процесс",
    text: "Если у вашей команды есть особая логика клиентов, оплат, отчётов или задач, мы можем адаптировать систему под реальный рабочий процесс, а не заставлять вас жить по шаблону.",
  },
  {
    label: "Внедрение",
    title: "Помогаем собрать систему, а не просто даём доступ",
    text: "RIVN OS создаётся digital-специалистами для digital-специалистов, поэтому мы понимаем хаос в проектах, клиентах, ФОТ, оплатах и заявках изнутри.",
  },
  {
    label: "Рост",
    title: "Система взрослеет вместе с бизнесом",
    text: "Можно начать одному, а затем добавить команду, роли, аналитику, регламенты, воронку заявок и контроль прибыли без переезда в другой инструмент.",
  },
];




const minimalImpactSections = [
  {
    key: "finance",
    label: "Финансы",
    title: "Деньги становятся видимыми каждый день, а не только в конце месяца",
    cards: [
      {
        number: "+214 000 ₽",
        title: "вернули в регулярные оплаты для агентства",
        text: "После занесения всех счетов и дат оплат система показала 6 зависших платежей, владелец отправил точечные напоминания и вернул деньги в регулярный график.",
      },
      {
        number: "18%",
        title: "неучтённых расходов нашли внутри проекта",
        text: "После внедрения RIVN OS один из пользователей RIVN OS выяснил, что на части проектов есть неучтённые расходы на дизайнеров, которые проходили мимо юр. лица.",
      },
    ],
  },
  {
    key: "process",
    label: "Процессы",
    title: "Проекты перестают держаться на памяти руководителя",
    cards: [
      {
        number: "0",
        title: "потерянных задач после переноса",
        text: "Одно из агентств перестало вести задачи в задачниках и получило полную прозрасность по задачам и текущим процессам.",
      },
      {
        number: "-7 ч",
        title: "лишних созвонов в неделю",
        text: "Убрали ежедневные созвоны и сбор статусов в личке. Руководитель смотрит дашборд, видит просрочки и точечно помогает только там, где застряли.",
      },
    ],
  },
  {
    key: "growth",
    label: "Рост",
    title: "Рост становится управляемым, а не случайным",
    cards: [
      {
        number: "3",
        title: "сценария выручки до старта",
        text: "Теперь вы каждый месяц понимаете сколько денег придёт в следующем с учётом текущей динамики.",
      },
      {
        number: "+27%",
        title: "к повторным оплатам",
        text: "После внедрения RIVN OS фрилансер заранее начал приходить к клиентам и находить их проблемы, благодаря чему удалось значительно повысить LTV за 2 месяца.",
      },
    ],
  },
  {
    key: "team",
    label: "Команда",
    title: "Команда становится прозрачной без микроменеджмента",
    cards: [
      {
        number: "92%",
        title: "задач получили ответственного",
        text: "Каждый начинает понимать свою зону ответственности, реальные задачи и дедлайны. После этого стало понятно, кто отвечает за результат и где есть перегруз.",
      },
      {
        number: "1",
        title: "картина команды и денег",
        text: "Соединили выплаты, загрузку и прибыль по проектам. Руководитель увидел, где команда окупается, а где рост ФОТ начинает давить на маржу.",
      },
    ],
  },
];

const activeImpact = minimalImpactSections[activeImpactIndex];

useEffect(() => {
  if (!impactAutoplayEnabled) {
    return;
  }

  const timer = window.setInterval(() => {
    setActiveImpactIndex((current) => (current + 1) % minimalImpactSections.length);
  }, 10000);

  return () => window.clearInterval(timer);
}, [impactAutoplayEnabled, minimalImpactSections.length]);

useMotionValueEvent(lossProgress, "change", (latest) => {
  setLossSystemMode(latest > 0.36);
});

useEffect(() => {
  let frame = 0;
  let lastKey = "";

  const measureLines = () => {
    const scene = lossSceneRef.current;
    if (!scene) {
      return;
    }

    const sceneRect = scene.getBoundingClientRect();
    const x1 = (lossSystemCenter[0] / 100) * sceneRect.width;
    const y1 = (lossSystemCenter[1] / 100) * sceneRect.height;
    const nextLines = lossBubbleRefs.current
      .slice(0, moneyLeaks.length)
      .map((node) => {
        if (!node) {
          return null;
        }

        const rect = node.getBoundingClientRect();
        return {
          x1,
          y1,
          x2: rect.left + rect.width / 2 - sceneRect.left,
          y2: rect.top + rect.height / 2 - sceneRect.top,
        };
      })
      .filter((line): line is LossLine => Boolean(line));

    const nextKey = nextLines
      .map((line) => `${Math.round(line.x2)}:${Math.round(line.y2)}`)
      .join("|");

    if (nextKey !== lastKey) {
      lastKey = nextKey;
      setLossLines(nextLines);
    }
  };

  const scheduleMeasure = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(measureLines);
  };

  scheduleMeasure();
  const unsubscribe = lossProgress.on("change", scheduleMeasure);
  window.addEventListener("scroll", scheduleMeasure, { passive: true });
  window.addEventListener("resize", scheduleMeasure);

  return () => {
    window.cancelAnimationFrame(frame);
    unsubscribe();
    window.removeEventListener("scroll", scheduleMeasure);
    window.removeEventListener("resize", scheduleMeasure);
  };
}, [lossProgress, moneyLeaks.length]);

useEffect(() => {
  const updateProgress = () => {
    const section = lossSectionRef.current;
    if (!section) {
      return;
    }

    const rect = section.getBoundingClientRect();
    const scrollRange = Math.max(rect.height - window.innerHeight, 1);
    const nextProgress = Math.min(Math.max(-rect.top / scrollRange, 0), 1);
    lossProgress.set(nextProgress);
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  return () => {
    window.removeEventListener("scroll", updateProgress);
    window.removeEventListener("resize", updateProgress);
  };
}, [lossProgress]);

useEffect(() => {
  const interval = window.setInterval(() => {
    setActiveLeakIndex((current) => {
      const next = current === null ? 0 : current + 1;
      return next >= moneyLeaks.length ? 0 : next;
    });
  }, 3600);

  return () => window.clearInterval(interval);
}, [moneyLeaks.length]);

useEffect(() => {
  const section = lossSectionRef.current;
  if (!section) {
    return;
  }

  const observer = new IntersectionObserver(
    ([entry]) => setLossStageVisible(entry.isIntersecting),
    { threshold: 0.01 },
  );

  observer.observe(section);
  return () => observer.disconnect();
}, []);

const fadeUp = {
    initial: { opacity: 1, y: 0 },
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
              <div className={styles.brandIcon}>
  <Image
    src="/logorivnos.png"
    alt="RIVN OS logo"
    width={32}
    height={32}
    className={styles.brandLogoImage}
  />
</div>
              <div>
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
  <a
  href="https://t.me/weismakeleadgen"
  target="_blank"
  rel="noreferrer"
  className={styles.secondaryHeaderBtn}
>
  Telegram основателя
</a>
  <a
  href="https://t.me/thebestweis"
  target="_blank"
  rel="noreferrer"
  className={styles.secondaryHeaderBtn}
>
  Поддержка
</a>
  <Link href="/login" className={styles.primaryHeaderBtn}>
    Войти в дашборд
  </Link>
</div>
          </motion.header>

          {renderLegacyLandingSections ? (
          <section className={`${styles.hero} ${styles.heroV4} ${styles.heroExperimentHidden}`}>
            <div className={styles.heroV4Grid}>
              <motion.div {...fadeUp} className={styles.heroV4Copy}>
                <div className={styles.badge}>
                  <span className={styles.badgeNew}>14 дней бесплатно</span>
                  Для digital-специалистов, фрилансеров и агентств
                </div>

                <h1 className={styles.heroTitle}>
                  Операционная система для тех, кто вырос из хаоса
                </h1>

                <p className={styles.heroText}>
                  RIVN OS собирает клиентов, проекты, задачи, оплаты, команду и аналитику в
                  одну систему, чтобы ты видел деньги, сроки и рост без таблиц, переписок и
                  ручного контроля.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/login" className={styles.primaryCta}>
                    Получить 14 дней бесплатно
                  </Link>
                  <Link href="/login" className={styles.secondaryCta}>
                    Посмотреть как работает
                  </Link>
                </div>

                <div className={styles.heroTrustLine}>
                  <span>7-15+ проектов под контролем</span>
                  <span>финансы, клиенты, команда</span>
                  <span>без хаоса в голове</span>
                </div>
              </motion.div>

              <motion.div
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.12 }}
                className={styles.heroMission}
              >
                <div className={styles.heroMissionTop}>
                  <span>RIVN OS</span>
                  <span>Mission Control</span>
                </div>

                <div className={styles.heroMetricGrid}>
                  {[
                    ["Выручка", "842 000 ₽", "+18%"],
                    ["Прибыль", "364 500 ₽", "+27%"],
                    ["LTV", "118 000 ₽", "+12%"],
                    ["Оплаты", "3 просрочены", "важно"],
                  ].map(([label, value, meta]) => (
                    <div className={styles.heroMetricCard} key={label}>
                      <span>{label}</span>
                      <strong>{value}</strong>
                      <em>{meta}</em>
                    </div>
                  ))}
                </div>

                <div className={styles.heroPipeline}>
                  <div className={styles.heroPipelineHead}>
                    <span>Сегодня в системе</span>
                    <strong>28 задач</strong>
                  </div>
                  {[
                    ["Клиент: Alfa Ads", "Отчет и продление", "82%"],
                    ["Команда", "4 задачи в работе", "64%"],
                    ["Финансы", "сверить ФОТ и налоги", "76%"],
                  ].map(([name, detail, progress]) => (
                    <div className={styles.heroPipelineRow} key={name}>
                      <div>
                        <strong>{name}</strong>
                        <span>{detail}</span>
                      </div>
                      <i style={{ width: progress }} />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, delay: 0.26 }}
              className={styles.logoRow}
            >
              {["Digital", "Фрилансеры", "Агентства", "Маркетинг", "Продажи", "Аналитика"].map((logo) => (
                <div key={logo} className={styles.logoPill}>
                  {logo}
                </div>
              ))}
            </motion.div>
          </section>
          ) : null}

          <section id="hero" className={`${styles.hero} ${styles.heroCompact}`}>
            <div className={styles.heroMain}>
              <motion.div {...fadeUp} className={styles.badge}>
                <span className={styles.badgeNew}>14 дней бесплатно</span>
                От digital-специалистов для digital-специалистов
              </motion.div>

              <motion.h1
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.08 }}
                className={styles.heroTitle}
              >
                <span className={styles.heroTitleLead}>RIVN OS —</span>
                <span>система для роста фрилансеров, агентств и digital-команд.</span>
              </motion.h1>

              <motion.p
                {...fadeUp}
                transition={{ duration: 0.7, delay: 0.14 }}
                className={styles.heroText}
              >
                Мы помогаем повышать вашу прибыль с помощью внедрения системного подхода
                к проектам. Контроль клиентов, финансов, команды и глубокая аналитика в одном
                месте. От digital-специалистов для digital-специалистов.
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
            </div>

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
              {["Агентства", "Фрилансеры", "Digital", "Маркетинг", "Продажи", "Аналитика"].map((logo) => (
                <div key={logo} className={styles.logoPill}>
                  {logo}
                </div>
              ))}
            </motion.div>
          </section>

          {renderLegacyLandingSections ? (
          <section className={styles.heroLegacyHidden}>
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
          ) : null}
        </div>
      </section>

      <section
        id="problems"
        ref={lossSectionRef}
        className={styles.lossScrollSection}
      >
        <motion.div className={styles.lossSticky} style={{ opacity: lossStageVisible ? stageOpacity : 0 }}>
          <motion.div className={styles.lossSceneIntro} style={{ y: introY, opacity: introOpacity }}>
            <AnimatePresence mode="wait">
              <motion.h2
                key={lossSystemMode ? "system-title" : "chaos-title"}
                className={`${styles.lossSceneTitle} ${lossSystemMode ? styles.lossSceneTitleSystem : ""}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28 }}
              >
                {lossSystemMode ? (
                  <>
                    И решили эти проблемы с помощью систематизации процессов в{" "}
                    <span className={styles.noWrap}>RIVN OS</span>
                  </>
                ) : (
                  "Мы нашли главные причины, где вы теряете деньги"
                )}
              </motion.h2>
            </AnimatePresence>
            <motion.a
              href="/login"
              className={styles.lossSceneCta}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Перестать терять деньги
            </motion.a>
            <motion.a
              href="https://t.me/thebestweis"
              target="_blank"
              rel="noreferrer"
              className={styles.lossSceneSecondaryCta}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Записаться на демо
            </motion.a>
            <motion.div
              className={styles.lossSceneProof}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.08 }}
            >
              {lossSystemMode ? (
                <>
                  <strong>Мы в единой системе закрываем весь контур управления: деньги, клиентов, задачи, команду и прогнозирование.</strong>
                  <span>Вы РЕАЛЬНО понимаете, что происходит в бизнесе, а не просто догадываетесь.</span>
                </>
              ) : (
                <>
                  <strong>Деньги теряются не в одной большой ошибке, а в десятках незаметных касаний.</strong>
                  <span>Забытый счёт, клиент без следующего шага, задачи в голове и цифры без контроля постепенно съедают прибыль.</span>
                </>
              )}
            </motion.div>
          </motion.div>

          <div className={styles.lossScene} ref={lossSceneRef}>
            <motion.div
              className={styles.chaosLayer}
              style={{ opacity: chaosOpacity, scale: chaosScale }}
            >
              {leakParticles.slice(0, 24).map((particle, index) => (
                <motion.span
                  aria-hidden
                  key={`ambient-${index}`}
                  className={styles.ambientBubble}
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    width: particle.size,
                    height: particle.size,
                  }}
                  animate={{ y: [0, -10 - (index % 4) * 4, 0], opacity: [0.24, 0.58, 0.24] }}
                  transition={{
                    duration: 4.4 + (index % 5) * 0.55,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (index % 8) * 0.18,
                  }}
                />
              ))}

            </motion.div>

            <div className={styles.morphLayer}>
              {moneyLeaks.map((item, index) => (
                <LossBubble
                  key={item.leak}
                  item={item}
                  index={index}
                  active={activeLeakIndex === index}
                  systemMode={lossSystemMode}
                  progress={lossProgress}
                  onActivate={() => setActiveLeakIndex(index)}
                  bubbleRef={(node) => {
                    lossBubbleRefs.current[index] = node;
                  }}
                />
              ))}
            </div>

            <motion.div
              className={styles.systemLayer}
              style={{ opacity: systemOpacity, scale: systemScale }}
            >
              <div className={styles.systemLines} aria-hidden="true">
                {lossLines.map((line, index) => {
                  const deltaX = line.x2 - line.x1;
                  const deltaY = line.y2 - line.y1;
                  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

                  return (
                    <motion.span
                    key={`line-${index}`}
                      className={styles.systemLine}
                      style={{
                        left: line.x1,
                        top: line.y1,
                        width: length,
                        rotate: `${angle}deg`,
                        scaleX: systemLineScale,
                      }}
                    />
                  );
                })}
              </div>

            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeLeak.leak}
              className={styles.lossSceneCaption}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26 }}
            >
              <span>{lossSystemMode ? "RIVN OS закрывает" : "Сейчас теряется"}</span>
              <strong>{activeLeak.leak}</strong>
              <p>{lossSystemMode ? activeLeak.fix : activeLeak.loss}</p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </section>

      {renderLegacyLandingSections ? (
      <motion.section
        id="problems-old"
        {...fadeUp}
        className={`${styles.container} ${styles.lossSection} ${styles.oldProblemsHidden}`}
      >
        <div className={styles.lossHead}>
          <div>
            <div className={styles.lossEyebrow}>Как вы теряете деньги</div>
            <h2 className={styles.lossTitle}>
              Где сейчас тихо утекают деньги
            </h2>
          </div>
          <p className={styles.lossLead}>
            Не в одной большой ошибке. В забытых счетах, клиентах без касания,
            задачах в голове и прибыли, которую никто не считает до конца.
          </p>
        </div>

        <div className={styles.lossLayout}>
          <div className={styles.lossGrid}>
            {moneyLeaks.map((item, index) => (
              <motion.article
                key={item.leak}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -7, scale: 1.01 }}
                onMouseEnter={() => setActiveLeakIndex(index)}
                onMouseMove={() => setActiveLeakIndex(index)}
                onPointerEnter={() => setActiveLeakIndex(index)}
                onClick={() => setActiveLeakIndex(index)}
                onFocus={() => setActiveLeakIndex(index)}
                className={`${styles.lossCard} ${activeLeakIndex === index ? styles.lossCardActive : ""}`}
                tabIndex={0}
              >
                <div className={styles.lossCardTop}>
                  <span className={styles.lossNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.lossMetric}>{item.metric}</span>
                </div>
                <div className={styles.lossCardBody}>
                  <h3>{item.leak}</h3>
                  <p className={styles.lossProblem}>{item.loss}</p>
                </div>
                <div className={styles.lossFix}>
                  <span />
                  {item.fix}
                </div>
              </motion.article>
            ))}
          </div>

          <motion.aside
            className={styles.lossSystem}
            onMouseLeave={() => setActiveLeakIndex(0)}
            initial={{ opacity: 0, scale: 0.96, y: 28 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.lossSystemHeader}>
              <span>RIVN OS</span>
              <strong>{activeLeak.metric}</strong>
            </div>

            <div className={styles.lossSystemStage}>
              <motion.div
                aria-hidden
                className={styles.lossCore}
                animate={{ scale: activeLeakIndex === null ? [1, 1.05, 1] : 1.08 }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <span>OS</span>
              </motion.div>

              {leakParticles.map((particle, index) => {
                const isActive = activeLeakIndex !== null;
                return (
                  <motion.span
                    aria-hidden
                    key={index}
                    className={styles.lossParticle}
                    style={{
                      width: particle.size,
                      height: particle.size,
                    }}
                    animate={{
                      left: `${isActive ? particle.targetX : particle.x}%`,
                      top: `${isActive ? particle.targetY : particle.y}%`,
                      opacity: isActive ? 0.9 : 0.42 + (index % 4) * 0.12,
                      scale: isActive ? 1.18 : 0.75 + (index % 5) * 0.12,
                    }}
                    transition={{
                      duration: 0.65,
                      delay: index * 0.008,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  />
                );
              })}

              <div className={styles.lossOrbitOne} />
              <div className={styles.lossOrbitTwo} />
              <div className={styles.lossOrbitThree} />
              <div className={styles.lossSignal}>хаос → система</div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeLeak.leak}
                className={styles.lossSystemFooter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28 }}
              >
                <span>RIVN OS закрывает</span>
                <strong>{activeLeak.leak}</strong>
                <p>{activeLeak.fix}</p>
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        </div>
      </motion.section>
      ) : null}

      {renderLegacyLandingSections ? (
      <motion.section
        aria-hidden="true"
        {...fadeUp}
        className={`${styles.container} ${styles.problemsSection} ${styles.oldProblemsHidden}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
  Мы решили проблему
  <br />
  отсутствия роста бизнеса
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
      ) : null}

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
            RIVN OS — это полноценная
            <br />
            операционная система бизнеса
          </h2>
          <p className={styles.solutionText}>
  Ты видишь в одном месте финансы, клиентов, задачи, команду и точки роста. Мы
  сделали систему, на которой можно спокойно масштабировать бизнес.
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
          <div className={styles.sectionEyebrow}>В одной системе</div>
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
              transition={{
                opacity: { duration: 0.5, delay: index * 0.05 },
                y: { duration: 0.5, delay: index * 0.05 },
                scale: { duration: 0.28, ease: "easeOut" },
              }}
              whileHover={{ scale: 1.006 }}
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
                    <>
                    <div className={styles.macbookMockup} aria-label="Пример дашборда RIVN OS">
                      <div className={styles.macbookScreen}>
                        <Image
                          src="/guide/screens/dashboard-demo.png"
                          alt="Демо-дэшборд RIVN OS"
                          width={1600}
                          height={1000}
                          sizes="(max-width: 767px) 88vw, (max-width: 1279px) 72vw, 680px"
                          className={styles.macbookScreenshot}
                        />
                      </div>
                      <div className={styles.macbookBase}>
                        <div className={styles.macbookBaseLip} />
                      </div>
                    </div>
                    <div className={styles.oldDashboardPreview} aria-hidden="true">
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
                    </>
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
  ["Altura", "Дизайн и трафик", "В работе"],
  ["Neonix", "Аналитика и рост", "Ожидает оплату"],
  ["Velaris", "Сопровождение", "Стабильно"],
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
  "У клиента Neonix риск просрочки оплаты",
  "Маржинальность снизилась на 8%",
  "Проект Velaris можно масштабировать",
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
        id="rivn-leads"
        {...fadeUp}
        className={`${styles.container} ${styles.leadsSection}`}
      >
        <div className={styles.leadsShell}>
          <div className={styles.leadsContent}>
            <div className={styles.sectionEyebrow}>RIVN Leads</div>
            <h2 className={styles.sectionTitleSmall}>
              Получайте заявки
              <br />
              со всего Telegram!
            </h2>
            <p className={styles.sectionText}>
              Мы сделали инструмент, который позволяет получать вам заявки со всего телеграмма!
              В том числе с закрытых и платных каналов. Работает 24/7, подходит для всех digital
              специалистов и выдаёт лучшие заявки на рынке.
            </p>
            <div className={styles.leadsNote}>*Доступно в тарифе STRATEGY</div>
          </div>

          <div className={styles.leadsReport}>
            <div className={styles.leadsReportHeader}>
              <span>RIVN Leads</span>
              <strong>Ежедневный отчёт</strong>
            </div>
            <div className={styles.leadsReportHero}>
              <div>
                <span>Новых заявок</span>
                <strong>37</strong>
              </div>
              <div>
                <span>Лучшие лиды</span>
                <strong>9</strong>
              </div>
            </div>
            <div className={styles.leadsReportList}>
              {[
                ["Маркетолог нужен на Авито", "Бюджет 120 000 ₽", "98%"],
                ["Таргетолог для онлайн-школы", "Запрос сегодня", "94%"],
                ["Директолог в нишу услуг", "Горячий лид", "91%"],
              ].map(([title, meta, score]) => (
                <div key={title} className={styles.leadsReportItem}>
                  <div>
                    <strong>{title}</strong>
                    <span>{meta}</span>
                  </div>
                  <em>{score}</em>
                </div>
              ))}
            </div>
            <div className={styles.leadsReportFooter}>
              <span>Отчёт пришёл в Telegram</span>
              <strong>09:00</strong>
            </div>
          </div>
        </div>
      </motion.section>

      {renderLegacyLandingSections ? (
      <motion.section
        id="pricing-legacy"
        {...fadeUp}
        className={`${styles.container} ${styles.pricingSection} ${styles.oldProblemsHidden}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={`${styles.sectionTitle} ${styles.pricingTitle}`}>Простой доступ к системе управления</h2>
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
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ""} ${plan.name === "STRATEGY" ? styles.planStrategy : ""}`}
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
              className={`${styles.planButton} ${plan.featured ? styles.planButtonFeatured : ""} ${plan.name === "STRATEGY" ? styles.planButtonStrategy : ""}`}
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
      ) : null}

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.valueSection}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            RIVN OS растёт вместе с вами!
          </h2>
          <p className={styles.sectionText}>
            Мы каждый день улучшаем продукт, исправляем баги и добавляем новые функции. Если вам не хватает сценария, отчёта или раздела — бесплатно доработаем систему под ваш процесс, чтобы закрыть 100% реальных потребностей.
          </p>
        </div>

        <div className={styles.valueGrid}>
          <motion.div whileHover={{ y: -4, scale: 1.005 }} className={styles.valueHeroCard}>
            <div className={styles.valueHeroGlowA} />
            <div className={styles.valueHeroGlowB} />
            <div className={styles.valueHeroOverlay} />
            <div className={styles.valueHeroContent}>
              <div className={styles.valueLabel}>Премиум-подход</div>
              <h3 className={styles.valueHeroTitle}>Система, которая подстраивается под бизнес, а не наоборот</h3>
            </div>
          </motion.div>

          <div className={styles.valueSideGrid}>
            {productAdvantages.map((item, index) => (
              <motion.div
                key={item.title}
                whileHover={{ y: -4, scale: 1.005 }}
                className={index === 1 ? styles.valueCardPurple : styles.valueCard}
              >
                <div className={styles.valueLabel}>{item.label}</div>
                <h3 className={styles.valueCardTitle}>{item.title}</h3>
                <p className={styles.valueCardText}>{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className={styles.centerAction}>
          <Link href="/login" className={styles.primaryCta}>
            Обсудить внедрение
          </Link>
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.reviewsSection}`}
      >
        <div className={styles.impactShell}>
          <div className={styles.impactIntro}>
            <h2 className={styles.impactTitle}>
              Цифры,
              <br />
              которые
              <br />
              показывают
              <br />
              <span>наш вклад</span>
            </h2>

            <div className={styles.impactPills}>
              {minimalImpactSections.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={activeImpactIndex === index ? styles.impactPillActive : ""}
                  onClick={() => {
                    setActiveImpactIndex(index);
                    setImpactAutoplayEnabled(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.impactContent}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeImpact.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.28 }}
                className={styles.impactContentInner}
              >
                <div className={styles.impactContentHead}>
                  <span>{activeImpact.label}</span>
                  <h3>{activeImpact.title}</h3>
                </div>

                <div className={styles.impactCards}>
                  {activeImpact.cards.map((card, index) => (
                    <motion.article
                      key={card.title}
                      whileHover={{ y: -4, scale: 1.01 }}
                      className={`${styles.impactCard} ${index === 1 ? styles.impactCardAccent : ""}`}
                    >
                      <strong className={styles.impactBigNumber}>{card.number}</strong>
                      <h3>{card.title}</h3>
                      <p>{card.text}</p>
                    </motion.article>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.section>

      <motion.section
        id="pricing"
        {...fadeUp}
        className={`${styles.container} ${styles.pricingSection}`}
      >
        <div className={styles.sectionHead}>
          <h2 className={`${styles.sectionTitle} ${styles.pricingTitle}`}>Простой доступ к системе управления</h2>
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
              className={`${styles.planCard} ${plan.featured ? styles.planFeatured : ""} ${plan.name === "STRATEGY" ? styles.planStrategy : ""}`}
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
                className={`${styles.planButton} ${plan.featured ? styles.planButtonFeatured : ""} ${plan.name === "STRATEGY" ? styles.planButtonStrategy : ""}`}
              >
                Начать бесплатно
              </Link>
            </motion.article>
          ))}
        </div>

        <div className={styles.pricingNote}>
          Окупается быстрее, чем большинство операционных ошибок. Один сохранённый клиент уже
          делает систему выгодной.
        </div>
      </motion.section>

      <motion.section
        {...fadeUp}
        className={`${styles.container} ${styles.finalCtaSection}`}
      >
        <div className={styles.finalCtaCard}>
          <div className={styles.finalCtaGlow} />
          <div className={styles.sectionEyebrow}>Старт без риска</div>
          <h2 className={styles.finalCtaTitle}>Хватит управлять бизнесом из головы</h2>
          <p className={styles.finalCtaText}>
            Настрой RIVN OS один раз — и начни свой стабильный системный рост,
            <br className={styles.desktopBreak} />
            основываясь на реальных цифрах, а не на догадках.
          </p>
          <div className={styles.solutionActions}>
            <Link href="/login" className={styles.primaryCta}>
              Получить 14 дней бесплатно
            </Link>
            <Link href="https://t.me/thebestweis" target="_blank" rel="noreferrer" className={styles.secondaryCta}>
              Записаться на настройку
            </Link>
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
  {faqItems.map((item, index) => {
    const isOpen = openFaqIndex === index;

    return (
      <motion.div
        key={item.q}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, delay: index * 0.05 }}
        whileHover={{ y: -2 }}
        className={styles.faqItem}
      >
        <button
          type="button"
          onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
          className={styles.faqButton}
        >
          <div className={styles.faqHead}>
            <div>
              <h3 className={styles.faqQuestion}>{item.q}</h3>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    key="answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeInOut" }}
                    className={styles.faqAnswerWrap}
                  >
                    <p className={styles.faqAnswer}>{item.a}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className={styles.faqToggle}>{isOpen ? "−" : "+"}</div>
          </div>
        </button>
      </motion.div>
    );
  })}
</div>
        </div>
      </motion.section>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerLeft}>
              <div className={styles.footerLead}>Оставайся на связи</div>
              <div className={styles.footerBrand}>
  <div className={styles.footerBrandIcon}>
    <Image
      src="/logorivnos.png"
      alt="RIVN OS logo"
      width={28}
      height={28}
      className={styles.footerBrandLogoImage}
    />
  </div>
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
              <a
  href="https://t.me/thebestweis"
  target="_blank"
  rel="noreferrer"
  className={styles.footerInputRow}
>
  <div className={styles.footerInputFake}>Написать в техническую поддержку</div>
  <span className={styles.footerArrow}>↗</span>
</a>

              <div className={styles.footerIcons}>
  <a
    href="https://t.me/weismakeleadgen"
    target="_blank"
    rel="noreferrer"
    className={styles.footerIconBtn}
  >
    tg
  </a>

  <a
    href="https://vk.ru/dearweis"
    target="_blank"
    rel="noreferrer"
    className={styles.footerIconBtn}
  >
    vk
  </a>

  <a
    href="https://www.youtube.com/@WeisHidden"
    target="_blank"
    rel="noreferrer"
    className={styles.footerIconBtn}
  >
    yt
  </a>

  <span className={styles.footerIconBtn}>in</span>
</div>
            </div>
          </div>

          <div className={styles.footerBottom}>
  <div>©2026 RIVN OS. Все права защищены.</div>
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


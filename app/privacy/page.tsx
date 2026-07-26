import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import styles from "./privacy-page.module.css";

export const metadata: Metadata = {
  title: "Политика конфиденциальности | RIVN OS",
  description:
    "Политика конфиденциальности RIVN OS: какие данные обрабатываются, как они используются, хранятся и удаляются.",
};

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string; id?: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };
type HeadingBlock = Extract<Block, { type: "heading" }>;
type ParagraphBlock = Extract<Block, { type: "paragraph" }>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePolicyMarkdown(markdown: string) {
  const blocks: Block[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const text = heading[2].replace(/\*\*/g, "");
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({
        type: "heading",
        level,
        text,
        id: level === 2 ? slugify(text) : undefined,
      });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      listItems.push(line.slice(2));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|https?:\/\/\S+)/g);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,;)]$/, "");
      const suffix = part.slice(href.length);
      return (
        <span key={index}>
          <a href={href} target="_blank" rel="noreferrer">
            {href}
          </a>
          {suffix}
        </span>
      );
    }

    return part;
  });
}

function getPolicyBlocks() {
  const filePath = path.join(process.cwd(), "app", "privacy", "privacy-policy.md");
  return parsePolicyMarkdown(fs.readFileSync(filePath, "utf8"));
}

export default function PrivacyPage() {
  const blocks = getPolicyBlocks();
  const titleBlock = blocks.find(
    (block): block is HeadingBlock =>
      block.type === "heading" && block.level === 1
  );
  const versionBlock = blocks.find(
    (block): block is ParagraphBlock =>
      block.type === "paragraph" && block.text.startsWith("**Версия")
  );
  const sections = blocks.filter(
    (block): block is HeadingBlock =>
      block.type === "heading" && block.level === 2
  );

  return (
    <main className={styles.page}>
      <div className={styles.bgGrid} aria-hidden="true" />
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand} aria-label="На главную RIVN OS">
            <span className={styles.brandIcon}>
              <Image
                src="/rivn-logo-icon.png"
                alt=""
                width={44}
                height={44}
                priority
              />
            </span>
            <span>
              <span className={styles.brandKicker}>RIVN OS</span>
              <span className={styles.brandName}>Privacy</span>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Навигация">
            <Link href="/" className={styles.navLink}>
              Главная
            </Link>
            <Link href="/login" className={styles.navButton}>
              Войти
            </Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <p className={styles.eyebrow}>Открытый документ</p>
          <h1>{titleBlock?.text ?? "Политика конфиденциальности RIVN OS"}</h1>
          <p className={styles.version}>
            {versionBlock ? renderInline(versionBlock.text) : "Версия 1.0 от 26 июля 2026 года"}
          </p>
          <p className={styles.lead}>
            Страница доступна без регистрации и авторизации. Здесь собраны правила
            обработки данных при использовании сайта, расширения, Telegram-бота,
            API и связанных сервисов RIVN OS.
          </p>
        </section>

        <div className={styles.contentGrid}>
          <aside className={styles.toc} aria-label="Содержание политики">
            <div className={styles.tocTitle}>Содержание</div>
            <div className={styles.tocList}>
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.text}
                </a>
              ))}
            </div>
          </aside>

          <article className={styles.document}>
            {blocks.map((block, index) => {
              if (block.type === "heading" && block.level === 1) return null;
              if (block.type === "paragraph" && block.text.startsWith("**Версия")) return null;

              if (block.type === "heading") {
                const HeadingTag = block.level === 2 ? "h2" : "h3";
                return (
                  <HeadingTag key={index} id={block.id} className={styles[`h${block.level}`]}>
                    {renderInline(block.text)}
                  </HeadingTag>
                );
              }

              if (block.type === "list") {
                return (
                  <ul key={index}>
                    {block.items.map((item) => (
                      <li key={item}>{renderInline(item)}</li>
                    ))}
                  </ul>
                );
              }

              return <p key={index}>{renderInline(block.text)}</p>;
            })}
          </article>
        </div>
      </div>
    </main>
  );
}

/**
 * Blog post utilities — slug generation, reading-time estimate, and a small
 * Markdown renderer designed for SEO articles.
 *
 * Why a custom Markdown renderer instead of react-markdown / marked:
 * 1. Zero new dependencies — keeps the bundle small and the supply chain
 *    minimal.
 * 2. The articles we plan to write here (3000-4000 word SEO posts on
 *    Postplan's blog) only need: H2/H3, paragraphs, lists, bold/italic,
 *    inline code, links, and images. Everything else is overkill.
 * 3. We render to JSX directly — no `dangerouslySetInnerHTML` so XSS risk
 *    from manually-written admin content is structurally avoided.
 *
 * The renderer is intentionally line-based and pragmatic. It is NOT a full
 * CommonMark implementation. If a feature isn't here, write it differently
 * or extend later.
 */

import type { ReactNode } from 'react';

/* -------------------------------------------------------------------------- */
/* Slug + time-to-read                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Convert a string into a URL-safe slug. Supports Cyrillic transliteration
 * for Russian SEO titles (e.g. "Маркировка рекламы" → "markirovka-reklamy").
 */
export function slugify(input: string): string {
  const cyrillicMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu',
    я: 'ya',
  };
  return input
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => cyrillicMap[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Rough reading-time estimate: 180 words per minute (slow side, since blog
 * posts often have code/numbers people pause on). Returns minutes, minimum 1.
 */
export function estimateReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

/* -------------------------------------------------------------------------- */
/* Markdown renderer                                                          */
/* -------------------------------------------------------------------------- */

/** Inline tokens: bold, italic, inline code, links. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  // Order matters: longest delimiters first so ** isn't eaten by *
  const patterns: Array<{ regex: RegExp; render: (m: RegExpExecArray, k: string) => ReactNode }> = [
    {
      regex: /\*\*([^*]+)\*\*/y,
      render: (m, k) => <strong key={k}>{m[1]}</strong>,
    },
    {
      regex: /\*([^*]+)\*/y,
      render: (m, k) => <em key={k}>{m[1]}</em>,
    },
    {
      regex: /`([^`]+)`/y,
      render: (m, k) => (
        <code key={k} className="rounded bg-surface-sunken px-1 py-0.5 text-[0.9em]">
          {m[1]}
        </code>
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)\s]+)\)/y,
      render: (m, k) => {
        const isExternal = /^https?:\/\//i.test(m[2]) && !m[2].includes('postplan-tg.ru');
        return (
          <a
            key={k}
            href={m[2]}
            className="text-primary underline-offset-2 hover:underline"
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {m[1]}
          </a>
        );
      },
    },
  ];

  while (cursor < text.length) {
    let matched = false;
    for (const { regex, render } of patterns) {
      regex.lastIndex = cursor;
      const m = regex.exec(text);
      if (m && m.index === cursor) {
        nodes.push(render(m, `${keyPrefix}-${key++}`));
        cursor = regex.lastIndex;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Collect a run of plain text until the next potential token
      const next = text.slice(cursor).search(/[*`[]/);
      const end = next === -1 ? text.length : cursor + Math.max(next, 1);
      nodes.push(text.slice(cursor, end));
      cursor = end;
    }
  }

  return nodes;
}

/**
 * Render a Markdown string to React nodes. Supports:
 *   #, ##, ###     → h1, h2, h3
 *   - / * / 1.     → ul / ol
 *   > ...          → blockquote
 *   ---            → hr
 *   ![alt](url)    → image (as <img>, not next/image, to avoid layout shift
 *                    issues with admin-supplied unknown dimensions)
 *   inline: **bold**, *italic*, `code`, [text](url)
 *   blank line     → paragraph break
 */
export function renderMarkdown(md: string): ReactNode {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const Tag = (`h${level}` as 'h1' | 'h2' | 'h3');
      const className =
        level === 1 ? 'mt-10 text-3xl font-semibold tracking-tight'
        : level === 2 ? 'mt-10 text-2xl font-semibold tracking-tight'
        : 'mt-8 text-lg font-semibold tracking-tight';
      blocks.push(
        <Tag key={`b${blockKey++}`} className={className}>
          {renderInline(text, `b${blockKey}`)}
        </Tag>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push(<hr key={`b${blockKey++}`} className="my-10 border-border" />);
      i++;
      continue;
    }

    // Image (alone on a line)
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (img) {
      blocks.push(
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`b${blockKey++}`}
          src={img[2]}
          alt={img[1]}
          className="my-6 w-full rounded-lg border border-border"
        />
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={`b${blockKey++}`} className="my-4 list-disc space-y-1.5 pl-6">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `b${blockKey}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push(
        <ol key={`b${blockKey++}`} className="my-4 list-decimal space-y-1.5 pl-6">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `b${blockKey}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const parts: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`b${blockKey++}`}
          className="my-6 border-l-4 border-primary/40 bg-surface-sunken/30 px-4 py-2 italic text-muted-foreground"
        >
          {renderInline(parts.join(' '), `b${blockKey}`)}
        </blockquote>
      );
      continue;
    }

    // Paragraph — collect lines until blank or block-starter
    const paragraph: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,3}\s|[-*]\s|\d+\.\s|>|-{3,}|!\[)/.test(lines[i])) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`b${blockKey++}`} className="my-4 leading-relaxed">
        {renderInline(paragraph.join(' '), `b${blockKey}`)}
      </p>
    );
  }

  return <>{blocks}</>;
}

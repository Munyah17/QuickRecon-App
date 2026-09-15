"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight markdown renderer for Kareem chat responses.
 * Supports: headings, bold/italic, bullet + numbered lists, tables,
 * inline + fenced code, and paragraphs. No external dependencies.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {parseBlocks(text)}
    </div>
  );
}

function parseBlocks(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++} className="overflow-x-auto rounded-lg bg-foreground/5 p-2.5 text-[11.5px] leading-4">
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Table (header row + |---| separator)
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const parseRow = (l: string) =>
        l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = parseRow(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        body.push(parseRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto rounded-lg border">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="bg-foreground/5 text-left">
                {head.map((h, j) => (
                  <th key={j} className="px-2.5 py-1.5 font-semibold">{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {body.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k} className="px-2.5 py-1.5">{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Heading
    const hMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (hMatch) {
      const size = ["text-[15px]", "text-[14px]", "text-[13px]", "text-[13px]"][hMatch[1].length - 1];
      blocks.push(
        <p key={key++} className={cn("pt-1 font-bold", size)}>{inline(hMatch[2])}</p>
      );
      i++;
      continue;
    }

    // Bullet / numbered list — gather consecutive items
    if (/^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ""));
        i++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key++} className={cn("space-y-1 pl-4", ordered ? "list-decimal" : "list-disc")}>
          {items.map((it, j) => (
            <li key={j} className="text-[12.5px] leading-5">{inline(it)}</li>
          ))}
        </List>
      );
      continue;
    }

    // Blank line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph — join consecutive non-empty lines
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(\s*[-*•]\s|\s*\d+[.)]\s|#{1,4}\s|```)/.test(lines[i]) && !lines[i].includes("|")) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="text-[12.5px] leading-5">
        {inline(para.join(" "))}
      </p>
    );
  }

  return blocks;
}

/** Inline formatting: **bold**, *italic*, `code`. */
function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) {
      out.push(<strong key={key++} className="font-semibold">{t.slice(2, -2)}</strong>);
    } else if (t.startsWith("`")) {
      out.push(<code key={key++} className="rounded bg-foreground/10 px-1 py-0.5 text-[11px]">{t.slice(1, -1)}</code>);
    } else {
      out.push(<em key={key++}>{t.slice(1, -1)}</em>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

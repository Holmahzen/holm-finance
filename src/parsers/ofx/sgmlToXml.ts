function escapeXmlText(text: string): string {
  return text
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * OFX 1.x is SGML: leaf tags are often left unclosed (e.g. `<TRNTYPE>DEBIT`
 * with no `</TRNTYPE>`). This normalizes each line into well-formed XML so
 * it can be parsed with a standard XML parser.
 */
export function sgmlToXml(sgml: string): string {
  const lines = sgml.split(/\r?\n/);
  const output: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^<([A-Za-z0-9.]+)>(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }

    const [, tag, rest] = match;
    if (rest.length === 0) {
      // pure container opening tag, e.g. <STMTTRN>
      output.push(line);
      continue;
    }

    const closingTag = `</${tag}>`;
    if (rest.endsWith(closingTag)) {
      // already well-formed, e.g. <TRNTYPE>DEBIT</TRNTYPE>
      output.push(line);
      continue;
    }

    output.push(`<${tag}>${escapeXmlText(rest)}${closingTag}`);
  }

  return output.join("\n");
}

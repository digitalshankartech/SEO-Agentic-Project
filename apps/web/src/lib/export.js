// ─── Markdown → Clean HTML ───────────────────────────────────────────────────

export function markdownToHtml(md) {
  let h = md.trim();

  // Fenced code blocks
  h = h.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

  // Tables  (header | --- | rows)
  h = h.replace(
    /\|(.+)\|\r?\n\|[-| :]+\|\r?\n((?:\|.+\|\r?\n?)*)/g,
    (_m, header, body) => {
      const ths = header.split('|').filter(Boolean)
        .map(c => `<th>${c.trim()}</th>`).join('');
      const trs = body.trim().split('\n').map(row => {
        const tds = row.split('|').filter(Boolean)
          .map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      }).join('');
      return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>\n`;
    }
  );

  // Headers
  h = h.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  h = h.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
  h = h.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
  h = h.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

  // Horizontal rule
  h = h.replace(/^---+$/gm, '<hr>');

  // Bold + italic combos
  h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  h = h.replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>');
  h = h.replace(/__(.+?)__/g,         '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g,         '<em>$1</em>');

  // Inline code
  h = h.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Blockquotes
  h = h.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Unordered lists (grouped)
  h = h.replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => `<li>${l.replace(/^[ \t]*[-*] /, '').trim()}</li>`)
      .join('');
    return `<ul>${items}</ul>\n`;
  });

  // Ordered lists (grouped)
  h = h.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n')
      .map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`)
      .join('');
    return `<ol>${items}</ol>\n`;
  });

  // Paragraphs — wrap non-HTML blocks
  const blocks = h.split(/\n{2,}/);
  h = blocks.map(block => {
    const b = block.trim();
    if (!b) return '';
    if (/^<[a-z]/.test(b)) return b;   // already an HTML tag
    return `<p>${b.replace(/\n/g, ' ')}</p>`;
  }).join('\n\n');

  return h;
}

// ─── Export as downloadable .html file ───────────────────────────────────────

export function exportToHtml(markdown, title = 'Marketing Suite Export') {
  const body = markdownToHtml(markdown);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           max-width: 860px; margin: 40px auto; padding: 0 24px;
           color: #111827; line-height: 1.7; background: #fff; }
    h1 { font-size: 2rem; font-weight: 800; margin: 0 0 8px; color: #1e1b4b; }
    h2 { font-size: 1.3rem; font-weight: 700; margin: 2rem 0 .6rem; color: #1e1b4b;
         padding-bottom: 6px; border-bottom: 2px solid #e0e7ff; }
    h3 { font-size: 1.05rem; font-weight: 600; margin: 1.4rem 0 .4rem; color: #312e81; }
    h4 { font-size: .95rem; font-weight: 600; margin: 1.2rem 0 .3rem; }
    p  { margin: .5rem 0 1rem; }
    ul, ol { margin: .4rem 0 1rem 1.4rem; padding: 0; }
    li { margin-bottom: .35rem; }
    strong { font-weight: 700; color: #111; }
    code  { background: #eef2ff; color: #4338ca; padding: 2px 6px; border-radius: 4px;
            font-size: .85em; font-family: 'Fira Code', 'Courier New', monospace; }
    pre   { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px;
            overflow-x: auto; font-size: .85em; margin: 1rem 0; }
    pre code { background: none; color: inherit; padding: 0; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .9em; }
    th    { background: #eef2ff; color: #312e81; font-weight: 600;
            padding: 10px 14px; text-align: left; border: 1px solid #c7d2fe; }
    td    { padding: 9px 14px; border: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    blockquote { border-left: 4px solid #6366f1; margin: 1rem 0; padding: .5rem 1rem;
                 background: #f5f3ff; border-radius: 0 8px 8px 0; color: #4b5563; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 2rem 0; }
    .header-bar { background: #4f46e5; color: #fff; padding: 14px 24px;
                  border-radius: 10px; margin-bottom: 2rem;
                  display: flex; align-items: center; gap: 10px; }
    .header-bar span { font-size: .8rem; opacity: .75; }
    .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;
              font-size: .75rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="header-bar">
    <strong>✦ Marketing Suite</strong>
    <span>— AI-powered output · Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
  </div>
  ${body}
  <div class="footer">Generated by Marketing Suite · Powered by marketingskills + AI</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Copy as WordPress-ready HTML ────────────────────────────────────────────

export function copyAsWordPress(markdown) {
  const html = markdownToHtml(markdown);
  // WordPress doesn't need a full document — just the body content
  return navigator.clipboard.writeText(html);
}

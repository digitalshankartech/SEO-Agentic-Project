import pptxgen from 'pptxgenjs';

const SLIDE = {
  width: 13.333,
  height: 7.5,
  marginX: 0.72,
  accent: '2563EB',
  dark: '0F172A',
  muted: '64748B',
  border: 'D8E3F0',
  soft: 'F8FAFC',
};

const MAX_BODY_LINES = 9;
const MAX_TEXT_LENGTH = 420;

function slugify(value) {
  return String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'report';
}

function cleanText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/\r/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function clampText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = cleanText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function isHeading(line) {
  return /^#{1,3}\s+\S/.test(line);
}

function stripHeading(line) {
  return cleanText(line.replace(/^#{1,6}\s+/, ''));
}

function normalizeBodyLine(line) {
  const trimmed = cleanText(line.replace(/^[-*]\s+/, '- ').replace(/^\d+\.\s+/, ''));
  if (!trimmed) return '';
  return /^[-*]\s+/.test(trimmed) ? trimmed.replace(/^\*\s+/, '- ') : trimmed;
}

function splitLongLine(line) {
  const text = normalizeBodyLine(line);
  if (!text || text.length <= 120) return text ? [text] : [];

  const chunks = [];
  const words = text.split(' ');
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 120) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) chunks.push(current);
  return chunks;
}

function chunkLines(lines, size) {
  const chunks = [];
  for (let i = 0; i < lines.length; i += size) {
    chunks.push(lines.slice(i, i + size));
  }
  return chunks;
}

function parseSections(markdown) {
  const lines = String(markdown || '')
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((line) => line.trim());

  const sections = [];
  let current = null;

  lines.forEach((line) => {
    if (!line) return;

    if (isHeading(line)) {
      if (current) sections.push(current);
      current = { title: stripHeading(line), body: [] };
      return;
    }

    if (!current) {
      current = { title: 'Key Findings', body: [] };
    }

    current.body.push(...splitLongLine(line));
  });

  if (current) sections.push(current);

  if (!sections.length) {
    return [{ title: 'Analysis', body: ['Analysis is still being generated.'] }];
  }

  return sections
    .map((section) => ({
      title: clampText(section.title || 'Analysis', 76),
      body: section.body.map((line) => clampText(line, 180)).filter(Boolean),
    }))
    .filter((section) => section.title || section.body.length)
    .slice(0, 18);
}

function buildSlides(markdown) {
  return parseSections(markdown).flatMap((section) => {
    const bodyChunks = chunkLines(section.body.length ? section.body : ['No details provided.'], MAX_BODY_LINES);
    return bodyChunks.map((body, index) => ({
      title: index === 0 ? section.title : `${section.title} (${index + 1})`,
      body,
    }));
  });
}

function addFooter(slide, slideNumber) {
  slide.addShape('line', {
    x: SLIDE.marginX,
    y: 6.9,
    w: SLIDE.width - (SLIDE.marginX * 2),
    h: 0,
    line: { color: SLIDE.border, width: 1 },
  });
  slide.addText(`Slide ${slideNumber}`, {
    x: SLIDE.width - 1.7,
    y: 7.02,
    w: 1,
    h: 0.18,
    fontFace: 'Arial',
    fontSize: 8,
    color: SLIDE.muted,
    align: 'right',
    margin: 0,
  });
}

function addCoverSlide(presentation, title) {
  const slide = presentation.addSlide();
  slide.background = { color: SLIDE.dark };
  slide.addText('Marketing Suite Export', {
    x: SLIDE.marginX,
    y: 1.35,
    w: 5.2,
    h: 0.3,
    fontFace: 'Arial',
    fontSize: 12,
    bold: true,
    color: '93C5FD',
    margin: 0,
    breakLine: false,
  });
  slide.addText(clampText(title, 90), {
    x: SLIDE.marginX,
    y: 2,
    w: 10.8,
    h: 1.4,
    fontFace: 'Arial',
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    margin: 0,
    fit: 'shrink',
  });
  slide.addText('Client-ready PowerPoint export generated from the analysis output.', {
    x: SLIDE.marginX,
    y: 3.55,
    w: 8.8,
    h: 0.38,
    fontFace: 'Arial',
    fontSize: 14,
    color: 'CBD5E1',
    margin: 0,
  });
  slide.addShape('rect', {
    x: SLIDE.marginX,
    y: 4.35,
    w: 1.25,
    h: 0.08,
    fill: { color: SLIDE.accent },
    line: { color: SLIDE.accent },
  });
}

function addContentSlide(presentation, section, slideNumber) {
  const slide = presentation.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText('Analysis', {
    x: SLIDE.marginX,
    y: 0.45,
    w: 2.1,
    h: 0.22,
    fontFace: 'Arial',
    fontSize: 9,
    bold: true,
    color: SLIDE.accent,
    margin: 0,
  });
  slide.addText(section.title, {
    x: SLIDE.marginX,
    y: 0.78,
    w: 11.2,
    h: 0.72,
    fontFace: 'Arial',
    fontSize: 22,
    bold: true,
    color: SLIDE.dark,
    margin: 0,
    fit: 'shrink',
  });
  slide.addShape('roundRect', {
    x: SLIDE.marginX,
    y: 1.75,
    w: 11.9,
    h: 4.85,
    rectRadius: 0.08,
    fill: { color: SLIDE.soft },
    line: { color: SLIDE.border, width: 1 },
  });
  slide.addText(section.body.join('\n'), {
    x: 0.98,
    y: 2.05,
    w: 11.3,
    h: 4.22,
    fontFace: 'Arial',
    fontSize: 13,
    color: '1E293B',
    breakLine: false,
    fit: 'shrink',
    valign: 'top',
    margin: 0.08,
    paraSpaceAfterPt: 8,
  });
  addFooter(slide, slideNumber);
}

export async function exportAnalysisPptx(markdown, title = 'SEO Audit Results') {
  const presentation = new pptxgen();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'Marketing Suite';
  presentation.company = 'Marketing Suite';
  presentation.subject = cleanText(title);
  presentation.title = cleanText(title);
  presentation.lang = 'en-US';
  presentation.theme = {
    headFontFace: 'Arial',
    bodyFontFace: 'Arial',
    lang: 'en-US',
  };

  addCoverSlide(presentation, title);
  buildSlides(markdown).forEach((section, index) => {
    addContentSlide(presentation, section, index + 2);
  });

  await presentation.writeFile({ fileName: `${slugify(title)}.pptx` });
}

export function summarizeUnavailableMetric(reason) {
  return reason || 'Unavailable from the public API. Add the required API key or retry after rate limits reset.';
}

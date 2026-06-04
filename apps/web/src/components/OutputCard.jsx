import { useState } from 'react';
import StreamOutput from './StreamOutput';
import { exportToHtml, copyAsWordPress } from '../lib/export';
import { exportAnalysisPptx } from '../lib/pptx';

// ─── Setup instructions shown after each export action ───────────────────────

const HTML_STEPS = [
  { n: '1', text: 'Click "Export HTML" — a file downloads automatically to your Downloads folder.' },
  { n: '2', text: 'Open the file in any browser (double-click it) to preview the formatted output.' },
  { n: '3', text: 'To use on your website: open the file in a text editor (Notepad, VS Code), copy the content between <body> tags, and paste into your site builder\'s HTML block.' },
  { n: '4', text: 'In Elementor: drag in an "HTML" widget → paste → Save. In any page builder: look for "Custom HTML" or "Raw HTML" block.' },
];

const WP_STEPS = [
  { n: '1', text: 'Click "WordPress Code" — the HTML is copied to your clipboard.' },
  { n: '2', text: 'Go to your WordPress dashboard → Pages / Posts → open the page you want to edit.' },
  { n: '3', text: 'Gutenberg (Block Editor): Click the "+" button → search "Custom HTML" → add the block → paste (Ctrl+V).' },
  { n: '4', text: 'Classic Editor: Click the "Text" tab (top right of editor) → paste the HTML → switch back to "Visual" to preview.' },
  { n: '5', text: 'Elementor: Drag an "HTML" widget onto the page → paste in the HTML field → click Update.' },
];

function SetupSteps({ steps, color }) {
  return (
    <div className={`mt-4 rounded-xl border p-4 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3 opacity-70">Setup Steps</p>
      <ol className="space-y-2.5">
        {steps.map(s => (
          <li key={s.n} className="flex gap-3 text-sm">
            <span className="shrink-0 w-5 h-5 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">
              {s.n}
            </span>
            <span className="leading-snug">{s.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OutputCard({ title, content, isStreaming, placeholder }) {
  const [copied, setCopied]       = useState(false);
  const [exported, setExported]   = useState(false);
  const [pdfExported, setPdfExported] = useState(false);
  const [pptExported, setPptExported] = useState(false);
  const [wpCopied, setWpCopied]   = useState(false);
  const [showPanel, setShowPanel] = useState(null); // 'html' | 'wp' | null

  function handleCopy() {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleExportHtml() {
    exportToHtml(content, title);
    setExported(true);
    setShowPanel(showPanel === 'html' ? null : 'html');
    setTimeout(() => setExported(false), 2000);
  }

  async function handleWordPress() {
    await copyAsWordPress(content);
    setWpCopied(true);
    setShowPanel(showPanel === 'wp' ? null : 'wp');
    setTimeout(() => setWpCopied(false), 2000);
  }

  function handlePdf() {
    setPdfExported(true);
    window.print();
    setTimeout(() => setPdfExported(false), 2000);
  }

  async function handlePpt() {
    setPptExported(true);
    try {
      await exportAnalysisPptx(content, title);
    } catch (error) {
      console.error('PPTX export failed', error);
      window.alert('PPTX export failed. Please try again.');
    } finally {
      setPptExported(false);
    }
  }

  const hasOutput = !!content && !isStreaming;

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-6 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>

        {hasOutput && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy raw */}
            <button
              onClick={handleCopy}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? '✓ Copied' : 'Copy text'}
            </button>

            {/* Export HTML */}
            <button
              onClick={handleExportHtml}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
            >
              <span>⬇</span>
              {exported ? 'Downloading…' : 'Export HTML'}
            </button>

            <button
              onClick={handlePdf}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
            >
              {pdfExported ? 'Opening...' : 'PDF Download PDF'}
            </button>

            <button
              onClick={handlePpt}
              disabled={pptExported}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              {pptExported ? 'Downloading...' : 'Download PPTX'}
            </button>

            {/* WordPress */}
            <button
              onClick={handleWordPress}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              <span>🔵</span>
              {wpCopied ? '✓ Copied!' : 'WordPress Code'}
            </button>
          </div>
        )}
      </div>

      {/* Output content */}
      <div className="px-6 py-5">
        <StreamOutput content={content} isStreaming={isStreaming} placeholder={placeholder} />
      </div>

      {/* Setup Instructions Panel */}
      {hasOutput && showPanel && (
        <div className="px-6 pb-6">
            <div className="border-t border-border pt-5">
            {/* Tab switcher */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setShowPanel('html')}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  showPanel === 'html'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'text-muted-foreground border-border hover:border-indigo-300'
                }`}
              >
                ⬇ Export HTML — How to use
              </button>
              <button
                onClick={() => setShowPanel('wp')}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  showPanel === 'wp'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'text-muted-foreground border-border hover:border-blue-300'
                }`}
              >
                🔵 WordPress Code — How to use
              </button>
              <button
                onClick={() => setShowPanel(null)}
                className="ml-auto px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕ Close
              </button>
            </div>

            {showPanel === 'html' && (
              <SetupSteps
                steps={HTML_STEPS}
                color="bg-indigo-50 border-indigo-200 text-indigo-900"
              />
            )}
            {showPanel === 'wp' && (
              <SetupSteps
                steps={WP_STEPS}
                color="bg-blue-50 border-blue-200 text-blue-900"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

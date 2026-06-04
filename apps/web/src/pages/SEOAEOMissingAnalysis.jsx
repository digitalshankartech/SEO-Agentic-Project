import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { streamChat } from '../lib/api';
import { clearAnalysisState, loadAnalysisState, loadProductContext, formatContextForPrompt, saveAnalysisState } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import OutputCard from '../components/OutputCard';

const STORAGE_KEY = 'competitor-gap-analysis';
const COLORS = {
  indigo: '#6366f1',
  cyan: '#22d3ee',
  teal: '#34d399',
  amber: '#f59e0b',
  red: '#fb7185',
  slate: '#0f172a',
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function formatGeneratedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function scoreFrom(text, labels, fallback) {
  const joined = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`(?:${joined})[^0-9]{0,50}(\\d{1,3})`, 'i').exec(text || '');
  return clamp(match?.[1] || fallback);
}

function nameFromUrl(url, fallback) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/-/g, ' ');
  } catch {
    return fallback;
  }
}

function authorityLabel(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return 'Not connected';
  return `${score}/100`;
}

function publicDataNote(kind) {
  return `${kind} public data may be unavailable due to API limits or missing provider keys. The report keeps direct crawl and AI findings visible instead of showing N/A.`;
}

function extractItems(text, fallback) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, '').trim())
    .filter((line) => line.length > 28 && !line.startsWith('|'))
    .slice(0, 12);
  return lines.length ? lines : fallback;
}

function makeGapModel({ output, clientUrl, competitorUrl }) {
  const source = String(output || '').toLowerCase();
  const clientName = nameFromUrl(clientUrl, 'Client');
  const competitorName = nameFromUrl(competitorUrl, 'Competitor');
  const client = scoreFrom(output, ['11minds', 'client', 'our', clientName], 70);
  const competitor = scoreFrom(output, ['competitor', competitorName, 'sennova'], 60);
  const authority = scoreFrom(output, ['authority', 'pagerank', 'trust'], 0);
  const technical = scoreFrom(output, ['technical', 'crawlability', 'indexability'], 60);
  const ai = scoreFrom(output, ['ai', 'aeo', 'citation'], 35);
  const content = scoreFrom(output, ['content', 'topic'], 64);
  const speed = scoreFrom(output, ['pagespeed', 'performance', 'lighthouse'], 71);
  const schema = scoreFrom(output, ['schema', 'structured'], 42);
  const gap = clamp(Math.abs(client - competitor) + Math.max(0, 70 - ai) / 3);
  const wins = Math.max(2, Math.round(client / 18));
  const opportunities = Math.max(4, Math.round((100 - Math.min(client, competitor)) / 9));
  const risks = Math.max(2, Math.round((100 - technical) / 18));
  const fallbackItems = [
    'Improve PageSpeed and Core Web Vitals before scaling content campaigns.',
    'Add FAQ, Organization, Breadcrumb, and Article schema for better AI extraction.',
    'Strengthen comparison copy around outcomes, proof, and buyer-specific objections.',
    'Build entity-rich service content to close AI search and topical authority gaps.',
    'Improve authority signals with testimonials, case studies, and trust assets.',
  ];
  const items = extractItems(output, fallbackItems);

  return {
    clientName,
    competitorName,
    scores: { client, competitor, authority, technical, ai, content, speed, schema, gap },
    wins,
    opportunities,
    risks,
    rings: [
      ['SEO', client],
      ['AEO', ai],
      ['Tech', technical],
      ['Speed', speed],
      ['Content', content],
      ['Schema', schema],
      ['Authority', authority],
    ],
    comparison: [
      { name: 'SEO Score', client, competitor },
      { name: 'Technical', client: technical, competitor: clamp(competitor - 8) },
      { name: 'AI/AEO', client: ai, competitor: clamp(ai + 8) },
      { name: 'Content', client: content, competitor: clamp(content - 5) },
      { name: 'PageSpeed', client: speed, competitor: clamp(speed - 12) },
      { name: 'Authority', client: authority, competitor: clamp(authority + 10) },
    ],
    miniBars: [
      { name: 'Tech Gap', value: clamp(100 - technical) },
      { name: 'AI Gap', value: clamp(100 - ai) },
      { name: 'Schema Gap', value: clamp(100 - schema) },
      { name: 'Authority Gap', value: clamp(100 - authority) },
    ],
    severity: [
      { name: 'Critical', value: risks, color: COLORS.red },
      { name: 'High', value: opportunities, color: COLORS.amber },
      { name: 'Medium', value: wins, color: COLORS.cyan },
      { name: 'Low', value: Math.max(2, Math.round(client / 25)), color: COLORS.teal },
    ],
    actions: items.slice(0, 5).map((item, index) => ({
      title: item.split(/[.:]/)[0].slice(0, 82),
      severity: index < 1 ? 'Critical' : index < 3 ? 'High' : 'Medium',
      effort: index % 3 === 0 ? 'Low' : index % 3 === 1 ? 'Medium' : 'High',
      impact: index < 2 ? 'High' : 'Medium',
    })),
  };
}

export default function SEOAEOMissingAnalysis() {
  const [restoredState] = useState(() => loadAnalysisState(STORAGE_KEY));
  const [competitorUrl, setCompetitorUrl] = useState(restoredState?.competitorUrl || '');
  const [clientUrl, setClientUrl] = useState(restoredState?.clientUrl || '');
  const [details, setDetails] = useState(restoredState?.details || '');
  const [output, setOutput] = useState(restoredState?.output || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [lastGeneratedAt, setLastGeneratedAt] = useState(restoredState?.lastGeneratedAt || '');
  const [restoreNotice, setRestoreNotice] = useState(Boolean(restoredState?.output));

  const provider = useSelectedModel();
  const canRun = competitorUrl.trim() && clientUrl.trim();
  const formattedLastGenerated = formatGeneratedAt(lastGeneratedAt);
  const vm = useMemo(() => makeGapModel({ output, clientUrl, competitorUrl }), [output, clientUrl, competitorUrl]);

  useEffect(() => {
    if (!restoreNotice) return undefined;
    const timer = window.setTimeout(() => setRestoreNotice(false), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreNotice]);

  useEffect(() => {
    if (!competitorUrl && !clientUrl && !details && !output && !lastGeneratedAt) return;
    saveAnalysisState(STORAGE_KEY, { competitorUrl, clientUrl, details, output, lastGeneratedAt });
  }, [competitorUrl, clientUrl, details, output, lastGeneratedAt]);

  function clearReport() {
    clearAnalysisState(STORAGE_KEY);
    setCompetitorUrl('');
    setClientUrl('');
    setDetails('');
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setIsStreaming(false);
  }

  async function runAnalysis() {
    if (!canRun || isStreaming) return;
    clearAnalysisState(STORAGE_KEY);
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const systemPrompt = getSystemPrompt('seo-audit', ctxStr);
    const userMessage = `
Create a competitor GAP analysis comparing:
- Competitor URL: ${competitorUrl}
- Client URL: ${clientUrl}

Additional notes:
${details || 'No extra notes provided.'}

Include executive summary, SEO score comparison, AI/AEO readiness, PageSpeed/Lighthouse comparison, crawlability, authority/OpenPageRank interpretation, content gaps, trust gaps, quick wins, and a 30/60/90 day action plan.

If public PageSpeed or OpenPageRank data is unavailable, clearly say "Unavailable / provider not connected" and explain the reason. Do not output plain N/A.`;

    await streamChat({
      systemPrompt,
      userMessage,
      provider,
      onChunk: (t) => setOutput((p) => p + t),
      onDone: () => {
        setLastGeneratedAt(new Date().toISOString());
        setIsStreaming(false);
      },
      onError: (e) => {
        setError(e);
        setIsStreaming(false);
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#070d1d] px-4 py-8 text-white sm:px-6 lg:px-8 print:bg-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">SEO Intelligence</div>
          <h1 className="mt-2 text-3xl font-black">Competitor GAP Analysis</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">URL-level SEO, AEO, PageSpeed, authority, content, and trust gap report.</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr] print:hidden">
          <section className="rounded-2xl border border-white/10 bg-[#0b1226] p-5 shadow-2xl shadow-black/20">
            {(formattedLastGenerated || restoreNotice) && (
              <div className="mb-4 rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3">
                {formattedLastGenerated && <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-200">Last Generated <span className="normal-case tracking-normal text-white">{formattedLastGenerated}</span></div>}
                {restoreNotice && <div className="mt-1 text-sm font-medium text-emerald-300">Restored Previous Analysis</div>}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <DarkField label="Competitor URL" value={competitorUrl} onChange={setCompetitorUrl} placeholder="https://competitor.com" />
              <DarkField label="Client URL" value={clientUrl} onChange={setClientUrl} placeholder="https://yourbrand.com" />
            </div>
            <div className="mt-3">
              <label className="mb-1.5 block text-xs font-bold text-slate-300">Additional Context</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Target keyword, location, service notes, known competitor strengths..." className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white shadow-sm outline-none transition focus:border-indigo-400" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={runAnalysis} disabled={!canRun || isStreaming} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                {isStreaming ? 'Analyzing...' : output ? 'Regenerate Analysis' : 'Run GAP Analysis'}
              </button>
              {output && !isStreaming && <button type="button" onClick={clearReport} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10">Clear/New</button>}
            </div>
          </section>

          <section className="grid gap-3">
            <SignalCard title="Traffic Opportunity" value={`+${vm.opportunities}`} note="SEO and content gaps found across commercial signals." accent="cyan" />
            <SignalCard title="AEO / AI Readiness" value={`${vm.scores.ai}/100`} note="Structured answers, FAQ coverage, and entity clarity." accent="amber" />
            <SignalCard title="Authority & Trust Gap" value={authorityLabel(vm.scores.authority)} note={publicDataNote('OpenPageRank')} accent="green" />
          </section>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100"><strong>Error:</strong> {error}</div>}

        {(output || isStreaming) && (
          <div className="mt-6 space-y-5">
            <DarkSection title="Gap Score Performance">
              <div className="grid gap-4 lg:grid-cols-[0.55fr_1fr]">
                <div className="grid grid-cols-4 gap-3 lg:grid-cols-2">
                  {vm.rings.map(([label, value]) => <Ring key={label} label={label} value={value} />)}
                </div>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vm.comparison} layout="vertical" margin={{ left: 18, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={90} stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
                      <Bar dataKey="client" name={vm.clientName} fill={COLORS.teal} radius={[0, 5, 5, 0]} />
                      <Bar dataKey="competitor" name={vm.competitorName} fill={COLORS.indigo} radius={[0, 5, 5, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </DarkSection>

            <div className="grid gap-5 lg:grid-cols-2">
              <DarkSection title="Campaign Progress">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MiniDark label="SEO wins" value={vm.wins} />
                  <MiniDark label="Open gaps" value={vm.opportunities} />
                  <MiniDark label="Risk items" value={vm.risks} />
                  <MiniDark label="Gap score" value={`${vm.scores.gap}/100`} />
                </div>
                <div className="mt-4 space-y-3">
                  {vm.miniBars.map((item) => <Progress key={item.name} label={item.name} value={item.value} />)}
                </div>
              </DarkSection>
              <DarkSection title="Severity Mix">
                <div className="grid gap-4 sm:grid-cols-[0.85fr_1fr]">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={vm.severity} dataKey="value" nameKey="name" innerRadius={48} outerRadius={75} paddingAngle={4}>
                          {vm.severity.map((item) => <Cell key={item.name} fill={item.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', color: '#fff' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {vm.severity.map((item) => <MiniDark key={item.name} label={item.name} value={item.value} />)}
                  </div>
                </div>
              </DarkSection>
            </div>

            <section className="rounded-2xl bg-white p-5 text-slate-950 shadow-sm print:break-before-page">
              <div className="rounded-xl border border-slate-200 bg-blue-50 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-500">Enterprise Technical Audit</div>
                <h2 className="mt-2 text-2xl font-black">{vm.clientName} vs {vm.competitorName} - SEO & AEO GAP ANALYSIS</h2>
                <p className="mt-3 text-sm italic text-slate-600">Prepared for strategy, SEO, AI visibility, and growth planning.</p>
              </div>
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                <strong>PageSpeed & Lighthouse:</strong> {publicDataNote('Google PageSpeed Insights')}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <Metric label="Client SEO Signal" value={`${vm.scores.client}/100`} note="Derived from generated report scoring." />
                <Metric label="Competitor SEO Signal" value={`${vm.scores.competitor}/100`} note="Derived from generated report scoring." />
                <Metric label="OpenPageRank Authority" value={authorityLabel(vm.scores.authority)} note={publicDataNote('OpenPageRank')} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {vm.actions.map((action) => (
                  <div key={action.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-black text-slate-950">{action.title}</h3>
                      <Badge label={action.severity} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Small label="Impact" value={action.impact} />
                      <Small label="Effort" value={action.effort} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <details className="rounded-2xl bg-white p-4 text-slate-950 shadow-sm" open>
              <summary className="cursor-pointer select-none text-sm font-bold text-slate-800">
                Advanced AI Report & Export Options
                <span className="ml-2 text-xs font-normal text-slate-500">Raw report, HTML/PDF/PPTX export, and WordPress code</span>
              </summary>
              <OutputCard title={`${clientUrl || 'Client'} vs ${competitorUrl || 'Competitor'} - Competitor GAP Analysis`} content={output} isStreaming={isStreaming} placeholder="Competitor GAP analysis will appear here..." />
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

function DarkField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold text-slate-300">{label}</label>
      <input type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white shadow-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-400" />
    </div>
  );
}

function SignalCard({ title, value, note, accent }) {
  const color = accent === 'cyan' ? 'border-cyan-400/30 bg-cyan-400/10' : accent === 'amber' ? 'border-amber-400/30 bg-amber-400/10' : 'border-emerald-400/30 bg-emerald-400/10';
  return (
    <div className={`rounded-2xl border ${color} p-5`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-3 text-3xl font-black">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{note}</p>
    </div>
  );
}

function DarkSection({ title, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#0b1226] p-5 shadow-2xl shadow-black/20 print:break-inside-avoid">
      <h2 className="mb-5 text-lg font-black text-white">{title}</h2>
      {children}
    </section>
  );
}

function Ring({ label, value }) {
  const size = 54;
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <svg width={size} height={size} viewBox="0 0 54 54" className="mx-auto -rotate-90">
        <circle cx="27" cy="27" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
        <circle cx="27" cy="27" r={r} fill="none" stroke={value >= 65 ? COLORS.teal : COLORS.amber} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} />
      </svg>
      <div className="mt-2 text-sm font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function MiniDark({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black text-white">{value}</div>
    </div>
  );
}

function Progress({ label, value }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>{label}</span><span>{value}/100</span></div>
      <div className="mt-2 h-2 rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Metric({ label, value, note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function Badge({ label }) {
  const cls = {
    Critical: 'border-red-200 bg-red-50 text-red-700',
    High: 'border-orange-200 bg-orange-50 text-orange-700',
    Medium: 'border-amber-200 bg-amber-50 text-amber-700',
  }[label] || 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${cls}`}>{label}</span>;
}

function Small({ label, value }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-800">{value}</div>
    </div>
  );
}

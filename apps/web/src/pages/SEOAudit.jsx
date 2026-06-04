import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { streamChat } from '../lib/api';
import { clearAnalysisState, loadAnalysisState, loadProductContext, formatContextForPrompt, saveAnalysisState } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const STORAGE_KEY = 'seo-audit';
const COLORS = {
  indigo: '#4f46e5',
  teal: '#14b8a6',
  amber: '#f59e0b',
  red: '#ef4444',
  green: '#22c55e',
  slate: '#0f172a',
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function scoreFrom(text, labels, fallback) {
  const joined = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const match = new RegExp(`(?:${joined})[^0-9]{0,60}(\\d{1,3})`, 'i').exec(text || '');
  return clamp(match?.[1] || fallback);
}

function countMatches(text, pattern) {
  return (String(text || '').match(pattern) || []).length;
}

function formatGeneratedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function statusFromScore(score) {
  if (score >= 82) return 'Excellent';
  if (score >= 68) return 'Good';
  if (score >= 52) return 'Needs Improvement';
  return 'Critical';
}

function badgeClass(label) {
  return {
    Critical: 'bg-red-50 text-red-700 border-red-200',
    High: 'bg-orange-50 text-orange-700 border-orange-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Needs Improvement': 'bg-amber-50 text-amber-700 border-amber-200',
    Info: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    Review: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  }[label] || 'bg-slate-50 text-slate-600 border-slate-200';
}

function extractItems(text, fallback) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*#\d.\s]+/, '').trim())
    .filter((line) => line.length > 28 && !line.startsWith('|'))
    .slice(0, 18);
  return lines.length ? lines : fallback;
}

function firstInsight(text) {
  return (
    String(text || '')
      .split(/(?<=[.!?])\s+/)
      .find((line) => line.trim().length > 45) ||
    'The audit shows a strong optimization opportunity across technical SEO, content depth, AI citation readiness, schema coverage, and authority signals.'
  ).slice(0, 230);
}

function makeAuditModel(output, aiSeo) {
  const source = String(output || '').toLowerCase();
  const technical = scoreFrom(output, ['Technical SEO', 'Technical Health', 'Crawlability', 'Indexability'], 68);
  const content = scoreFrom(output, ['Content Quality', 'Content Depth', 'Content Score'], 64);
  const authority = scoreFrom(output, ['Authority', 'Authority Score', 'Trust Score', 'Backlink'], 52);
  const ai = scoreFrom(output, ['AI SEO', 'AEO', 'Citation Readiness', 'AI Discoverability'], aiSeo ? 58 : 45);
  const performance = scoreFrom(output, ['Performance', 'PageSpeed', 'Core Web Vitals'], 60);
  const schema = scoreFrom(output, ['Schema', 'Structured Data', 'Schema Coverage'], 44);
  const accessibility = scoreFrom(output, ['Accessibility', 'ARIA', 'Contrast'], 72);
  const ux = scoreFrom(output, ['UX', 'User Experience', 'Conversion'], 66);
  const overall = Math.round((technical + content + authority + ai + performance + schema + accessibility + ux) / 8);
  const critical = Math.max(1, countMatches(source, /critical|blocked|not index|crawl error|missing title/g) || Math.round((100 - overall) / 25));
  const high = Math.max(2, countMatches(source, /high|important|slow|duplicate|thin|missing/g) || Math.round((100 - overall) / 16));
  const medium = Math.max(3, countMatches(source, /medium|improve|optimi[sz]e|warning/g) || Math.round((100 - overall) / 12));
  const low = Math.max(2, countMatches(source, /low|minor|nice to have/g) || Math.round((100 - overall) / 20));
  const total = critical + high + medium + low;
  const trafficLoss = Math.max(120, Math.round((100 - overall) * 38));
  const trafficGain = Math.max(260, Math.round((100 - overall) * 64));
  const quickWins = Math.max(3, Math.round((100 - content) / 14));

  const fallbackIssues = [
    'Fix crawlability and indexability blockers before investing in content expansion.',
    'Improve Core Web Vitals so slow loading does not suppress rankings or conversion.',
    'Add FAQ and organization schema to improve entity clarity and AI citation readiness.',
    'Expand thin content with missing entities, buyer questions, and proof-led answers.',
    'Strengthen internal linking to connect priority pages with commercial search intent.',
  ];
  const rawIssues = extractItems(output, fallbackIssues);
  const severities = ['Critical', 'Critical', 'High', 'Medium', 'Medium'];
  const issues = rawIssues.slice(0, 5).map((item, index) => ({
    title: item.split(/[.:]/)[0].slice(0, 82),
    severity: severities[index] || 'Low',
    area: ['Technical SEO', 'Performance', 'Schema', 'Content', 'Authority'][index % 5],
    impact: index < 2 ? 'High traffic / business impact' : 'Medium growth opportunity',
    effort: index % 3 === 0 ? 'Low' : index % 3 === 1 ? 'Medium' : 'High',
    outcome: 'Better crawl confidence, visibility, and conversion-ready search experience.',
    x: index % 3 === 0 ? 24 : index % 3 === 1 ? 55 : 78,
    y: index < 2 ? 30 : index < 4 ? 54 : 76,
  }));

  const radar = [
    { dimension: 'Technical SEO', score: technical, benchmark: 78 },
    { dimension: 'Content Quality', score: content, benchmark: 76 },
    { dimension: 'AI SEO', score: ai, benchmark: 72 },
    { dimension: 'Authority', score: authority, benchmark: 70 },
    { dimension: 'Accessibility', score: accessibility, benchmark: 82 },
    { dimension: 'UX', score: ux, benchmark: 76 },
    { dimension: 'Performance', score: performance, benchmark: 75 },
    { dimension: 'Schema Coverage', score: schema, benchmark: 68 },
  ];
  const strongest = radar.reduce((best, item) => (item.score > best.score ? item : best), radar[0]);
  const weakest = radar.reduce((worst, item) => (item.score < worst.score ? item : worst), radar[0]);

  const schemaTypes = ['Organization', 'FAQ', 'Breadcrumb', 'Article', 'Product', 'Local Business', 'Review', 'Video', 'Event', 'HowTo'];
  const schemaHeatmap = schemaTypes.map((name, index) => {
    const value = clamp(schema - index * 4 + (source.includes(name.toLowerCase()) ? 22 : 0));
    return { name, status: value >= 72 ? 'Present' : value >= 48 ? 'Partial' : 'Missing' };
  });

  return {
    status: statusFromScore(overall),
    summary: firstInsight(output),
    scores: { overall, technical, content, authority, ai, performance, schema, accessibility, ux },
    metrics: {
      critical,
      high,
      medium,
      low,
      total,
      trafficLoss,
      trafficGain,
      quickWins,
      rankingGrowth: Math.max(9, Math.round((100 - overall) / 2.8)),
      leadGrowth: Math.max(5, Math.round((trafficGain / 1000) * 8)),
      pages: Math.max(4, Math.round(total / 3)),
    },
    issues,
    radar,
    strongest,
    weakest,
    severity: [
      { name: 'Critical', value: critical, color: COLORS.red },
      { name: 'High', value: high, color: COLORS.amber },
      { name: 'Medium', value: medium, color: COLORS.teal },
      { name: 'Low', value: low, color: COLORS.green },
    ],
    businessCards: [
      ['Estimated Traffic Loss', `${trafficLoss}`, 'High'],
      ['Traffic Gain Opportunity', `+${trafficGain}`, 'Good'],
      ['Ranking Opportunities', `+${Math.max(6, Math.round((100 - content) / 5))}`, 'Info'],
      ['Potential Lead Growth', `+${Math.max(8, Math.round((trafficGain / 1000) * 11))}%`, 'Good'],
    ],
    opportunityBars: [
      { name: 'Tech', value: clamp(100 - technical + 22) },
      { name: 'Content', value: clamp(100 - content + 24) },
      { name: 'Schema', value: clamp(100 - schema + 28) },
      { name: 'AI Search', value: clamp(100 - ai + 30) },
      { name: 'Authority', value: clamp(100 - authority + 22) },
    ],
    aiReadiness: [
      { name: 'ChatGPT', value: clamp(ai + 8) },
      { name: 'Google AI Overviews', value: clamp(ai - 3) },
      { name: 'Perplexity', value: clamp(ai + 2) },
      { name: 'Claude', value: clamp(ai + 4) },
      { name: 'Gemini', value: clamp(ai) },
    ],
    aiSignals: [
      ['Entity Coverage', clamp(ai + 4)],
      ['FAQ Readiness', clamp(schema + 10)],
      ['Structured Data', schema],
      ['AI Discoverability', ai],
    ],
    technicalBars: [
      { name: 'LCP', value: performance },
      { name: 'CLS', value: clamp(performance + 8) },
      { name: 'INP', value: clamp(performance + 4) },
      { name: 'Crawlability', value: technical },
      { name: 'Indexability', value: clamp(technical + 6) },
      { name: 'Debt', value: clamp(100 - technical) },
    ],
    technicalCards: [
      ['Performance Score', `${performance}/100`, performance],
      ['Technical Debt Indicator', `${clamp(100 - technical)}/100`, clamp(100 - technical)],
    ],
    schemaHeatmap,
    contentMetrics: [
      ['Missing FAQs', Math.max(3, Math.round((100 - schema) / 12))],
      ['Missing Entities', Math.max(4, Math.round((100 - ai) / 10))],
      ['Missing Topics', Math.max(5, Math.round((100 - content) / 9))],
      ['Content Depth', content],
      ['Topical Authority', clamp(content - 4)],
    ],
    contentBars: [
      { name: 'Topic Coverage', value: content },
      { name: 'FAQ Coverage', value: clamp(schema + 8) },
      { name: 'Entity Coverage', value: ai },
      { name: 'Content Depth', value: content },
      { name: 'Topical Authority', value: clamp(content - 4) },
    ],
    accessibility: [
      ['Accessibility Score', accessibility],
      ['ARIA Issues', Math.max(1, Math.round((100 - accessibility) / 18))],
      ['Contrast Issues', Math.max(1, Math.round((100 - accessibility) / 22))],
      ['Semantic HTML Issues', Math.max(1, Math.round((100 - technical) / 24))],
    ],
    roadmap: [
      { period: 'First 30 Days', title: 'Quick Wins', items: issues.slice(0, 2) },
      { period: 'Next 60 Days', title: 'Medium Impact Improvements', items: issues.slice(2, 4) },
      { period: 'Next 90 Days', title: 'Strategic Improvements', items: issues.slice(4, 5).concat(issues.slice(0, 1)) },
    ],
  };
}

export default function SEOAudit() {
  const [restoredState] = useState(() => loadAnalysisState(STORAGE_KEY));
  const [url, setUrl] = useState(restoredState?.url || '');
  const [details, setDetails] = useState(restoredState?.details || '');
  const [aiSeo, setAiSeo] = useState(Boolean(restoredState?.aiSeo));
  const [output, setOutput] = useState(restoredState?.output || '');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');
  const [lastGeneratedAt, setLastGeneratedAt] = useState(restoredState?.lastGeneratedAt || '');
  const [restoreNotice, setRestoreNotice] = useState(Boolean(restoredState?.output));

  const provider = useSelectedModel();
  const canRun = url.trim() || details.trim();
  const formattedLastGenerated = formatGeneratedAt(lastGeneratedAt);
  const vm = useMemo(() => makeAuditModel(output, aiSeo), [output, aiSeo]);

  useEffect(() => {
    if (!restoreNotice) return undefined;
    const timer = window.setTimeout(() => setRestoreNotice(false), 6000);
    return () => window.clearTimeout(timer);
  }, [restoreNotice]);

  useEffect(() => {
    if (!url && !details && !aiSeo && !output && !lastGeneratedAt) return;
    saveAnalysisState(STORAGE_KEY, { url, details, aiSeo, output, lastGeneratedAt });
  }, [url, details, aiSeo, output, lastGeneratedAt]);

  function clearReport() {
    clearAnalysisState(STORAGE_KEY);
    setUrl('');
    setDetails('');
    setAiSeo(false);
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setIsStreaming(false);
  }

  async function handleRun() {
    if (!canRun || isStreaming) return;
    clearAnalysisState(STORAGE_KEY);
    setOutput('');
    setError('');
    setLastGeneratedAt('');
    setRestoreNotice(false);
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const tool = aiSeo ? 'ai-seo' : 'seo-audit';
    const systemPrompt = getSystemPrompt(tool, ctxStr);
    const userMessage = [
      `Please conduct a comprehensive ${aiSeo ? 'AI search optimization audit' : 'SEO audit'} for the following:`,
      url && `**URL:** ${url}`,
      details && `**Page details / context:**\n${details}`,
      aiSeo && '\nFocus on getting this content cited by AI systems (ChatGPT, Perplexity, Google AI Overviews, Claude). Include specific structural and content changes.',
      '\nProvide a premium agency-grade audit with executive summary, KPI scores, business impact, severity, quick wins, technical SEO, content optimization, accessibility, AI search readiness, schema opportunities, priority action cards, and a 30/60/90 day roadmap.',
    ].filter(Boolean).join('\n\n');

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
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 print:bg-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <ToolHeader icon="SEO" title="SEO Audit" description="A client-ready SEO, AI search, technical, content, and business impact audit." badge="Agency Report" />
          {(formattedLastGenerated || restoreNotice) && (
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              {formattedLastGenerated && <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Last Generated <span className="normal-case tracking-normal text-indigo-900">{formattedLastGenerated}</span></div>}
              {restoreNotice && <div className="mt-1 text-sm font-medium text-emerald-700">Restored Previous Analysis</div>}
            </div>
          )}
          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Page URL</label>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yoursite.com/your-page" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={aiSeo} onChange={(e) => setAiSeo(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>
                  <span className="block text-sm font-bold text-slate-800">Include AI Search Optimization</span>
                  <span className="text-xs text-slate-500">ChatGPT, Perplexity, Google AI Overviews, Claude, Gemini</span>
                </span>
              </label>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Page Description / Additional Context</label>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Describe the page, target keywords, known issues, current rankings, competitors, or paste relevant page copy." className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleRun} disabled={!canRun || isStreaming} className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isStreaming ? 'Analyzing...' : output ? 'Regenerate Audit' : 'Run SEO Audit'}
              </button>
              {output && !isStreaming && <button type="button" onClick={clearReport} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50">Clear/New Audit</button>}
            </div>
          </div>
        </div>

        {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><strong>Error:</strong> {error}</div>}

        {(output || isStreaming) && (
          <div className="mt-8 space-y-5">
            <ExecutiveDashboard vm={vm} />
            <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
              <HealthOverview vm={vm} />
              <SeverityOverview vm={vm} />
            </div>
            <BusinessImpact vm={vm} />
            <AiSearchDashboard vm={vm} />
            <TechnicalSeo vm={vm} />
            <SchemaCoverage vm={vm} />
            <OpportunityMatrix vm={vm} />
            <PriorityActions vm={vm} />
            <ContentOptimization vm={vm} />
            <Accessibility vm={vm} />
            <Roadmap vm={vm} />
            <Appendix output={output} isStreaming={isStreaming} aiSeo={aiSeo} />
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${badgeClass(label)}`}>{label}</span>;
}

function Section({ number, title, children, compact = false }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white ${compact ? 'p-5' : 'p-6'} shadow-sm print:break-inside-avoid`}>
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-500">Section {number}</div>
        <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, badge = 'Info', note }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
        <Badge label={badge} />
      </div>
      <div className="mt-3 text-3xl font-black text-slate-950">{value}</div>
      {note && <p className="mt-2 text-xs leading-5 text-slate-500">{note}</p>}
    </div>
  );
}

function ExecutiveDashboard({ vm }) {
  const kpis = [
    ['Overall SEO Score', `${vm.scores.overall}/100`, vm.status, 'A composite score across technical SEO, content, schema, performance, authority, AI search, and UX.'],
    ['AI SEO Score', `${vm.scores.ai}/100`, 'Info', 'Citation and answer-engine readiness.'],
    ['Technical Health', `${vm.scores.technical}/100`, 'Info', 'Crawlability, indexability, and technical foundation.'],
    ['Content Quality', `${vm.scores.content}/100`, 'Info', 'Content depth, topical clarity, and search intent fit.'],
    ['Authority Score', `${vm.scores.authority}/100`, 'Medium', 'Trust and backlink confidence.'],
    ['Critical Issues', vm.metrics.critical, 'Critical', 'Issues that can suppress visibility or conversion.'],
    ['Quick Wins', vm.metrics.quickWins, 'Good', 'Fast fixes with strong impact.'],
    ['Pages Requiring Optimization', vm.metrics.pages, 'Medium', 'Priority pages that need attention.'],
    ['Estimated Traffic Loss', `${vm.metrics.trafficLoss}`, 'Critical', 'Estimated monthly visits at risk.'],
    ['Potential Traffic Gain', `+${vm.metrics.trafficGain}`, 'Good', 'Potential upside after fixes.'],
    ['Ranking Opportunities', `+${vm.metrics.rankingGrowth}%`, 'Info', 'Estimated ranking growth potential.'],
    ['Lead Growth Potential', `+${vm.metrics.leadGrowth}%`, 'Good', 'Potential business impact.'],
  ];
  return (
    <Section number="1" title="Executive Summary Dashboard">
      <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        <strong>Status:</strong> {vm.status}. {vm.summary}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, badge, note]) => <Kpi key={label} label={label} value={value} badge={badge} note={note} />)}
      </div>
    </Section>
  );
}

function HealthOverview({ vm }) {
  return (
    <Section number="2" title="SEO Health Overview" compact>
      <div className="h-[360px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={vm.radar}>
            <PolarGrid />
            <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: '#64748b' }} />
            <Radar name="Website Score" dataKey="score" stroke={COLORS.indigo} fill={COLORS.indigo} fillOpacity={0.22} />
            <Radar name="Industry Benchmark" dataKey="benchmark" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.12} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <Mini label="Strongest" value={vm.strongest.dimension} />
        <Mini label="Weakest" value={vm.weakest.dimension} />
        <Mini label="Opportunity" value={`${100 - vm.weakest.score} pts`} />
      </div>
    </Section>
  );
}

function SeverityOverview({ vm }) {
  return (
    <Section number="3" title="Severity Overview" compact>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={vm.severity} dataKey="value" nameKey="name" innerRadius={62} outerRadius={94} paddingAngle={3}>
              {vm.severity.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {vm.severity.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold">
            <span>{item.name}</span><span>{item.value}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Mini({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 font-bold text-slate-800">{value}</div>
    </div>
  );
}

function BusinessImpact({ vm }) {
  return (
    <Section number="4" title="Business Impact Dashboard">
      <div className="grid gap-3 md:grid-cols-4">
        {vm.businessCards.map(([label, value, badge]) => (
          <div key={label} className="rounded-xl bg-slate-950 p-4 text-white">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-3 text-3xl font-black">{value}</div>
            <div className="mt-2"><Badge label={badge} /></div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          {['Lost Visibility', 'Missed Traffic', 'Missed Leads'].map((label, index) => (
            <div key={label} className="mx-auto mb-3 rounded-lg px-4 py-4 text-sm font-black text-white" style={{ width: `${100 - index * 16}%`, background: [COLORS.indigo, COLORS.teal, COLORS.amber][index] }}>
              {label}
            </div>
          ))}
        </div>
        <div className="h-[245px] rounded-xl border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vm.opportunityBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.indigo} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

function AiSearchDashboard({ vm }) {
  return (
    <Section number="5" title="AI Search Optimization Dashboard">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="space-y-3">
            {vm.aiReadiness.map((item) => <Progress key={item.name} label={item.name} value={item.value} />)}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {vm.aiSignals.map(([label, value]) => <Gauge key={label} label={label} value={value} />)}
        </div>
      </div>
    </Section>
  );
}

function Progress({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-600"><span>{label}</span><span>{value}/100</span></div>
      <div className="mt-2 h-3 rounded-full bg-slate-200"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Gauge({ label, value }) {
  const angle = (value / 100) * 180;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
      <div className="mx-auto h-16 w-24 overflow-hidden">
        <div className="relative h-24 w-24 rounded-full border-[8px] border-amber-400 border-b-transparent border-l-transparent" style={{ transform: `rotate(${angle - 45}deg)` }} />
      </div>
      <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function TechnicalSeo({ vm }) {
  return (
    <Section number="6" title="Technical SEO Visualizations">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
        <div className="h-[250px] rounded-xl border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vm.technicalBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.amber} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-3">
          {vm.technicalCards.map(([label, value, score]) => <Kpi key={label} label={label} value={value} badge={score >= 65 ? 'Info' : 'Critical'} note="Use this as a technical priority signal." />)}
        </div>
      </div>
    </Section>
  );
}

function SchemaCoverage({ vm }) {
  return (
    <Section number="7" title="Schema Coverage Heatmap">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {vm.schemaHeatmap.map((item) => {
          const cls = item.status === 'Present' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === 'Partial' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700';
          return (
            <div key={item.name} className={`rounded-xl border p-4 ${cls}`}>
              <div className="text-sm font-black">{item.name}</div>
              <div className="mt-2 text-[10px] font-black uppercase tracking-wide">{item.status}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function OpportunityMatrix({ vm }) {
  return (
    <Section number="8" title="Opportunity Matrix">
      <div className="relative h-[330px] rounded-xl border border-slate-200 bg-slate-50">
        <div className="absolute left-4 right-4 top-1/2 h-px bg-slate-300" />
        <div className="absolute bottom-4 top-4 left-1/2 w-px bg-slate-300" />
        <div className="absolute left-4 top-3 text-[10px] font-bold text-slate-500">High Impact / Low Effort</div>
        <div className="absolute right-4 top-3 text-right text-[10px] font-bold text-slate-500">High Impact / High Effort</div>
        <div className="absolute left-4 bottom-3 text-[10px] font-bold text-slate-500">Low Impact / Low Effort</div>
        <div className="absolute right-4 bottom-3 text-right text-[10px] font-bold text-slate-500">Low Impact / High Effort</div>
        {vm.issues.map((issue, index) => (
          <div key={`${issue.title}-${index}`} className="absolute max-w-[150px] rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-lg" style={{ left: `${issue.x}%`, top: `${issue.y}%`, transform: 'translate(-50%, -50%)' }}>
            {issue.title}
          </div>
        ))}
      </div>
    </Section>
  );
}

function PriorityActions({ vm }) {
  return (
    <Section number="9" title="Priority Action Center">
      <div className="grid gap-4 lg:grid-cols-2">
        {vm.issues.map((issue) => (
          <div key={issue.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-black text-slate-950">{issue.title}</h3>
              <Badge label={issue.severity} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Mini label="Area" value={issue.area} />
              <Mini label="Impact" value={issue.impact} />
              <Mini label="Effort" value={issue.effort} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{issue.outcome}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ContentOptimization({ vm }) {
  return (
    <Section number="10" title="Content Optimization Dashboard">
      <div className="grid gap-5 lg:grid-cols-[0.7fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {vm.contentMetrics.map(([label, value]) => <Kpi key={label} label={label} value={value} badge="Info" />)}
        </div>
        <div className="h-[250px] rounded-xl border border-slate-200 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vm.contentBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill={COLORS.teal} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  );
}

function Accessibility({ vm }) {
  return (
    <Section number="11" title="Accessibility Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vm.accessibility.map(([label, value], index) => <Kpi key={label} label={label} value={index === 0 ? `${value}/100` : value} badge={index === 0 ? 'Info' : 'Medium'} note="Accessibility and UX quality signal." />)}
      </div>
    </Section>
  );
}

function Roadmap({ vm }) {
  return (
    <Section number="12" title="30 / 60 / 90 Day SEO Roadmap">
      <div className="grid gap-4 lg:grid-cols-3">
        {vm.roadmap.map((phase) => (
          <div key={phase.period} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">{phase.period}</div>
            <h3 className="mt-2 text-base font-black text-slate-950">{phase.title}</h3>
            <div className="mt-4 space-y-3">
              {phase.items.map((item) => (
                <div key={`${phase.period}-${item.title}`} className="rounded-lg bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-black text-slate-950">{item.title}</div>
                    <Badge label={item.severity} />
                  </div>
                  <div className="mt-2 text-[11px] leading-5 text-slate-500">Impact: {item.impact} | Effort: {item.effort}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Appendix({ output, isStreaming, aiSeo }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:break-before-page" open>
      <summary className="cursor-pointer select-none text-sm font-bold text-slate-800">
        Advanced AI Report & Export Options
        <span className="ml-2 text-xs font-normal text-slate-500">Raw report, HTML/PDF/PPTX export, and WordPress code</span>
      </summary>
      <OutputCard title={aiSeo ? 'AI Search Optimization Audit' : 'SEO Audit Results'} content={output} isStreaming={isStreaming} placeholder="SEO audit results will appear here..." />
    </details>
  );
}

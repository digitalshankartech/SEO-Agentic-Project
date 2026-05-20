import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const GOALS = [
  'Free trial / signup',
  'Demo request',
  'Purchase / checkout',
  'Lead form fill',
  'Content download',
  'Newsletter signup',
  'Other',
];

export default function CROAnalyzer() {
  const [url, setUrl] = useState('');
  const [pageDesc, setPageDesc] = useState('');
  const [conversionGoal, setConversionGoal] = useState(GOALS[0]);
  const [trafficSource, setTrafficSource] = useState('');
  const [currentMetrics, setCurrentMetrics] = useState('');
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const provider = useSelectedModel();
  const canRun = url.trim() || pageDesc.trim();

  async function handleAnalyze() {
    if (!canRun || isStreaming) return;
    setOutput('');
    setError('');
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const systemPrompt = getSystemPrompt('page-cro', ctxStr);

    const userMessage = [
      'Please analyze this page for conversion rate optimization opportunities.',
      url && `**Page URL:** ${url}`,
      pageDesc && `**Page description / content:**\n${pageDesc}`,
      `**Conversion goal:** ${conversionGoal}`,
      trafficSource && `**Primary traffic source:** ${trafficSource}`,
      currentMetrics && `**Current performance / known issues:** ${currentMetrics}`,
      `
Provide a full CRO analysis covering all 7 dimensions. Structure your response using the standard sections: Quick Wins, High-Priority Changes, A/B Test Ideas, Copy Alternatives, and Conversion Killers.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    await streamChat({
      systemPrompt,
      userMessage,
      provider,
      onChunk: (t) => setOutput((p) => p + t),
      onDone: () => setIsStreaming(false),
      onError: (e) => { setError(e); setIsStreaming(false); },
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <ToolHeader
        icon="📈"
        title="CRO Analyzer"
        description="Identify what's killing conversions on your marketing pages — across 7 impact dimensions, with prioritized fixes."
        badge="Optimization"
      />

      <div className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Page URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com/landing-page"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Page Description / Copy{' '}
            <span className="font-normal text-gray-400">(paste content or describe the page)</span>
          </label>
          <textarea
            value={pageDesc}
            onChange={(e) => setPageDesc(e.target.value)}
            placeholder="Describe the page layout, headline, key sections, CTA placement, trust signals present, form fields, etc. Or paste the page copy directly. More detail = more specific recommendations."
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Conversion Goal
            </label>
            <select
              value={conversionGoal}
              onChange={(e) => setConversionGoal(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Primary Traffic Source <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={trafficSource}
              onChange={(e) => setTrafficSource(e.target.value)}
              placeholder="e.g. Google Ads, organic SEO, cold email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Current Performance / Known Issues{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={currentMetrics}
            onChange={(e) => setCurrentMetrics(e.target.value)}
            placeholder="e.g. 2.1% CVR, high bounce on mobile, form abandonment at 60%"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={!canRun || isStreaming}
          className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isStreaming ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Analyze for CRO'
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {(output || isStreaming) && (
        <OutputCard
          title="CRO Analysis"
          content={output}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}

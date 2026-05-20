import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

export default function SEOAudit() {
  const [url, setUrl] = useState('');
  const [details, setDetails] = useState('');
  const [aiSeo, setAiSeo] = useState(false);
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const provider = useSelectedModel();
  const canRun = url.trim() || details.trim();

  async function handleRun() {
    if (!canRun || isStreaming) return;
    setOutput('');
    setError('');
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const tool = aiSeo ? 'ai-seo' : 'seo-audit';
    const systemPrompt = getSystemPrompt(tool, ctxStr);

    const userMessage = [
      `Please conduct a comprehensive ${aiSeo ? 'AI search optimization audit' : 'SEO audit'} for the following:`,
      url && `**URL:** ${url}`,
      details && `**Page details / context:**\n${details}`,
      aiSeo &&
        '\nFocus on getting this content cited by AI systems (ChatGPT, Perplexity, Google AI Overviews, Claude). Include specific structural and content changes.',
      '\nProvide a thorough, prioritized audit with specific findings and actionable fixes.',
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
        icon="🔍"
        title="SEO Audit"
        description="Analyze your pages for technical issues, on-page gaps, content quality, and authority — prioritized by impact."
        badge="Discovery"
      />

      <div className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Page URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com/your-page"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Page Description / Additional Context
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Describe the page, its purpose, target keywords, current rankings, known issues, or paste relevant page copy. The more context you provide, the more specific the audit."
            rows={5}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={aiSeo}
            onChange={(e) => setAiSeo(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
            Include AI Search Optimization (ChatGPT, Perplexity, Google AI Overviews citations)
          </span>
        </label>

        <button
          onClick={handleRun}
          disabled={!canRun || isStreaming}
          className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isStreaming ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Run SEO Audit'
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
          title={aiSeo ? 'AI Search Optimization Audit' : 'SEO Audit Results'}
          content={output}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}

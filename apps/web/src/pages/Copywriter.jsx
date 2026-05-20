import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const PAGE_TYPES = [
  'Homepage',
  'Landing Page',
  'Pricing Page',
  'Feature Page',
  'About Page',
  'Blog Post',
  'Other',
];

export default function Copywriter() {
  const [pageType, setPageType] = useState('Homepage');
  const [primaryCTA, setPrimaryCTA] = useState('');
  const [keyMessage, setKeyMessage] = useState('');
  const [trafficSource, setTrafficSource] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const provider = useSelectedModel();

  async function handleGenerate() {
    if (isStreaming) return;
    setOutput('');
    setError('');
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const systemPrompt = getSystemPrompt('copywriting', ctxStr);

    const userMessage = [
      `Write complete, conversion-focused copy for a **${pageType}**.`,
      primaryCTA && `**Primary CTA:** ${primaryCTA}`,
      keyMessage && `**Key message / unique offer:** ${keyMessage}`,
      trafficSource && `**Traffic source:** ${trafficSource}`,
      extraNotes && `**Additional notes:** ${extraNotes}`,
      `
Deliver full copy for every major section of this page type. Include 2-3 headline (H1) alternatives and 2-3 CTA button text alternatives. Add brief annotations explaining key copy decisions.`,
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
        icon="✍️"
        title="AI Copywriter"
        description="Generate conversion-focused copy for any marketing page, grounded in expert copywriting principles."
        badge="Content"
      />

      <div className="mt-8 space-y-5">
        {/* Page type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Page Type</label>
          <div className="flex flex-wrap gap-2">
            {PAGE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setPageType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pageType === t
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Primary CTA — What action should visitors take?
          </label>
          <input
            type="text"
            value={primaryCTA}
            onChange={(e) => setPrimaryCTA(e.target.value)}
            placeholder="e.g. Start free trial, Book a demo, Download the guide"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Key Message / Unique Offer
          </label>
          <textarea
            value={keyMessage}
            onChange={(e) => setKeyMessage(e.target.value)}
            placeholder="The one thing you want visitors to remember. Any special offer, specific angle, or benefit to emphasize on this page."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Traffic Source <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={trafficSource}
              onChange={(e) => setTrafficSource(e.target.value)}
              placeholder="e.g. Google Ads, LinkedIn organic, cold outreach"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Extra Notes <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Tone preference, sections to include, things to avoid"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isStreaming}
          className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isStreaming ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Writing...
            </span>
          ) : (
            'Generate Copy'
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
          title={`${pageType} Copy`}
          content={output}
          isStreaming={isStreaming}
        />
      )}
    </div>
  );
}

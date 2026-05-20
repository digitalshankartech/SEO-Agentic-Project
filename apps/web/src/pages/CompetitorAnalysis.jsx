import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

export default function CompetitorAnalysis() {
  const [competitor, setCompetitor] = useState('');
  const [yourPositioning, setYourPositioning] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [context, setContext] = useState('');
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  const provider = useSelectedModel();
  const canRun = competitor.trim();

  async function handleAnalyze() {
    if (!canRun || isStreaming) return;
    setOutput('');
    setError('');
    setIsStreaming(true);

    const ctxStr = formatContextForPrompt(loadProductContext());
    const systemPrompt = getSystemPrompt('competitor-analysis', ctxStr);

    const userMessage = [
      `Please conduct a comprehensive competitive analysis against: **${competitor}**`,
      yourPositioning && `**Our current positioning:** ${yourPositioning}`,
      targetAudience && `**Target audience overlap:** ${targetAudience}`,
      context && `**Additional context:** ${context}`,
      `
Deliver a full analysis covering:
1. Competitive landscape and how ${competitor} positions themselves
2. Head-to-head comparison table (features, pricing, audience, strengths, weaknesses)
3. Our differentiation and the customer segments where we win
4. Recommended positioning statement vs. this competitor
5. Key messages to emphasize in marketing and sales
6. Comparison page strategy ("Us vs ${competitor}" SEO content)
7. Objection handling scripts for "Why not just use ${competitor}?"

Be specific and actionable — this should be ready to use in real marketing and sales situations.`,
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
        icon="⚔️"
        title="Competitor Analysis"
        description="Analyze any competitor and craft positioning, messaging, and comparison content that highlights your differentiation."
        badge="Intelligence"
      />

      <div className="mt-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Competitor Name or URL <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={competitor}
            onChange={(e) => setCompetitor(e.target.value)}
            placeholder="e.g. HubSpot, Notion, Salesforce, or https://competitor.com"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Your Current Positioning{' '}
            <span className="font-normal text-gray-400">(optional — pulled from context if set)</span>
          </label>
          <textarea
            value={yourPositioning}
            onChange={(e) => setYourPositioning(e.target.value)}
            placeholder="How do you currently describe yourself? What's your main value prop? Leave blank to use your saved product context."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Audience Overlap{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="e.g. Both target mid-market SaaS companies; they focus on enterprise, we focus on startups"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What You Know About Them{' '}
            <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Share anything you know: their pricing, main features, recent moves, customer complaints, how you win/lose against them in sales calls, review site feedback, etc."
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
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
            'Run Competitor Analysis'
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
          title={`Analysis: You vs. ${competitor}`}
          content={output}
          isStreaming={isStreaming}
          placeholder="Competitive analysis will appear here..."
        />
      )}
    </div>
  );
}

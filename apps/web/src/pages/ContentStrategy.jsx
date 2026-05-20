import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const GOALS = [
  { id: 'traffic', label: 'Organic Traffic', desc: 'Rank for high-intent keywords' },
  { id: 'leads', label: 'Lead Generation', desc: 'Content that converts visitors to leads' },
  { id: 'authority', label: 'Thought Leadership', desc: 'Build brand authority and trust' },
  { id: 'all', label: 'Balanced Mix', desc: 'Traffic + leads + authority' },
];

export default function ContentStrategy() {
  const [goal, setGoal] = useState('all');
  const [industry, setIndustry] = useState('');
  const [primaryAudience, setPrimaryAudience] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [existingContent, setExistingContent] = useState('');
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
    const systemPrompt = getSystemPrompt('content-strategy', ctxStr);
    const selectedGoal = GOALS.find((g) => g.id === goal);

    const userMessage = [
      `Create a comprehensive content strategy focused on: **${selectedGoal?.label}**.`,
      industry && `**Industry / niche:** ${industry}`,
      primaryAudience && `**Primary target audience:** ${primaryAudience}`,
      competitors && `**Main competitors to analyze:** ${competitors}`,
      existingContent && `**Current content situation:** ${existingContent}`,
      `
Deliver:
1. 3-5 Content Pillars with rationale and example topics
2. A 12-week Content Calendar (table format with: Week, Title, Target Keyword, Buyer Stage, Content Type, Priority)
3. Quick Win Opportunities (low-competition, high-intent topics for 30-60 day rankings)
4. Competitor Content Gaps (topics they rank for where we can create better content)

Be specific with keyword suggestions and article titles — not just category names.`,
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
        icon="📅"
        title="Content Strategy"
        description="Plan content pillars, editorial calendars, and keyword opportunities that compound over time."
        badge="Strategy"
      />

      <div className="mt-8 space-y-6">
        {/* Goal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Goal</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`text-left px-3 py-3 rounded-xl border transition-all ${
                  goal === g.id
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className={`font-medium text-sm ${goal === g.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {g.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Industry / Niche
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. B2B SaaS, E-commerce, FinTech, Healthcare"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Primary Target Audience
            </label>
            <input
              type="text"
              value={primaryAudience}
              onChange={(e) => setPrimaryAudience(e.target.value)}
              placeholder="e.g. Marketing managers at Series A SaaS companies"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Competitors to Analyze <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={competitors}
            onChange={(e) => setCompetitors(e.target.value)}
            placeholder="e.g. HubSpot, Ahrefs, Semrush — helps identify content gaps"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Current Content Situation <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            value={existingContent}
            onChange={(e) => setExistingContent(e.target.value)}
            placeholder="Do you have existing content? What's performing well? What topics have you covered? Starting from scratch or building on existing assets?"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isStreaming}
          className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isStreaming ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Building strategy...
            </span>
          ) : (
            'Generate Content Strategy'
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
          title="Content Strategy"
          content={output}
          isStreaming={isStreaming}
          placeholder="Your content strategy will appear here..."
        />
      )}
    </div>
  );
}

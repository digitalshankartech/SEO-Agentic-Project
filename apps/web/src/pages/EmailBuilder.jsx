import { useState } from 'react';
import { streamChat } from '../lib/api';
import { loadProductContext, formatContextForPrompt } from '../lib/storage';
import { getSystemPrompt } from '../skills/prompts';
import { useSelectedModel } from '../components/ModelSelector';
import ToolHeader from '../components/ToolHeader';
import OutputCard from '../components/OutputCard';

const SEQUENCE_TYPES = [
  { id: 'welcome', label: 'Welcome', desc: '5-7 emails · 12-14 days · New subscribers' },
  { id: 'nurture', label: 'Lead Nurture', desc: '6-8 emails · 2-3 weeks · Move toward purchase' },
  { id: 'reengagement', label: 'Re-engagement', desc: '3-4 emails · Win back inactive subscribers' },
  { id: 'onboarding', label: 'Product Onboarding', desc: '5-7 emails · Drive activation & adoption' },
];

export default function EmailBuilder() {
  const [sequenceType, setSequenceType] = useState('welcome');
  const [goal, setGoal] = useState('');
  const [numEmails, setNumEmails] = useState('5');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
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
    const systemPrompt = getSystemPrompt('email-sequence', ctxStr);
    const selectedType = SEQUENCE_TYPES.find((t) => t.id === sequenceType);

    const userMessage = [
      `Write a complete **${selectedType?.label} email sequence** with ${numEmails} emails.`,
      goal && `**Sequence goal:** ${goal}`,
      offer && `**Offer / value delivered:** ${offer}`,
      audience && `**Specific audience segment:** ${audience}`,
      `
Write each email in full — subject line (+ 2 alternatives), preview text, complete email body, and CTA. Follow the One Email One Job principle. Space emails according to best-practice timing for this sequence type.`,
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
        icon="📧"
        title="Email Sequences"
        description="Build complete, high-converting email sequences with proper timing, subject lines, and one-job-per-email structure."
        badge="Email"
      />

      <div className="mt-8 space-y-6">
        {/* Sequence type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Sequence Type</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SEQUENCE_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSequenceType(t.id)}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${
                  sequenceType === t.id
                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className={`font-medium text-sm ${sequenceType === t.id ? 'text-indigo-700' : 'text-gray-900'}`}>
                  {t.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Number of emails */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Emails: <span className="text-indigo-600 font-semibold">{numEmails}</span>
          </label>
          <input
            type="range"
            min="3"
            max="8"
            value={numEmails}
            onChange={(e) => setNumEmails(e.target.value)}
            className="w-full accent-indigo-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Sequence Goal
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Drive users to complete their first report, convert trial to paid, re-engage lapsed subscribers"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Offer / Value Being Delivered
          </label>
          <textarea
            value={offer}
            onChange={(e) => setOffer(e.target.value)}
            placeholder="What did subscribers sign up for? What are you promising to deliver? e.g. Free SEO audit template + 5 tips to double organic traffic"
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Audience Segment <span className="font-normal text-gray-400">(optional refinement)</span>
          </label>
          <input
            type="text"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. E-commerce founders who signed up via the Google Ads landing page"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
              Writing sequence...
            </span>
          ) : (
            'Generate Email Sequence'
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
          title={`${SEQUENCE_TYPES.find((t) => t.id === sequenceType)?.label} Email Sequence`}
          content={output}
          isStreaming={isStreaming}
          placeholder="Your email sequence will appear here..."
        />
      )}
    </div>
  );
}

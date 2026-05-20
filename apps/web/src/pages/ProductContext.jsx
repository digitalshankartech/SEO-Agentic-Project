import { useEffect, useState } from 'react';
import { saveProductContext, loadProductContext, clearProductContext } from '../lib/storage';
import ToolHeader from '../components/ToolHeader';

const FIELDS = [
  {
    key: 'productName',
    label: 'Product Name',
    type: 'input',
    placeholder: 'e.g. Acme Analytics',
  },
  {
    key: 'description',
    label: 'What does your product do?',
    type: 'textarea',
    placeholder: 'In 2-3 sentences: what it does, who it helps, and the main outcome it delivers.',
    rows: 3,
  },
  {
    key: 'targetAudience',
    label: 'Target Audience',
    type: 'textarea',
    placeholder: 'e.g. SaaS founders and growth teams at B2B companies with 10-200 employees.',
    rows: 2,
  },
  {
    key: 'personas',
    label: 'Key Personas',
    type: 'textarea',
    placeholder: 'Describe 1-3 buyer personas: their role, top goals, and biggest frustrations.',
    rows: 4,
  },
  {
    key: 'painPoints',
    label: 'Pain Points Solved',
    type: 'textarea',
    placeholder: 'What specific problems do you solve? Use customer language when possible.',
    rows: 3,
  },
  {
    key: 'differentiation',
    label: 'Key Differentiators',
    type: 'textarea',
    placeholder: 'What makes you genuinely different from alternatives? What do you do 10x better?',
    rows: 3,
  },
  {
    key: 'customerLanguage',
    label: 'Customer Language',
    type: 'textarea',
    placeholder:
      'Exact phrases customers use to describe their problem and your solution. Copy from reviews, interviews, or support tickets — verbatim quotes are gold.',
    rows: 4,
    highlight: true,
    tip: 'Most important field — this is the raw material for your best copy.',
  },
  {
    key: 'brandVoice',
    label: 'Brand Voice & Tone',
    type: 'input',
    placeholder: 'e.g. Direct, confident, technical but accessible. Think: knowledgeable friend, not corporate brochure.',
  },
  {
    key: 'proofPoints',
    label: 'Key Proof Points',
    type: 'textarea',
    placeholder: 'Stats, customer quotes, case study results, notable customers, awards, press mentions.',
    rows: 3,
  },
  {
    key: 'goals',
    label: 'Current Marketing Goals',
    type: 'textarea',
    placeholder: 'e.g. Increase signups by 40% in Q2, improve trial-to-paid from 8% to 15%, expand into enterprise.',
    rows: 2,
  },
];

export default function ProductContext() {
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = loadProductContext();
    if (existing) setForm(existing);
  }, []);

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveProductContext(form);
    setSaved(true);
    window.dispatchEvent(new Event('context-updated'));
    setTimeout(() => setSaved(false), 3000);
  }

  function handleClear() {
    if (!confirm('Clear all context? This cannot be undone.')) return;
    clearProductContext();
    setForm({});
    window.dispatchEvent(new Event('context-updated'));
  }

  const filled = Object.values(form).filter(Boolean).length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <ToolHeader
        icon="📋"
        title="Product Context"
        description="Your marketing foundation. Fill this in once and every tool will use it to generate personalized, on-brand output."
        badge="Foundation"
      />

      {/* Progress */}
      <div className="mt-6 mb-8 flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: `${Math.round((filled / FIELDS.length) * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {filled}/{FIELDS.length} fields filled
        </span>
      </div>

      <div className="space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              {field.label}
              {field.highlight && (
                <span className="text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Most important
                </span>
              )}
            </label>

            {field.type === 'input' ? (
              <input
                type="text"
                value={form[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            ) : (
              <textarea
                value={form[field.key] || ''}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={field.rows || 3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-shadow"
              />
            )}

            {field.tip && (
              <p className="mt-1 text-xs text-gray-400 italic">{field.tip}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex items-center gap-4">
        <button
          onClick={handleSave}
          className="bg-indigo-600 text-white font-medium px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Save Context
        </button>

        {saved && (
          <span className="text-emerald-600 text-sm font-medium flex items-center gap-1.5">
            <span>✓</span> Saved — all tools updated
          </span>
        )}

        {Object.keys(form).length > 0 && !saved && (
          <button
            onClick={handleClear}
            className="ml-auto text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            Clear context
          </button>
        )}
      </div>
    </div>
  );
}

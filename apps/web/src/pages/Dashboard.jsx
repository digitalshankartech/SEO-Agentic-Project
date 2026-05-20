import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { loadProductContext } from '../lib/storage';

const tools = [
  {
    path: '/context',
    icon: '📋',
    name: 'Product Context',
    description: 'Define your product, audience, and positioning. This powers every other tool with personalized output.',
    badge: 'Foundation',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
  {
    path: '/seo',
    icon: '🔍',
    name: 'SEO Audit',
    description: 'Analyze pages for technical issues, on-page gaps, and ranking opportunities — prioritized by impact.',
    badge: 'Discovery',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    path: '/copy',
    icon: '✍️',
    name: 'AI Copywriter',
    description: 'Generate conversion-focused copy for homepages, landing pages, pricing pages, and more.',
    badge: 'Content',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    path: '/cro',
    icon: '📈',
    name: 'CRO Analyzer',
    description: 'Identify conversion blockers across 7 dimensions. Get quick wins, test ideas, and copy alternatives.',
    badge: 'Optimization',
    badgeColor: 'bg-orange-100 text-orange-700',
  },
  {
    path: '/email',
    icon: '📧',
    name: 'Email Sequences',
    description: 'Build complete email sequences — welcome, lead nurture, re-engagement, and product onboarding.',
    badge: 'Email',
    badgeColor: 'bg-sky-100 text-sky-700',
  },
  {
    path: '/content',
    icon: '📅',
    name: 'Content Strategy',
    description: 'Plan content pillars, 12-week editorial calendars, and high-priority topic clusters.',
    badge: 'Strategy',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    path: '/competitor',
    icon: '⚔️',
    name: 'Competitor Analysis',
    description: 'Analyze competitors and craft positioning that wins on your unique differentiators.',
    badge: 'Intelligence',
    badgeColor: 'bg-rose-100 text-rose-700',
  },
];

export default function Dashboard() {
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    setCtx(loadProductContext());
    const handler = () => setCtx(loadProductContext());
    window.addEventListener('context-updated', handler);
    return () => window.removeEventListener('context-updated', handler);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Marketing Suite</h1>
        <p className="text-gray-500 mt-1.5">
          AI-powered marketing toolkit powered by{' '}
          <a
            href="https://github.com/coreyhaines31/marketingskills"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            specialized agent skills
          </a>
        </p>
      </div>

      {/* Status banner */}
      {!ctx ? (
        <div className="mb-8 flex items-start gap-4 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <span className="text-2xl mt-0.5">💡</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-indigo-900">Start with Product Context</h3>
            <p className="text-indigo-700 text-sm mt-1">
              Define your product once — every tool will use it to generate personalized, on-brand output.
            </p>
          </div>
          <Link
            to="/context"
            className="shrink-0 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Set Up →
          </Link>
        </div>
      ) : (
        <div className="mb-8 flex items-start gap-4 bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <span className="text-2xl mt-0.5">✅</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-emerald-900">
              Context active: {ctx.productName || 'Your Product'}
            </h3>
            <p className="text-emerald-700 text-sm mt-1 truncate">
              {ctx.targetAudience
                ? `Targeting: ${ctx.targetAudience}`
                : 'All tools are personalized for your product.'}
            </p>
          </div>
          <Link
            to="/context"
            className="shrink-0 border border-emerald-300 text-emerald-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            Edit
          </Link>
        </div>
      )}

      {/* Tool grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-2xl">{tool.icon}</span>
              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${tool.badgeColor}`}>
                {tool.badge}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {tool.name}
            </h3>
            <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">{tool.description}</p>
            <div className="mt-4 text-indigo-600 text-sm font-medium group-hover:translate-x-0.5 transition-transform inline-block">
              Open tool →
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-gray-400">
        Built with Claude AI · Skills by{' '}
        <a
          href="https://github.com/coreyhaines31/marketingskills"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600"
        >
          @coreyhaines31
        </a>
      </p>
    </div>
  );
}

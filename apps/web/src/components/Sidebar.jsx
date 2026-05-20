import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { loadProductContext } from '../lib/storage';
import ModelSelector from './ModelSelector';

const nav = [
  { path: '/', label: 'Dashboard', icon: '⊞', end: true },
  { divider: 'Setup' },
  { path: '/context', label: 'Product Context', icon: '📋' },
  { divider: 'Tools' },
  { path: '/seo', label: 'SEO Audit', icon: '🔍' },
  { path: '/copy', label: 'AI Copywriter', icon: '✍️' },
  { path: '/cro', label: 'CRO Analyzer', icon: '📈' },
  { path: '/email', label: 'Email Sequences', icon: '📧' },
  { path: '/content', label: 'Content Strategy', icon: '📅' },
  { path: '/competitor', label: 'Competitor Analysis', icon: '⚔️' },
];

export default function Sidebar() {
  const [hasContext, setHasContext] = useState(false);
  const [productName, setProductName] = useState('');

  useEffect(() => {
    const ctx = loadProductContext();
    setHasContext(!!ctx);
    setProductName(ctx?.productName || '');

    const handler = () => {
      const c = loadProductContext();
      setHasContext(!!c);
      setProductName(c?.productName || '');
    };
    window.addEventListener('storage', handler);
    window.addEventListener('context-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('context-updated', handler);
    };
  }, []);

  return (
    <aside className="w-56 shrink-0 bg-slate-900 flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-400 text-xl font-bold">✦</span>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Marketing Suite</div>
            <div className="text-slate-400 text-xs">AI-Powered Tools</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map((item, i) => {
          if (item.divider) {
            return (
              <div key={i} className="px-2 pt-5 pb-1.5">
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest">
                  {item.divider}
                </span>
              </div>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Model selector */}
      <ModelSelector />

      {/* Context status */}
      <div className="px-4 py-3 border-t border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${hasContext ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400 truncate">
            {hasContext ? productName || 'Context active' : 'No context — set up first'}
          </span>
        </div>
      </div>
    </aside>
  );
}

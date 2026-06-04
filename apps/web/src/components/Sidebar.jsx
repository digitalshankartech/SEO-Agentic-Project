import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { loadProductContext } from '../lib/storage';
import ModelSelector from './ModelSelector';
import ThemeToggle from './ThemeToggle';

const nav = [
  { path: '/', label: 'Dashboard', icon: 'DB', end: true },
  { divider: 'Setup' },
  { path: '/context', label: 'Product Context', icon: 'PC' },
  { divider: 'SEO Intelligence' },
  { path: '/seo', label: 'SEO Audit', icon: 'SE' },
  { path: '/competitor-gap', label: 'Competitor GAP', icon: 'GA' },
  { path: '/competitor', label: 'Competitor Analysis', icon: 'CI' },
  { divider: 'Growth Tools' },
  { path: '/copy', label: 'AI Copywriter', icon: 'AI' },
  { path: '/cro', label: 'CRO Analyzer', icon: 'CR' },
  { path: '/email', label: 'Email Sequences', icon: 'EM' },
  { path: '/content', label: 'Content Strategy', icon: 'CS' },
];

export default function Sidebar() {
  const [hasContext, setHasContext] = useState(false);
  const [productName, setProductName] = useState('');

  useEffect(() => {
    const syncContext = () => {
      const ctx = loadProductContext();
      setHasContext(Boolean(ctx));
      setProductName(ctx?.productName || '');
    };
    syncContext();
    window.addEventListener('storage', syncContext);
    window.addEventListener('context-updated', syncContext);
    return () => {
      window.removeEventListener('storage', syncContext);
      window.removeEventListener('context-updated', syncContext);
    };
  }, []);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-sm font-black text-white">MS</div>
          <div>
            <div className="text-sm font-bold leading-tight text-white">Marketing Suite</div>
            <div className="text-xs text-slate-400">AI growth workspace</div>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${hasContext ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{hasContext ? productName || 'Context active' : 'No context set'}</div>
              <div className="truncate text-[11px] text-slate-400">{hasContext ? 'Personalizes every tool' : 'Set product context first'}</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item, index) => {
          if (item.divider) {
            return (
              <div key={`${item.divider}-${index}`} className="px-1 pb-1 pt-5 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                {item.divider}
              </div>
            );
          }
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`
              }
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-[10px] font-black">{item.icon}</span>
              <span className="truncate font-semibold">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <ModelSelector />
      <ThemeToggle />
    </aside>
  );
}

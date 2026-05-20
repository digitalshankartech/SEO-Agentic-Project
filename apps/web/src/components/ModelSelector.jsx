import { useEffect, useState } from 'react';
import { loadSelectedModel, saveSelectedModel } from '../lib/storage';

const PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    model: 'gemini-1.5-flash',
    color: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    model: 'mistral-small',
    color: 'text-violet-400',
    dot: 'bg-violet-400',
  },
  {
    id: 'anthropic',
    label: 'Claude',
    model: 'sonnet-4-6',
    color: 'text-orange-400',
    dot: 'bg-orange-400',
  },
];

export default function ModelSelector() {
  const [selected, setSelected] = useState(loadSelectedModel());
  const [available, setAvailable] = useState({});

  // Ask server which providers are configured
  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        setAvailable(data);
        // If current selection is not available, pick first available
        if (!data[selected]) {
          const first = PROVIDERS.find((p) => data[p.id]);
          if (first) { setSelected(first.id); saveSelectedModel(first.id); }
        }
      })
      .catch(() => {});
  }, []);

  function select(id) {
    if (!available[id]) return;
    setSelected(id);
    saveSelectedModel(id);
    window.dispatchEvent(new CustomEvent('model-changed', { detail: id }));
  }

  const active = PROVIDERS.find((p) => p.id === selected);

  return (
    <div className="px-3 py-3 border-t border-slate-700/60">
      <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-2 px-1">
        AI Model
      </p>
      <div className="space-y-0.5">
        {PROVIDERS.map((p) => {
          const isActive = selected === p.id;
          const isAvailable = !!available[p.id];
          return (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              disabled={!isAvailable}
              title={!isAvailable ? `${p.label} key not configured in .env` : ''}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : isAvailable
                  ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed opacity-50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAvailable ? p.dot : 'bg-slate-600'}`} />
              <span className="font-medium">{p.label}</span>
              <span className="text-slate-500 text-xs ml-auto truncate">{p.model}</span>
              {isActive && <span className="text-indigo-400 text-xs">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Hook for pages to get current provider reactively
export function useSelectedModel() {
  const [model, setModel] = useState(loadSelectedModel());
  useEffect(() => {
    const handler = (e) => setModel(e.detail);
    window.addEventListener('model-changed', handler);
    return () => window.removeEventListener('model-changed', handler);
  }, []);
  return model;
}

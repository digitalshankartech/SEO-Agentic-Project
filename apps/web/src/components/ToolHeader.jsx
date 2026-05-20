const TAG_COLORS = {
  Foundation: 'bg-violet-100 text-violet-700',
  Discovery: 'bg-blue-100 text-blue-700',
  Content: 'bg-emerald-100 text-emerald-700',
  Optimization: 'bg-orange-100 text-orange-700',
  Email: 'bg-sky-100 text-sky-700',
  Strategy: 'bg-amber-100 text-amber-700',
  Intelligence: 'bg-rose-100 text-rose-700',
};

export default function ToolHeader({ icon, title, description, badge }) {
  return (
    <div className="pb-6 border-b border-gray-200">
      <div className="flex items-start gap-3">
        <span className="text-3xl mt-0.5">{icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {badge && (
              <span
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  TAG_COLORS[badge] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="text-gray-500 text-sm mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

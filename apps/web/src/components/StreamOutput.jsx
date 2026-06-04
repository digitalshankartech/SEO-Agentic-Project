import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function StreamOutput({ content, isStreaming, placeholder = 'Output will appear here once you run the tool.' }) {
  if (!content && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-3xl mb-3 opacity-30">✦</div>
        <p className="text-muted-foreground text-sm max-w-xs">{placeholder}</p>
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-semibold
      prose-h2:text-base prose-h2:mt-6 prose-h2:mb-2
      prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1.5
      prose-p:text-muted-foreground prose-p:leading-relaxed
      prose-li:text-muted-foreground
      prose-strong:text-foreground prose-strong:font-semibold
      prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-blockquote:border-indigo-300 prose-blockquote:text-muted-foreground
      prose-table:text-sm prose-th:text-foreground prose-th:font-semibold prose-th:bg-muted
      prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-indigo-500 animate-pulse ml-1 align-middle rounded-sm" />
      )}
    </div>
  );
}

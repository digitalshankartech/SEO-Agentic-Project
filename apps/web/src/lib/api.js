export async function streamChat({ systemPrompt, userMessage, provider, onChunk, onDone, onError }) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userMessage, provider }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      onError?.(err.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') {
          onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed.error) { onError?.(parsed.error); return; }
          if (parsed.text) onChunk?.(parsed.text);
        } catch {
          // skip malformed chunk
        }
      }
    }

    onDone?.();
  } catch (err) {
    onError?.(err.message || 'Network error');
  }
}

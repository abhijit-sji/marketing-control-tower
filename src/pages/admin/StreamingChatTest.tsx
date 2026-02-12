import { StreamingChatDemo } from '@/components/ai/StreamingChatDemo';

export default function StreamingChatTest() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Streaming AI Chat</h1>
        <p className="text-muted-foreground mt-2">
          Real-time streaming responses from Claude, Gemini, and OpenAI models
        </p>
      </div>
      
      <StreamingChatDemo />
      
      <div className="mt-8 max-w-4xl mx-auto space-y-4">
        <div className="border rounded-lg p-4 bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">How Streaming Works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>• <strong>Server-Sent Events (SSE)</strong>: Uses HTTP streaming to push data from server to client</li>
            <li>• <strong>Token-by-Token</strong>: Each word/token is sent as soon as it's generated</li>
            <li>• <strong>Lower Latency</strong>: Users see responses immediately instead of waiting for completion</li>
            <li>• <strong>Better UX</strong>: Progress indication and ability to cancel mid-stream</li>
          </ul>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Provider Comparison</h2>
          <div className="grid gap-3 text-sm">
            <div>
              <strong className="text-foreground">Gemini 2.5 Flash:</strong>
              <p className="text-muted-foreground">Fast, cost-effective, good for most use cases</p>
            </div>
            <div>
              <strong className="text-foreground">Claude 3.5 Sonnet:</strong>
              <p className="text-muted-foreground">Excellent reasoning, great for analysis and writing</p>
            </div>
            <div>
              <strong className="text-foreground">GPT-5 Mini:</strong>
              <p className="text-muted-foreground">Balanced performance, reliable for general tasks</p>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Usage in Your App</h2>
          <pre className="text-xs bg-background p-3 rounded mt-2 overflow-x-auto">
{`import { useStreamAIResponse } from '@/hooks/useStreamAIResponse';

const { streamResponse, isStreaming } = useStreamAIResponse();

await streamResponse({
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  onChunk: (chunk) => console.log(chunk),
  onComplete: (full) => console.log('Done:', full)
});`}
          </pre>
        </div>
      </div>
    </div>
  );
}

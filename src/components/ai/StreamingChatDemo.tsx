import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useStreamAIResponse } from '@/hooks/useStreamAIResponse';
import { Loader2, StopCircle } from 'lucide-react';

type ProviderName = "openai" | "gemini" | "claude";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const providerModels = {
  openai: ['gpt-4o-mini', 'gpt-5-mini-2025-08-07', 'gpt-5-2025-08-07'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-7-sonnet-20250219', 'claude-sonnet-4-5'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
};

export function StreamingChatDemo() {
  const [provider, setProvider] = useState<ProviderName>('gemini');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const { streamResponse, cancelStream, isStreaming, streamedContent } = useStreamAIResponse();

  const handleProviderChange = (newProvider: ProviderName) => {
    setProvider(newProvider);
    setModel(providerModels[newProvider][0]);
  };

  const handleSubmit = async () => {
    if (!userInput.trim() || isStreaming) return;

    const newMessage: Message = { role: 'user', content: userInput };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setUserInput('');

    try {
      const response = await streamResponse({
        provider,
        model,
        messages: updatedMessages,
        systemPrompt: 'You are a helpful AI assistant. Provide clear, concise, and informative responses.',
        temperature: 0.7,
        maxTokens: 2048,
        onComplete: (fullResponse) => {
          setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
        },
      });
    } catch (error) {
      console.error('Stream error:', error);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>AI Streaming Chat Demo</CardTitle>
        <CardDescription>
          Test real-time streaming responses from Claude, Gemini, and OpenAI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(v as ProviderName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerModels[provider].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="border rounded-lg p-4 min-h-[300px] max-h-[500px] overflow-y-auto space-y-4 bg-muted/20">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No messages yet. Start a conversation below.
            </p>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <p className="text-sm font-medium mb-1">
                  {msg.role === 'user' ? 'You' : 'AI'}
                </p>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming Content */}
          {isStreaming && streamedContent && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg p-3 bg-secondary text-secondary-foreground">
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  AI <Loader2 className="h-3 w-3 animate-spin" />
                </p>
                <p className="text-sm whitespace-pre-wrap">{streamedContent}</p>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your message here..."
            className="min-h-[100px]"
            disabled={isStreaming}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!userInput.trim() || isStreaming}
              className="flex-1"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Streaming...
                </>
              ) : (
                'Send Message'
              )}
            </Button>
            {isStreaming && (
              <Button onClick={cancelStream} variant="destructive" size="icon">
                <StopCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          <p>• Press Enter to send, Shift+Enter for new line</p>
          <p>• Responses stream in real-time token by token</p>
          <p>• Switch providers and models to compare performance</p>
        </div>
      </CardContent>
    </Card>
  );
}

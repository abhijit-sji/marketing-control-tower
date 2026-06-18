import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

type ProviderName = "openai" | "gemini" | "claude";

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface StreamOptions {
  provider: ProviderName;
  model: string;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  onChunk?: (chunk: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: string) => void;
}

export function useStreamAIResponse() {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamResponse = useCallback(async (options: StreamOptions) => {
    const {
      provider,
      model,
      messages,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk,
      onComplete,
      onError,
    } = options;

    setIsStreaming(true);
    setStreamedContent('');
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    let fullResponse = '';

    try {
      const response = await fetch(
        'https://tkdksyfudpzxrlnvybqz.supabase.co/functions/v1/stream-ai-response',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider,
            model,
            messages,
            systemPrompt,
            temperature,
            maxTokens,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          
          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content') {
              fullResponse += parsed.content;
              setStreamedContent(prev => prev + parsed.content);
              
              if (onChunk) {
                onChunk(parsed.content);
              }
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            } else if (parsed.type === 'done') {
              console.log('[useStreamAIResponse] Stream completed');
            }
          } catch (e) {
            console.warn('[useStreamAIResponse] Failed to parse event:', data);
          }
        }
      }

      if (onComplete) {
        onComplete(fullResponse);
      }

      return fullResponse;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[useStreamAIResponse] Stream cancelled');
        return fullResponse; // Return partial response
      }

      const errorMessage = error instanceof Error ? error.message : 'Failed to stream response';
      console.error('[useStreamAIResponse] Error:', errorMessage);
      
      toast({
        title: 'Streaming Error',
        description: errorMessage,
        variant: 'destructive',
      });

      if (onError) {
        onError(errorMessage);
      }

      throw error;
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [toast]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const resetStream = useCallback(() => {
    setStreamedContent('');
    setIsStreaming(false);
  }, []);

  return {
    streamResponse,
    cancelStream,
    resetStream,
    isStreaming,
    streamedContent,
  };
}

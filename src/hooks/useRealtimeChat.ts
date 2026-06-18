import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  postData?: PostData;
}

export interface PostData {
  post_title: string;
  post_body: string;
  carousel_outline?: Array<{
    slide_number: number;
    title: string;
    content: string;
  }>;
  caption_ideas?: string[];
}

interface UseRealtimeChatProps {
  leaderId: string;
  systemPrompt: string;
  onPostGenerated?: (postData: PostData) => void;
}

export const useRealtimeChat = ({ leaderId, systemPrompt, onPostGenerated }: UseRealtimeChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(true); // SSE is always "connected"
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPost, setCurrentPost] = useState<PostData | null>(null);
  
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(() => {
    // No-op for SSE - connection happens on each request
    setIsConnected(true);
  }, []);

  const sendMessage = useCallback(async (text: string, explicitSystemPrompt?: string) => {
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const conversationHistory = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use explicit prompt if provided, otherwise fall back to prop
      const promptToUse = explicitSystemPrompt || systemPrompt;

      const response = await fetch(
        'https://tkdksyfudpzxrlnvybqz.supabase.co/functions/v1/linkedin-chat-stream',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: conversationHistory,
            leaderId,
            systemPrompt: promptToUse
          }),
          signal: abortControllerRef.current.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      let assistantContent = '';
      let functionCallArgs = '';
      let inFunctionCall = false;
      let assistantMessageId = Date.now().toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            setIsGenerating(false);
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (!delta) continue;

            // Handle function call
            if (delta.tool_calls) {
              inFunctionCall = true;
              const toolCall = delta.tool_calls[0];
              if (toolCall?.function?.arguments) {
                functionCallArgs += toolCall.function.arguments;
              }
            }

            // Handle text content
            if (delta.content) {
              assistantContent += delta.content;
              
              setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                
                if (lastMsg?.id === assistantMessageId && lastMsg.role === 'assistant') {
                  lastMsg.content = assistantContent;
                  return [...newMessages];
                } else {
                  return [...newMessages, {
                    id: assistantMessageId,
                    role: 'assistant' as const,
                    content: assistantContent,
                    timestamp: new Date()
                  }];
                }
              });
            }

            // Handle finish reason
            if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && functionCallArgs) {
              try {
                const postData = JSON.parse(functionCallArgs);
                setCurrentPost(postData);
                onPostGenerated?.(postData);
                
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.id === assistantMessageId) {
                    lastMsg.postData = postData;
                  }
                  return [...newMessages];
                });
              } catch (error) {
                console.error('Error parsing function call:', error);
              }
            }

          } catch (error) {
            console.error('Error parsing SSE data:', error);
          }
        }
      }

      setIsGenerating(false);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  }, [messages, leaderId, systemPrompt, toast, onPostGenerated]);

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setCurrentPost(null);
    setIsGenerating(false);
  }, []);

  return {
    messages,
    isConnected,
    isGenerating,
    currentPost,
    connect,
    sendMessage,
    disconnect,
    reset,
  };
};

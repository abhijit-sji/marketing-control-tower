import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const ChatMessage = ({ role, content, timestamp }: ChatMessageProps) => {
  return (
    <div className={cn(
      "flex w-full gap-3 mb-4",
      role === 'user' ? 'justify-end' : 'justify-start'
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg px-4 py-3",
        role === 'user' 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted text-foreground'
      )}>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
        <div className={cn(
          "mt-1 text-xs opacity-70",
          role === 'user' ? 'text-primary-foreground' : 'text-muted-foreground'
        )}>
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};

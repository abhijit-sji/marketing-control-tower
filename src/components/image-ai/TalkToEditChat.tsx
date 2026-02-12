import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Loader2, Image as ImageIcon, Wand2 } from "lucide-react";

interface EditMessage {
  id: string;
  type: "user" | "system";
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

interface TalkToEditChatProps {
  currentImageId: string | null;
  currentImageUrl: string | null;
  onEdit: (instruction: string) => Promise<void>;
  isEditing: boolean;
  className?: string;
}

// Suggested edit instructions
const suggestedEdits = [
  "Make it brighter",
  "Add a sunset sky",
  "Change to nighttime",
  "Make it more colorful",
  "Add rain effects",
  "Remove the background",
  "Make it more dramatic",
  "Add lens flare",
];

export function TalkToEditChat({
  currentImageId,
  currentImageUrl,
  onEdit,
  isEditing,
  className,
}: TalkToEditChatProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (instruction?: string) => {
    const editInstruction = instruction || input.trim();
    if (!editInstruction || !currentImageId || isEditing) return;

    // Add user message
    const userMessage: EditMessage = {
      id: crypto.randomUUID(),
      type: "user",
      content: editInstruction,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      // Add system processing message
      const processingMessage: EditMessage = {
        id: crypto.randomUUID(),
        type: "system",
        content: "Editing your image...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, processingMessage]);

      // Perform edit
      await onEdit(editInstruction);

      // Update processing message to success
      setMessages((prev) =>
        prev.map((m) =>
          m.id === processingMessage.id
            ? { ...m, content: "Edit applied successfully!" }
            : m
        )
      );
    } catch (error) {
      // Update to error message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "system",
          content: `Edit failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDisabled = !currentImageId || isEditing;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Talk to Edit
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Current image preview */}
        {currentImageUrl ? (
          <div className="w-full h-20 rounded-md overflow-hidden bg-muted relative">
            <img
              src={currentImageUrl}
              alt="Current image"
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="text-xs text-white font-medium">
                Editing this image
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full h-20 rounded-md bg-muted flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <span className="text-xs">Generate an image first</span>
            </div>
          </div>
        )}

        {/* Messages area */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="space-y-2 pr-2">
            {messages.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">
                  Describe how you want to edit the image
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    msg.type === "user"
                      ? "bg-primary text-primary-foreground ml-4"
                      : "bg-muted mr-4"
                  )}
                >
                  {msg.content}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Suggested edits */}
        {currentImageId && messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Quick edits:</p>
            <div className="flex flex-wrap gap-1">
              {suggestedEdits.slice(0, 4).map((edit) => (
                <Button
                  key={edit}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  disabled={isDisabled}
                  onClick={() => handleSubmit(edit)}
                >
                  {edit}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isDisabled
                ? "Generate an image first..."
                : "Describe your edit..."
            }
            disabled={isDisabled}
            className="text-sm"
          />
          <Button
            size="icon"
            onClick={() => handleSubmit()}
            disabled={isDisabled || !input.trim()}
          >
            {isEditing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

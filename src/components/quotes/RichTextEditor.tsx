import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Rich Text Editor component
 *
 * Currently uses a textarea with basic HTML support.
 * Can be upgraded to TipTap for full WYSIWYG editing:
 * npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
 */
export function RichTextEditor({
  content,
  onChange,
  placeholder,
  className,
}: RichTextEditorProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <Textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={6}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Supports basic HTML formatting (bold, italic, lists, links)
      </p>
    </div>
  );
}

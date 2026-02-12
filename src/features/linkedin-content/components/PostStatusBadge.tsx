import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Clock, Send, Archive, FileText, CalendarDays, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PostStatus = "draft" | "scheduled" | "published" | "archived";

interface PostStatusBadgeProps {
  postId: string;
  leaderId: string;
  status: PostStatus;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  linkedinPostUrl?: string | null;
  showActions?: boolean;
}

const STATUS_CONFIG: Record<PostStatus, { label: string; icon: typeof FileText; className: string }> = {
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-muted text-muted-foreground border-muted",
  },
  scheduled: {
    label: "Scheduled",
    icon: CalendarDays,
    className: "bg-blue-500/10 text-blue-700 border-blue-200",
  },
  published: {
    label: "Published",
    icon: Check,
    className: "bg-green-500/10 text-green-700 border-green-200",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    className: "bg-gray-500/10 text-gray-500 border-gray-200",
  },
};

export const PostStatusBadge = ({
  postId,
  leaderId,
  status,
  scheduledFor,
  publishedAt,
  linkedinPostUrl,
  showActions = true,
}: PostStatusBadgeProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    scheduledFor ? new Date(scheduledFor) : undefined
  );
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, scheduleDate, url }: { 
      newStatus: PostStatus; 
      scheduleDate?: Date | null;
      url?: string;
    }) => {
      const updates: Record<string, unknown> = { status: newStatus };
      
      if (newStatus === "scheduled" && scheduleDate) {
        updates.scheduled_for = scheduleDate.toISOString();
      } else if (newStatus !== "scheduled") {
        updates.scheduled_for = null;
      }
      
      if (newStatus === "published") {
        updates.published_at = new Date().toISOString();
        if (url) updates.linkedin_post_url = url;
      }
      
      const { error } = await supabase
        .from("generated_posts")
        .update(updates)
        .eq("id", postId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated-posts", leaderId] });
      toast.success("Post status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;

  const handleSchedule = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      updateStatusMutation.mutate({ newStatus: "scheduled", scheduleDate: date });
      setCalendarOpen(false);
    }
  };

  const handleMarkPublished = () => {
    const url = prompt("Enter LinkedIn post URL (optional):");
    updateStatusMutation.mutate({ newStatus: "published", url: url || undefined });
  };

  if (!showActions) {
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
        {status === "scheduled" && scheduledFor && (
          <span className="ml-1 text-xs">
            {format(new Date(scheduledFor), "MMM d")}
          </span>
        )}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-1 ${config.className}`}>
          <Icon className="h-3 w-3" />
          {config.label}
          {status === "scheduled" && scheduledFor && (
            <span className="ml-1 text-xs">
              {format(new Date(scheduledFor), "MMM d")}
            </span>
          )}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ newStatus: "draft" })}>
          <FileText className="mr-2 h-4 w-4" />
          Mark as Draft
        </DropdownMenuItem>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Schedule...
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSchedule}
              disabled={(date) => date < new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        
        <DropdownMenuItem onClick={handleMarkPublished}>
          <Check className="mr-2 h-4 w-4" />
          Mark Published
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ newStatus: "archived" })}>
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
        
        {linkedinPostUrl && (
          <DropdownMenuItem asChild>
            <a href={linkedinPostUrl} target="_blank" rel="noopener noreferrer">
              <Send className="mr-2 h-4 w-4" />
              View on LinkedIn
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

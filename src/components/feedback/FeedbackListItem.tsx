import { Bug, Lightbulb, MessageSquare, ThumbsUp, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

interface FeedbackListItemProps {
  id: string;
  feedbackNumber: number;
  type: "bug" | "feature";
  subject: string;
  description: string;
  status: string;
  priority?: string;
  module?: string;
  upvotes: number;
  commentCount: number;
  createdAt: string;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  open: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function FeedbackListItem({
  feedbackNumber,
  type,
  subject,
  description,
  status,
  priority,
  module,
  upvotes,
  commentCount,
  createdAt,
  onClick,
}: FeedbackListItemProps) {
  const Icon = type === "bug" ? Bug : Lightbulb;
  const typeLabel = type === "bug" ? "Bug" : "Feature";
  const typeColor =
    type === "bug"
      ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
      : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300";

  return (
    <Card
      className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer group"
      onClick={onClick}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`p-2 rounded-lg ${
              type === "bug"
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-purple-100 dark:bg-purple-900/30"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                type === "bug" ? "text-red-500" : "text-purple-500"
              }`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-xs ${typeColor}`}>
                {typeLabel} #{feedbackNumber}
              </Badge>
              {module && module !== "General" && (
                <Badge variant="outline" className="text-xs">
                  {module}
                </Badge>
              )}
              {priority && priority !== "medium" && (
                <Badge variant="outline" className={`text-xs ${priorityColors[priority] || ""}`}>
                  {priority}
                </Badge>
              )}
            </div>

            {/* Title */}
            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
              {subject}
            </h4>

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {description}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(createdAt), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                {upvotes}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {commentCount}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <Badge className={`shrink-0 ${statusColors[status] || statusColors.open}`}>
            {status.replace("_", " ")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

interface KnowledgeStatusBadgeProps {
  isIndexed?: boolean;
  processingStatus?: string;
  embeddingCount?: number;
  errorMessage?: string;
}

export function KnowledgeStatusBadge({
  isIndexed,
  processingStatus,
  embeddingCount,
  errorMessage
}: KnowledgeStatusBadgeProps) {
  // Determine status based on flags
  const getStatus = () => {
    if (processingStatus === 'failed') {
      return {
        label: 'Failed',
        variant: 'destructive' as const,
        icon: XCircle,
        className: 'bg-red-500/10 text-red-600 border-red-200'
      };
    }

    if (processingStatus === 'processing' || processingStatus === 'pending') {
      return {
        label: 'Processing',
        variant: 'secondary' as const,
        icon: Clock,
        className: 'bg-yellow-500/10 text-yellow-600 border-yellow-200'
      };
    }

    if (isIndexed && processingStatus === 'completed') {
      return {
        label: 'Indexed',
        variant: 'default' as const,
        icon: CheckCircle,
        className: 'bg-green-500/10 text-green-600 border-green-200'
      };
    }

    return {
      label: 'Unknown',
      variant: 'outline' as const,
      icon: AlertCircle,
      className: 'bg-gray-500/10 text-gray-600 border-gray-200'
    };
  };

  const status = getStatus();
  const Icon = status.icon;

  const tooltipContent = () => {
    const parts: string[] = [];

    if (embeddingCount !== undefined && embeddingCount > 0) {
      parts.push(`${embeddingCount} vector chunk${embeddingCount !== 1 ? 's' : ''}`);
    }

    if (errorMessage) {
      parts.push(`Error: ${errorMessage}`);
    } else if (processingStatus) {
      parts.push(`Status: ${processingStatus}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No vector data';
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={status.variant}
          className={`${status.className} flex items-center gap-1.5 cursor-help`}
        >
          <Icon className="h-3 w-3" />
          {status.label}
          {embeddingCount !== undefined && embeddingCount > 0 && (
            <span className="ml-1 text-xs opacity-75">({embeddingCount})</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">{tooltipContent()}</p>
      </TooltipContent>
    </Tooltip>
  );
}

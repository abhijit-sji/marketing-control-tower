import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react";

interface IntegrationStatusBadgeProps {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  error?: string;
  lastChecked?: string | null;
}

export const IntegrationStatusBadge = ({ 
  configured, 
  connected, 
  enabled, 
  error,
  lastChecked 
}: IntegrationStatusBadgeProps) => {
  if (!configured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Not Configured
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This integration needs to be configured</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Error
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-semibold">Connection Error</p>
            <p className="text-xs mt-1">{error}</p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground mt-1">
                Last checked: {new Date(lastChecked).toLocaleString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (!connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Connected
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Integration is configured but not connected</p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground mt-1">
                Last checked: {new Date(lastChecked).toLocaleString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  if (!enabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Disabled
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Integration is connected but currently disabled</p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground mt-1">
                Last checked: {new Date(lastChecked).toLocaleString()}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge className="bg-green-600 hover:bg-green-700 gap-1">
            <CheckCircle className="h-3 w-3" />
            Active
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Integration is active and working</p>
          {lastChecked && (
            <p className="text-xs text-muted-foreground mt-1">
              Last checked: {new Date(lastChecked).toLocaleString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

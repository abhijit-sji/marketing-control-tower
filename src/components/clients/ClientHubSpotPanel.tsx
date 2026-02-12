import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Client } from "@/hooks/useClients";

interface ClientHubSpotPanelProps {
  client: Client;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export const ClientHubSpotPanel = ({
  client,
  onSync,
  isSyncing
}: ClientHubSpotPanelProps) => {
  return (
    <Card className="border border-border/50 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">HubSpot Integration</CardTitle>
        <CardDescription>
          Sync client data from HubSpot CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">Integration Status</p>
            <Badge
              variant={client.hubspot_sync_status === 'synced' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {client.hubspot_sync_status || 'unknown'}
            </Badge>
          </div>
        </div>

        {client.hubspot_id && (
          <div className="space-y-1">
            <p className="text-sm font-medium">HubSpot ID</p>
            <p className="text-sm text-muted-foreground font-mono">
              {client.hubspot_id}
            </p>
          </div>
        )}

        {client.hubspot_last_sync && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Last Sync</p>
            <p className="text-sm text-muted-foreground">
              {format(new Date(client.hubspot_last_sync), 'PPp')}
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={onSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync from HubSpot
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

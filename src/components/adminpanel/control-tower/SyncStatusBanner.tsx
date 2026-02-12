import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useSyncControlTower } from "@/hooks/useControlTowerData";
import { toast } from "sonner";

interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  records_fetched: number;
  records_synced: number;
  records_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  triggered_by: string | null;
  metadata: any;
}

export function SyncStatusBanner() {
  const { data: syncLog } = useQuery<SyncLog | null>({
    queryKey: ['control-tower-sync-status'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('control_tower_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching sync status:', error);
        return null;
      }
      return data as SyncLog | null;
    },
    refetchInterval: 10000, // Poll every 10 seconds
  });

  const syncMutation = useSyncControlTower();

  const handleSync = async () => {
    try {
      await syncMutation.mutateAsync();
      toast.success('Sync started successfully');
    } catch (error) {
      toast.error('Failed to start sync');
      console.error('Sync error:', error);
    }
  };

  const lastSyncTime = syncLog?.completed_at 
    ? formatDistanceToNow(new Date(syncLog.completed_at), { addSuffix: true })
    : 'Never';

  const isInProgress = syncLog?.status === 'in_progress';
  const hasErrors = syncLog?.status === 'completed_with_errors' || syncLog?.status === 'failed';

  return (
    <Card className="mb-6">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {isInProgress && (
            <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          )}
          {!isInProgress && !hasErrors && syncLog?.completed_at && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
          {hasErrors && (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          {!syncLog && (
            <Clock className="h-5 w-5 text-muted-foreground" />
          )}
          
          <div>
            <p className="text-sm font-medium">
              Last synced: {lastSyncTime}
            </p>
            {isInProgress && (
              <p className="text-xs text-muted-foreground">
                Sync in progress...
              </p>
            )}
            {hasErrors && syncLog?.error_message && (
              <p className="text-xs text-yellow-600">
                {syncLog.error_message}
              </p>
            )}
            {syncLog?.metadata && typeof syncLog.metadata === 'object' && (
              <p className="text-xs text-muted-foreground">
                {(syncLog.metadata as any).employees || 0} employees, {(syncLog.metadata as any).pods || 0} PODs, {(syncLog.metadata as any).pod_members || 0} members
              </p>
            )}
          </div>
        </div>
        
        <Button
          size="sm"
          onClick={handleSync}
          disabled={syncMutation.isPending || isInProgress}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending || isInProgress ? 'Syncing...' : 'Sync Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

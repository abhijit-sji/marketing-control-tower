import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, FileText, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeCategory {
  id: string;
  name: string;
  description: string | null;
  fileCount: number;
  lastSynced: string | null;
  isEnabled: boolean;
  priority: number;
}

interface AgentKnowledgeSelectorProps {
  agentId: string;
  onSelectionChange?: (selections: KnowledgeCategory[]) => void;
}

export function AgentKnowledgeSelector({ agentId, onSelectionChange }: AgentKnowledgeSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { isEnabled: boolean; priority: number }>>(new Map());

  // Fetch categories with file counts and selection status
  const { data: categories, isLoading } = useQuery({
    queryKey: ['agent-knowledge-categories', agentId],
    queryFn: async () => {
      // Get all active categories
      const { data: categoriesData, error: catError } = await supabase
        .from('knowledge_base_categories')
        .select('id, name, description, last_synced')
        .eq('is_active', true)
        .order('name');

      if (catError) throw catError;

      // Get file counts per category
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (cat) => {
          // Get sources for this category
          const { data: sources } = await supabase
            .from('knowledge_sources')
            .select('id')
            .eq('category_id', cat.id);
          
          const sourceIds = sources?.map(s => s.id) || [];
          
          const { count } = await supabase
            .from('knowledge_files')
            .select('*', { count: 'exact', head: true })
            .in('source_id', sourceIds)
            .eq('is_indexed', true);

          // Get selection status
          const { data: selection } = await supabase
            .from('ai_agent_knowledge_selection')
            .select('is_enabled, priority')
            .eq('agent_id', agentId)
            .eq('category_id', cat.id)
            .maybeSingle();

          return {
            id: cat.id,
            name: cat.name,
            description: cat.description,
            fileCount: count || 0,
            lastSynced: cat.last_synced,
            isEnabled: selection?.is_enabled ?? false,
            priority: selection?.priority ?? 5,
          } as KnowledgeCategory;
        })
      );

      return categoriesWithCounts;
    },
  });

  // Mutation to update selection
  const updateSelectionMutation = useMutation({
    mutationFn: async ({ categoryId, isEnabled, priority }: { categoryId: string; isEnabled: boolean; priority: number }) => {
      const { error } = await supabase
        .from('ai_agent_knowledge_selection')
        .upsert({
          agent_id: agentId,
          category_id: categoryId,
          is_enabled: isEnabled,
          priority,
        }, {
          onConflict: 'agent_id,category_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-knowledge-categories', agentId] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update knowledge selection",
        variant: "destructive",
      });
    },
  });

  // Debounced update handler
  useEffect(() => {
    if (pendingUpdates.size === 0) return;

    const timer = setTimeout(() => {
      pendingUpdates.forEach((update, categoryId) => {
        updateSelectionMutation.mutate({
          categoryId,
          isEnabled: update.isEnabled,
          priority: update.priority,
        });
      });
      setPendingUpdates(new Map());
    }, 1000);

    return () => clearTimeout(timer);
  }, [pendingUpdates]);

  const handleToggleCategory = (categoryId: string, currentEnabled: boolean, currentPriority: number) => {
    const newEnabled = !currentEnabled;
    setPendingUpdates(prev => new Map(prev).set(categoryId, { isEnabled: newEnabled, priority: currentPriority }));
    
    // Optimistic update
    queryClient.setQueryData(['agent-knowledge-categories', agentId], (old: KnowledgeCategory[] | undefined) => {
      return old?.map(cat => 
        cat.id === categoryId ? { ...cat, isEnabled: newEnabled } : cat
      );
    });
  };

  const handlePriorityChange = (categoryId: string, currentEnabled: boolean, newPriority: number) => {
    setPendingUpdates(prev => new Map(prev).set(categoryId, { isEnabled: currentEnabled, priority: newPriority }));
    
    // Optimistic update
    queryClient.setQueryData(['agent-knowledge-categories', agentId], (old: KnowledgeCategory[] | undefined) => {
      return old?.map(cat => 
        cat.id === categoryId ? { ...cat, priority: newPriority } : cat
      );
    });
  };

  useEffect(() => {
    if (categories && onSelectionChange) {
      onSelectionChange(categories);
    }
  }, [categories, onSelectionChange]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Categories</CardTitle>
          <CardDescription>No knowledge categories found</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Create knowledge categories in the Company Knowledge Hub first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = categories.filter(c => c.isEnabled).length;
  const totalFiles = categories.reduce((sum, c) => sum + (c.isEnabled ? c.fileCount : 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Knowledge Sources
        </CardTitle>
        <CardDescription>
          Select which knowledge categories this agent can access
        </CardDescription>
        <div className="flex gap-4 pt-2">
          <Badge variant="secondary">
            {enabledCount} / {categories.length} Categories
          </Badge>
          <Badge variant="secondary">
            <FileText className="h-3 w-3 mr-1" />
            {totalFiles} Files Available
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map((category) => (
          <div
            key={category.id}
            className={`rounded-lg border p-4 transition-colors ${
              category.isEnabled ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-start gap-4">
              <Checkbox
                id={`category-${category.id}`}
                checked={category.isEnabled}
                onCheckedChange={() => handleToggleCategory(category.id, category.isEnabled, category.priority)}
                className="mt-1"
              />
              
              <div className="flex-1 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor={`category-${category.id}`}
                      className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                    >
                      {category.name}
                      {category.isEnabled && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </label>
                    {category.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {category.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>{category.fileCount} files</span>
                  </div>
                </div>

                {category.lastSynced && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Synced {formatDistanceToNow(new Date(category.lastSynced), { addSuffix: true })}</span>
                  </div>
                )}

                {category.isEnabled && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        Priority: {category.priority}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        {category.priority <= 3 ? 'Low' : category.priority <= 7 ? 'Medium' : 'High'}
                      </span>
                    </div>
                    <Slider
                      value={[category.priority]}
                      onValueChange={([value]) => handlePriorityChange(category.id, category.isEnabled, value)}
                      min={0}
                      max={10}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}

                {category.isEnabled && category.fileCount === 0 && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-3 w-3" />
                    <AlertDescription className="text-xs">
                      This category has no indexed files
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        ))}

        {pendingUpdates.size > 0 && (
          <Alert>
            <AlertDescription className="text-xs">
              Saving changes...
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

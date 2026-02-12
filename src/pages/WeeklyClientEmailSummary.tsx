import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/useClients";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { generateWeeklyEmailSummary } from "@/lib/weeklyEmailSummary";
import { Loader2, Mail, Calendar } from "lucide-react";
import { format, startOfWeek, addDays } from "date-fns";

// Get Monday to Friday of current week
function getCurrentWeekRange() {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 }); // Monday as start
  const friday = addDays(monday, 4); // Friday (Monday + 4 days)
  return {
    start: monday,
    end: friday,
  };
}

interface LinkedProject {
  id: string;
  name: string;
  activecollab_project_id: string;
}

export default function WeeklyClientEmailSummary() {
  const { toast } = useToast();
  const { clients } = useClients({ limit: 1000 });

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [dateRange, setDateRange] = useState(getCurrentWeekRange());
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projects, setProjects] = useState<LinkedProject[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  // Filter active clients (email not required for summary generation)
  const activeClients = clients.filter(
    (client) => client.status === "active"
  );

  const selectedClient = activeClients.find((c) => c.id === selectedClientId);

  // Fetch projects linked to the client from database
  useEffect(() => {
    const fetchProjects = async () => {
      if (!selectedClientId) {
        setProjects([]);
        setSelectedProjectIds([]);
        return;
      }

      setIsLoadingProjects(true);
      try {
        // Fetch projects from database that are linked to this client
        // Only get projects that have ActiveCollab project IDs
        const { data: linkedProjects, error } = await supabase
          .from('projects')
          .select('id, name, activecollab_project_id')
          .eq('client_id', selectedClientId)
          .not('activecollab_project_id', 'is', null)
          .order('name');

        if (error) {
          throw error;
        }

        // Map to LinkedProject format
        const projectsList: LinkedProject[] = (linkedProjects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          activecollab_project_id: p.activecollab_project_id,
        }));

        setProjects(projectsList);
      } catch (error: any) {
        toast({
          title: "Error Fetching Projects",
          description: error.message || "Failed to fetch projects linked to this client",
          variant: "destructive",
        });
        setProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    fetchProjects();
  }, [selectedClientId, toast]);

  const handleGenerateSummary = async () => {
    if (!selectedClientId) {
      toast({
        title: "Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (selectedProjectIds.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one project",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setSummary("");

    try {
      const startDate = format(dateRange.start, "yyyy-MM-dd");
      const endDate = format(dateRange.end, "yyyy-MM-dd");

      const result = await generateWeeklyEmailSummary({
        client_id: selectedClientId,
        project_ids: selectedProjectIds,
        start_date: startDate,
        end_date: endDate,
      });

      setSummary(result.summary || "No summary generated.");
    } catch (error: any) {
      toast({
        title: "Error Generating Summary",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const projectOptions = projects.map((project) => ({
    value: project.activecollab_project_id,
    label: project.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Mail className="h-8 w-8 text-primary" />
          Send Weekly Email to Client
        </h1>
        <p className="text-muted-foreground mt-2">
          Generate weekly project summaries based on task comments and titles from ActiveCollab
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Weekly Summary</CardTitle>
          <CardDescription>
            Select a client, choose projects, and set the date range to generate an AI-powered summary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger id="client">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {activeClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} {client.company && `(${client.company})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClient && (
              <p className="text-sm text-muted-foreground">
                Email (optional): {selectedClient.email || 'Not provided'}
              </p>
            )}
          </div>

          {/* Project Multi-Select */}
          {selectedClientId && (
            <div className="space-y-2">
              <Label htmlFor="projects">Projects *</Label>
              <MultiSelect
                options={projectOptions}
                selected={selectedProjectIds}
                onChange={setSelectedProjectIds}
                placeholder={
                  isLoadingProjects
                    ? "Loading projects..."
                    : projectOptions.length === 0
                    ? "No projects found"
                    : "Select projects"
                }
                emptyText="No projects available"
                searchPlaceholder="Search projects..."
                loading={isLoadingProjects}
              />
              {!isLoadingProjects && (
                <p className="text-xs text-muted-foreground">
                  {projects.length === 0
                    ? "No projects linked to this client. Please link projects to the client first."
                    : `${projects.length} project${projects.length !== 1 ? "s" : ""} linked to this client`}
                </p>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Week Range (Monday - Friday) *
            </Label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Start Date (Monday)</Label>
                <input
                  type="date"
                  value={format(dateRange.start, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setDateRange({ start: newDate, end: addDays(newDate, 4) });
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">End Date (Friday)</Label>
                <input
                  type="date"
                  value={format(dateRange.end, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const newDate = new Date(e.target.value);
                    setDateRange({ start: addDays(newDate, -4), end: newDate });
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(dateRange.start, "MMM d")} - {format(dateRange.end, "MMM d, yyyy")}
            </p>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerateSummary}
            disabled={!selectedClientId || selectedProjectIds.length === 0 || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Generate Summary
              </>
            )}
          </Button>

          {/* Summary Textarea */}
          {summary && (
            <div className="space-y-2">
              <Label htmlFor="summary">Summary (Editable)</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Summary will appear here..."
              />
              <p className="text-xs text-muted-foreground">
                You can edit the summary before copying or saving. The summary is formatted with markdown.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How it works</CardTitle>
          <CardDescription className="text-xs">
            This tool fetches tasks and comments directly from ActiveCollab for the selected projects
            within the specified date range, then generates an AI-powered summary based on task titles
            and comments. The summary can be edited before use.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}


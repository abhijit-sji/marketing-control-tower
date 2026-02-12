import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LeaderFormDialog } from "@/features/linkedin-content/components/LeaderFormDialog";
import { useCreateLeader, useLinkedInLeaders, useUpdateLeader } from "@/features/linkedin-content/hooks";
import { LinkedInLeader, LeaderInput } from "@/features/linkedin-content/types";
import { Loader2, PlusCircle, Sparkles, Pencil, Eye, ChevronDown, ChevronUp, Info } from "lucide-react";
import { ContentCreationFlow } from "@/components/linkedin/ContentCreationFlow";
import { ContentFunnelVisualizer } from "@/components/linkedin/ContentFunnelVisualizer";

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const LeaderRowActions = ({ leader, onEdit, onView }: {
  leader: LinkedInLeader;
  onEdit: (leader: LinkedInLeader) => void;
  onView: (leaderId: string) => void;
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => onView(leader.id)} aria-label={`View ${leader.name}`}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onEdit(leader)} aria-label={`Edit ${leader.name}`}>
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
  );
};

const LinkedInLeaderListPage = () => {
  const navigate = useNavigate();
  const { data: leaders, isLoading } = useLinkedInLeaders();
  const createMutation = useCreateLeader();
  const [editingLeader, setEditingLeader] = useState<LinkedInLeader | null>(null);
  const updateMutation = useUpdateLeader(editingLeader?.id ?? "");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const handleAdd = () => {
    setEditingLeader(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (leader: LinkedInLeader) => {
    setEditingLeader(leader);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (payload: LeaderInput) => {
    if (editingLeader) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            LinkedIn Content Lab
          </h1>
          <p className="text-muted-foreground">
            Curate SJ Innovation thought leaders and prepare high-signal LinkedIn posts every week.
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full md:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" /> Add leader
        </Button>
      </div>

      {/* Content Creation Flow - Compact */}
      <ContentCreationFlow compact />

      {/* Methodology Section - Collapsible */}
      <Collapsible open={showMethodology} onOpenChange={setShowMethodology}>
        <Card className="border-dashed">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Content Marketing Funnel Methodology</CardTitle>
                </div>
                <Button variant="ghost" size="sm">
                  {showMethodology ? (
                    <>Hide <ChevronUp className="h-4 w-4 ml-1" /></>
                  ) : (
                    <>Learn More <ChevronDown className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
              {!showMethodology && (
                <CardDescription className="mt-1">
                  Understand which funnel stage your content targets for maximum impact
                </CardDescription>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ContentFunnelVisualizer compact={false} />
                <div className="space-y-4">
                  <ContentCreationFlow compact={false} />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Leaders Table */}

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Weekly thought leadership engine
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Track each leader&apos;s readiness with references, trends, and saved drafts.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading thought leaders…
            </div>
          ) : leaders && leaders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leader</TableHead>
                    <TableHead className="hidden md:table-cell">Persona tone</TableHead>
                    <TableHead className="hidden md:table-cell">Uploads</TableHead>
                    <TableHead className="hidden md:table-cell">Weekly trends</TableHead>
                    <TableHead className="hidden lg:table-cell">Drafts</TableHead>
                    <TableHead className="hidden lg:table-cell">Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaders.map((leader) => {
                    const leaderPath = leader.urlSlug || leader.id;
                    return (
                      <TableRow key={leader.id} className="hover:bg-muted/40">
                        <TableCell 
                          className="cursor-pointer"
                          onClick={() => navigate(`/content/linkedin/${leaderPath}`)}
                        >
                          <div className="font-medium hover:text-primary transition-colors">{leader.name}</div>
                          <div className="text-sm text-muted-foreground">{leader.title}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary">{leader.personaTone}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{leader.uploadCount}</TableCell>
                        <TableCell className="hidden md:table-cell">{leader.trendCount}</TableCell>
                        <TableCell className="hidden lg:table-cell">{leader.generatedPostCount}</TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {formatDate(leader.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <LeaderRowActions
                            leader={leader}
                            onEdit={handleEdit}
                            onView={(leaderId) => navigate(`/content/linkedin/${leaderPath}`)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Sparkles className="h-8 w-8 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">Introduce your first thought leader</h2>
                <p className="text-sm text-muted-foreground">
                  Add Shahed, Mohan, or a new voice to seed prompts, target audiences, and creative guidance.
                </p>
              </div>
              <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create leader
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <LeaderFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending || updateMutation.isPending}
        leader={editingLeader}
      />
    </div>
  );
};

export default LinkedInLeaderListPage;

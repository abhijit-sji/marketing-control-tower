import { useParams, useNavigate } from "react-router-dom";
import { Mail, Phone, Calendar, TrendingUp, Loader2, MapPin, Building2, Globe, RefreshCw, Users, Handshake, DollarSign, Trash2, Edit, Target, ExternalLink, MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { useClients, Client, UpdateClientData } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useContacts } from "@/hooks/useContacts";
import { useDeals } from "@/hooks/useDeals";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { slugify } from "@/lib/slugify";
import { ClientStatsCard } from "@/components/clients/ClientStatsCard";
import { ClientInfoCard } from "@/components/clients/ClientInfoCard";
import { ClientProjectCard } from "@/components/clients/ClientProjectCard";
import { ClientContactCard } from "@/components/clients/ClientContactCard";
import { ClientDealCard } from "@/components/clients/ClientDealCard";
import { ClientHubSpotPanel } from "@/components/clients/ClientHubSpotPanel";
import { SentimentTimeline } from "@/components/testimonials/SentimentTimeline";
import { AnalysisResultCard } from "@/components/testimonials/AnalysisResultCard";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { useTestimonials } from "@/hooks/useTestimonials";
import { useClientSentiment } from "@/hooks/useClientSentiment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ClientDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { clients, getClientById, syncClientFromHubSpot, updateClient } = useClients({ limit: 1000 });
  const [clientId, setClientId] = useState<string | undefined>();
  const { projects, loading: projectsLoading, deleteProject, refetch: refetchProjects, updateProjectClientAssociations } = useProjects({ client_id: clientId });
  const { contacts, loading: contactsLoading } = useContacts(clientId);
  const { deals, loading: dealsLoading } = useDeals(clientId);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { testimonials } = useTestimonials();
  const { entries } = useClientSentiment(clientId);

  useEffect(() => {
    const loadClient = async () => {
      if (!slug) return;
      setClientLoading(true);
      setFetchError(null);
      try {
        // Find client by matching slug against slugified company or name
        const matchedClient = clients.find(c => {
          const clientSlug = slugify(c.company || c.name);
          return clientSlug === slug;
        });

        if (!matchedClient) {
          setFetchError('Client not found');
          setClient(null);
        } else {
          setClient(matchedClient);
          setClientId(matchedClient.id);
        }
      } catch (error) {
        console.error('Error loading client:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to load client';
        setFetchError(errorMessage);
        toast.error('Failed to load client details');
      } finally {
        setClientLoading(false);
      }
    };
    loadClient();
  }, [slug, clients]);

  const handleSync = async () => {
    if (!client?.hubspot_id || !clientId) return;

    setIsSyncing(true);
    try {
      await syncClientFromHubSpot(clientId);
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteClick = (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      toast.success("Project deleted successfully");
      await refetchProjects();
    } catch (error: any) {
      toast.error(`Failed to delete project: ${error.message}`);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const canDeleteProjects = hasRole('super_admin') || hasRole('manager');

  const handleEditClient = async (data: any, projectIds: string[]) => {
    if (!clientId) return;

    setIsSubmitting(true);
    try {
      await updateClient(clientId, data as UpdateClientData);

      // Update project associations
      if (projectIds.length > 0 || client) {
        await updateProjectClientAssociations(clientId, projectIds);
      }

      toast.success('Client updated successfully');
      setEditDialogOpen(false);

      // Reload client data
      const updatedClient = await getClientById(clientId);
      if (updatedClient) {
        setClient(updatedClient);
      }
      await refetchProjects();
    } catch (error: any) {
      toast.error(`Failed to update client: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (clientLoading || projectsLoading || contactsLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading client details...</span>
      </div>
    );
  }

  if (fetchError || !client) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Alert variant="destructive">
          <AlertDescription>
            {fetchError || 'Client not found.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'on_hold': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'planning': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'prospect': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
  const activeProjects = projects.filter(p => p.status === 'in_progress' || p.status === 'planning');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const clientTestimonials = testimonials.filter((testimonial) => {
    const matchesCompany = testimonial.companyName.toLowerCase() === client.company?.toLowerCase();
    const matchesName = testimonial.clientName.toLowerCase() === client.name.toLowerCase();
    return matchesCompany || matchesName;
  });

  return (
    <div className="relative min-h-screen">
      {/* Decorative background circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10" />

      <div className="container mx-auto max-w-7xl py-8 px-4">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/clients">Clients</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbPage>{client.name}</BreadcrumbPage>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center pb-6 border-b border-border/50 mb-6">
          {/* Avatar in white container */}
          <div className="flex-shrink-0 p-4 bg-white dark:bg-muted rounded-xl shadow-md">
            <Avatar className="h-16 w-16">
              <AvatarImage src="" />
              <AvatarFallback className="text-xl">
                {client.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Content area */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-display font-bold tracking-tight">
                {client.name}
              </h1>
              <Badge className={getStatusColor(client.status)}>
                {client.status}
              </Badge>
            </div>

            {client.company && (
              <p className="text-sm text-muted-foreground">{client.company}</p>
            )}

            {client.website && (
              <a
                href={client.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors group"
              >
                Visit Website
                <ExternalLink className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            )}
          </div>

          {/* Edit button */}
          <Button onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit Client
          </Button>
        </div>

        {/* Tab Navigation */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full flex items-center gap-2 bg-muted/50 p-2 rounded-xl border border-border/50 shadow-sm mb-6 overflow-x-auto">
            <TabsTrigger
              value="overview"
              className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
            >
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="projects"
              className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
            >
              <Target className="h-4 w-4" />
              Projects ({projects.length})
            </TabsTrigger>
            <TabsTrigger
              value="meetings"
              className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
            >
              <Calendar className="h-4 w-4" />
              Meetings
            </TabsTrigger>
            {contacts.length > 0 && (
              <TabsTrigger
                value="contacts"
                className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
              >
                <Users className="h-4 w-4" />
                Contacts ({contacts.length})
              </TabsTrigger>
            )}
            {deals.length > 0 && (
              <TabsTrigger
                value="deals"
                className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
              >
                <Handshake className="h-4 w-4" />
                Deals ({deals.length})
              </TabsTrigger>
            )}
            <TabsTrigger
              value="testimonials"
              className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
            >
              <MessageSquareQuote className="h-4 w-4" />
              Testimonials ({clientTestimonials.length})
            </TabsTrigger>
            {client.hubspot_id && (
              <TabsTrigger
                value="hubspot"
                className="rounded-lg px-4 py-2 h-10 flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary font-semibold transition-all whitespace-nowrap"
              >
                <RefreshCw className="h-4 w-4" />
                HubSpot
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <div className="space-y-6">
              {/* Client Info Card */}
              <ClientInfoCard client={client} />

              {/* Quick Stats Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ClientStatsCard
                  title="Active Projects"
                  value={activeProjects.length}
                  icon={<Target className="h-5 w-5" />}
                />
                <ClientStatsCard
                  title="Completed Projects"
                  value={completedProjects.length}
                  icon={<TrendingUp className="h-5 w-5" />}
                />
                <ClientStatsCard
                  title="Total Budget"
                  value={`$${totalBudget.toLocaleString()}`}
                  icon={<DollarSign className="h-5 w-5" />}
                />
              </div>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            {projects.length === 0 ? (
              <Card className="border-2 border-dashed border-border/50 bg-muted/20">
                <CardContent className="py-16 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                    <Target className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-display font-bold mb-2">No Projects Yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    This client doesn't have any projects assigned yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((project) => (
                  <ClientProjectCard
                    key={project.id}
                    project={project}
                    onNavigate={() => {
                      const projectSlug = slugify(project.name);
                      navigate(`/projects/${projectSlug}`);
                    }}
                    onDelete={(e) => handleDeleteClick(project.id, project.name, e)}
                    canDelete={canDeleteProjects}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Meetings Tab */}
          <TabsContent value="meetings" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
            <Card className="border-2 border-dashed border-border/50 bg-muted/20">
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-display font-bold mb-2">No Meetings Scheduled</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  Schedule and track client meetings, calls, and follow-ups.
                </p>
                <Button variant="outline" disabled>
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Meeting (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contacts Tab */}
          {contacts.length > 0 && (
            <TabsContent value="contacts" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
              <div className="grid gap-4 sm:grid-cols-2">
                {contacts.map((contact) => (
                  <ClientContactCard key={contact.id} contact={contact} />
                ))}
              </div>
            </TabsContent>
          )}

          {/* Deals Tab */}
          {deals.length > 0 && (
            <TabsContent value="deals" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
              <div className="grid gap-4 sm:grid-cols-2">
                {deals.map((deal) => (
                  <ClientDealCard key={deal.id} deal={deal} />
                ))}
              </div>
            </TabsContent>
          )}

          {/* Testimonials Tab */}
          <TabsContent value="testimonials" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300 space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {clientTestimonials.length === 0 ? (
                <Card className="border-2 border-dashed border-border/50 bg-muted/20 lg:col-span-2">
                  <CardContent className="py-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                      <MessageSquareQuote className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-display font-bold mb-2">No Testimonials Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Once a testimonial is requested or approved, it will appear here alongside sentiment insights.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                clientTestimonials.map((testimonial) => (
                  <TestimonialCard key={testimonial.id} testimonial={testimonial} />
                ))
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SentimentTimeline entries={entries} />
              <div className="grid gap-4">
                {entries.map((entry) => (
                  <AnalysisResultCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* HubSpot Tab */}
          {client.hubspot_id && (
            <TabsContent value="hubspot" className="animate-in fade-in-50 slide-in-from-bottom-4 duration-300">
              <div className="max-w-2xl">
                <ClientHubSpotPanel
                  client={client}
                  onSync={handleSync}
                  isSyncing={isSyncing}
                />
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{projectToDelete?.name}</strong>? This action cannot be undone and will also delete all associated tasks and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Client Dialog */}
      <ClientDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        client={client || undefined}
        onSubmit={handleEditClient}
        isLoading={isSubmitting}
      />
    </div>
  );
}

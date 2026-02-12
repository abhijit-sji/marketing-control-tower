import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, MoreVertical, Building2, Eye, Edit, Trash2, DollarSign, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getClientUrl } from "@/lib/clientSlugUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useClients, Client, CreateClientData, UpdateClientData } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ClientsAndProjects() {
  const navigate = useNavigate();
  
  // Client states
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState<string>('all');
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>();
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Stats state (for all clients, not just current page)
  const [activeClientsCount, setActiveClientsCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // Hooks
  const { 
    clients, 
    loading: clientsLoading, 
    totalCount: clientsTotalCount,
    createClient, 
    updateClient, 
    deleteClient,
    refetch: refetchClients
  } = useClients({ 
    page: currentPage,
    limit: itemsPerPage,
    search: clientSearchTerm,
    status: clientStatusFilter === 'all' ? undefined : clientStatusFilter,
  });

  const { updateProjectClientAssociations } = useProjects();

  // Fetch stats from all clients (not paginated)
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;

      // Fetch count of all active clients
      const { count: activeCount } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Fetch total revenue from all clients
      const { data: allClients } = await supabase
        .from('clients')
        .select('total_revenue');

      setActiveClientsCount(activeCount || 0);
      setTotalRevenue(
        (allClients || []).reduce((sum, client) => sum + (client.total_revenue || 0), 0)
      );
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Refetch stats when clients are updated
  useEffect(() => {
    if (!clientsLoading && !clientDialogOpen) {
      fetchStats();
    }
  }, [clientsLoading, clientDialogOpen]);

  // Client functions
  const getClientStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'prospect': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const handleAddClient = () => {
    setEditingClient(undefined);
    setClientDialogOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientDialogOpen(true);
  };

  const handleClientSubmit = async (data: CreateClientData, projectIds: string[]) => {
    setIsClientSubmitting(true);
    try {
      let clientId: string;
      
      if (editingClient) {
        await updateClient(editingClient.id, data as UpdateClientData);
        clientId = editingClient.id;
        toast.success('Client updated');
      } else {
        const newClient = await createClient(data);
        clientId = newClient.id;
        toast.success('Client created');
      }
      
      // Update ActiveCollab project associations
      if (projectIds.length > 0 || editingClient) {
        await updateProjectClientAssociations(clientId, projectIds);
      }
      
      setClientDialogOpen(false);
      setEditingClient(undefined);
      await refetchClients();
      await fetchStats(); // Refresh stats after client update
    } catch (error) {
      toast.error('Failed to save client');
    } finally {
      setIsClientSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteClient(clientId);
        toast.success('Client deleted successfully');
        await fetchStats(); // Refresh stats after client deletion
      } catch (error) {
        toast.error('Failed to delete client');
      }
    }
  };

  const totalPages = Math.ceil(clientsTotalCount / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your clients and track relationships</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientsTotalCount}</div>
            <p className="text-xs text-muted-foreground">All clients in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : activeClientsCount}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : `$${totalRevenue.toLocaleString()}`}
            </div>
            <p className="text-xs text-muted-foreground">From all clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Management */}
      <div className="space-y-4">
          {/* Client Controls */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-1 gap-4 items-center w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search clients..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={clientStatusFilter} onValueChange={setClientStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddClient}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </div>

          {/* Client Grid */}
          {clientsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded"></div>
                      <div className="h-3 bg-muted rounded w-5/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No clients found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {clientSearchTerm ? 'Try adjusting your search' : 'Get started by creating your first client'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clients.map((client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(getClientUrl(client))}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {client.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{client.name}</CardTitle>
                          {client.company && (
                            <p className="text-sm text-muted-foreground">{client.company}</p>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(getClientUrl(client));
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleEditClient(client);
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClient(client.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge className={getClientStatusColor(client.status)}>
                          {client.status}
                        </Badge>
                      </div>
                      {client.email && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Email</span>
                          <span className="text-sm truncate max-w-[180px]">{client.email}</span>
                        </div>
                      )}
                      {client.total_revenue !== null && client.total_revenue !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Revenue</span>
                          <span className="text-sm font-medium">${client.total_revenue.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, clientsTotalCount)} of {clientsTotalCount} clients
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          className="w-9"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          )}
        </div>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={editingClient}
        onSubmit={handleClientSubmit}
        isLoading={isClientSubmitting}
      />
    </div>
  );
}
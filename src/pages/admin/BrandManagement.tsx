import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Building2, 
  Users, 
  Plug, 
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  DollarSign,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useAdminBrands,
  Brand,
  CreateBrandData,
  UpdateBrandData
} from "@/hooks/useAdminBrands";
import { useAdminUsers } from "@/hooks/useAdminUsers";

const BrandManagement = () => {
  const navigate = useNavigate();
  const { brands, loading, createBrand, updateBrand, deleteBrand, refetch } = useAdminBrands();
  const { users } = useAdminUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "internal" | "client">("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [editBrandData, setEditBrandData] = useState<UpdateBrandData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Form state for new brand
  const [newBrandData, setNewBrandData] = useState<CreateBrandData>({
    name: "",
    description: "",
    type: "internal",
    owner_id: "",
    monthly_budget: undefined
  });

  const filteredBrands = brands.filter(brand => {
    const matchesSearch = brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (brand.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === "all" || brand.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleCreateBrand = async () => {
    if (!newBrandData.name || !newBrandData.description || !newBrandData.owner_id) {
      return;
    }

    setIsCreating(true);
    const success = await createBrand(newBrandData);
    setIsCreating(false);
    
    if (success) {
      setIsAddDialogOpen(false);
      setNewBrandData({
        name: "",
        description: "",
        type: "internal",
        owner_id: "",
        monthly_budget: undefined
      });
    }
  };

  const getBrandStats = (brand: Brand) => {
    const totalKPIs = brand.kpis.length;
    const achievedKPIs = brand.kpis.filter(kpi => 
      kpi.current_value >= (kpi.target_value || kpi.current_value)
    ).length;
    const achievementRate = totalKPIs > 0 ? Math.round((achievedKPIs / totalKPIs) * 100) : 0;
    
    return { totalKPIs, achievedKPIs, achievementRate };
  };

  const handleOpenEditDialog = (brand: Brand) => {
    setSelectedBrand(brand);
    setEditBrandData({
      name: brand.name,
      description: brand.description,
      type: brand.type,
      owner_id: brand.owner_id,
      monthly_budget: brand.monthly_budget,
      is_active: brand.is_active,
      status: brand.status
    });
    setIsEditDialogOpen(true);
  };

  const resetEditState = () => {
    setIsEditDialogOpen(false);
    setSelectedBrand(null);
    setEditBrandData(null);
    setIsUpdating(false);
  };

  const handleUpdateBrand = async () => {
    if (!selectedBrand || !editBrandData) {
      return;
    }

    if (!editBrandData.name || !editBrandData.description || !editBrandData.owner_id) {
      return;
    }

    setIsUpdating(true);
    const updated = await updateBrand(selectedBrand.id, editBrandData);
    setIsUpdating(false);

    if (updated) {
      resetEditState();
      refetch();
    }
  };

  const handleDeleteClick = (brand: Brand) => {
    setBrandToDelete(brand);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;
    
    setIsDeleting(true);
    const success = await deleteBrand(brandToDelete.id);
    setIsDeleting(false);
    
    if (success) {
      setDeleteDialogOpen(false);
      setBrandToDelete(null);
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Brand Management</h1>
          <p className="text-muted-foreground">
            Manage brand modules, assign team members, and configure settings
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add New Brand
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Brand Module</DialogTitle>
              <DialogDescription>
                Create a new brand module to track marketing efforts and results.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input 
                    id="brand-name" 
                    placeholder="Enter brand name" 
                    value={newBrandData.name}
                    onChange={(e) => setNewBrandData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-type">Brand Type</Label>
                  <Select 
                    value={newBrandData.type} 
                    onValueChange={(value: "internal" | "client") => 
                      setNewBrandData(prev => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal Brand</SelectItem>
                      <SelectItem value="client">Client Brand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand-description">Description</Label>
                <Textarea 
                  id="brand-description" 
                  placeholder="Brief description of the brand"
                  value={newBrandData.description}
                  onChange={(e) => setNewBrandData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-owner">Brand Owner</Label>
                  <Select 
                    value={newBrandData.owner_id} 
                    onValueChange={(value) => 
                      setNewBrandData(prev => ({ ...prev, owner_id: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(user => user.role === 'manager' || user.role === 'super_admin').map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name && user.last_name 
                            ? `${user.first_name} ${user.last_name}` 
                            : user.email
                          }
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-budget">Monthly Budget ($)</Label>
                  <Input 
                    id="monthly-budget" 
                    type="number" 
                    placeholder="0"
                    value={newBrandData.monthly_budget || ""}
                    onChange={(e) => setNewBrandData(prev => ({ 
                      ...prev, 
                      monthly_budget: e.target.value ? Number(e.target.value) : undefined 
                    }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateBrand}
                disabled={isCreating || !newBrandData.name || !newBrandData.description || !newBrandData.owner_id}
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Brand
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              resetEditState();
            } else {
              setIsEditDialogOpen(true);
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Brand</DialogTitle>
              <DialogDescription>
                Update brand details to keep information accurate across the team.
              </DialogDescription>
            </DialogHeader>
            {editBrandData && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-brand-name">Brand Name</Label>
                    <Input
                      id="edit-brand-name"
                      placeholder="Enter brand name"
                      value={editBrandData.name}
                      onChange={(e) =>
                        setEditBrandData(prev => prev ? { ...prev, name: e.target.value } : prev)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-brand-type">Brand Type</Label>
                    <Select
                      value={editBrandData.type}
                      onValueChange={(value: "internal" | "client") =>
                        setEditBrandData(prev => prev ? { ...prev, type: value } : prev)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal Brand</SelectItem>
                        <SelectItem value="client">Client Brand</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-brand-description">Description</Label>
                  <Textarea
                    id="edit-brand-description"
                    placeholder="Brief description of the brand"
                    value={editBrandData.description}
                    onChange={(e) =>
                      setEditBrandData(prev => prev ? { ...prev, description: e.target.value } : prev)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-brand-owner">Brand Owner</Label>
                    <Select
                      value={editBrandData.owner_id}
                      onValueChange={(value) =>
                        setEditBrandData(prev => prev ? { ...prev, owner_id: value } : prev)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter(user => user.role === "manager" || user.role === "super_admin")
                          .map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name && user.last_name
                                ? `${user.first_name} ${user.last_name}`
                                : user.email
                              }
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-monthly-budget">Monthly Budget ($)</Label>
                    <Input
                      id="edit-monthly-budget"
                      type="number"
                      placeholder="0"
                      value={editBrandData.monthly_budget ?? ""}
                      onChange={(e) =>
                        setEditBrandData(prev => prev ? {
                          ...prev,
                          monthly_budget: e.target.value ? Number(e.target.value) : undefined
                        } : prev)
                      }
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetEditState}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateBrand}
                disabled={
                  isUpdating ||
                  !editBrandData?.name ||
                  !editBrandData?.description ||
                  !editBrandData?.owner_id
                }
              >
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search brands or owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterType} onValueChange={(value: "all" | "internal" | "client") => setFilterType(value)}>
          <SelectTrigger className="w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
            <SelectItem value="client">Client</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Brand</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{brandToDelete?.name}</strong>? 
              This action cannot be undone and will remove all associated KPIs and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Brand
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Brand Cards Grid */}
      {!loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredBrands.map((brand) => {
          const stats = getBrandStats(brand);
          
          return (
            <Card key={brand.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle 
                      className="text-lg cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/brands/${brand.slug || brand.id}`)}
                    >
                      {brand.name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {brand.description}
                    </CardDescription>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/brands/${brand.slug || brand.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEditDialog(brand)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Brand
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Team
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Plug className="mr-2 h-4 w-4" />
                        Integrations
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDeleteClick(brand)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Brand
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex gap-2 mt-2">
                  <Badge variant={brand.type === 'internal' ? 'default' : 'secondary'}>
                    {brand.type}
                  </Badge>
                  <Badge variant={brand.is_active ? 'default' : 'destructive'}>
                    {brand.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    KPI Score: {stats.achievementRate}%
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Owner Info */}
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">
                      {(brand.owner_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{brand.owner_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">Brand Owner</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-lg font-bold text-foreground">{brand.team_members?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Team</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{brand.active_integrations?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">Integrations</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{brand.kpis?.length || 0}</div>
                    <div className="text-xs text-muted-foreground">KPIs</div>
                  </div>
                </div>

                {/* Budget */}
                {brand.monthly_budget && (
                  <div className="flex items-center justify-between p-2 bg-accent/10 rounded-md">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Monthly Budget</span>
                    </div>
                    <span className="text-sm font-bold text-success">
                      ${brand.monthly_budget.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Recent KPIs */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-foreground">Recent KPIs</h4>
                  <div className="space-y-1">
                    {brand.kpis && brand.kpis.length > 0 ? (
                      brand.kpis.slice(0, 2).map((kpi) => (
                        <div key={kpi.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{kpi.name}</span>
                          <span className="font-medium">
                            {kpi.type === 'currency' ? '$' : ''}
                            {kpi.current_value.toLocaleString()}
                            {kpi.type === 'percentage' ? '%' : ''}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No KPIs configured</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {filteredBrands.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No brands found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || filterType !== "all" 
                ? "Try adjusting your search or filter criteria"
                : "Get started by creating your first brand module"
              }
            </p>
            {!searchTerm && filterType === "all" && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add First Brand
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BrandManagement;
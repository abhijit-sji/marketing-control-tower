import { useState } from "react";
import { Plus, Pencil, Trash2, FolderOpen, Package, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Switch } from "@/components/ui/switch";
import {
  useServiceCategories,
  useServices,
  useDeleteServiceCategory,
  useDeleteService,
  useUpdateServiceCategory,
  useUpdateService,
} from "@/hooks/useQuoteBuilder";
import type { ServiceCategory, Service } from "@/types/quote-builder";
import { ServiceCategoryDialog } from "@/components/quotes/ServiceCategoryDialog";
import { ServiceFormDialog } from "@/components/quotes/ServiceFormDialog";

export default function ServiceCatalogPage() {
  const [activeTab, setActiveTab] = useState("services");
  const [showInactive, setShowInactive] = useState(false);

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  // Service dialog state
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  // Queries
  const { data: categories, isLoading: categoriesLoading } = useServiceCategories(showInactive);
  const { data: services, isLoading: servicesLoading } = useServices(showInactive);

  // Mutations
  const deleteCategory = useDeleteServiceCategory();
  const deleteService = useDeleteService();
  const updateCategory = useUpdateServiceCategory();
  const updateService = useUpdateService();

  const handleEditCategory = (category: ServiceCategory) => {
    setEditingCategory(category);
    setIsCategoryDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setIsServiceDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (deletingCategoryId) {
      await deleteCategory.mutateAsync(deletingCategoryId);
      setDeletingCategoryId(null);
    }
  };

  const handleDeleteService = async () => {
    if (deletingServiceId) {
      await deleteService.mutateAsync(deletingServiceId);
      setDeletingServiceId(null);
    }
  };

  const handleToggleCategoryActive = async (category: ServiceCategory) => {
    await updateCategory.mutateAsync({
      id: category.id,
      updates: { is_active: !category.is_active },
    });
  };

  const handleToggleServiceActive = async (service: Service) => {
    await updateService.mutateAsync({
      id: service.id,
      updates: { is_active: !service.is_active },
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId || !categories) return "Uncategorized";
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || "Uncategorized";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Service Catalog</h1>
          <p className="text-muted-foreground">
            Manage services and categories for quote generation
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <label htmlFor="show-inactive" className="text-sm text-muted-foreground">
              Show inactive
            </label>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Services ({services?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Categories ({categories?.length || 0})
            </TabsTrigger>
          </TabsList>

          {activeTab === "services" ? (
            <Button onClick={() => { setEditingService(null); setIsServiceDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          ) : (
            <Button onClick={() => { setEditingCategory(null); setIsCategoryDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          )}
        </div>

        {/* Services Tab */}
        <TabsContent value="services" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>
                Define services with pricing, effort hours, and requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              {servicesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading services...</div>
              ) : services && services.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Base Price</TableHead>
                      <TableHead className="text-right">Effort (hrs)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{service.name}</p>
                            {service.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {service.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getCategoryName(service.category_id)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(service.base_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {service.effort_hours}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleServiceActive(service)}
                            className="flex items-center gap-1"
                            disabled={updateService.isPending}
                          >
                            {service.is_active ? (
                              <>
                                <ToggleRight className="h-5 w-5 text-green-500" />
                                <span className="text-sm text-green-600">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-5 w-5 text-gray-400" />
                                <span className="text-sm text-gray-500">Inactive</span>
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditService(service)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingServiceId(service.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No services yet</p>
                  <Button onClick={() => { setEditingService(null); setIsServiceDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Service
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>
                Organize services into categories for easier navigation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
              ) : categories && categories.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead className="text-right">Sort Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{category.name}</p>
                            {category.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {category.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {category.slug}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {category.sort_order}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => handleToggleCategoryActive(category)}
                            className="flex items-center gap-1"
                            disabled={updateCategory.isPending}
                          >
                            {category.is_active ? (
                              <>
                                <ToggleRight className="h-5 w-5 text-green-500" />
                                <span className="text-sm text-green-600">Active</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-5 w-5 text-gray-400" />
                                <span className="text-sm text-gray-500">Inactive</span>
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingCategoryId(category.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No categories yet</p>
                  <Button onClick={() => { setEditingCategory(null); setIsCategoryDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Category
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <ServiceCategoryDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        category={editingCategory}
        onSuccess={() => {
          setIsCategoryDialogOpen(false);
          setEditingCategory(null);
        }}
      />

      {/* Service Dialog */}
      <ServiceFormDialog
        open={isServiceDialogOpen}
        onOpenChange={setIsServiceDialogOpen}
        service={editingService}
        categories={categories || []}
        onSuccess={() => {
          setIsServiceDialogOpen(false);
          setEditingService(null);
        }}
      />

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deletingCategoryId} onOpenChange={() => setDeletingCategoryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? Services in this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Confirmation */}
      <AlertDialog open={!!deletingServiceId} onOpenChange={() => setDeletingServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this service? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteService}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

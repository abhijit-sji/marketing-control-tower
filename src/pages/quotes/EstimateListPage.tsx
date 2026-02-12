import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Copy,
  Pencil,
  Eye,
  Trash2,
  FileText,
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import {
  useEstimates,
  useEstimateTemplates,
  useDeleteEstimate,
  useDuplicateEstimate,
} from "@/hooks/useQuoteBuilder";
import type { Estimate, EstimateStatus } from "@/types/quote-builder";
import { LoadTemplateDialog } from "@/components/quotes/LoadTemplateDialog";

export default function EstimateListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);

  const { data: estimates, isLoading: estimatesLoading } = useEstimates(false);
  const { data: templates } = useEstimateTemplates();
  const deleteEstimate = useDeleteEstimate();
  const duplicateEstimate = useDuplicateEstimate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: EstimateStatus) => {
    const variants: Record<EstimateStatus, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "secondary",
      sent: "default",
      approved: "default",
      rejected: "destructive",
      archived: "outline",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  const filteredEstimates = estimates?.filter(
    (e) =>
      (e.client_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
      e.project_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (deletingId) {
      await deleteEstimate.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  const handleDuplicate = async (estimateId: string) => {
    const newEstimate = await duplicateEstimate.mutateAsync(estimateId);
    navigate(`/quotes/${newEstimate.id}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quotes & Estimates</h1>
          <p className="text-muted-foreground">
            Create and manage client estimates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search estimates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Button variant="outline" onClick={() => setIsTemplateDialogOpen(true)}>
            <LayoutTemplate className="h-4 w-4 mr-2" />
            From Template
          </Button>
          <Button onClick={() => navigate("/quotes/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Estimate
          </Button>
        </div>
      </div>

      {/* Estimates */}
      <Card>
        <CardHeader>
          <CardTitle>Your Estimates</CardTitle>
          <CardDescription>
            View and manage your saved estimates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estimatesLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading estimates...
            </div>
          ) : filteredEstimates && filteredEstimates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client / Project</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstimates.map((estimate) => (
                  <TableRow key={estimate.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{estimate.project_name}</p>
                        {estimate.client_name && (
                          <p className="text-sm text-muted-foreground">
                            {estimate.client_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(estimate as any).items?.length || 0} items
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {estimate.total_hours}h
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatCurrency(estimate.total_price)}
                      {estimate.billing_type === "monthly" && (
                        <span className="text-xs text-muted-foreground">/mo</span>
                      )}
                      {estimate.billing_type === "hourly" && (
                        <span className="text-xs text-muted-foreground">/hr</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(estimate.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(estimate.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            ...
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(`/quotes/${estimate.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate(`/quotes/${estimate.id}/edit`)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(estimate.id)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletingId(estimate.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "No estimates match your search"
                  : "No estimates yet"}
              </p>
              <Button onClick={() => navigate("/quotes/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Estimate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Load Template Dialog */}
      <LoadTemplateDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        templates={templates || []}
        onSelect={(templateId) => {
          handleDuplicate(templateId);
          setIsTemplateDialogOpen(false);
        }}
        onDelete={(templateId) => {
          deleteEstimate.mutate({ id: templateId, isTemplate: true });
        }}
      />
    </div>
  );
}

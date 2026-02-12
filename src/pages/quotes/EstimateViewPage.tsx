import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  Clock,
  DollarSign,
  FileText,
  User,
  Building2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { format } from "date-fns";
import {
  useEstimate,
  useDeleteEstimate,
  useDuplicateEstimate,
} from "@/hooks/useQuoteBuilder";
import { RequirementsViewDialog } from "@/components/quotes/RequirementsViewDialog";
import type { EstimateStatus, PackageItem } from "@/types/quote-builder";

export default function EstimateViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRequirementsOpen, setIsRequirementsOpen] = useState(false);

  const { data: estimate, isLoading } = useEstimate(id);
  const deleteEstimate = useDeleteEstimate();
  const duplicateEstimate = useDuplicateEstimate();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
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

  const handleDelete = async () => {
    if (id) {
      await deleteEstimate.mutateAsync(id);
      navigate("/quotes");
    }
  };

  const handleDuplicate = async () => {
    if (id) {
      const newEstimate = await duplicateEstimate.mutateAsync(id);
      navigate(`/quotes/${newEstimate.id}/edit`);
    }
  };

  // Convert estimate items to PackageItem format for RequirementsViewDialog
  const packageItems: PackageItem[] = estimate?.items?.map((item, index) => ({
    temp_id: item.id,
    service_id: item.service_id,
    service_name: item.service_name,
    base_price: item.base_price,
    effort_hours: item.effort_hours,
    quantity: item.quantity,
    final_price: item.final_price,
    requirements_html: item.requirements_html,
    sort_order: item.sort_order ?? index,
  })) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading estimate...</p>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-muted-foreground mb-4">Estimate not found</p>
        <Button onClick={() => navigate("/quotes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Estimates
        </Button>
      </div>
    );
  }

  const items = estimate.items || [];
  const hasRequirements = items.some((item) => item.requirements_html?.trim());

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/quotes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{estimate.project_name}</h1>
            <p className="text-muted-foreground">{estimate.client_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasRequirements && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRequirementsOpen(true)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Requirements
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDuplicate}
            disabled={duplicateEstimate.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/quotes/${id}/edit`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{estimate.client_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="font-medium">{estimate.total_hours}h</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total {estimate.billing_type === "monthly" ? "(Monthly)" : estimate.billing_type === "hourly" ? "(Hourly)" : ""}
                </p>
                <p className="font-medium text-primary">
                  {formatCurrency(estimate.total_price)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {format(new Date(estimate.created_at), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              {getStatusBadge(estimate.status)}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Billing:</span>
              <Badge variant="outline">
                {estimate.billing_type === "monthly"
                  ? "Monthly Retainer"
                  : estimate.billing_type === "hourly"
                    ? "Hourly"
                    : "One-Time"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Table */}
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.service_name}</TableCell>
                  <TableCell className="text-right">{item.effort_hours}h</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.final_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.final_price * item.quantity)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell colSpan={2}>Totals</TableCell>
                <TableCell className="text-right">{estimate.total_hours}h</TableCell>
                <TableCell colSpan={2} className="text-right text-primary">
                  {formatCurrency(estimate.total_price)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Notes */}
      {estimate.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {estimate.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Requirements Dialog */}
      <RequirementsViewDialog
        open={isRequirementsOpen}
        onOpenChange={setIsRequirementsOpen}
        items={packageItems}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Estimate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this estimate? This action cannot be undone.
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
    </div>
  );
}

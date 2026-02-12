import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateService,
  useUpdateService,
  generateSlug,
} from "@/hooks/useQuoteBuilder";
import type { Service, ServiceCategory, ServiceFormData } from "@/types/quote-builder";
import { RichTextEditor } from "@/components/quotes/RichTextEditor";

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  categories: ServiceCategory[];
  onSuccess: () => void;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  categories,
  onSuccess,
}: ServiceFormDialogProps) {
  const createService = useCreateService();
  const updateService = useUpdateService();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<ServiceFormData>({
    defaultValues: {
      category_id: null,
      name: "",
      slug: "",
      description: "",
      requirements_html: "",
      base_price: 0,
      effort_hours: 0,
      is_active: true,
      sort_order: 0,
    },
  });

  const nameValue = watch("name");

  // Auto-generate slug from name
  useEffect(() => {
    if (!service && nameValue) {
      setValue("slug", generateSlug(nameValue));
    }
  }, [nameValue, service, setValue]);

  // Reset form when dialog opens/closes or service changes
  useEffect(() => {
    if (open) {
      if (service) {
        reset({
          category_id: service.category_id,
          name: service.name,
          slug: service.slug,
          description: service.description || "",
          requirements_html: service.requirements_html || "",
          base_price: service.base_price,
          effort_hours: service.effort_hours,
          is_active: service.is_active,
          sort_order: service.sort_order,
        });
      } else {
        reset({
          category_id: null,
          name: "",
          slug: "",
          description: "",
          requirements_html: "",
          base_price: 0,
          effort_hours: 0,
          is_active: true,
          sort_order: 0,
        });
      }
    }
  }, [open, service, reset]);

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (service) {
        await updateService.mutateAsync({
          id: service.id,
          updates: data,
        });
      } else {
        await createService.mutateAsync(data);
      }
      onSuccess();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isPending = createService.isPending || updateService.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {service ? "Edit Service" : "Create Service"}
          </DialogTitle>
          <DialogDescription>
            {service
              ? "Update the service details"
              : "Add a new service to the catalog"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
                placeholder="e.g., Custom Website Design"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                {...register("slug", { required: "Slug is required" })}
                placeholder="e.g., custom-website-design"
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || "uncategorized"}
                  onValueChange={(value) =>
                    field.onChange(value === "uncategorized" ? null : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uncategorized">Uncategorized</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Brief description of this service"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_price">Base Price (USD) *</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                min="0"
                {...register("base_price", {
                  required: "Base price is required",
                  valueAsNumber: true,
                  min: { value: 0, message: "Price must be positive" },
                })}
                placeholder="0.00"
              />
              {errors.base_price && (
                <p className="text-sm text-destructive">{errors.base_price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="effort_hours">Effort Hours *</Label>
              <Input
                id="effort_hours"
                type="number"
                step="0.5"
                min="0"
                {...register("effort_hours", {
                  required: "Effort hours is required",
                  valueAsNumber: true,
                  min: { value: 0, message: "Hours must be positive" },
                })}
                placeholder="0"
              />
              {errors.effort_hours && (
                <p className="text-sm text-destructive">{errors.effort_hours.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Requirements</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Add requirements or prerequisites for this service. This will be included in the estimate.
            </p>
            <Controller
              name="requirements_html"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  content={field.value}
                  onChange={field.onChange}
                  placeholder="List the requirements, deliverables, or prerequisites..."
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                {...register("sort_order", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            <div className="flex items-center justify-between pt-8">
              <Label htmlFor="is_active">Active</Label>
              <Switch
                id="is_active"
                checked={watch("is_active")}
                onCheckedChange={(checked) => setValue("is_active", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : service ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

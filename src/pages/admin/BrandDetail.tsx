import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Edit3, Loader2, X, ListTodo, Settings, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleAnalyticsConfig } from "@/components/brands/GoogleAnalyticsConfig";
import { N8nAnalyticsPanel } from "@/components/brands/N8nAnalyticsPanel";
import { BrandTasksTab } from "@/components/brands/BrandTasksTab";

interface ApiBrand {
  id: string;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  ownerId?: string | null;
  owner_id?: string | null;
  ownerName?: string | null;
  owner_name?: string | null;
  ownerInitials?: string | null;
  owner_initials?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
  last_updated_at?: string | null;
}

interface ApiBrandOwner {
  id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  initials?: string | null;
  email?: string | null;
}

interface BrandFormState {
  name: string;
  description: string;
  type: string;
  status: string;
  ownerId: string;
}

interface NormalizedBrand {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  status: string;
  ownerId: string;
  ownerName: string;
  ownerInitials: string;
  createdAt?: string;
  updatedAt?: string;
}

interface NormalizedOwner {
  id: string;
  name: string;
  initials: string;
}

interface UpdateBrandPayload {
  name: string;
  description: string;
  type: string;
  status: string;
  ownerId: string;
}

const STATUS_OPTIONS = ["active", "inactive", "pending", "archived"];
const TYPE_OPTIONS = ["internal", "external", "client"];
const DESCRIPTION_LIMIT = 300;

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatDateTime = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const datePart = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${datePart} at ${timePart}`;
};

const toTitleCase = (value?: string) => {
  if (!value) return "";
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const buildInitials = (value?: string | null) => {
  if (!value) return "";
  const matches = value
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase())
    .filter(Boolean);

  return matches.slice(0, 2).join("");
};

const BrandDetail = () => {
  const { brandSlug } = useParams<{ brandSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Helper to check if string is a valid UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const canEdit = useMemo(() => {
    if (!user) return false;
    const role = user.role as string;
    return role === "super_admin" || role === "manager" || role === "brand_manager";
  }, [user]);

  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<BrandFormState | null>(null);

  const {
    data: brand,
    isLoading: brandLoading,
    isError: brandError,
    error,
  } = useQuery<ApiBrand>({
    queryKey: ["brand", brandSlug],
    enabled: Boolean(brandSlug),
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      // Determine if we're querying by UUID (backward compatibility) or slug
      const queryParam = isUUID(brandSlug || '') ? 'id' : 'slug';
      const queryValue = brandSlug;

      // Construct the URL with query parameters
      const SUPABASE_URL = 'https://fzknasqrludvoyxdzbxl.supabase.co';
      const functionUrl = `${SUPABASE_URL}/functions/v1/admin-brands?${queryParam}=${encodeURIComponent(queryValue)}`;
      
      const fetchResponse = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
          apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6a25hc3FybHVkdm95eGR6YnhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NjgzNDQsImV4cCI6MjA3NDI0NDM0NH0.dY6cDep2gXHzCz4SVD2741oupXjjzMSyIcmSn8HsigI',
        },
      });

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'Failed to fetch brand');
        } catch {
          throw new Error('Failed to fetch brand');
        }
      }

      const brandData = await fetchResponse.json();
      return brandData as ApiBrand;
    },
  });

  const { data: owners, isLoading: ownersLoading } = useQuery<ApiBrandOwner[]>({
    queryKey: ["brand-owners"],
    queryFn: async () => {
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name');

      if (usersError) {
        throw new Error(usersError.message || 'Failed to fetch users');
      }

      // Fetch roles for users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', usersData?.map(u => u.id) || [])
        .in('role', ['super_admin', 'manager']);

      if (rolesError) {
        throw new Error(rolesError.message || 'Failed to fetch roles');
      }

      // Filter users who have admin or manager roles
      const adminUserIds = rolesData?.map(r => r.user_id) || [];
      const data = usersData?.filter(u => adminUserIds.includes(u.id)) || [];

      return data.map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name
      }));
    },
  });

  const normalizedBrand = useMemo<NormalizedBrand | null>(() => {
    if (!brand) return null;

    const ownerId = brand.ownerId ?? brand.owner_id ?? "";
    const ownerName = brand.ownerName ?? brand.owner_name ?? "";
    const ownerInitials =
      brand.ownerInitials ?? brand.owner_initials ?? buildInitials(ownerName);

    return {
      id: brand.id,
      slug: brand.slug?.trim() ?? "",
      name: brand.name?.trim() ?? "",
      description: brand.description?.trim() ?? "",
      type: brand.type?.toLowerCase() ?? "internal",
      status: brand.status?.toLowerCase() ?? "active",
      ownerId,
      ownerName: ownerName.trim(),
      ownerInitials,
      createdAt: brand.createdAt ?? brand.created_at ?? undefined,
      updatedAt: brand.updatedAt ?? brand.updated_at ?? brand.last_updated_at ?? undefined,
    };
  }, [brand]);

  useEffect(() => {
    if (normalizedBrand) {
      setFormState({
        name: normalizedBrand.name,
        description: normalizedBrand.description,
        type: normalizedBrand.type,
        status: normalizedBrand.status,
        ownerId: normalizedBrand.ownerId,
      });
    }
  }, [normalizedBrand]);

  const normalizedOwners = useMemo<NormalizedOwner[]>(() => {
    const mapped = (owners ?? []).map<NormalizedOwner>((owner) => {
      const fullName = owner.name?.trim()
        || `${owner.first_name ?? ""} ${owner.last_name ?? ""}`.trim()
        || owner.email?.trim()
        || "Unnamed Owner";
      const initials = owner.initials?.trim() || buildInitials(fullName);

      return {
        id: owner.id,
        name: fullName,
        initials,
      };
    });

    if (normalizedBrand?.ownerId) {
      const exists = mapped.some((owner) => owner.id === normalizedBrand.ownerId);
      if (!exists) {
        const fallbackName =
          normalizedBrand.ownerName || "Current Owner";
        mapped.push({
          id: normalizedBrand.ownerId,
          name: fallbackName,
          initials: normalizedBrand.ownerInitials || buildInitials(fallbackName),
        });
      }
    }

    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  }, [owners, normalizedBrand]);

  const updateBrandMutation = useMutation({
    mutationFn: async (payload: UpdateBrandPayload) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        throw new Error('No valid session');
      }

      // Use brand.id for update, not the slug
      const response = await supabase.functions.invoke(`admin-brands?id=${brand?.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
        body: {
          name: payload.name,
          description: payload.description,
          type: payload.type,
          owner_id: payload.ownerId,
          is_active: payload.status === 'active',
          status: payload.status,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update brand');
      }

      return response.data as ApiBrand;
    },
    onSuccess: (updatedBrand) => {
      queryClient.setQueryData(["brand", brandSlug], updatedBrand);
      setIsEditing(false);
      toast.success("Brand updated successfully");
    },
    onError: (mutationError: unknown) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to update brand";
      toast.error(message);
    },
  });

  const handleFieldChange = <Key extends keyof BrandFormState>(
    key: Key,
    value: BrandFormState[Key]
  ) => {
    setFormState((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleCancel = () => {
    if (normalizedBrand) {
      setFormState({
        name: normalizedBrand.name,
        description: normalizedBrand.description,
        type: normalizedBrand.type,
        status: normalizedBrand.status,
        ownerId: normalizedBrand.ownerId,
      });
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!formState || !normalizedBrand) {
      return;
    }

    const trimmedName = formState.name.trim();
    const trimmedDescription = formState.description.trim();

    if (!trimmedName) {
      toast.error("Brand name is required");
      return;
    }

    if (!formState.ownerId) {
      toast.error("Brand owner is required");
      return;
    }

    if (trimmedDescription.length > DESCRIPTION_LIMIT) {
      toast.error(`Description must be ${DESCRIPTION_LIMIT} characters or less`);
      return;
    }

    const payload: UpdateBrandPayload = {
      name: trimmedName,
      description: trimmedDescription,
      type: formState.type,
      status: formState.status,
      ownerId: formState.ownerId,
    };

    const hasChanges =
      trimmedName !== normalizedBrand.name ||
      trimmedDescription !== normalizedBrand.description ||
      formState.type !== normalizedBrand.type ||
      formState.status !== normalizedBrand.status ||
      formState.ownerId !== normalizedBrand.ownerId;

    if (!hasChanges) {
      toast.info("No changes to save");
      setIsEditing(false);
      return;
    }

    updateBrandMutation.mutate(payload);
  };

  useEffect(() => {
    if (!canEdit && isEditing) {
      setIsEditing(false);
    }
  }, [canEdit, isEditing]);

  if (brandLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (brandError) {
    const errorMessage =
      error instanceof Error ? error.message : "Unable to load brand details";
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Brand not available</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/adminpanel/brands")}>Back to Brands</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!normalizedBrand) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Brand not found</CardTitle>
            <CardDescription>
              We couldn't locate the requested brand. It may have been removed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/adminpanel/brands")}>Back to Brands</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const statusVariant =
    normalizedBrand.status === "active"
      ? "default"
      : normalizedBrand.status === "inactive"
        ? "destructive"
        : "secondary";

  const descriptionLength = formState?.description.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {normalizedBrand.name || "Brand details"}
            </h1>
            <p className="text-sm text-muted-foreground">
              View and manage core brand information.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {toTitleCase(normalizedBrand.type)}
          </Badge>
          <Badge variant={statusVariant} className="capitalize">
            {toTitleCase(normalizedBrand.status)}
          </Badge>
          {normalizedBrand.slug && (
            <Button asChild variant="outline">
              <Link
                to={`/brands/${normalizedBrand.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View Public Page
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-6">
        <TabsList>
          <TabsTrigger value="details" className="gap-2">
            <Settings className="h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand information</CardTitle>
              <CardDescription>
                Keep the brand profile up to date for your team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">Brand Name</Label>
                  <Input
                    id="brand-name"
                    value={formState?.name ?? ""}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                    disabled={!isEditing || !canEdit || updateBrandMutation.isPending}
                    placeholder="Enter brand name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-type">Type</Label>
                  <Select
                    value={formState?.type || undefined}
                    onValueChange={(value) => handleFieldChange("type", value)}
                    disabled={!isEditing || !canEdit || updateBrandMutation.isPending}
                  >
                    <SelectTrigger id="brand-type">
                      <SelectValue placeholder="Select brand type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {toTitleCase(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-status">Status</Label>
                  <Select
                    value={formState?.status || undefined}
                    onValueChange={(value) => handleFieldChange("status", value)}
                    disabled={!isEditing || !canEdit || updateBrandMutation.isPending}
                  >
                    <SelectTrigger id="brand-status">
                      <SelectValue placeholder="Select brand status" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {toTitleCase(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-owner">Brand Owner</Label>
                  <Select
                    value={formState?.ownerId || undefined}
                    onValueChange={(value) => handleFieldChange("ownerId", value)}
                    disabled={
                      !isEditing ||
                      !canEdit ||
                      ownersLoading ||
                      updateBrandMutation.isPending
                    }
                  >
                    <SelectTrigger id="brand-owner">
                      <SelectValue placeholder="Select brand owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {normalizedOwners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.initials ? `${owner.initials} · ${owner.name}` : owner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!canEdit && (
                    <p className="text-xs text-muted-foreground">
                      Editing requires admin or brand manager access.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-description">Description</Label>
                <Textarea
                  id="brand-description"
                  value={formState?.description ?? ""}
                  onChange={(event) => handleFieldChange("description", event.target.value)}
                  disabled={!isEditing || !canEdit || updateBrandMutation.isPending}
                  placeholder="Provide a concise brand overview"
                  maxLength={DESCRIPTION_LIMIT}
                  rows={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Maximum {DESCRIPTION_LIMIT} characters.</span>
                  <span>{descriptionLength}/{DESCRIPTION_LIMIT}</span>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Created</Label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(normalizedBrand.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Owner</Label>
                  <p className="text-sm text-muted-foreground">
                    {normalizedBrand.ownerInitials
                      ? `${normalizedBrand.ownerInitials} · ${normalizedBrand.ownerName || "Unassigned"}`
                      : normalizedBrand.ownerName || "Unassigned"}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t border-border bg-muted/30 py-6 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                Last updated {formatDateTime(normalizedBrand.updatedAt)}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        onClick={handleSave}
                        disabled={updateBrandMutation.isPending}
                      >
                        {updateBrandMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateBrandMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit brand
                    </Button>
                  )}
                </div>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <BrandTasksTab brandId={normalizedBrand.id} brandName={normalizedBrand.name} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <GoogleAnalyticsConfig
            brandId={normalizedBrand.id}
            onConfigured={() => queryClient.invalidateQueries({ queryKey: ["brand", brandSlug] })}
          />

          <N8nAnalyticsPanel brandId={normalizedBrand.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BrandDetail;

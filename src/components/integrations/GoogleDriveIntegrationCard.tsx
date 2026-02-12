import { useCallback, useEffect, useMemo, useState } from "react";
import { Cloud, RefreshCw } from "lucide-react";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { IntegrationForm, type IntegrationFormField } from "@/components/integrations/IntegrationForm";
import type {
  GoogleDriveIntegrationConfig,
  GoogleDriveIntegrationRecord,
  IntegrationStatus,
  OrganizationIntegrationsInsert,
  OrganizationIntegrationsRow,
  OrganizationIntegrationsUpdate,
} from "@/types/integrations";

const googleDriveSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  refreshToken: z.string().min(1, "Refresh Token is required"),
  folderId: z.string().optional(),
});

type SchemaInput = z.input<typeof googleDriveSchema>;
type SchemaOutput = z.output<typeof googleDriveSchema>;

type FieldErrors = Partial<Record<keyof SchemaInput, string>>;

const toIntegrationStatus = (value: string | null | undefined): IntegrationStatus => {
  if (value === "connected" || value === "not_connected") {
    return value;
  }
  return "unknown";
};

const defaultConfig: GoogleDriveIntegrationConfig = {
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  folderId: "",
};

const mapRowToRecord = (row: OrganizationIntegrationsRow): GoogleDriveIntegrationRecord => ({
  id: row.id,
  integration: row.integration,
  config: (row.config as Partial<GoogleDriveIntegrationConfig> | null) ?? null,
  status: row.status,
  last_checked_at: row.last_checked_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const normalizeConfig = (config: GoogleDriveIntegrationConfig): SchemaInput => ({
  clientId: config.clientId.trim(),
  clientSecret: config.clientSecret.trim(),
  refreshToken: config.refreshToken.trim(),
  folderId: config.folderId?.trim() ? config.folderId.trim() : undefined,
});

const parseSupabaseConfig = (config: GoogleDriveIntegrationRecord["config"]): GoogleDriveIntegrationConfig => ({
  clientId: (config?.clientId as string) ?? "",
  clientSecret: (config?.clientSecret as string) ?? "",
  refreshToken: (config?.refreshToken as string) ?? "",
  folderId: (config?.folderId as string) ?? "",
});

type ExtendedDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      organization_integrations: {
        Row: OrganizationIntegrationsRow;
        Insert: OrganizationIntegrationsInsert;
        Update: OrganizationIntegrationsUpdate;
        Relationships: never[];
      };
    };
  };
};

const supabaseWithOrg = supabase as SupabaseClient<ExtendedDatabase>;

const persistIntegration = async (
  integrationId: string | null,
  config: SchemaOutput,
  status: IntegrationStatus,
  lastChecked: string | null,
): Promise<GoogleDriveIntegrationRecord> => {
  const payload = {
    integration: "google_drive",
    config,
    status,
    last_checked_at: lastChecked,
  };

  const supabase: any = supabaseWithOrg;
  
  const query = integrationId
    ? supabase
        .from("organization_integrations")
        .update(payload)
        .eq("id", integrationId)
        .select("id, integration, config, status, last_checked_at, updated_at")
        .single()
    : supabase
        .from("organization_integrations")
        .insert(payload)
        .select("id, integration, config, status, last_checked_at, created_at")
        .single();

  const { data, error } = await query;

  if (error || !data) {
    throw error ?? new Error("Unable to persist Google Drive integration");
  }

  return mapRowToRecord(data);
};

const GoogleDriveIntegrationCard = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<GoogleDriveIntegrationConfig>(defaultConfig);
  const [status, setStatus] = useState<IntegrationStatus>("unknown");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const loadIntegration = useCallback(async (showErrors = false) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabaseWithOrg
        .from("organization_integrations")
        .select("id, integration, config, status, last_checked_at, updated_at")
        .eq("integration", "google_drive")
        .maybeSingle();

      if (error) {
        console.error("Failed to load Google Drive integration", error);
        if (showErrors) {
          toast({
            title: "Unable to load Google Drive settings",
            description: "Check your network connection or refresh the page.",
            variant: "destructive",
          });
        }
        return;
      }

      if (data) {
        const parsed = mapRowToRecord(data);
        setIntegrationId(parsed.id);
        setConfig(parseSupabaseConfig(parsed.config));
        setStatus(toIntegrationStatus(parsed.status));
        setLastChecked(parsed.last_checked_at);
      } else {
        setIntegrationId(null);
        setConfig(defaultConfig);
        setStatus("unknown");
        setLastChecked(null);
      }
    } catch (err) {
      console.error("Error loading Google Drive integration", err);
      if (showErrors) {
        toast({
          title: "Load Error",
          description: "Failed to load Google Drive integration.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  const handleFieldChange = (name: string, value: string) => {
    setConfig((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateConfig = (rawConfig: GoogleDriveIntegrationConfig): SchemaOutput | null => {
    const normalized = normalizeConfig(rawConfig);
    const result = googleDriveSchema.safeParse(normalized);

    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          fieldErrors[field as keyof SchemaInput] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return null;
    }

    setErrors({});
    return result.data;
  };

  const handleSave = async () => {
    const validConfig = validateConfig(config);
    if (!validConfig) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the required Google Drive credentials before saving.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const record = await persistIntegration(integrationId, validConfig, status, lastChecked);
      setIntegrationId(record.id);
      setStatus(toIntegrationStatus(record.status));
      setLastChecked(record.last_checked_at);
      toast({
        title: "Google Drive configuration saved",
        description: "Credentials have been stored securely for the organization.",
      });
    } catch (error) {
      console.error("Failed to save Google Drive configuration", error);
      toast({
        title: "Unable to save configuration",
        description: error instanceof Error ? error.message : "Unexpected error occurred while saving settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const validConfig = validateConfig(config);
    if (!validConfig) {
      toast({
        title: "Missing required fields",
        description: "Please fill in the required Google Drive credentials before testing.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    const timestamp = new Date().toISOString();

    try {
      const { data, error } = await supabase.functions.invoke("test-google-drive", {
        body: {
          clientId: validConfig.clientId,
          clientSecret: validConfig.clientSecret,
          refreshToken: validConfig.refreshToken,
          folderId: validConfig.folderId,
        },
      });

      if (error || !data?.success) {
        setStatus("not_connected");
        setLastChecked(timestamp);
        const record = await persistIntegration(integrationId, validConfig, "not_connected", timestamp);
        setIntegrationId(record.id);
        setStatus(toIntegrationStatus(record.status));
        setLastChecked(record.last_checked_at);
        toast({
          title: "Google Drive test failed",
          description: (error?.message ?? data?.error) || "Unable to verify the provided credentials.",
          variant: "destructive",
        });
        return;
      }

      setStatus("connected");
      setLastChecked(timestamp);
      const record = await persistIntegration(integrationId, validConfig, "connected", timestamp);
      setIntegrationId(record.id);
      setStatus(toIntegrationStatus(record.status));
      setLastChecked(record.last_checked_at);

      toast({
        title: "Google Drive connected",
        description: data.message ?? "The API credentials are valid and accessible.",
      });
    } catch (error) {
      console.error("Google Drive test request failed", error);
      setStatus("not_connected");
      setLastChecked(timestamp);
      const record = await persistIntegration(integrationId, validConfig, "not_connected", timestamp).catch(() => null);
      if (record) {
        setIntegrationId(record.id);
        setStatus(toIntegrationStatus(record.status));
        setLastChecked(record.last_checked_at);
      }
      toast({
        title: "Unable to reach Google Drive",
        description: error instanceof Error ? error.message : "A network error prevented the test from completing.",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const fields: IntegrationFormField[] = useMemo(
    () => [
      {
        name: "clientId",
        label: "Google Client ID",
        value: config.clientId,
        placeholder: "xxxxxxxx.apps.googleusercontent.com",
        required: true,
        error: errors.clientId,
      },
      {
        name: "clientSecret",
        label: "Google Client Secret",
        value: config.clientSecret,
        placeholder: "SuperSecretValue",
        required: true,
        type: "password",
        error: errors.clientSecret,
      },
      {
        name: "refreshToken",
        label: "Refresh Token",
        value: config.refreshToken,
        placeholder: "1//0gabcdef123456",
        required: true,
        error: errors.refreshToken,
      },
      {
        name: "folderId",
        label: "Root Folder ID",
        value: config.folderId ?? "",
        placeholder: "Optional folder ID to limit sync scope",
        description: "Leave blank to use the account root",
        error: errors.folderId,
      },
    ],
    [config, errors],
  );

  const canTest = Boolean(config.clientId && config.clientSecret && config.refreshToken);

  return (
    <IntegrationForm
      icon={<Cloud className="h-6 w-6" />}
      title="Google Drive"
      description="Connect Google Drive to enable document ingestion and knowledge management."
      status={status}
      lastChecked={lastChecked}
      fields={fields}
      onFieldChange={handleFieldChange}
      onSave={handleSave}
      onTest={handleTestConnection}
      isSaving={isSaving}
      isTesting={isTesting}
      disabled={isLoading}
      canTest={canTest}
      footerContent={
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            {status === "connected"
              ? "Credentials verified. Drive sync available for ingestion workflows."
              : "Run a test to verify credentials and enable Drive ingestion."}
          </div>
          <div className="flex flex-col sm:items-end">
            {status === "connected" && lastChecked && (
              <span>Validated {new Date(lastChecked).toLocaleString()}</span>
            )}
          </div>
        </div>
      }
    />
  );
};

export default GoogleDriveIntegrationCard;

export type IntegrationStatus = "connected" | "not_connected" | "unknown";

export interface GoogleDriveIntegrationConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string;
}

export interface GoogleDriveIntegrationRecord {
  id: string;
  integration: string;
  config: Partial<GoogleDriveIntegrationConfig> | null;
  status: string | null;
  last_checked_at: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface OrganizationIntegrationsRow {
  id: string;
  integration: string;
  config: Record<string, unknown> | null;
  status: string | null;
  last_checked_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type OrganizationIntegrationsInsert = Omit<OrganizationIntegrationsRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OrganizationIntegrationsUpdate = Partial<OrganizationIntegrationsRow>;

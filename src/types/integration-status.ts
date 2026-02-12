export interface IntegrationStatus {
  id: string;
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  lastChecked: string | null;
  error?: string;
  hasApiKey?: boolean;
  config?: Record<string, any> | null; // This line is the fix
}

export interface IntegrationHealthResponse {
  integrations: {
    [key: string]: {
      status: "configured" | "not_configured" | "error";
      configured: boolean;
      connected?: boolean;
      error?: string;
      lastChecked?: string;
    };
  };
  timestamp: string;
}

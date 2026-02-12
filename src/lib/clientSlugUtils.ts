import { slugify } from "./slugify";
import { Client } from "@/hooks/useClients";

/**
 * Generates a URL-friendly slug for a client
 * Uses company name if available, otherwise falls back to client name
 */
export function getClientSlug(client: Client): string {
  return slugify(client.company || client.name);
}

/**
 * Generates a client detail URL with the appropriate slug
 */
export function getClientUrl(client: Client): string {
  return `/clients/${getClientSlug(client)}`;
}

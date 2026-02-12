import { slugify } from "./slugify";

export interface ProjectWithSlug {
  id: string;
  name: string;
  [key: string]: any;
}

/**
 * Generates a URL-friendly slug for a project based on project name
 */
export function getProjectSlug(project: ProjectWithSlug): string {
  return slugify(project.name);
}

/**
 * Generates a project detail URL with the appropriate slug
 */
export function getProjectUrl(project: ProjectWithSlug, isActiveCollab = false): string {
  const slug = getProjectSlug(project);
  return isActiveCollab ? `/projects/${slug}/details` : `/projects/${slug}`;
}

/**
 * Generates a project knowledge base URL with the appropriate slug
 */
export function getProjectKnowledgeUrl(project: ProjectWithSlug): string {
  return `/projects/${getProjectSlug(project)}/knowledge`;
}

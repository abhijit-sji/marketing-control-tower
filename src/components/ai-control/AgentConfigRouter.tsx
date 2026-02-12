import { LinkedInAgentConfigSection } from "./LinkedInAgentConfigSection";
import { SEOBlogAgentConfigSection } from "./SEOBlogAgentConfigSection";
import { GenericAgentConfig } from "./GenericAgentConfig";

interface AgentConfigRouterProps {
  agent: {
    id: string;
    name: string;
    slug: string;
    category: string;
    config?: Record<string, unknown> | null;
  };
  onClose?: () => void;
}

export function AgentConfigRouter({ agent, onClose }: AgentConfigRouterProps) {
  // Check if this is the LinkedIn content generator
  if (agent.slug === 'linkedin-content-gen' || agent.category === 'content_generation') {
    return <LinkedInAgentConfigSection agentId={agent.id} onClose={onClose} />;
  }

  // Check if this is the SEO Blog Generator
  if (agent.slug === 'seo-blog-generator' || agent.category === 'seo') {
    return <SEOBlogAgentConfigSection agentId={agent.id} onClose={onClose} />;
  }

  // Use generic configuration for all other agents
  return <GenericAgentConfig agentId={agent.id} onClose={onClose} />;
}

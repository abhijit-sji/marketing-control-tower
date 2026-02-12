/**
 * Input validation for reel hook generator
 */

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateInput(input: any): ValidationResult {
  // Required fields
  if (!input.brand_id) {
    return { valid: false, error: "brand_id is required" };
  }

  if (!input.topic || typeof input.topic !== "string" || input.topic.trim().length === 0) {
    return { valid: false, error: "topic is required and must be a non-empty string" };
  }

  if (input.topic.length < 10) {
    return { valid: false, error: "topic must be at least 10 characters (be more specific)" };
  }

  if (!input.target_audience || typeof input.target_audience !== "string" || input.target_audience.trim().length === 0) {
    return { valid: false, error: "target_audience is required and must be a non-empty string" };
  }

  if (input.target_audience.length < 10) {
    return { valid: false, error: "target_audience must be at least 10 characters (be more specific)" };
  }

  if (!input.platform) {
    return { valid: false, error: "platform is required" };
  }

  const validPlatforms = ["instagram", "youtube_shorts", "tiktok", "facebook"];
  if (!validPlatforms.includes(input.platform)) {
    return { valid: false, error: `platform must be one of: ${validPlatforms.join(", ")}` };
  }

  if (!input.primary_goal) {
    return { valid: false, error: "primary_goal is required" };
  }

  const validGoals = ["views", "saves", "follows", "clicks"];
  if (!validGoals.includes(input.primary_goal)) {
    return { valid: false, error: `primary_goal must be one of: ${validGoals.join(", ")}` };
  }

  if (!input.tone || typeof input.tone !== "string" || input.tone.trim().length === 0) {
    return { valid: false, error: "tone is required (e.g., 'bold, direct', 'friendly, casual')" };
  }

  // Optional field validations
  if (input.hook_length) {
    const validLengths = ["short", "medium", "long"];
    if (!validLengths.includes(input.hook_length)) {
      return { valid: false, error: `hook_length must be one of: ${validLengths.join(", ")}` };
    }
  }

  if (input.content_format) {
    const validFormats = ["talking_head", "broll", "text_overlay", "mixed"];
    if (!validFormats.includes(input.content_format)) {
      return { valid: false, error: `content_format must be one of: ${validFormats.join(", ")}` };
    }
  }

  if (input.urgency_level) {
    const validUrgency = ["low", "medium", "high"];
    if (!validUrgency.includes(input.urgency_level)) {
      return { valid: false, error: `urgency_level must be one of: ${validUrgency.join(", ")}` };
    }
  }

  if (input.creator_persona) {
    const validPersonas = ["expert", "peer", "entertainer", "educator"];
    if (!validPersonas.includes(input.creator_persona)) {
      return { valid: false, error: `creator_persona must be one of: ${validPersonas.join(", ")}` };
    }
  }

  return { valid: true };
}

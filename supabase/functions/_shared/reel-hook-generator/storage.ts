/**
 * Database operations for reel hook generator
 */

export async function saveGeneration(
  supabase: any,
  generationId: string,
  data: any
): Promise<void> {
  try {
    const { error } = await supabase
      .from("reel_hook_generations")
      .update(data)
      .eq("id", generationId);

    if (error) {
      console.error("[storage] Failed to update generation:", error);
      throw error;
    }
  } catch (error) {
    console.error("[storage] Error saving generation:", error);
    throw error;
  }
}

export async function createLog(
  supabase: any,
  generationId: string,
  stepName: string,
  attemptNumber: number,
  data: any
): Promise<void> {
  try {
    const logEntry = {
      reel_hook_generation_id: generationId,
      step_name: stepName,
      attempt_number: attemptNumber,
      input_data: data.input_data || {},
      output_data: data.output_data || {},
      model_used: data.model_used,
      tokens_used: data.tokens_used || 0,
      prompt_tokens: data.prompt_tokens || 0,
      completion_tokens: data.completion_tokens || 0,
      execution_time_ms: data.execution_time_ms || 0,
      cost_usd: data.cost_usd || 0,
      status: data.status || "completed",
      error_message: data.error_message,
    };

    const { error } = await supabase
      .from("reel_hook_generation_logs")
      .insert(logEntry);

    if (error) {
      console.error("[storage] Failed to create log:", error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  } catch (error) {
    console.error("[storage] Error creating log:", error);
    // Don't throw
  }
}

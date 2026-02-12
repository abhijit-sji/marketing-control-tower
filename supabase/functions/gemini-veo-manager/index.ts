// Gemini Veo Manager v3.0 - Database persistence
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

console.log("GEMINI_API_KEY loaded:", GEMINI_API_KEY ? "✓ Present" : "✗ Missing");
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "veo-3.0-generate-001";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CreateVideoRequest {
  operation: "create";
  prompt: string;
  duration?: number;
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p";
  negativePrompt?: string;
  imageBase64?: string;
  imageMimeType?: string;
  metadata?: Record<string, unknown>;
}

interface ListVideosRequest {
  operation: "list";
}

interface GetVideoRequest {
  operation: "retrieve";
  id: string;
}

interface DeleteVideoRequest {
  operation: "delete";
  id: string;
}

interface DownloadVideoRequest {
  operation: "content";
  id: string;
}

interface RemixVideoRequest {
  operation: "remix";
  id: string;
  prompt: string;
}

type RequestBody =
  | CreateVideoRequest
  | ListVideosRequest
  | GetVideoRequest
  | DeleteVideoRequest
  | DownloadVideoRequest
  | RemixVideoRequest;

async function pollOperation(operationName: string): Promise<any> {
  const maxAttempts = 40; // Up to 10 minutes with exponential backoff
  let attempts = 0;
  let delay = 5000; // Start with 5 seconds

  while (attempts < maxAttempts) {
    const response = await fetch(`${BASE_URL}/${operationName}`, {
      headers: {
        "x-goog-api-key": GEMINI_API_KEY!,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error polling operation:", error);
      throw new Error(`Failed to poll operation: ${error}`);
    }

    const operation = await response.json();
    
    if (operation.done) {
      return operation;
    }

    attempts++;
    console.log(`Polling attempt ${attempts}/${maxAttempts}, waiting ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    // Exponential backoff: 5s -> 10s -> 20s -> 30s (max)
    delay = Math.min(delay * 2, 30000);
  }

  throw new Error("Video generation timeout - exceeded 10 minutes");
}

async function createVideo(
  prompt: string,
  userId: string,
  duration?: number,
  aspectRatio?: "16:9" | "9:16",
  resolution?: "720p" | "1080p",
  negativePrompt?: string,
  imageBase64?: string,
  imageMimeType?: string,
  metadata?: Record<string, unknown>
): Promise<any> {
  try {
    console.log("🎬 Creating video with prompt:", prompt?.substring(0, 50));
    console.log("Parameters:", { 
      userId: userId?.substring(0, 8),
      duration, 
      aspectRatio, 
      resolution, 
      negativePrompt: negativePrompt?.substring(0, 30),
      hasImage: !!imageBase64,
      metadataKeys: Object.keys(metadata || {})
    });

    // Build request body according to Veo 3 API spec
    const requestBody: any = {
      prompt: prompt,
      personGeneration: "allow_adult", // Required for EU compliance
    };

    // Add optional parameters
    if (duration && duration >= 5 && duration <= 8) {
      requestBody.duration = duration;
    }
    
    if (aspectRatio) {
      requestBody.aspectRatio = aspectRatio;
    }
    
    if (resolution) {
      requestBody.resolution = resolution;
    }
    
    if (negativePrompt) {
      requestBody.negativePrompt = negativePrompt;
    }

    // Add image for image-to-video generation
    if (imageBase64 && imageMimeType) {
      console.log("Adding image for image-to-video generation, mime type:", imageMimeType);
      requestBody.image = {
        bytesBase64Encoded: imageBase64,
        mimeType: imageMimeType,
      };
    }


    console.log("📤 Sending request to Gemini API:", `${BASE_URL}/models/${MODEL}:generateVideos`);

    const response = await fetch(`${BASE_URL}/models/${MODEL}:generateVideos`, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Gemini API error:", errorText);
      
      // Parse error for better user messaging
      let errorMessage = "Failed to create video";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
        
        // Check for specific error types
        if (errorMessage.includes("quota") || errorMessage.includes("QUOTA")) {
          errorMessage = "API quota exceeded. Please try again later or check your Gemini API limits.";
        } else if (errorMessage.includes("safety") || errorMessage.includes("blocked")) {
          errorMessage = "Content blocked by safety filters. Please revise your prompt and try again.";
        } else if (errorMessage.includes("audio") || errorMessage.includes("Audio")) {
          errorMessage = "Audio content flagged. Veo 3 detected potentially unsafe audio. Please revise your prompt.";
        }
      } catch {
        errorMessage = errorText.substring(0, 200);
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    const operationName = result.name;
    
    // Store operation in database
    const videoId = operationName.split("/").pop() || operationName;
    
    const { error: dbError } = await supabase
      .from("gemini_videos")
      .insert({
        id: videoId,
        operation_name: operationName,
        prompt,
        duration: duration || 8,
        aspect_ratio: aspectRatio || "16:9",
        resolution: resolution || "720p",
        negative_prompt: negativePrompt,
        status: "processing",
        metadata: metadata || {},
        user_id: userId,
      });

    if (dbError) {
      console.error("❌ Database error:", dbError);
      throw new Error(`Failed to store video: ${dbError.message}`);
    }

    console.log("✅ Video creation started, operation name:", operationName);
    console.log("Video ID:", videoId, "| Duration:", duration, "| Aspect:", aspectRatio, "| Resolution:", resolution);

    // Return complete video object matching database structure
    return {
      id: videoId,
      operation_name: operationName,
      prompt,
      duration: duration || 8,
      aspect_ratio: aspectRatio || "16:9",
      resolution: resolution || "720p",
      negative_prompt: negativePrompt,
      status: "processing",  // Will be normalized to "in_progress" by frontend
      has_audio: true,
      created_at: new Date().toISOString(),
      metadata: metadata || {},
    };
  } catch (error) {
    console.error("❌ Error in createVideo:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      promptLength: prompt?.length
    });
    throw error;
  }
}

// Convert gs:// URI to downloadable HTTP URL using Gemini Files API
async function convertGsUriToDownloadUrl(gsUri: string): Promise<string> {
  // Extract file name from gs:// URI (format: gs://bucket/path/filename)
  const fileName = gsUri.split('/').pop();
  if (!fileName) {
    throw new Error("Invalid gs:// URI format");
  }

  // Use Gemini Files API to get download URL
  const response = await fetch(`${BASE_URL}/files/${fileName}`, {
    headers: {
      "x-goog-api-key": GEMINI_API_KEY!,
    },
  });

  if (!response.ok) {
    console.error("Failed to convert gs:// URI:", await response.text());
    // Fallback: return original URI with direct download query
    return `${gsUri}?alt=media`;
  }

  const fileData = await response.json();
  return fileData.uri || `${gsUri}?alt=media`;
}

async function getVideo(id: string): Promise<any> {
  // Get video from database
  const { data: videoData, error: dbError } = await supabase
    .from("gemini_videos")
    .select("*")
    .eq("id", id)
    .single();
  
  if (dbError || !videoData) {
    throw new Error("Video not found");
  }

  // Check if video is still processing
  if (videoData.status === "processing") {
    const response = await fetch(`${BASE_URL}/${videoData.operation_name}`, {
      headers: {
        "x-goog-api-key": GEMINI_API_KEY!,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Error getting video status:", error);
      
      // Parse error for better messaging
      let errorMessage = "Failed to get video status";
      try {
        const errorJson = JSON.parse(error);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        errorMessage = error.substring(0, 200);
      }
      
      throw new Error(errorMessage);
    }

    const operation = await response.json();
    
    if (operation.done) {
      // Extract video URI from correct Veo 3 response path
      const videoUri = operation.response?.generated_videos?.[0]?.video?.uri;
      
      // Convert gs:// URI to downloadable URL if needed
      let downloadUrl = videoUri;
      if (videoUri?.startsWith('gs://')) {
        try {
          downloadUrl = await convertGsUriToDownloadUrl(videoUri);
          console.log("Converted gs:// URI to download URL:", downloadUrl);
        } catch (error) {
          console.error("Failed to convert URI, using original:", error);
        }
      }
      
      // Update database
      await supabase
        .from("gemini_videos")
        .update({
          status: "completed",
          video_url: downloadUrl,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      videoData.status = "completed";
      videoData.video_url = downloadUrl;
      videoData.completed_at = new Date().toISOString();
    } else if (operation.error) {
      // Parse error for better messaging
      const errorDetails = operation.error;
      let errorMessage = errorDetails.message || "Video generation failed";
      
      // Check for specific error types
      if (errorMessage.includes("audio") || errorMessage.includes("Audio")) {
        errorMessage = "Audio content blocked - Veo 3 detected unsafe audio in your prompt. Please revise and try again.";
      }
      
      console.error("Video generation error:", errorDetails);
      
      // Update database
      await supabase
        .from("gemini_videos")
        .update({
          status: "failed",
          error: { message: errorMessage, details: errorDetails },
        })
        .eq("id", id);
      
      videoData.status = "failed";
      videoData.error = { message: errorMessage, details: errorDetails };
    }
  }

  return videoData;
}

async function listVideos(userId: string): Promise<any[]> {
  // Get all videos for user from database
  const { data: videos, error: dbError } = await supabase
    .from("gemini_videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  if (dbError) {
    console.error("Error listing videos:", dbError);
    throw new Error(`Failed to list videos: ${dbError.message}`);
  }
  
  // Update status for all processing videos
  const updatePromises = (videos || [])
    .filter((v) => v.status === "processing")
    .map((v) => getVideo(v.id).catch(() => v));
  
  await Promise.all(updatePromises);
  
  // Fetch updated videos and ensure proper format
  const { data: updatedVideos } = await supabase
    .from("gemini_videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  
  // Map to ensure id field is always present
  return (updatedVideos || []).map((video) => ({
    ...video,
    id: video.id || video.operation_name?.split("/").pop() || "",
  }));
}

async function deleteVideo(id: string): Promise<void> {
  // Delete from database
  const { error: dbError } = await supabase
    .from("gemini_videos")
    .delete()
    .eq("id", id);
  
  if (dbError) {
    console.error("Error deleting video:", dbError);
    throw new Error(`Failed to delete video: ${dbError.message}`);
  }
  
  console.log("Video deleted:", id);
}

async function downloadVideo(id: string): Promise<Response> {
  const videoData = await getVideo(id);
  
  if (videoData.status !== "completed" || !videoData.video_url) {
    throw new Error(`Video not ready for download - status: ${videoData.status}`);
  }

  console.log("Downloading video:", id, "from URL:", videoData.video_url);

  const response = await fetch(videoData.video_url, {
    headers: {
      "x-goog-api-key": GEMINI_API_KEY!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Download failed:", response.status, errorText);
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  console.log("✅ Video download successful:", id);
  return response;
}

async function remixVideo(id: string, newPrompt: string, userId: string): Promise<any> {
  const originalVideo = await getVideo(id);
  
  if (!originalVideo) {
    throw new Error("Original video not found");
  }

  // Create a new video with the new prompt, using the original duration
  return createVideo(newPrompt, userId, originalVideo.duration, {
    ...originalVideo.metadata,
    remixedFrom: id,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    // Get user ID from authorization header
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: RequestBody = await req.json();
    const { operation } = body;

    console.log("Operation:", operation);

    switch (operation) {
      case "create": {
        console.log("🎬 CREATE operation requested by user:", userId);
        const { prompt, duration, aspectRatio, resolution, negativePrompt, imageBase64, imageMimeType, metadata } = body as CreateVideoRequest;
        console.log("Request params:", { 
          promptLength: prompt?.length, 
          duration, 
          aspectRatio, 
          resolution,
          hasImage: !!imageBase64 
        });
        
        const result = await createVideo(
          prompt, 
          userId, 
          duration, 
          aspectRatio, 
          resolution, 
          negativePrompt,
          imageBase64,
          imageMimeType,
          metadata
        );
        
        console.log("✅ CREATE operation completed, video ID:", result.id);
        return new Response(JSON.stringify({ video: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list": {
        const videos = await listVideos(userId);
        return new Response(JSON.stringify({ videos }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "retrieve": {
        const { id } = body as GetVideoRequest;
        const video = await getVideo(id);
        return new Response(JSON.stringify({ video }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { id } = body as DeleteVideoRequest;
        await deleteVideo(id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "content": {
        const { id } = body as DownloadVideoRequest;
        const videoResponse = await downloadVideo(id);
        const blob = await videoResponse.blob();
        
        return new Response(blob, {
          headers: {
            ...corsHeaders,
            "Content-Type": "video/mp4",
            "Content-Disposition": `attachment; filename="video-${id}.mp4"`,
          },
        });
      }

      case "remix": {
        const { id, prompt } = body as RemixVideoRequest;
        const result = await remixVideo(id, prompt, userId);
        return new Response(JSON.stringify({ video: result }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error("Error in gemini-veo-manager:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

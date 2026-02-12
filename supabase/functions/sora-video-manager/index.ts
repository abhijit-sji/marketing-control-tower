import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 20;

const sanitizeMetadata = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(([_, entryValue]) => {
    if (typeof entryValue === 'string') {
      return entryValue.trim().length > 0;
    }
    return entryValue !== undefined && entryValue !== null;
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
};

const setStringIfMissing = (object: Record<string, unknown>, key: string, value?: string) => {
  if (!value) {
    return;
  }
  const existing = object[key];
  if (typeof existing !== 'string' || existing.trim().length === 0) {
    object[key] = value;
  }
};

const attachSupplementalMetadata = (
  payload: unknown,
  metadata: Record<string, unknown> | undefined,
  fallbackTitle?: string,
  fallbackModel?: string,
) => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const target = payload as Record<string, unknown>;

  setStringIfMissing(target, 'title', fallbackTitle);
  setStringIfMissing(target, 'model', fallbackModel);

  if (metadata) {
    const metadataRecord = metadata as Record<string, unknown>;
    const existingMetadata =
      typeof target.metadata === 'object' && target.metadata !== null ? target.metadata as Record<string, unknown> : {};
    const mergedMetadata: Record<string, unknown> = { ...metadataRecord, ...existingMetadata };

    setStringIfMissing(mergedMetadata, 'title', fallbackTitle);

    const brandId = typeof metadataRecord['brand_id'] === 'string' ? metadataRecord['brand_id'] : undefined;
    const brandName = typeof metadataRecord['brand_name'] === 'string' ? metadataRecord['brand_name'] : undefined;
    const brandSlug = typeof metadataRecord['brand_slug'] === 'string' ? metadataRecord['brand_slug'] : undefined;

    setStringIfMissing(target, 'brand_id', brandId);
    setStringIfMissing(target, 'brand_name', brandName);
    setStringIfMissing(target, 'brand_slug', brandSlug);

    target.metadata = mergedMetadata;
  }

  return target;
};

const propagateMetadata = (
  payload: unknown,
  metadata: Record<string, unknown> | undefined,
  fallbackTitle?: string,
  fallbackModel?: string,
) => {
  if (!payload) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => attachSupplementalMetadata(item, metadata, fallbackTitle, fallbackModel));
  }

  if (typeof payload === 'object' && payload !== null && Array.isArray((payload as { data?: unknown }).data)) {
    const container = payload as { data: unknown[] } & Record<string, unknown>;
    container.data = container.data.map((item) =>
      attachSupplementalMetadata(item, metadata, fallbackTitle, fallbackModel)
    );
    return container;
  }

  return attachSupplementalMetadata(payload, metadata, fallbackTitle, fallbackModel);
};

const base64ToUint8Array = (value: string): Uint8Array => {
  const binaryString = atob(value);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const normalizeInputReference = (value: unknown): { blob: Blob; fileName: string } | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const candidate = value as { data?: string; name?: string; type?: string };
  if (typeof candidate.data !== 'string' || candidate.data.length === 0) {
    return undefined;
  }

  const fileName = typeof candidate.name === 'string' && candidate.name.trim().length > 0
    ? candidate.name.trim()
    : 'input-reference';
  const mimeType = typeof candidate.type === 'string' && candidate.type.trim().length > 0
    ? candidate.type.trim()
    : 'application/octet-stream';

  try {
    const bytes = base64ToUint8Array(candidate.data);
    const blob = new Blob([bytes as unknown as BlobPart], { type: mimeType });
    return { blob, fileName };
  } catch (error) {
    console.error('Failed to decode input reference:', error);
    return undefined;
  }
};

const ALLOWED_SECONDS = ['4', '8', '12'] as const;
type AllowedSeconds = typeof ALLOWED_SECONDS[number];

const normalizeSeconds = (input: unknown): AllowedSeconds => {
  const str = String(input).trim();
  if (ALLOWED_SECONDS.includes(str as AllowedSeconds)) {
    return str as AllowedSeconds;
  }
  
  const num = parseInt(str, 10);
  if (!Number.isFinite(num)) return '8';
  if (num <= 4) return '4';
  if (num <= 8) return '8';
  return '12';
};

/**
 * Downloads video blob from OpenAI and uploads to Supabase Storage
 * Returns the permanent public URL and storage path
 */
const uploadVideoToStorage = async (
  videoId: string,
  openAIVideoUrl: string,
  userId: string,
  supabase: any
): Promise<{ storageUrl: string; storagePath: string; fileSizeBytes: number }> => {
  console.log(`Downloading video ${videoId} from OpenAI for storage upload...`);
  
  const openAIApiKey = Deno.env.get('OPENAI_KEY');
  const videoResponse = await fetch(openAIVideoUrl, {
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'video-generation=2024-12-17',
    },
  });
  
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video from OpenAI: ${videoResponse.status}`);
  }
  
  const videoBlob = await videoResponse.arrayBuffer();
  const fileSizeBytes = videoBlob.byteLength;
  console.log(`Downloaded video blob: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  
  const storagePath = `${userId}/${videoId}.mp4`;
  const { error: uploadError } = await supabase.storage
    .from('sora-videos')
    .upload(storagePath, videoBlob, {
      contentType: 'video/mp4',
      upsert: true,
    });
  
  if (uploadError) {
    console.error('Failed to upload video to storage:', uploadError);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }
  
  console.log(`Successfully uploaded video to storage: ${storagePath}`);
  
  const { data: urlData } = supabase.storage
    .from('sora-videos')
    .getPublicUrl(storagePath);
  
  return {
    storageUrl: urlData.publicUrl,
    storagePath,
    fileSizeBytes,
  };
};

/**
 * Downloads thumbnail from OpenAI and uploads to Supabase Storage
 */
const uploadThumbnailToStorage = async (
  videoId: string,
  openAIThumbnailUrl: string,
  userId: string,
  supabase: any
): Promise<{ storageUrl: string; storagePath: string }> => {
  console.log(`Downloading thumbnail ${videoId} from OpenAI for storage upload...`);
  
  const openAIApiKey = Deno.env.get('OPENAI_KEY');
  const thumbResponse = await fetch(openAIThumbnailUrl, {
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'video-generation=2024-12-17',
    },
  });
  
  if (!thumbResponse.ok) {
    console.error(`Failed to download thumbnail: ${thumbResponse.status}`);
    return { storageUrl: '', storagePath: '' };
  }
  
  const thumbBlob = await thumbResponse.arrayBuffer();
  const storagePath = `${userId}/${videoId}_thumb.jpg`;
  
  const { error: uploadError } = await supabase.storage
    .from('sora-videos')
    .upload(storagePath, thumbBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  
  if (uploadError) {
    console.error('Failed to upload thumbnail:', uploadError);
    return { storageUrl: '', storagePath: '' };
  }
  
  const { data: urlData } = supabase.storage
    .from('sora-videos')
    .getPublicUrl(storagePath);
  
  return {
    storageUrl: urlData.publicUrl,
    storagePath,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_KEY not configured');
    }

    const { operation, prompt, file, videoId, idea, model, metadata, title, brandId, seconds, inputReference } = await req.json();
    console.log('Sora video operation:', operation);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user ID from auth header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
    const userId = user?.id;

    let response;
    const baseHeaders = {
      'Authorization': `Bearer ${openAIApiKey}`,
      'OpenAI-Beta': 'video-generation=2024-12-17',
    };
    const jsonHeaders = {
      ...baseHeaders,
      'Content-Type': 'application/json',
    };

    const trimmedModel = typeof model === 'string' && model.trim().length > 0 ? model.trim() : undefined;
    const sanitizedMetadata = sanitizeMetadata(metadata);
    const trimmedTitle = typeof title === 'string' && title.trim().length > 0 ? title.trim() : undefined;
    const trimmedBrandId = typeof brandId === 'string' && brandId.trim().length > 0 ? brandId.trim() : undefined;
    const secondsStr: AllowedSeconds = normalizeSeconds(seconds);
    console.log('Normalized seconds for OpenAI API:', secondsStr);
    const referenceFile = normalizeInputReference(inputReference) || normalizeInputReference(file);

    switch (operation) {
      case 'enhance':
        console.log('Enhancing video idea:', idea);
        if (!idea || !idea.trim()) {
          throw new Error('Idea is required to enhance the prompt');
        }
        
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a marketing video prompt generator for OpenAI Sora 2. Transform short marketing ideas into detailed cinematic prompts that describe visuals, camera style, lighting, and tone in 1-2 sentences.',
              },
              { role: 'user', content: idea.trim() },
            ],
          }),
        });
        break;
      case 'list':
        console.log('Fetching video list from OpenAI');
        response = await fetch('https://api.openai.com/v1/videos', {
          method: 'GET',
          headers: jsonHeaders,
        });
        
        // Enhance with local metadata
        if (response.ok) {
          const openAIVideos = await response.json();
          
          // Fetch local video metadata with storage URLs
          const { data: localVideos } = await supabase
            .from('sora_videos')
            .select(`
              id,
              title,
              brand_id,
              prompt,
              model,
              metadata,
              status,
              video_url,
              thumbnail_url,
              storage_path,
              thumbnail_storage_path,
              duration,
              completed_at,
              file_size_bytes,
              user_id
            `);
          
          // Create a map for quick lookup
          const localVideoMap = new Map(
            localVideos?.map(v => [v.id, v]) || []
          );
          
          // Merge with local metadata, preferring local storage URLs and status
          if (openAIVideos?.data) {
            openAIVideos.data = openAIVideos.data.map((video: any) => {
              const local = localVideoMap.get(video.id);
              if (!local) return video;
              
              return {
                ...video, // Keep OpenAI fields by default
                // Prefer local stable data (permanent URLs and stored attributes)
                url: local.video_url || video.url || video.video_url, // Explicit top-level url for UI
                status: local.status || video.status,
                video_url: local.video_url || video.video_url,
                thumbnail_url: local.thumbnail_url || video.thumbnail_url,
                title: local.title || video.title,
                brand_id: local.brand_id ?? video.brand_id,
                prompt: local.prompt || video.prompt,
                model: local.model || video.model,
                metadata: { ...(video.metadata || {}), ...(local.metadata || {}) },
                storage_path: local.storage_path ?? video.storage_path,
                thumbnail_storage_path: local.thumbnail_storage_path ?? video.thumbnail_storage_path,
                duration: local.duration ?? video.duration,
                completed_at: local.completed_at ?? video.completed_at,
                file_size_bytes: local.file_size_bytes ?? video.file_size_bytes,
                user_id: local.user_id ?? video.user_id,
              };
            });
          }
          
          return new Response(JSON.stringify(openAIVideos), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        break;

      case 'create':
        console.log('Creating video with prompt:', prompt);
        if (!prompt || !prompt.trim()) {
          throw new Error('Prompt is required to generate a video');
        }

        if (referenceFile) {
          // If file is provided, we need to handle multipart/form-data
          console.log('Creating video with input reference file:', referenceFile.fileName);
          const formData = new FormData();
          formData.append('prompt', prompt.trim());
          if (trimmedModel) {
            formData.append('model', trimmedModel);
          }
          // Don't send title or metadata to OpenAI - store locally instead
          formData.append('seconds', secondsStr);
          // Append blob with filename - Deno's FormData handles Blob better than File
          formData.append('input_reference', referenceFile.blob, referenceFile.fileName);

          console.log('Sending video creation request to OpenAI with file attachment');
          response = await fetch('https://api.openai.com/v1/videos', {
            method: 'POST',
            headers: baseHeaders,
            body: formData,
          });
          console.log('OpenAI response status:', response.status);
        } else {
          const requestBody: Record<string, unknown> = {
            prompt: prompt.trim(),
          };

          if (trimmedModel) {
            requestBody.model = trimmedModel;
          }

          // Don't send title or metadata to OpenAI - store locally instead
          requestBody.seconds = secondsStr;

          response = await fetch('https://api.openai.com/v1/videos', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify(requestBody),
          });
        }
        break;

      case 'delete':
        console.log('Deleting video:', videoId);
        if (!videoId) {
          throw new Error('Video ID is required to delete a video');
        }
        response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
          method: 'DELETE',
          headers: jsonHeaders,
        });
        break;

      case 'retrieve':
        console.log('Retrieving video:', videoId);
        if (!videoId) {
          throw new Error('Video ID is required to retrieve a video');
        }
        response = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
          method: 'GET',
          headers: jsonHeaders,
        });
        
        if (response.ok && userId) {
          try {
            const videoData = await response.clone().json();
            
            // Debug logging for OpenAI response structure
            console.log('=== OpenAI Retrieve Response Debug ===');
            console.log('Status:', videoData.status);
            console.log('Has video_url?', !!videoData.video_url);
            console.log('Has url?', !!videoData.url);
            console.log('Has download_url?', !!videoData.download_url);
            console.log('Has thumbnail_url?', !!videoData.thumbnail_url);
            console.log('Has thumbnail?', !!videoData.thumbnail);
            console.log('Available keys:', Object.keys(videoData));
            console.log('===================================');
            
            let completedAt = null;
            if (videoData.completed_at) {
              completedAt = typeof videoData.completed_at === 'number' 
                ? new Date(videoData.completed_at * 1000).toISOString()
                : videoData.completed_at;
            }
            
            // Extract URLs with robust fallbacks to content endpoints
            const videoUrl = videoData.video_url || 
                            videoData.url || 
                            videoData.download_url ||
                            `https://api.openai.com/v1/videos/${videoId}/content`;
            
            const thumbnailUrl = videoData.thumbnail_url || 
                                videoData.thumbnail ||
                                `https://api.openai.com/v1/videos/${videoId}/content?variant=thumbnail`;
            
            console.log('Extracted URLs - video:', videoUrl, 'thumbnail:', thumbnailUrl);
            
            // Upload if video is completed (don't depend on video_url field presence)
            const needsUpload = ['succeeded', 'ready', 'completed'].includes(videoData.status);
            
            let storageUrl = null;
            let storagePath = null;
            let fileSizeBytes = null;
            let thumbnailStorageUrl = null;
            let thumbnailStoragePath = null;
            
            if (needsUpload) {
              console.log('✅ Video is completed, checking storage status...');
              
              const { data: existingVideo } = await supabase
                .from('sora_videos')
                .select('storage_path, thumbnail_storage_path')
                .eq('id', videoId)
                .eq('user_id', userId)
                .single();
              
              if (!existingVideo?.storage_path) {
                console.log('📤 Uploading video to permanent storage...');
                
                try {
                  const uploadResult = await uploadVideoToStorage(
                    videoId,
                    videoUrl, // Use extracted URL with fallback
                    userId,
                    supabase
                  );
                  storageUrl = uploadResult.storageUrl;
                  storagePath = uploadResult.storagePath;
                  fileSizeBytes = uploadResult.fileSizeBytes;
                  console.log('✅ Video uploaded:', storagePath);
                  
                  // Upload thumbnail if not already stored
                  if (!existingVideo?.thumbnail_storage_path) {
                    try {
                      const thumbResult = await uploadThumbnailToStorage(
                        videoId,
                        thumbnailUrl, // Use extracted thumbnail URL
                        userId,
                        supabase
                      );
                      thumbnailStorageUrl = thumbResult.storageUrl;
                      thumbnailStoragePath = thumbResult.storagePath;
                      console.log('✅ Thumbnail uploaded:', thumbnailStoragePath);
                    } catch (thumbErr) {
                      console.error('⚠️ Thumbnail upload failed (non-critical):', thumbErr);
                    }
                  }
                  
                } catch (uploadErr) {
                  console.error('❌ Storage upload failed:', uploadErr);
                  // Don't store temporary URLs - leave as null to retry later
                  console.log('⚠️ Leaving URLs as null to retry on next retrieve');
                }
              } else {
                console.log('✅ Video already in storage, reusing permanent URLs');
                const { data: publicUrlData } = supabase.storage
                  .from('sora-videos')
                  .getPublicUrl(existingVideo.storage_path);
                storageUrl = publicUrlData.publicUrl;
                
                if (existingVideo.thumbnail_storage_path) {
                  const { data: thumbUrlData } = supabase.storage
                    .from('sora-videos')
                    .getPublicUrl(existingVideo.thumbnail_storage_path);
                  thumbnailStorageUrl = thumbUrlData.publicUrl;
                }
              }
            } else {
              console.log('⏳ Video not yet completed, status:', videoData.status);
            }
            
            // Update DB with ONLY permanent storage URLs (never temporary OpenAI URLs)
            const { error: updateError } = await supabase
              .from('sora_videos')
              .update({
                status: videoData.status,
                video_url: storageUrl || null, // Only store permanent URL or null
                thumbnail_url: thumbnailStorageUrl || null, // Only store permanent URL or null
                duration: videoData.duration || null,
                completed_at: completedAt,
                storage_path: storagePath || null,
                file_size_bytes: fileSizeBytes || null,
                thumbnail_storage_path: thumbnailStoragePath || null,
              })
              .eq('id', videoId)
              .eq('user_id', userId);
            
            if (updateError) {
              console.error('Failed to update video in database:', updateError);
            } else {
              console.log('Successfully updated video:', videoId);
              
              const { data: localVideo, error: fetchError } = await supabase
                .from('sora_videos')
                .select('*')
                .eq('id', videoId)
                .eq('user_id', userId)
                .single();
              
              if (!fetchError && localVideo) {
                const mergedData = {
                  ...videoData,
                  url: localVideo.video_url, // Explicit top-level url for UI
                  status: localVideo.status,
                  video_url: localVideo.video_url,
                  thumbnail_url: localVideo.thumbnail_url,
                  duration: localVideo.duration,
                  completed_at: localVideo.completed_at,
                  title: localVideo.title,
                  prompt: localVideo.prompt,
                  model: localVideo.model,
                  brand_id: localVideo.brand_id,
                  metadata: localVideo.metadata,
                  user_id: localVideo.user_id,
                  storage_path: localVideo.storage_path,
                  file_size_bytes: localVideo.file_size_bytes,
                  thumbnail_storage_path: localVideo.thumbnail_storage_path,
                };
                
                response = new Response(JSON.stringify(mergedData), {
                  status: 200,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
              }
            }
          } catch (updateErr) {
            console.error('Error updating video:', updateErr);
          }
        }
        break;

      case 'thumbnail':
        console.log('Fetching thumbnail for video:', videoId);
        if (!videoId || !userId) {
          throw new Error('Video ID and user authentication required');
        }
        
        // Check if thumbnail is already in storage
        const { data: thumbRecord, error: thumbFetchError } = await supabase
          .from('sora_videos')
          .select('thumbnail_storage_path, thumbnail_url, status')
          .eq('id', videoId)
          .eq('user_id', userId)
          .single();
        
        if (!thumbFetchError && thumbRecord?.thumbnail_storage_path) {
          console.log('✅ Thumbnail found in storage, returning permanent URL');
          // Fetch thumbnail from storage and return as base64
          const { data: thumbData, error: downloadError } = await supabase.storage
            .from('sora-videos')
            .download(thumbRecord.thumbnail_storage_path);
          
          if (!downloadError && thumbData) {
            const arrayBuffer = await thumbData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }
            const base64Data = btoa(binary);
            
            return new Response(
              JSON.stringify({
                base64Data,
                contentType: thumbData.type || 'image/jpeg',
                url: thumbRecord.thumbnail_url,
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          console.log('⚠️ Failed to download thumbnail from storage');
        }
        
        // If video is completed but thumbnail not in storage, return placeholder
        if (!thumbFetchError && ['succeeded', 'ready', 'completed'].includes(thumbRecord?.status || '')) {
          console.log('⚠️ Video completed but thumbnail not in storage - returning placeholder');
          return new Response(
            JSON.stringify({ 
              error: "Thumbnail not available in storage. Video may have expired on OpenAI.",
              code: "THUMBNAIL_NOT_STORED",
              placeholder: true
            }),
            { 
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        }
        
        // Only try OpenAI for videos still processing
        if (!thumbFetchError && ['queued', 'processing'].includes(thumbRecord?.status || '')) {
          console.log('⏳ Video still processing, trying OpenAI for thumbnail');
          try {
            response = await fetch(`https://api.openai.com/v1/videos/${videoId}/content?variant=thumbnail`, {
              method: 'GET',
              headers: baseHeaders,
            });
            
            // If OpenAI fetch succeeds, we'll handle it normally
            if (response.ok) {
              break;
            }
          } catch (fetchErr) {
            console.log('⚠️ Failed to fetch from OpenAI, video may still be processing');
          }
        }
        
        // Return placeholder for any other case
        return new Response(
          JSON.stringify({ 
            error: "Thumbnail not available. Video may still be processing or has expired.",
            code: "THUMBNAIL_UNAVAILABLE",
            placeholder: true
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
        break;

      case 'content':
        console.log('[DEPRECATED] Content operation - videos now stored permanently in Supabase Storage');
        console.log('Fetching video from storage instead:', videoId);
        
        if (!videoId || !userId) {
          throw new Error('Video ID and user authentication required');
        }
        
        const { data: videoRecord, error: fetchError } = await supabase
          .from('sora_videos')
          .select('storage_path, video_url')
          .eq('id', videoId)
          .eq('user_id', userId)
          .single();
        
        if (fetchError || !videoRecord) {
          throw new Error('Video not found in database');
        }
        
        if (!videoRecord.storage_path) {
          throw new Error('Video not in storage yet. Try refreshing the video status first.');
        }
        
        return new Response(
          JSON.stringify({
            url: videoRecord.video_url,
            message: 'Video is permanently stored in Supabase Storage',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
        break;

      case 'remix':
        console.log('Remixing video:', videoId);
        if (!videoId) {
          throw new Error('Video ID is required to remix a video');
        }
        if (!prompt || !prompt.trim()) {
          throw new Error('Prompt is required to remix a video');
        }
        response = await fetch(`https://api.openai.com/v1/videos/${videoId}/remix`, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify({ prompt: prompt.trim() }),
        });
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error (status', response.status + '):', errorText);
      console.error('Request details - operation:', operation, 'model:', trimmedModel, 'hasFile:', !!referenceFile);
      
      // Return specific error for invalid duration
      if (response.status === 400 && errorText.includes('seconds')) {
        return new Response(
          JSON.stringify({ 
            error: "Duration must be 4, 8, or 12 seconds.",
            code: "INVALID_DURATION",
            details: errorText
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Return 410 Gone for expired videos
      if (response.status === 404 && errorText.includes("no longer available")) {
        return new Response(
          JSON.stringify({ 
            error: "Video has expired. Sora videos are only available for 1 hour after generation.",
            code: "VIDEO_EXPIRED" 
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 410 
          }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    let data;
    if (operation === 'delete') {
      data = {};
    } else if (operation === 'enhance') {
      const rawData = await response.json();
      const content = rawData?.choices?.[0]?.message?.content || '';
      data = { enhancedPrompt: content.trim() };
    } else if (operation === 'thumbnail') {
      // Only thumbnail operation returns binary data now (content returns JSON from storage)
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binary);
      data = {
        base64Data,
        contentType: response.headers.get('content-type') ?? undefined,
      };
    } else {
      const jsonResponse = await response.json() as Record<string, unknown>;
      data = jsonResponse as Record<string, unknown>;
      if (operation === 'create') {
        data = propagateMetadata(data, sanitizedMetadata, trimmedTitle, trimmedModel);
        
        // Store video metadata locally (without temporary URLs)
        const videoId = (data as Record<string, unknown>)?.id as string | undefined;
        if (videoId && userId) {
          const typedData = data as Record<string, unknown>;
          const { error: insertError } = await supabase
            .from('sora_videos')
            .insert({
              id: videoId,
              user_id: userId,
              title: trimmedTitle,
              brand_id: trimmedBrandId,
              prompt: prompt.trim(),
              model: trimmedModel || 'sora-2',
              status: (typedData.status as string) || 'processing',
              video_url: null, // Will be populated on retrieve when video completes
              thumbnail_url: null, // Will be populated on retrieve when video completes
              duration: typedData.duration as number | undefined,
              aspect_ratio: typedData.aspect_ratio as string | undefined,
              resolution: typedData.resolution as string | undefined,
              has_audio: typedData.has_audio as boolean | undefined,
              metadata: sanitizedMetadata || {},
            });
          
          if (insertError) {
            console.error('Failed to store video metadata locally:', insertError);
          } else {
            console.log('Video metadata stored locally:', videoId);
            // Add local fields to response
            (data as Record<string, unknown>).title = trimmedTitle;
            (data as Record<string, unknown>).brandId = trimmedBrandId;
          }
        }
      }
    }
    console.log('OpenAI response received successfully');

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in sora-video-manager:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

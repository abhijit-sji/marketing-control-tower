import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface GoogleDriveFolder {
  id: string;
  name: string;
  modifiedTime?: string;
  iconLink?: string;
}

interface ListFoldersResponse {
  success: boolean;
  folders: GoogleDriveFolder[];
  error?: string;
}

export const useGoogleDriveFolders = (parentFolderId?: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["google-drive-folders", parentFolderId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<ListFoldersResponse>(
        "google-drive-list-folders",
        {
          body: { parentFolderId },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to list folders");

      return data.folders;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Folder, ChevronRight, Home } from "lucide-react";
import { useGoogleDriveFolders } from "@/hooks/useGoogleDriveFolders";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface GoogleDriveFolderBrowserProps {
  onSelectFolder: (folderId: string, folderName: string) => void;
  selectedFolderId?: string;
}

export const GoogleDriveFolderBrowser = ({ 
  onSelectFolder, 
  selectedFolderId 
}: GoogleDriveFolderBrowserProps) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | undefined; name: string }>>([
    { id: undefined, name: "My Drive" }
  ]);

  const { data: folders, isLoading, error } = useGoogleDriveFolders(currentFolderId, true);

  const navigateToFolder = (folderId: string | undefined, folderName: string) => {
    setCurrentFolderId(folderId);
    
    // Update breadcrumbs
    const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
    if (existingIndex >= 0) {
      // Going back - trim breadcrumbs
      setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
    } else {
      // Going forward - add breadcrumb
      setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
    }
  };

  const handleSelectFolder = (folderId: string, folderName: string) => {
    onSelectFolder(folderId, folderName);
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load folders. Please ensure you're connected to Google Drive.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id || 'root'} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3" />}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 hover:text-foreground"
              onClick={() => navigateToFolder(crumb.id, crumb.name)}
            >
              {index === 0 ? <Home className="h-3 w-3 mr-1" /> : null}
              {crumb.name}
            </Button>
          </div>
        ))}
      </div>

      {/* Folder List */}
      <ScrollArea className="h-[300px] rounded-md border bg-muted/30">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : folders && folders.length > 0 ? (
          <div className="p-2 space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`group flex items-center justify-between p-2 rounded-md hover:bg-accent transition-colors ${
                  selectedFolderId === folder.id ? 'bg-primary/10 border border-primary/20' : ''
                }`}
              >
                <button
                  className="flex items-center gap-2 flex-1 text-left"
                  onClick={() => navigateToFolder(folder.id, folder.name)}
                >
                  <Folder className="h-4 w-4 text-primary" />
                  <span className="text-sm">{folder.name}</span>
                </button>
                <Button
                  size="sm"
                  variant={selectedFolderId === folder.id ? "default" : "ghost"}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleSelectFolder(folder.id, folder.name)}
                >
                  {selectedFolderId === folder.id ? "Selected" : "Select"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Folder className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No folders found in this location</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

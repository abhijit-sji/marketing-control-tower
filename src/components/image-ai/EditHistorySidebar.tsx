import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, ChevronRight, Image as ImageIcon, Edit3 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { GeneratedImage } from "./ImagePreviewPanel";

interface EditHistorySidebarProps {
  currentImage: GeneratedImage | null;
  versionHistory: GeneratedImage[];
  onSelectVersion: (image: GeneratedImage) => void;
  className?: string;
}

export function EditHistorySidebar({
  currentImage,
  versionHistory,
  onSelectVersion,
  className,
}: EditHistorySidebarProps) {
  // Sort by version number descending (newest first)
  const sortedHistory = [...versionHistory].sort(
    (a, b) => (b.version_number || 1) - (a.version_number || 1)
  );

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="w-5 h-5" />
          Version History
        </CardTitle>
        {sortedHistory.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {sortedHistory.length} version{sortedHistory.length !== 1 ? "s" : ""}
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-4 pb-4">
          {sortedHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No version history yet</p>
              <p className="text-xs mt-1">
                Edit an image to create new versions
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedHistory.map((version) => {
                const isSelected = currentImage?.id === version.id;
                const isOriginal = version.version_number === 1;

                return (
                  <button
                    key={version.id}
                    onClick={() => onSelectVersion(version)}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 transition-colors",
                      "hover:bg-accent hover:border-primary/50",
                      isSelected && "bg-accent border-primary"
                    )}
                  >
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {version.image_url ? (
                          <img
                            src={version.image_url}
                            alt={`Version ${version.version_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant={isOriginal ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {isOriginal ? "Original" : `v${version.version_number}`}
                          </Badge>
                          {isSelected && (
                            <ChevronRight className="w-3 h-3 text-primary" />
                          )}
                        </div>

                        {/* Edit instruction or prompt preview */}
                        <p className="text-xs line-clamp-2 text-muted-foreground">
                          {version.edit_instruction ? (
                            <span className="flex items-start gap-1">
                              <Edit3 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {version.edit_instruction}
                            </span>
                          ) : (
                            version.prompt.substring(0, 60) + (version.prompt.length > 60 ? "..." : "")
                          )}
                        </p>

                        {/* Timestamp */}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(version.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Compact timeline version
export function VersionTimeline({
  versions,
  currentVersionId,
  onSelectVersion,
}: {
  versions: GeneratedImage[];
  currentVersionId: string | null;
  onSelectVersion: (image: GeneratedImage) => void;
}) {
  const sortedVersions = [...versions].sort(
    (a, b) => (a.version_number || 1) - (b.version_number || 1)
  );

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {sortedVersions.map((version, index) => {
        const isSelected = currentVersionId === version.id;
        const isLast = index === sortedVersions.length - 1;

        return (
          <div key={version.id} className="flex items-center">
            <Button
              variant={isSelected ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-8 w-8 p-0 rounded-full",
                !isSelected && "hover:bg-accent"
              )}
              onClick={() => onSelectVersion(version)}
            >
              <span className="text-xs">{version.version_number || 1}</span>
            </Button>
            {!isLast && (
              <div className="w-4 h-0.5 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

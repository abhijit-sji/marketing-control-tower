import { useState } from 'react';
import { Star, Trash2, Download, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { HistoryResponse } from '@/features/voicebox/types';
import { useDeleteGeneration, useToggleFavorite } from '@/features/voicebox/hooks';
import { getAudioUrl, getExportAudioUrl } from '@/Api/voiceboxApi';
import { AudioPlayer } from './AudioPlayer';

interface GenerationCardProps {
  generation: HistoryResponse;
  onReuseText?: (text: string) => void;
  compact?: boolean;
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'secondary',
  processing: 'outline',
  loading_model: 'outline',
  failed: 'destructive',
  cancelled: 'outline',
  canceled: 'outline',
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function GenerationCard({ generation, onReuseText, compact = false }: GenerationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const deleteGen = useDeleteGeneration();
  const toggleFav = useToggleFavorite();

  // audio_path is set once generation completes; use that as ground truth
  const isReady = generation.status === 'completed' && !!generation.audio_path;
  const audioUrl = isReady ? getAudioUrl(generation.id) : null;
  const exportUrl = getExportAudioUrl(generation.id);

  const handleDownload = async () => {
    try {
      const response = await fetch(exportUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generation.profile_name}-${generation.id.slice(0, 8)}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(exportUrl, '_blank');
    }
  };

  const truncatedText =
    generation.text.length > 120 ? generation.text.slice(0, 120) + '...' : generation.text;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium truncate">{generation.profile_name}</span>
              <Badge variant={STATUS_VARIANTS[generation.status] ?? 'outline'} className="text-xs shrink-0">
                {generation.status}
              </Badge>
              {generation.duration != null && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDuration(generation.duration)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(generation.created_at).toLocaleString()}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className={`h-7 w-7 shrink-0 ${generation.is_favorited ? 'text-yellow-500' : 'text-muted-foreground'}`}
            onClick={() => toggleFav.mutate(generation.id)}
            title={generation.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className="h-4 w-4" fill={generation.is_favorited ? 'currentColor' : 'none'} />
          </Button>
        </div>

        {/* Text content */}
        <div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {expanded ? generation.text : truncatedText}
          </p>
          {generation.text.length > 120 && (
            <button
              className="text-xs text-primary mt-1 hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Audio player */}
        {audioUrl && !compact && (
          <AudioPlayer
            src={audioUrl}
            filename={`${generation.profile_name}-${generation.id.slice(0, 8)}.wav`}
          />
        )}
        {audioUrl && compact && (
          <AudioPlayer
            src={audioUrl}
            filename={`${generation.profile_name}-${generation.id.slice(0, 8)}.wav`}
            compact
          />
        )}

        {/* Action row */}
        <div className="flex items-center gap-1 pt-1">
          {onReuseText && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => onReuseText(generation.text)}
            >
              <RefreshCw className="h-3 w-3" />
              Reuse text
            </Button>
          )}
          {audioUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
            onClick={() => deleteGen.mutate(generation.id)}
            disabled={deleteGen.isPending}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

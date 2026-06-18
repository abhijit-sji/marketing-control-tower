import { useState, useMemo } from 'react';
import { Search, AlertCircle, Clock, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GenerationCard } from '@/components/voice-ai/GenerationCard';
import { useHistory } from '@/features/voicebox/hooks';

interface HistoryTabProps {
  onReuseText?: (text: string) => void;
}

export function HistoryTab({ onReuseText }: HistoryTabProps) {
  const [search, setSearch] = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const { data, isLoading, error } = useHistory(100);
  const generations = data?.items ?? [];

  const profileNames = useMemo(() => {
    const names = new Set(generations.map((g) => g.profile_name));
    return Array.from(names).sort();
  }, [generations]);

  const filtered = useMemo(() => {
    let result = generations;
    if (profileFilter) {
      result = result.filter((g) => g.profile_name === profileFilter);
    }
    if (showFavoritesOnly) {
      result = result.filter((g) => g.is_favorited);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (g) =>
          g.text.toLowerCase().includes(q) ||
          g.profile_name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [generations, profileFilter, showFavoritesOnly, search]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Failed to load history</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Make sure VoiceBox is running and try again.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by text or voice..."
            className="pl-9"
          />
        </div>
        {profileNames.length > 1 && (
          <Select value={profileFilter} onValueChange={setProfileFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All voices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All voices</SelectItem>
              {profileNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={showFavoritesOnly ? 'secondary' : 'outline'}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Star className="h-4 w-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} />
          Favorites
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {filtered.length} generation{filtered.length !== 1 ? 's' : ''}
          {filtered.length !== generations.length && ` (filtered from ${generations.length})`}
        </span>
        {data?.total != null && data.total > generations.length && (
          <Badge variant="outline" className="text-xs">
            Showing latest {generations.length} of {data.total}
          </Badge>
        )}
      </div>

      {/* Generation list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Clock className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {generations.length === 0 ? 'No generations yet' : 'No results'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {generations.length === 0
                ? 'Generated audio will appear here after you use Text to Speech.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((gen) => (
            <GenerationCard key={gen.id} generation={gen} onReuseText={onReuseText} />
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { User, ChevronDown, X, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMarketingTeamMembers, MarketingTeamMember } from '@/hooks/useMarketingTeamMembers';
import { Skeleton } from '@/components/ui/skeleton';

interface InlineAssigneeSelectProps {
  value?: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
}

const getInitials = (firstName?: string | null, lastName?: string | null) => {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  return '?';
};

export const InlineAssigneeSelect = ({ value, onChange, disabled }: InlineAssigneeSelectProps) => {
  const { data: members, isLoading } = useMarketingTeamMembers();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedMember = members?.find((m) => m.id === value);

  // Filter members based on search query
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!searchQuery.trim()) return members;

    const query = searchQuery.toLowerCase();
    return members.filter((member) => {
      const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
      const email = member.email?.toLowerCase() || '';
      const title = member.title?.toLowerCase() || '';
      return fullName.includes(query) || email.includes(query) || title.includes(query);
    });
  }, [members, searchQuery]);

  if (isLoading) {
    return <Skeleton className="h-10 w-48" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <Button variant="outline" className="justify-between min-w-[200px]">
            <div className="flex items-center gap-2">
              {selectedMember ? (
                <>
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {getInitials(selectedMember.first_name, selectedMember.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">
                    {`${selectedMember.first_name || ''} ${selectedMember.last_name || ''}`.trim() ||
                      selectedMember.email}
                  </span>
                </>
              ) : (
                <>
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Unassigned</span>
                </>
              )}
            </div>
            <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0">
          <div className="space-y-2 p-4 pb-0">
            <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                placeholder="Search by name, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent h-auto p-0 focus-visible:ring-0"
              />
            </div>
          </div>
          <ScrollArea className="h-[300px] p-4 pt-2">
            <div className="space-y-1">
              {/* Unassigned option */}
              <button
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                  setSearchQuery('');
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-left text-sm"
              >
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">Unassigned</span>
              </button>

              {/* Team members */}
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      onChange(member.id);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent text-left"
                  >
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(member.first_name, member.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate text-sm font-medium">
                        {`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}
                      </span>
                      {member.title && (
                        <span className="text-xs text-muted-foreground truncate">{member.title}</span>
                      )}
                    </div>
                    {value === member.id && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-8 text-sm text-muted-foreground text-center">
                  No team members found matching "{searchQuery}"
                </div>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
      {selectedMember && !disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

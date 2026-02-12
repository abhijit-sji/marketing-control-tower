import React from 'react';
import { Flag, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'normal' | 'high' | 'urgent';

interface InlinePrioritySelectProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bgColor: string }> = {
  low: {
    label: 'Low',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100 hover:bg-slate-200',
  },
  normal: {
    label: 'Normal',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 hover:bg-blue-200',
  },
  high: {
    label: 'High',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 hover:bg-orange-200',
  },
  urgent: {
    label: 'Urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-100 hover:bg-red-200',
  },
};

export const InlinePrioritySelect = ({ value, onChange, disabled }: InlinePrioritySelectProps) => {
  const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.normal;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="ghost" className="h-auto p-0">
          <Badge
            className={cn(
              'cursor-pointer flex items-center gap-1 font-medium',
              config.bgColor,
              config.color
            )}
          >
            <Flag className="h-3 w-3" />
            {config.label}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((priority) => {
          const pConfig = PRIORITY_CONFIG[priority];
          return (
            <DropdownMenuItem
              key={priority}
              onClick={() => onChange(priority)}
              className="flex items-center gap-2"
            >
              <Flag className={cn('h-4 w-4', pConfig.color)} />
              <span>{pConfig.label}</span>
              {priority === value && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

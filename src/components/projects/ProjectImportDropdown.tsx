import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ActiveCollabSearchDialog } from './ActiveCollabSearchDialog';
import { ControlTowerSearchDialog } from './ControlTowerSearchDialog';

/**
 * Unified dropdown button for importing projects from multiple sources
 * Provides a cleaner UI by consolidating import options into a single dropdown menu
 */
export const ProjectImportDropdown = () => {
  const [activeCollabOpen, setActiveCollabOpen] = useState(false);
  const [controlTowerOpen, setControlTowerOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            Import Project
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setControlTowerOpen(true)}>
            Import from Control Tower
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveCollabOpen(true)}>
            Import from ActiveCollab
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Render dialogs in controlled mode - no trigger buttons visible */}
      <ActiveCollabSearchDialog
        open={activeCollabOpen}
        onOpenChange={setActiveCollabOpen}
      />
      <ControlTowerSearchDialog
        open={controlTowerOpen}
        onOpenChange={setControlTowerOpen}
      />
    </>
  );
};

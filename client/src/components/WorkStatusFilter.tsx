import type { WorkStatus } from "@shared/schema";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface WorkStatusFilterProps {
  selectedStatus: WorkStatus | "All";
  onSelectStatus: (status: WorkStatus | "All") => void;
}

export function WorkStatusFilter({ selectedStatus, onSelectStatus }: WorkStatusFilterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-filter-work-status">
          <span className="material-symbols-outlined text-base">filter_list</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onSelectStatus("All")}
          data-testid="filter-option-all"
        >
          All
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelectStatus("At work")}
          data-testid="filter-option-at-work"
        >
          At work
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onSelectStatus("Off work")}
          data-testid="filter-option-off-work"
        >
          Off work
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

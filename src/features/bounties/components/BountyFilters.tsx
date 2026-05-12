import { ArrowDownWideNarrow, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type {
  BountyFilterStatus,
  BountySortKey,
  SortDirection,
} from "../types";

const statusOptions: BountyFilterStatus[] = [
  "All",
  "Open",
  "In Progress",
  "Under Review",
  "Completed",
];

interface BountyFiltersProps {
  status: BountyFilterStatus;
  search: string;
  sortKey: BountySortKey;
  sortDirection: SortDirection;
  onStatusChange: (status: BountyFilterStatus) => void;
  onSearchChange: (query: string) => void;
  onSortKeyChange: (sortKey: BountySortKey) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function BountyFilters({
  status,
  search,
  sortKey,
  sortDirection,
  onStatusChange,
  onSearchChange,
  onSortKeyChange,
  onSortDirectionChange,
}: BountyFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/30 bg-card/20 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
          <Input
            value={search}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search title, requester, tags, or type"
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={sortKey} onValueChange={value => onSortKeyChange(value as BountySortKey)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground/50" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deadline">Deadline</SelectItem>
              <SelectItem value="reward">Reward</SelectItem>
              <SelectItem value="submissions">Submissions</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortDirection}
            onValueChange={value => onSortDirectionChange(value as SortDirection)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">Descending</SelectItem>
              <SelectItem value="asc">Ascending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs
        value={status}
        onValueChange={value => onStatusChange(value as BountyFilterStatus)}
        className="gap-0"
      >
        <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl bg-muted/50 p-1">
          {statusOptions.map(option => (
            <TabsTrigger
              key={option}
              value={option}
              className="min-w-fit px-3 py-1.5 text-xs"
            >
              {option}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

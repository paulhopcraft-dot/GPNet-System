import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Filter, X, ChevronDown, Search, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface FilterState {
  search: string;
  status: string;
  caseType: string;
  claimType: string;
  priority: string;
  ragScore: string;
  fitClassification: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: string;
  sortOrder: string;
}

interface AdvancedCaseFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  activeFilterCount: number;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "NEW", label: "New" },
  { value: "ANALYSING", label: "Analyzing" },
  { value: "AWAITING_REVIEW", label: "Awaiting Review" },
  { value: "REVISIONS_REQUIRED", label: "Revisions Required" },
  { value: "READY_TO_SEND", label: "Ready to Send" },
  { value: "COMPLETE", label: "Complete" },
];

const caseTypeOptions = [
  { value: "all", label: "All Case Types" },
  { value: "pre_employment", label: "Pre-Employment" },
  { value: "injury", label: "Workplace Injury" },
];

const claimTypeOptions = [
  { value: "all", label: "All Claim Types" },
  { value: "complex", label: "Complex Claims" },
  { value: "standard", label: "Standard Claims" },
  { value: "urgent", label: "Urgent Claims" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "low", label: "Low Priority" },
  { value: "medium", label: "Medium Priority" },
  { value: "high", label: "High Priority" },
  { value: "urgent", label: "Urgent Priority" },
];

const ragScoreOptions = [
  { value: "all", label: "All Risk Levels" },
  { value: "green", label: "Low Risk (Green)" },
  { value: "amber", label: "Medium Risk (Amber)" },
  { value: "red", label: "High Risk (Red)" },
];

const fitClassificationOptions = [
  { value: "all", label: "All Classifications" },
  { value: "fit", label: "Fit for Work" },
  { value: "fit_with_restrictions", label: "Fit with Restrictions" },
  { value: "not_fit", label: "Not Fit for Work" },
];

const sortOptions = [
  { value: "createdAt", label: "Created Date" },
  { value: "updatedAt", label: "Updated Date" },
  { value: "workerName", label: "Worker Name" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "ragScore", label: "Risk Score" },
];

export default function AdvancedCaseFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  activeFilterCount,
}: AdvancedCaseFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearDateFilter = (dateType: 'dateFrom' | 'dateTo') => {
    onFiltersChange({ ...filters, [dateType]: undefined });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Case Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="outline" 
                size="sm"
                onClick={onClearFilters}
                data-testid="button-clear-filters"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-toggle-filters">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Always visible: Search and basic filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Cases</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name, ID, email..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="pl-9"
                data-testid="input-case-search"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caseType">Case Type</Label>
            <Select value={filters.caseType} onValueChange={(value) => updateFilter('caseType', value)}>
              <SelectTrigger data-testid="select-case-type-filter">
                <SelectValue placeholder="Select case type" />
              </SelectTrigger>
              <SelectContent>
                {caseTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ragScore">Risk Level</Label>
            <Select value={filters.ragScore} onValueChange={(value) => updateFilter('ragScore', value)}>
              <SelectTrigger data-testid="select-risk-filter">
                <SelectValue placeholder="Select risk level" />
              </SelectTrigger>
              <SelectContent>
                {ragScoreOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {/* Advanced filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="claimType">Claim Type</Label>
                <Select value={filters.claimType} onValueChange={(value) => updateFilter('claimType', value)}>
                  <SelectTrigger data-testid="select-claim-type-filter">
                    <SelectValue placeholder="Select claim type" />
                  </SelectTrigger>
                  <SelectContent>
                    {claimTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={filters.priority} onValueChange={(value) => updateFilter('priority', value)}>
                  <SelectTrigger data-testid="select-priority-filter">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fitClassification">Fit Classification</Label>
                <Select value={filters.fitClassification} onValueChange={(value) => updateFilter('fitClassification', value)}>
                  <SelectTrigger data-testid="select-fit-classification-filter">
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                  <SelectContent>
                    {fitClassificationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date range filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Created From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-date-from"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom}
                      onSelect={(date) => updateFilter('dateFrom', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {filters.dateFrom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearDateFilter('dateFrom')}
                    className="h-8 px-2"
                    data-testid="button-clear-date-from"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Created To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-date-to"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(filters.dateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo}
                      onSelect={(date) => updateFilter('dateTo', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {filters.dateTo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearDateFilter('dateTo')}
                    className="h-8 px-2"
                    data-testid="button-clear-date-to"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Sorting options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={filters.sortBy} onValueChange={(value) => updateFilter('sortBy', value)}>
                  <SelectTrigger data-testid="select-sort-by">
                    <SelectValue placeholder="Select sort field" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Select value={filters.sortOrder} onValueChange={(value) => updateFilter('sortOrder', value)}>
                  <SelectTrigger data-testid="select-sort-order">
                    <SelectValue placeholder="Select sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest First</SelectItem>
                    <SelectItem value="asc">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
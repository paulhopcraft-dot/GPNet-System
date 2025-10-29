import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CompanyNav } from "@/components/CompanyNav";
import { SearchBar } from "@/components/SearchBar";
import { CasesTable } from "@/components/CasesTable";
import { CaseDetailPanel } from "@/components/CaseDetailPanel";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { CompanyName, WorkerCase } from "@shared/schema";

export default function GPNet2Dashboard() {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const { data: cases = [], isLoading } = useQuery<WorkerCase[]>({
    queryKey: ["/api/gpnet2/cases"],
    refetchInterval: 30000,
  });

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const matchesCompany = !selectedCompany || c.company === selectedCompany;
      const matchesSearch =
        !searchQuery ||
        c.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCompany && matchesSearch;
    });
  }, [cases, selectedCompany, searchQuery]);

  const selectedCase = useMemo(() => {
    return cases.find((c) => c.id === selectedCaseId) || null;
  }, [cases, selectedCaseId]);

  const handleCaseClick = (caseId: string) => {
    setSelectedCaseId(caseId);
  };

  const handleClosePanel = () => {
    setSelectedCaseId(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading cases...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 flex-shrink-0 bg-sidebar p-4 border-r border-sidebar-border">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-primary/20 rounded-full size-10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">corporate_fare</span>
          </div>
          <h1 className="text-sidebar-foreground text-xl font-bold">GPNet 2</h1>
        </div>
        <CompanyNav selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} cases={cases} />
      </aside>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
          <div className="flex justify-between items-center gap-4 mb-6">
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
            <div className="flex items-center gap-2">
              <Button disabled data-testid="button-add-case">
                <span className="material-symbols-outlined text-base">add</span>
                <span className="font-bold">Add Case</span>
              </Button>
              <ThemeToggle />
            </div>
          </div>
          <CasesTable 
            cases={filteredCases} 
            selectedCaseId={selectedCaseId}
            onCaseClick={handleCaseClick} 
          />
        </div>

        {selectedCase && (
          <CaseDetailPanel workerCase={selectedCase} onClose={handleClosePanel} />
        )}
      </main>
    </div>
  );
}

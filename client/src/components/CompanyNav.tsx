import type { WorkerCase } from "@shared/schema";

interface CompanyNavProps {
  selectedCompany: string | null;
  onSelectCompany: (company: string | null) => void;
  cases: WorkerCase[];
}

export function CompanyNav({ selectedCompany, onSelectCompany, cases }: CompanyNavProps) {
  // Dynamically extract unique companies from actual case data
  const companies = Array.from(new Set(cases.map(c => c.company)))
    .filter(company => company)
    .sort();
  return (
    <nav className="space-y-1">
      <button
        onClick={() => onSelectCompany(null)}
        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
          selectedCompany === null
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover-elevate"
        }`}
        data-testid="button-company-all"
      >
        All Companies
      </button>
      {companies.map((company) => (
        <button
          key={company}
          onClick={() => onSelectCompany(company)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
            selectedCompany === company
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover-elevate"
          }`}
          data-testid={`button-company-${company.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {company}
        </button>
      ))}
    </nav>
  );
}

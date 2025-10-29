import type { WorkerCase, WorkStatus } from "@shared/schema";
import { RiskBadge } from "./RiskBadge";
import { WorkStatusFilter } from "./WorkStatusFilter";
import { useState } from "react";
import { Link2 } from "lucide-react";

interface CasesTableProps {
  cases: WorkerCase[];
  selectedCaseId?: string | null;
  onCaseClick?: (caseId: string) => void;
}

export function CasesTable({ cases, selectedCaseId, onCaseClick }: CasesTableProps) {
  const [workStatusFilter, setWorkStatusFilter] = useState<WorkStatus | "All">("All");

  const filteredCases = cases.filter((c) => 
    workStatusFilter === "All" || c.workStatus === workStatusFilter
  );

  return (
    <div className="flex-1 overflow-x-auto bg-card rounded-xl border border-border">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted border-b border-border">
          <tr>
            <th className="px-4 py-3 font-medium text-muted-foreground">Worker Name</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Date of Injury</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Company</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Risk Level</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Work Status</span>
                <WorkStatusFilter
                  selectedStatus={workStatusFilter}
                  onSelectStatus={setWorkStatusFilter}
                />
              </div>
            </th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Latest Certificate</th>
            <th className="px-4 py-3 font-medium text-muted-foreground">Compliance Indicator</th>
            <th className="px-6 py-3 font-medium text-muted-foreground w-1/3">Next Step (Owner / Due Date)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredCases.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                No cases found
              </td>
            </tr>
          ) : (
            filteredCases.map((workerCase) => {
              const isSelected = selectedCaseId === workerCase.id;
              return (
                <tr
                  key={workerCase.id}
                  onClick={() => onCaseClick?.(workerCase.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "hover-elevate"
                  }`}
                  data-testid={`row-case-${workerCase.id}`}
                >
                  <td className="px-4 py-3 font-medium text-card-foreground">
                    {workerCase.workerName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {workerCase.dateOfInjury || '-'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{workerCase.company}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={workerCase.riskLevel} type="risk" />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{workerCase.workStatus}</td>
                  <td className="px-4 py-3">
                    {workerCase.hasCertificate ? (
                      <a
                        href={workerCase.certificateUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`link-certificate-${workerCase.id}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={workerCase.complianceIndicator} type="compliance" />
                  </td>
                  <td className="px-6 py-3 text-card-foreground w-1/3">
                    <div className="space-y-1">
                      <div className="font-medium">{workerCase.nextStep}</div>
                      <div className="text-sm text-muted-foreground">
                        {workerCase.owner} {workerCase.dueDate && `• Due: ${workerCase.dueDate}`}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

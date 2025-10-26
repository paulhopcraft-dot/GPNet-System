import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

interface GPNet2Case {
  workerName: string;
  company: string;
  riskLevel: string;
  workStatus: string;
  latestCert: string;
  compliance: string;
  summary: string;
  nextStep: string;
  owner: string;
  dueDate: string;
}

export default function GPNet2Table() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: cases = [], isLoading } = useQuery<GPNet2Case[]>({
    queryKey: ['/api/gpnet2/cases'],
  });

  const filteredCases = cases.filter((c) =>
    c.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskBadgeColor = (level: string) => {
    switch(level.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getComplianceBadgeColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'very high': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400';
      case 'high': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'low': return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle data-testid="text-gpnet2-title">GPNet 2</CardTitle>
            <CardDescription>Case management dashboard</CardDescription>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search"
              placeholder="Search by Worker or Company"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading cases...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-sm">Worker Name</th>
                  <th className="text-left p-3 font-medium text-sm">Company</th>
                  <th className="text-left p-3 font-medium text-sm">Risk Level</th>
                  <th className="text-left p-3 font-medium text-sm">Work Status</th>
                  <th className="text-left p-3 font-medium text-sm">Latest Cert File</th>
                  <th className="text-left p-3 font-medium text-sm">Compliance Status</th>
                  <th className="text-left p-3 font-medium text-sm">Where are we at?</th>
                  <th className="text-left p-3 font-medium text-sm">Next Step - Owner + Due</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((caseItem, index) => (
                  <tr 
                    key={index} 
                    data-testid={`row-case-${index}`}
                    className="border-b hover-elevate cursor-pointer"
                  >
                    <td className="p-3 font-medium" data-testid={`text-worker-${index}`}>
                      {caseItem.workerName}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {caseItem.company}
                    </td>
                    <td className="p-3">
                      <Badge className={getRiskBadgeColor(caseItem.riskLevel)} data-testid={`badge-risk-${index}`}>
                        {caseItem.riskLevel}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" data-testid={`badge-work-${index}`}>
                        {caseItem.workStatus}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      {caseItem.latestCert}
                    </td>
                    <td className="p-3">
                      <Badge className={getComplianceBadgeColor(caseItem.compliance)} data-testid={`badge-compliance-${index}`}>
                        {caseItem.compliance}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm max-w-xs truncate" title={caseItem.summary}>
                      {caseItem.summary}
                    </td>
                    <td className="p-3 text-sm">
                      <div className="space-y-1">
                        <div className="font-medium">{caseItem.nextStep}</div>
                        <div className="text-xs text-muted-foreground">
                          {caseItem.owner} · {caseItem.dueDate}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCases.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No cases found
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

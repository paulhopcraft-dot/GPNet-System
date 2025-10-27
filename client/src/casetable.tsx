import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";
import { AlertTriangle, CheckCircle, Clock, FileText } from "lucide-react";

interface CaseRecord {
  workerName: string;
  company: string;
  riskLevel: string;
  workStatus: string;
  latestCert: string;
  compliance: string;
  summary?: string;
  nextStep: string;
  owner: string;
  dueDate: string;
}

export default function CaseTable() {
  const { data: cases, isLoading } = useQuery<CaseRecord[]>({
    queryKey: ["/api/gpnet2/cases"],
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/gpnet2/stats"],
  });

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "high": return "bg-red-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getComplianceColor = (compliance: string) => {
    switch (compliance.toLowerCase()) {
      case "very high": return "bg-green-500 text-white";
      case "high": return "bg-blue-500 text-white";
      case "medium": return "bg-yellow-500 text-white";
      case "low": return "bg-orange-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cases...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-dashboard">GPNet2 Case Dashboard</h1>
          <p className="text-muted-foreground">
            Worker health case management and compliance tracking
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2" data-testid="badge-total-cases">
          {cases?.length || 0} Total Cases
        </Badge>
      </div>

      {/* Dashboard Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-high-risk">
              {cases?.filter(c => c.riskLevel.toLowerCase() === "high").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-active-workers">
              {cases?.filter(c => c.workStatus.toLowerCase() === "at work").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Actions</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending-actions">
              {cases?.filter(c => c.nextStep && c.nextStep !== "None").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certificates</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-certificates">
              {cases?.filter(c => c.latestCert && c.latestCert !== "None").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Worker Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Risk Level</TableHead>
                <TableHead>Work Status</TableHead>
                <TableHead>Latest Certificate</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Next Step</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!cases || cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No cases found
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((c, i) => (
                  <TableRow key={i} data-testid={`row-case-${i}`}>
                    <TableCell className="font-medium" data-testid={`cell-worker-${i}`}>{c.workerName}</TableCell>
                    <TableCell data-testid={`cell-company-${i}`}>{c.company}</TableCell>
                    <TableCell>
                      <Badge className={getRiskColor(c.riskLevel)} data-testid={`badge-risk-${i}`}>
                        {c.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-status-${i}`}>{c.workStatus}</TableCell>
                    <TableCell data-testid={`cell-cert-${i}`}>{c.latestCert}</TableCell>
                    <TableCell>
                      <Badge className={getComplianceColor(c.compliance)} data-testid={`badge-compliance-${i}`}>
                        {c.compliance}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-next-${i}`}>{c.nextStep}</TableCell>
                    <TableCell data-testid={`cell-owner-${i}`}>{c.owner}</TableCell>
                    <TableCell data-testid={`cell-due-${i}`}>{c.dueDate}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

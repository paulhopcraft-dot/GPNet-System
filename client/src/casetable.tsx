import React, { useEffect, useState } from "react";

interface CaseRecord {
  workerName: string;
  company: string;
  riskLevel: string;
  workStatus: string;
  latestCert: string;
  compliance: string;
  nextStep: string;
  owner: string;
  dueDate: string;
}

const CaseTable: React.FC = () => {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gpnet2/cases")
      .then((res) => res.json())
      .then((data) => {
        setCases(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading cases:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Loading cases...</p>;

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">GPNet2 – Case Dashboard</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Worker Name</th>
            <th className="p-2 border">Company</th>
            <th className="p-2 border">Risk</th>
            <th className="p-2 border">Work Status</th>
            <th className="p-2 border">Latest Certificate</th>
            <th className="p-2 border">Compliance</th>
            <th className="p-2 border">Next Step</th>
            <th className="p-2 border">Owner</th>
            <th className="p-2 border">Due</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="p-2 border">{c.workerName}</td>
              <td className="p-2 border">{c.company}</td>
              <td className="p-2 border">{c.riskLevel}</td>
              <td className="p-2 border">{c.workStatus}</td>
              <td className="p-2 border">{c.latestCert}</td>
              <td className="p-2 border">{c.compliance}</td>
              <td className="p-2 border">{c.nextStep}</td>
              <td className="p-2 border">{c.owner}</td>
              <td className="p-2 border">{c.dueDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CaseTable;

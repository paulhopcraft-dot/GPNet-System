import { useState } from 'react';
import CaseDetailsModal from '../CaseDetailsModal';
import { Button } from '@/components/ui/button';

export default function CaseDetailsModalExample() {
  const [isOpen, setIsOpen] = useState(false);

  const mockCaseDetails = {
    ticketId: "1234",
    workerName: "John Smith",
    email: "john.smith@email.com",
    phone: "+1 (555) 123-4567",
    roleApplied: "Warehouse Operator",
    company: "ABC Logistics",
    status: "AWAITING_REVIEW",
    ragScore: "amber" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    fitClassification: "Fit with Restrictions",
    recommendations: [
      "Recommend ergonomic assessment for lifting tasks",
      "Provide back support training before starting role",
      "Consider job rotation to minimize repetitive strain"
    ],
    notes: "Candidate has previous back strain history but shows good functional capacity. Recommendations focus on preventive measures."
  };

  return (
    <div className="p-6">
      <Button onClick={() => setIsOpen(true)}>
        Open Case Details Modal
      </Button>
      
      <CaseDetailsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        caseDetails={mockCaseDetails}
        onStatusUpdate={(ticketId, status) => console.log('Status update:', ticketId, status)}
        onRecommendationsUpdate={(ticketId, recs) => console.log('Recommendations update:', ticketId, recs)}
      />
    </div>
  )
}
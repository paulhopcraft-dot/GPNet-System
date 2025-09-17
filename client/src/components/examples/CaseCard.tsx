import CaseCard from '../CaseCard'

export default function CaseCardExample() {
  return (
    <div className="p-4 space-y-4">
      <CaseCard
        ticketId="1234"
        workerName="John Smith"
        roleApplied="Warehouse Operator"
        company="ABC Logistics"
        status="AWAITING_REVIEW"
        ragScore="amber"
        createdAt={new Date(Date.now() - 1000 * 60 * 60 * 2)} // 2 hours ago
        onViewCase={() => console.log('View case clicked')}
      />
      <CaseCard
        ticketId="5678"
        workerName="Maria Lopez"
        roleApplied="Office Administrator"
        company="XYZ Corp"
        status="COMPLETE"
        ragScore="green"
        createdAt={new Date(Date.now() - 1000 * 60 * 60 * 24)} // 1 day ago
        onViewCase={() => console.log('View case clicked')}
      />
      <CaseCard
        ticketId="9012"
        workerName="David Wilson"
        roleApplied="Construction Worker"
        status="REVISIONS_REQUIRED"
        ragScore="red"
        createdAt={new Date(Date.now() - 1000 * 60 * 30)} // 30 minutes ago
        onViewCase={() => console.log('View case clicked')}
      />
    </div>
  )
}
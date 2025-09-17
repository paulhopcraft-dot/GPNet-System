import StatusBoard from '../StatusBoard'

export default function StatusBoardExample() {
  const mockStats = {
    total: 147,
    new: 23,
    inProgress: 34,
    awaiting: 12,
    complete: 78,
    flagged: 5,
  }

  return (
    <div className="p-6">
      <StatusBoard 
        stats={mockStats}
        todayCount={8}
        weeklyGrowth={15}
      />
    </div>
  )
}
import type { RiskLevel, ComplianceIndicator } from "@shared/schema";

interface RiskBadgeProps {
  level: RiskLevel | ComplianceIndicator;
  type: "risk" | "compliance";
}

export function RiskBadge({ level, type }: RiskBadgeProps) {
  const getColorClass = () => {
    if (type === "risk") {
      switch (level) {
        case "High":
          return "bg-red-500 text-white";
        case "Medium":
          return "bg-yellow-500 text-white";
        case "Low":
          return "bg-green-500 text-white";
        default:
          return "bg-gray-500 text-white";
      }
    } else {
      switch (level) {
        case "Very High":
          return "bg-green-500 text-white";
        case "High":
          return "bg-blue-500 text-white";
        case "Medium":
          return "bg-yellow-500 text-white";
        case "Low":
          return "bg-orange-500 text-white";
        case "Very Low":
          return "bg-red-500 text-white";
        default:
          return "bg-gray-500 text-white";
      }
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColorClass()}`}
      data-testid={`badge-${type}-${level.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {level}
    </span>
  );
}

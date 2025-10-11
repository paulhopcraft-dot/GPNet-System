/**
 * JotForm Webhook Test - Module 1 WIS Fields Validation
 * Usage: node test-jotform-webhook.js
 */

const testPayload = {
  // Core Worker Details
  firstName: "John",
  lastName: "Smith",
  email: "john.smith@example.com",
  phone: "0412345678",
  employeeId: "EMP001",
  
  // Manager Details (NEW)
  managerName: "Sarah Johnson",
  managerEmail: "sarah.j@company.com",
  managerPhone: "0423456789",
  
  // Incident Details (Enhanced)
  injuryDate: "2024-01-15T10:30:00",
  injuryLocation: "Warehouse Bay 3",
  description: "Worker slipped on wet floor while carrying boxes",
  activityAtTime: "Moving stock from delivery to storage",
  witnesses: "Mike Chen (0434567890)",
  
  // Medical Response (NEW)
  ambulanceCalled: "Yes",
  hospitalAttended: "Yes",
  hospitalName: "St Vincent's Hospital",
  doctorSeen: "Yes",
  firstAidAdministered: "Yes",
  firstAidDetails: "Ice pack applied to knee",
  
  // Worker Status (NEW)
  currentLocation: "In hospital",
  workStatus: "Off work",
  expectedTimeOff: "1 week",
  
  // Employment Context (NEW)
  underPerformanceManagement: "No",
  previousInjuries: "Yes",
  previousInjuryDetails: "Minor hand injury 6 months ago",
  additionalInfo: "Floor was recently mopped, no warning sign visible",
  
  // System Metadata
  caseId: "TEST-001",
  companyId: "ORG-123"
};

async function testWebhook() {
  console.log("🧪 Testing JotForm Injury Webhook...\n");
  
  try {
    const response = await fetch("http://0.0.0.0:5000/api/webhook/injury", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    console.log("✅ Response Status:", response.status);
    console.log("\n📦 Response Data:");
    console.log(JSON.stringify(result, null, 2));
    
    console.log("\n🔍 Verify these Module 1 fields were captured:");
    console.log("- Manager:", result.normalized?.managerName || "❌ Missing");
    console.log("- Medical Response:", result.normalized?.ambulanceCalled ? "✓" : "❌");
    console.log("- Worker Status:", result.normalized?.currentLocation || "❌ Missing");
    console.log("- Employment Context:", result.normalized?.previousInjuries !== undefined ? "✓" : "❌");
    console.log("- System Metadata:", result.normalized?.caseId || "❌ Missing");
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("\nMake sure the server is running: npm run dev");
  }
}

testWebhook();

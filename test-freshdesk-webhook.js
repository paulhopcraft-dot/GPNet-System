/**
 * Test Freshdesk Webhook Endpoint
 * Verifies that the endpoint accepts requests without signatures
 */

const testPayload = {
  type: "ticket_created",
  ticket: {
    id: 99999,
    subject: "Test Medical Document Upload",
    status: 2,
    priority: 1,
    requester_id: 12345,
    company_id: 67890,
    attachments: [
      {
        id: 1,
        name: "medical_certificate.pdf",
        content_type: "application/pdf",
        size: 102400,
        attachment_url: "https://example.com/attachments/cert.pdf"
      }
    ]
  },
  requester: {
    id: 12345,
    name: "John Smith",
    email: "john.smith@example.com"
  },
  time_stamp: new Date().toISOString()
};

async function testWebhook() {
  console.log("🧪 Testing Freshdesk Webhook (without signature)...\n");
  
  try {
    const response = await fetch("http://0.0.0.0:5000/api/medical-documents/freshdesk-webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
        // NOTE: No X-Freshdesk-Signature header - testing that it's optional
      },
      body: JSON.stringify(testPayload)
    });
    
    const result = await response.json();
    
    if (response.status === 200) {
      console.log("✅ SUCCESS! Webhook accepted without signature");
      console.log("\nResponse:", JSON.stringify(result, null, 2));
    } else if (response.status === 401) {
      console.log("❌ FAILED: Still requiring signature (error not fixed)");
      console.log("Response:", result);
    } else {
      console.log(`⚠️ Response Status: ${response.status}`);
      console.log("Response:", JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("\nMake sure the server is running: npm run dev");
  }
}

testWebhook();

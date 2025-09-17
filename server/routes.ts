import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { preEmploymentFormSchema, type PreEmploymentFormData } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

// Analysis engine for RAG scoring and fit classification
class AnalysisEngine {
  analyzeSubmission(formData: PreEmploymentFormData) {
    const risks: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    let fitClassification = "fit";
    const recommendations: string[] = [];

    // Lifting capacity assessment
    if (formData.liftingKg < 15) {
      risks.push("Low lifting capacity");
      ragScore = "amber";
      recommendations.push("Consider ergonomic assessment for lifting tasks");
    }

    // Repetitive tasks assessment
    if (formData.repetitiveTasks === "yes") {
      risks.push("Repetitive task concerns");
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Provide training on repetitive strain injury prevention");
    }

    // Musculoskeletal assessments
    const mskFields = [
      { field: formData.mskBack, name: "back", details: formData.mskBackDetails },
      { field: formData.mskNeck, name: "neck", details: formData.mskNeckDetails },
      { field: formData.mskShoulders, name: "shoulders", details: formData.mskShouldersDetails },
      { field: formData.mskElbows, name: "elbows", details: formData.mskElbowsDetails },
      { field: formData.mskWrists, name: "wrists", details: formData.mskWristsDetails },
      { field: formData.mskHips, name: "hips", details: formData.mskHipsDetails },
      { field: formData.mskKnees, name: "knees", details: formData.mskKneesDetails },
      { field: formData.mskAnkles, name: "ankles", details: formData.mskAnklesDetails },
    ];

    let currentIssues = 0;
    let pastIssues = 0;

    mskFields.forEach(({ field, name, details }) => {
      if (field === "current") {
        currentIssues++;
        risks.push(`Current ${name} issue: ${details || "Not specified"}`);
        recommendations.push(`Seek medical clearance for ${name} condition`);
      } else if (field === "past") {
        pastIssues++;
        recommendations.push(`Monitor ${name} for any recurring symptoms`);
      }
    });

    // Determine RAG score based on issues
    if (currentIssues >= 2) {
      ragScore = "red";
      fitClassification = "not_fit";
      recommendations.push("Comprehensive medical assessment required before employment");
    } else if (currentIssues === 1 || pastIssues >= 2) {
      ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      recommendations.push("Regular monitoring and ergonomic support recommended");
    }

    // Psychosocial screening
    if (formData.stressRating >= 4 || formData.sleepRating <= 2 || formData.supportRating <= 2) {
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Consider workplace wellness program referral");
    }

    // Set final fit classification
    if (ragScore === "red") {
      fitClassification = "not_fit";
    } else if (ragScore === "amber") {
      fitClassification = "fit_with_restrictions";
    } else {
      fitClassification = "fit";
    }

    // Default recommendations if none identified
    if (recommendations.length === 0) {
      recommendations.push("No specific restrictions identified - standard workplace safety protocols apply");
    }

    return {
      ragScore,
      fitClassification,
      recommendations,
      notes: risks.length > 0 ? `Identified risks: ${risks.join(", ")}` : "No significant health risks identified",
    };
  }
}

const analysisEngine = new AnalysisEngine();

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Jotform webhook endpoint for receiving form submissions
  app.post("/api/webhook/jotform", async (req, res) => {
    try {
      console.log("Received Jotform webhook:", req.body);
      
      // Validate the form data
      const validationResult = preEmploymentFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid form data", details: errorMessage });
      }

      const formData = validationResult.data;

      // Create worker record
      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.roleApplied,
        site: formData.site || null,
      });

      // Create ticket
      const ticket = await storage.createTicket({
        caseType: "pre_employment",
        status: "NEW",
      });

      // Create form submission record
      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Perform automated analysis
      const analysisResult = analysisEngine.analyzeSubmission(formData);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      // Update ticket status to AWAITING_REVIEW
      await storage.updateTicketStatus(ticket.id, "AWAITING_REVIEW");

      console.log(`Created case ${ticket.id} for ${worker.firstName} ${worker.lastName}`);

      res.json({
        success: true,
        ticketId: ticket.id,
        status: "AWAITING_REVIEW",
        message: "Form processed successfully",
      });

    } catch (error) {
      console.error("Error processing form submission:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to process form submission" 
      });
    }
  });

  // Dashboard API - Get statistics
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Get all cases with optional filtering
  app.get("/api/cases", async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      
      // For each ticket, get associated worker and analysis data
      const cases = await Promise.all(
        tickets.map(async (ticket) => {
          const submission = await storage.getFormSubmissionByTicket(ticket.id);
          const analysis = await storage.getAnalysisByTicket(ticket.id);
          
          let worker = null;
          if (submission) {
            worker = await storage.getWorker(submission.workerId);
          }

          return {
            ticketId: ticket.id,
            status: ticket.status,
            createdAt: ticket.createdAt,
            workerName: worker ? `${worker.firstName} ${worker.lastName}` : "Unknown",
            email: worker?.email || "",
            phone: worker?.phone || "",
            roleApplied: worker?.roleApplied || "",
            company: "", // To be implemented with company data
            ragScore: analysis?.ragScore || "green",
            fitClassification: analysis?.fitClassification || "",
            recommendations: analysis?.recommendations || [],
            notes: analysis?.notes || "",
          };
        })
      );

      res.json(cases);
    } catch (error) {
      console.error("Error fetching cases:", error);
      res.status(500).json({ error: "Failed to fetch cases" });
    }
  });

  // Get specific case details
  app.get("/api/cases/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      const submission = await storage.getFormSubmissionByTicket(ticketId);
      const analysis = await storage.getAnalysisByTicket(ticketId);
      
      let worker = null;
      if (submission) {
        worker = await storage.getWorker(submission.workerId);
      }

      const caseDetails = {
        ticketId: ticket.id,
        status: ticket.status,
        createdAt: ticket.createdAt,
        workerName: worker ? `${worker.firstName} ${worker.lastName}` : "Unknown",
        email: worker?.email || "",
        phone: worker?.phone || "",
        roleApplied: worker?.roleApplied || "",
        company: "", // To be implemented
        ragScore: analysis?.ragScore || "green",
        fitClassification: analysis?.fitClassification || "",
        recommendations: analysis?.recommendations || [],
        notes: analysis?.notes || "",
        formData: submission?.rawData || null,
      };

      res.json(caseDetails);
    } catch (error) {
      console.error("Error fetching case details:", error);
      res.status(500).json({ error: "Failed to fetch case details" });
    }
  });

  // Update case recommendations (consultant review)
  app.put("/api/cases/:ticketId/recommendations", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { recommendations } = req.body;

      if (!Array.isArray(recommendations)) {
        return res.status(400).json({ error: "Recommendations must be an array" });
      }

      await storage.updateAnalysis(ticketId, { recommendations });

      res.json({ success: true, message: "Recommendations updated" });
    } catch (error) {
      console.error("Error updating recommendations:", error);
      res.status(500).json({ error: "Failed to update recommendations" });
    }
  });

  // Update case status
  app.put("/api/cases/:ticketId/status", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;

      const validStatuses = ["NEW", "ANALYSING", "AWAITING_REVIEW", "REVISIONS_REQUIRED", "READY_TO_SEND", "COMPLETE"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.updateTicketStatus(ticketId, status);

      res.json({ success: true, message: "Status updated" });
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Test endpoint for form submission (for demo purposes)
  app.post("/api/test/submit-form", async (req, res) => {
    try {
      // This endpoint simulates a form submission for testing
      const testFormData: PreEmploymentFormData = {
        firstName: "John",
        lastName: "Smith",
        dateOfBirth: "1990-01-01",
        phone: "+1-555-123-4567",
        email: "john.smith@test.com",
        roleApplied: "Warehouse Operator",
        site: "Main Site",
        previousInjuries: "Minor back strain 2 years ago",
        conditions: [],
        medications: "None",
        allergies: "None",
        mskBack: "past",
        mskBackDetails: "Previous minor strain, fully recovered",
        mskNeck: "none",
        mskShoulders: "none",
        mskElbows: "none",
        mskWrists: "none",
        mskHips: "none",
        mskKnees: "none",
        mskAnkles: "none",
        liftingKg: 25,
        standingMins: 120,
        walkingMins: 60,
        repetitiveTasks: "no",
        sleepRating: 4,
        stressRating: 2,
        supportRating: 4,
        psychosocialComments: "Generally feeling good about work-life balance",
        consentToShare: true,
        signature: "John Smith",
        signatureDate: new Date().toISOString().split('T')[0],
      };

      // Process through the same workflow as the webhook
      const response = await fetch(`${req.protocol}://${req.get('host')}/api/webhook/jotform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFormData),
      });

      const result = await response.json();
      res.json({ success: true, result });

    } catch (error) {
      console.error("Error in test submission:", error);
      res.status(500).json({ error: "Test submission failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

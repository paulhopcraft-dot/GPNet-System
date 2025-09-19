import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { preEmploymentFormSchema, type PreEmploymentFormData, injuryFormSchema, type InjuryFormData, rtwPlanSchema, insertStakeholderSchema } from "@shared/schema";
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

// Enhanced Injury Analysis Engine for comprehensive workplace injury assessments
class InjuryAnalysisEngine {
  analyzeInjury(formData: InjuryFormData) {
    const risks: string[] = [];
    const riskFactors: string[] = [];
    let ragScore: "green" | "amber" | "red" = "green";
    let fitClassification = "fit";
    const recommendations: string[] = [];
    const workCapacityAssessment: string[] = [];
    const medicalRecommendations: string[] = [];
    const workplaceModifications: string[] = [];

    // Severity assessment
    if (formData.severity === "major" || formData.severity === "serious") {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push(`${formData.severity} injury requiring comprehensive assessment`);
      recommendations.push("Immediate medical assessment required before return to work");
      recommendations.push("Development of comprehensive return-to-work plan necessary");
    } else if (formData.severity === "moderate") {
      ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      risks.push("Moderate injury requiring monitoring");
      recommendations.push("Modified duties may be required during recovery");
    }

    // Time off work assessment
    if (formData.timeOffWork) {
      if (ragScore === "green") ragScore = "amber";
      recommendations.push("Return-to-work planning and medical clearance required");
      risks.push("Time off work required for recovery");
    }

    // Work capacity assessment
    if (formData.canReturnToWork === "no") {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push("Unable to return to work at this time");
      recommendations.push("Medical treatment and recovery period required");
      recommendations.push("Regular medical review to assess fitness for work");
    } else if (formData.canReturnToWork === "with_restrictions") {
      if (ragScore === "green") ragScore = "amber";
      fitClassification = "fit_with_restrictions";
      recommendations.push("Return to work with medical restrictions and modified duties");
      
      // Add specific restrictions
      if (formData.workRestrictions && formData.workRestrictions.length > 0) {
        risks.push(`Work restrictions required: ${formData.workRestrictions.join(", ")}`);
      }
    }

    // Body parts affected analysis
    if (formData.bodyPartsAffected && formData.bodyPartsAffected.length > 0) {
      const criticalAreas = ["Back", "Neck", "Head", "Chest"];
      const affectedCritical = formData.bodyPartsAffected.filter(part => 
        criticalAreas.some(critical => part.toLowerCase().includes(critical.toLowerCase()))
      );
      
      if (affectedCritical.length > 0) {
        if (ragScore === "green") ragScore = "amber";
        risks.push(`Critical body areas affected: ${affectedCritical.join(", ")}`);
        recommendations.push("Specialist medical assessment recommended for critical body areas");
      }

      if (formData.bodyPartsAffected.length >= 3) {
        ragScore = "red";
        risks.push("Multiple body parts affected indicating complex injury");
        recommendations.push("Comprehensive medical evaluation for multi-site injury");
      }
    }

    // Injury type assessment
    const highRiskInjuries = ["Fracture/Break", "Burn", "Chemical Exposure", "Crush"];
    if (highRiskInjuries.includes(formData.injuryType)) {
      ragScore = "red";
      fitClassification = "not_fit";
      risks.push(`High-risk injury type: ${formData.injuryType}`);
      recommendations.push("Specialist medical treatment and extended recovery period required");
    }

    // WorkCover claim assessment
    if (formData.claimType === "workcover") {
      recommendations.push("WorkCover claim processing required");
      recommendations.push("Case manager assignment and claim documentation necessary");
      risks.push("WorkCover claim - formal injury management process required");
    }

    // Recovery time assessment
    if (formData.estimatedRecovery) {
      const recoveryLower = formData.estimatedRecovery.toLowerCase();
      if (recoveryLower.includes("month") || recoveryLower.includes("week")) {
        if (ragScore === "green") ragScore = "amber";
        medicalRecommendations.push("Extended recovery period - regular medical review required");
        workCapacityAssessment.push("Extended recovery may affect return-to-work timeline");
      }
      if (recoveryLower.includes("unknown") || recoveryLower.includes("unclear")) {
        if (ragScore === "green") ragScore = "amber";
        medicalRecommendations.push("Uncertain recovery timeline - close medical monitoring required");
        riskFactors.push("Unpredictable recovery timeline increases case complexity");
      }
    }

    // Enhanced injury type-specific assessments
    this.analyzeInjuryTypeSpecific(formData, riskFactors, workCapacityAssessment, medicalRecommendations, workplaceModifications);
    
    // Position and department-specific risk assessment
    this.analyzeWorkplaceFactors(formData, workplaceModifications, workCapacityAssessment);
    
    // Recovery timeline and RTW planning
    this.generateRTWRecommendations(formData, medicalRecommendations, workCapacityAssessment);

    // Set final fit classification based on RAG score
    if (ragScore === "red") {
      fitClassification = "not_fit";
    } else if (ragScore === "amber") {
      fitClassification = "fit_with_restrictions";
    } else {
      fitClassification = "fit";
    }

    // Default recommendations if none identified
    if (recommendations.length === 0) {
      recommendations.push("Monitor for symptom changes and ensure proper workplace safety protocols");
    }

    return {
      ragScore,
      fitClassification,
      recommendations: [...recommendations, ...medicalRecommendations, ...workCapacityAssessment, ...workplaceModifications],
      notes: risks.length > 0 ? `Identified risks: ${risks.join("; ")}` : "Minor injury with standard recovery expected",
      riskFactors,
      workCapacityAssessment,
      medicalRecommendations,
      workplaceModifications,
    };
  }

  // Analyze injury type-specific factors and implications
  analyzeInjuryTypeSpecific(formData: InjuryFormData, riskFactors: string[], workCapacity: string[], medical: string[], workplace: string[]) {
    const injuryTypeAssessments = {
      "Strain/Sprain": {
        risks: ["Potential for re-injury", "Recurring pain patterns"],
        capacity: ["May require lifting restrictions", "Gradual return to full duties"],
        medical: ["Physiotherapy assessment recommended", "Pain management strategies"],
        workplace: ["Ergonomic workstation assessment", "Manual handling training"]
      },
      "Cut/Laceration": {
        risks: ["Infection risk", "Scarring affecting function"],
        capacity: ["Hand/finger dexterity may be affected", "Possible tool restrictions"],
        medical: ["Wound care management", "Tetanus status verification"],
        workplace: ["Safety equipment review", "Sharp object handling protocols"]
      },
      "Fracture/Break": {
        risks: ["Long recovery period", "Potential permanent impairment"],
        capacity: ["Extended reduced capacity", "Significant work modifications required"],
        medical: ["Orthopedic specialist referral", "X-ray monitoring schedule"],
        workplace: ["Major duty modifications", "Temporary alternative roles"]
      },
      "Burn": {
        risks: ["Scarring and contractures", "Psychological impact"],
        capacity: ["Skin sensitivity to temperature", "Possible mobility restrictions"],
        medical: ["Burn specialist assessment", "Scar management therapy"],
        workplace: ["Heat source exposure elimination", "Personal protective equipment review"]
      },
      "Chemical Exposure": {
        risks: ["Systemic health effects", "Respiratory complications"],
        capacity: ["Chemical sensitivity development", "Breathing restrictions"],
        medical: ["Toxicology consultation", "Ongoing health monitoring"],
        workplace: ["Chemical safety protocols review", "Ventilation system assessment"]
      },
      "Crush": {
        risks: ["Permanent tissue damage", "Complex recovery"],
        capacity: ["Severe functional limitations", "Long-term disability risk"],
        medical: ["Immediate specialist care", "Reconstructive surgery consideration"],
        workplace: ["Machinery safety audit", "Comprehensive training review"]
      }
    };

    const assessment = injuryTypeAssessments[formData.injuryType as keyof typeof injuryTypeAssessments];
    if (assessment) {
      riskFactors.push(...assessment.risks);
      workCapacity.push(...assessment.capacity);
      medical.push(...assessment.medical);
      workplace.push(...assessment.workplace);
    }
  }

  // Analyze workplace factors based on position and department
  analyzeWorkplaceFactors(formData: InjuryFormData, workplace: string[], workCapacity: string[]) {
    // Department-specific assessments
    const departmentRisks = {
      "warehouse": ["Heavy lifting requirements", "Forklift operation", "Standing for extended periods"],
      "office": ["Ergonomic workstation setup", "Computer use duration", "Minimal physical demands"],
      "production": ["Machine operation safety", "Repetitive motions", "Manufacturing environment"],
      "maintenance": ["Tool usage requirements", "Physical accessibility", "Safety equipment needs"],
      "customer service": ["Voice strain considerations", "Sitting/standing options", "Stress management"]
    };

    const dept = formData.department.toLowerCase();
    const relevantRisks = Object.entries(departmentRisks).find(([key]) => 
      dept.includes(key)
    );

    if (relevantRisks) {
      workplace.push(`Department-specific considerations: ${relevantRisks[1].join(", ")}`);
    }

    // Position-specific capacity requirements
    const position = formData.position.toLowerCase();
    if (position.includes("manager") || position.includes("supervisor")) {
      workCapacity.push("Leadership responsibilities may be maintained with physical restrictions");
      workplace.push("Consider delegation of physical oversight tasks");
    }
    
    if (position.includes("driver") || position.includes("operator")) {
      workCapacity.push("Operating licenses and certifications may be affected");
      workplace.push("Medical clearance required for safety-sensitive position");
    }
  }

  // Generate comprehensive RTW recommendations
  generateRTWRecommendations(formData: InjuryFormData, medical: string[], workCapacity: string[]) {
    // Graduated return-to-work planning
    if (formData.canReturnToWork === "with_restrictions") {
      medical.push("Develop graduated return-to-work plan with medical oversight");
      workCapacity.push("Start with reduced hours and gradually increase capacity");
      
      // Specific restriction planning
      if (formData.workRestrictions) {
        formData.workRestrictions.forEach(restriction => {
          switch (restriction.toLowerCase()) {
            case "no lifting":
              workCapacity.push("Alternative duties for all lifting tasks required");
              medical.push("Regular assessment of lifting capacity progression");
              break;
            case "no standing":
              workCapacity.push("Seated work arrangement mandatory");
              medical.push("Monitor for circulation and mobility improvements");
              break;
            case "limited hours":
              workCapacity.push("Flexible scheduling to accommodate medical appointments");
              medical.push("Fatigue management strategies implementation");
              break;
            case "light duties only":
              workCapacity.push("Comprehensive light duty program development");
              medical.push("Regular capacity assessments for duty progression");
              break;
          }
        });
      }
    }

    // Timeline-based recommendations
    if (formData.estimatedRecovery) {
      const recovery = formData.estimatedRecovery.toLowerCase();
      if (recovery.includes("week")) {
        medical.push("Weekly medical reviews during initial recovery phase");
        workCapacity.push("Short-term modified duties with weekly progression assessment");
      } else if (recovery.includes("month")) {
        medical.push("Bi-weekly medical reviews with functional capacity evaluations");
        workCapacity.push("Medium-term rehabilitation program with monthly milestones");
      }
    }

    // WorkCover-specific RTW planning
    if (formData.claimType === "workcover") {
      medical.push("Coordinate with WorkCover case manager for treatment approvals");
      workCapacity.push("Document all capacity changes for WorkCover reporting");
      medical.push("Ensure all treating practitioners are WorkCover approved");
    }
  }
}

const analysisEngine = new AnalysisEngine();
const injuryAnalysisEngine = new InjuryAnalysisEngine();

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

  // Injury webhook endpoint for receiving injury form submissions
  app.post("/api/webhook/injury", async (req, res) => {
    try {
      console.log("Received injury webhook:", req.body);
      
      // Validate the injury form data
      const validationResult = injuryFormSchema.safeParse(req.body);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid injury form data", details: errorMessage });
      }

      const formData = validationResult.data;

      // Create worker record
      const worker = await storage.createWorker({
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: "", // Not captured in injury form
        phone: formData.phone,
        email: formData.email,
        roleApplied: formData.position, // Use position as role applied
        site: formData.department || null,
      });

      // Create ticket for injury case
      const ticket = await storage.createTicket({
        workerId: worker.id,
        caseType: "injury",
        claimType: formData.claimType,
        status: "NEW",
        priority: formData.severity === "major" || formData.severity === "serious" ? "high" : "medium",
      });

      // Create injury record with incident details
      await storage.createInjury({
        ticketId: ticket.id,
        incidentDate: formData.incidentDate,
        incidentTime: formData.incidentTime || null,
        location: formData.location,
        description: formData.description,
        bodyPartsAffected: formData.bodyPartsAffected,
        injuryType: formData.injuryType,
        severity: formData.severity,
        witnessDetails: formData.witnessDetails || null,
        immediateAction: formData.immediateAction || null,
        medicalTreatment: formData.medicalTreatment,
        timeOffWork: formData.timeOffWork,
        estimatedRecovery: formData.estimatedRecovery || null,
      });

      // Create form submission record
      await storage.createFormSubmission({
        ticketId: ticket.id,
        workerId: worker.id,
        rawData: formData,
      });

      // Create doctor stakeholder if provided
      if (formData.doctorName && formData.clinicName) {
        await storage.createStakeholder({
          ticketId: ticket.id,
          role: "doctor",
          name: formData.doctorName,
          email: null,
          phone: formData.clinicPhone || null,
          organization: formData.clinicName,
          notes: "Primary treating doctor",
        });
      }

      // Perform automated injury analysis
      const analysisResult = injuryAnalysisEngine.analyzeInjury(formData);
      
      await storage.createAnalysis({
        ticketId: ticket.id,
        fitClassification: analysisResult.fitClassification,
        ragScore: analysisResult.ragScore,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      // Update ticket status to ANALYSING
      await storage.updateTicketStatus(ticket.id, "ANALYSING");

      console.log(`Created injury case ${ticket.id} for ${worker.firstName} ${worker.lastName}`);

      res.json({
        success: true,
        ticketId: ticket.id,
        caseType: "injury",
        claimType: formData.claimType,
        status: "ANALYSING",
        message: `Injury report processed successfully. ${formData.claimType === 'workcover' ? 'WorkCover claim processing initiated.' : 'Standard claim processing initiated.'}`,
      });

    } catch (error) {
      console.error("Error processing injury submission:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: "Failed to process injury report" 
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
            caseType: ticket.caseType,
            claimType: ticket.claimType || null,
            priority: ticket.priority || null,
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
        caseType: ticket.caseType,
        claimType: ticket.claimType || null,
        priority: ticket.priority || null,
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

  // Regenerate injury analysis
  app.post("/api/cases/:ticketId/regenerate-analysis", async (req, res) => {
    try {
      const { ticketId } = req.params;

      // Get the original form submission
      const submission = await storage.getFormSubmissionByTicket(ticketId);
      if (!submission) {
        return res.status(404).json({ error: "Form submission not found" });
      }

      // Check if this is an injury case
      const ticket = await storage.getTicket(ticketId);
      if (!ticket || ticket.caseType !== "injury") {
        return res.status(400).json({ error: "Analysis regeneration only available for injury cases" });
      }

      // Re-run injury analysis with enhanced engine
      const formData = submission.rawData as any;
      const analysisResult = injuryAnalysisEngine.analyzeInjury(formData);

      // Update the analysis with enhanced results
      await storage.updateAnalysis(ticketId, {
        ragScore: analysisResult.ragScore,
        fitClassification: analysisResult.fitClassification,
        recommendations: analysisResult.recommendations,
        notes: analysisResult.notes,
      });

      console.log(`Regenerated analysis for case ${ticketId}`);
      res.json({ success: true, analysis: analysisResult });

    } catch (error) {
      console.error("Error regenerating analysis:", error);
      res.status(500).json({ error: "Failed to regenerate analysis" });
    }
  });

  // Update assessment notes
  app.put("/api/cases/:ticketId/assessment-notes", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { notes } = req.body;

      // Validate notes
      if (typeof notes !== "string") {
        return res.status(400).json({ error: "Notes must be a string" });
      }

      // Check if case exists
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: "Case not found" });
      }

      // Update analysis notes
      await storage.updateAnalysis(ticketId, { notes });

      console.log(`Updated assessment notes for case ${ticketId}`);
      res.json({ success: true, message: "Assessment notes updated" });

    } catch (error) {
      console.error("Error updating assessment notes:", error);
      res.status(500).json({ error: "Failed to update assessment notes" });
    }
  });

  // Stakeholder API endpoints
  
  // Get stakeholders for a case
  app.get("/api/cases/:ticketId/stakeholders", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const stakeholders = await storage.getStakeholdersByTicket(ticketId);
      res.json(stakeholders);
    } catch (error) {
      console.error("Error fetching stakeholders:", error);
      res.status(500).json({ error: "Failed to fetch stakeholders" });
    }
  });

  // Get specific stakeholder
  app.get("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      const stakeholder = await storage.getStakeholder(stakeholderId);
      
      if (!stakeholder) {
        return res.status(404).json({ error: "Stakeholder not found" });
      }
      
      res.json(stakeholder);
    } catch (error) {
      console.error("Error fetching stakeholder:", error);
      res.status(500).json({ error: "Failed to fetch stakeholder" });
    }
  });

  // Create new stakeholder
  app.post("/api/stakeholders", async (req, res) => {
    try {
      const stakeholderData = req.body;
      
      // Validate stakeholder data
      const validationResult = insertStakeholderSchema.safeParse(stakeholderData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid stakeholder data", details: errorMessage });
      }

      const stakeholder = await storage.createStakeholder(validationResult.data);
      
      console.log(`Created stakeholder ${stakeholder.id} for case ${stakeholder.ticketId}`);
      res.json({ success: true, stakeholder });
      
    } catch (error) {
      console.error("Error creating stakeholder:", error);
      res.status(500).json({ error: "Failed to create stakeholder" });
    }
  });

  // Update stakeholder
  app.put("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      const updates = req.body;
      
      // Validate partial stakeholder updates
      const partialSchema = insertStakeholderSchema.partial();
      const validationResult = partialSchema.safeParse(updates);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid stakeholder update data", details: errorMessage });
      }

      const stakeholder = await storage.updateStakeholder(stakeholderId, validationResult.data);
      
      console.log(`Updated stakeholder ${stakeholderId}`);
      res.json({ success: true, stakeholder });
      
    } catch (error) {
      console.error("Error updating stakeholder:", error);
      res.status(500).json({ error: "Failed to update stakeholder" });
    }
  });

  // Delete stakeholder
  app.delete("/api/stakeholders/:stakeholderId", async (req, res) => {
    try {
      const { stakeholderId } = req.params;
      
      await storage.deleteStakeholder(stakeholderId);
      
      console.log(`Deleted stakeholder ${stakeholderId}`);
      res.json({ success: true, message: "Stakeholder deleted successfully" });
      
    } catch (error) {
      console.error("Error deleting stakeholder:", error);
      res.status(500).json({ error: "Failed to delete stakeholder" });
    }
  });

  // RTW Plan API endpoints
  
  // Get RTW plans for a ticket
  app.get("/api/cases/:ticketId/rtw-plans", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const plans = await storage.getRtwPlansByTicket(ticketId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching RTW plans:", error);
      res.status(500).json({ error: "Failed to fetch RTW plans" });
    }
  });

  // Get specific RTW plan
  app.get("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const plan = await storage.getRtwPlan(planId);
      
      if (!plan) {
        return res.status(404).json({ error: "RTW plan not found" });
      }
      
      res.json(plan);
    } catch (error) {
      console.error("Error fetching RTW plan:", error);
      res.status(500).json({ error: "Failed to fetch RTW plan" });
    }
  });

  // Create new RTW plan
  app.post("/api/cases/:ticketId/rtw-plans", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const planData = { ...req.body, ticketId };
      
      // Validate RTW plan data
      const validationResult = rtwPlanSchema.safeParse(planData);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid RTW plan data", details: errorMessage });
      }

      const plan = await storage.createRtwPlan(validationResult.data);
      
      console.log(`Created RTW plan ${plan.id} for case ${ticketId}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error creating RTW plan:", error);
      res.status(500).json({ error: "Failed to create RTW plan" });
    }
  });

  // Update RTW plan
  app.put("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      const updates = req.body;
      
      // Validate partial RTW plan updates
      const partialSchema = rtwPlanSchema.partial();
      const validationResult = partialSchema.safeParse(updates);
      if (!validationResult.success) {
        const errorMessage = fromZodError(validationResult.error).toString();
        return res.status(400).json({ error: "Invalid RTW plan update data", details: errorMessage });
      }

      const plan = await storage.updateRtwPlan(planId, validationResult.data);
      
      console.log(`Updated RTW plan ${planId}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error updating RTW plan:", error);
      res.status(500).json({ error: "Failed to update RTW plan" });
    }
  });

  // Update RTW plan status
  app.patch("/api/rtw-plans/:planId/status", async (req, res) => {
    try {
      const { planId } = req.params;
      const { status } = req.body;
      
      if (!["draft", "pending_approval", "approved", "active", "completed"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }

      const plan = await storage.updateRtwPlanStatus(planId, status);
      
      console.log(`Updated RTW plan ${planId} status to ${status}`);
      res.json({ success: true, plan });
      
    } catch (error) {
      console.error("Error updating RTW plan status:", error);
      res.status(500).json({ error: "Failed to update RTW plan status" });
    }
  });

  // Delete RTW plan
  app.delete("/api/rtw-plans/:planId", async (req, res) => {
    try {
      const { planId } = req.params;
      await storage.deleteRtwPlan(planId);
      
      console.log(`Deleted RTW plan ${planId}`);
      res.json({ success: true });
      
    } catch (error) {
      console.error("Error deleting RTW plan:", error);
      res.status(500).json({ error: "Failed to delete RTW plan" });
    }
  });

  // ===============================================
  // RTW COMPLEX CLAIMS - LEGISLATION COMPLIANCE API
  // ===============================================

  // Import legislation data from JSON
  app.post("/api/legislation/import", async (req, res) => {
    try {
      const { jsonData } = req.body;
      let importCount = 0;

      // Import WIRC Act sections
      if (jsonData.WIRC) {
        for (const [sectionId, details] of Object.entries(jsonData.WIRC)) {
          const sectionDetails = details as any;
          const legislationData = {
            source: "WIRC",
            sectionId,
            title: sectionDetails.title,
            summary: sectionDetails.summary,
            sourceUrl: sectionDetails.url,
            version: jsonData.source_version || "2025-09-19",
            checksum: jsonData.checksum || "pending",
            documentType: "act",
            jurisdiction: "VIC"
          };

          await storage.createLegislationDocument(legislationData);
          importCount++;
        }
      }

      // Import Claims Manual sections
      if (jsonData.CLAIMS_MANUAL) {
        for (const [sectionId, details] of Object.entries(jsonData.CLAIMS_MANUAL)) {
          const sectionDetails = details as any;
          const legislationData = {
            source: "CLAIMS_MANUAL",
            sectionId,
            title: sectionDetails.title,
            summary: sectionDetails.summary || "",
            sourceUrl: sectionDetails.url,
            version: jsonData.source_version || "2025-09-19",
            checksum: jsonData.checksum || "pending",
            documentType: "manual",
            jurisdiction: "VIC"
          };

          await storage.createLegislationDocument(legislationData);
          importCount++;
        }
      }

      console.log(`Imported ${importCount} legislation sections`);
      res.json({ 
        success: true, 
        message: `Successfully imported ${importCount} legislation sections`,
        importCount 
      });

    } catch (error) {
      console.error("Error importing legislation data:", error);
      res.status(500).json({ error: "Failed to import legislation data" });
    }
  });

  // Get all legislation
  app.get("/api/legislation", async (req, res) => {
    try {
      const legislation = await storage.getAllLegislation();
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation:", error);
      res.status(500).json({ error: "Failed to fetch legislation" });
    }
  });

  // Get legislation by source (WIRC, CLAIMS_MANUAL)
  app.get("/api/legislation/:source", async (req, res) => {
    try {
      const { source } = req.params;
      const legislation = await storage.getLegislationBySource(source);
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation by source:", error);
      res.status(500).json({ error: "Failed to fetch legislation" });
    }
  });

  // Get specific legislation section
  app.get("/api/legislation/:source/:sectionId", async (req, res) => {
    try {
      const { source, sectionId } = req.params;
      const legislation = await storage.getLegislationBySourceAndSection(source, sectionId);
      
      if (!legislation) {
        return res.status(404).json({ error: "Legislation section not found" });
      }
      
      res.json(legislation);
    } catch (error) {
      console.error("Error fetching legislation section:", error);
      res.status(500).json({ error: "Failed to fetch legislation section" });
    }
  });

  // RTW Workflow Management
  app.post("/api/tickets/:ticketId/rtw-workflow", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const workflowData = req.body;

      const step = await storage.createRtwWorkflowStep({
        ticketId,
        ...workflowData
      });

      // Update ticket RTW status
      await storage.updateTicketRtwStatus(
        ticketId, 
        workflowData.stepId, 
        "compliant"
      );

      console.log(`Created RTW workflow step for ticket ${ticketId}`);
      res.json({ success: true, step });

    } catch (error) {
      console.error("Error creating RTW workflow step:", error);
      res.status(500).json({ error: "Failed to create RTW workflow step" });
    }
  });

  // Get RTW workflow steps for a ticket
  app.get("/api/tickets/:ticketId/rtw-workflow", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const steps = await storage.getRtwWorkflowStepsByTicket(ticketId);
      res.json(steps);
    } catch (error) {
      console.error("Error fetching RTW workflow steps:", error);
      res.status(500).json({ error: "Failed to fetch RTW workflow steps" });
    }
  });

  // Update RTW workflow step
  app.patch("/api/rtw-workflow/:stepId", async (req, res) => {
    try {
      const { stepId } = req.params;
      const updates = req.body;

      const step = await storage.updateRtwWorkflowStep(stepId, updates);

      console.log(`Updated RTW workflow step ${stepId}`);
      res.json({ success: true, step });

    } catch (error) {
      console.error("Error updating RTW workflow step:", error);
      res.status(500).json({ error: "Failed to update RTW workflow step" });
    }
  });

  // Compliance Audit
  app.post("/api/tickets/:ticketId/compliance-audit", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const auditData = req.body;

      const audit = await storage.createComplianceAudit({
        ticketId,
        ...auditData
      });

      console.log(`Created compliance audit for ticket ${ticketId}`);
      res.json({ success: true, audit });

    } catch (error) {
      console.error("Error creating compliance audit:", error);
      res.status(500).json({ error: "Failed to create compliance audit" });
    }
  });

  // Get compliance audit trail for a ticket
  app.get("/api/tickets/:ticketId/compliance-audit", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const auditTrail = await storage.getComplianceAuditByTicket(ticketId);
      res.json(auditTrail);
    } catch (error) {
      console.error("Error fetching compliance audit:", error);
      res.status(500).json({ error: "Failed to fetch compliance audit" });
    }
  });

  // Worker Participation Events
  app.post("/api/tickets/:ticketId/participation-events", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const eventData = req.body;

      const event = await storage.createWorkerParticipationEvent({
        ticketId,
        ...eventData
      });

      console.log(`Created participation event for ticket ${ticketId}`);
      res.json({ success: true, event });

    } catch (error) {
      console.error("Error creating participation event:", error);
      res.status(500).json({ error: "Failed to create participation event" });
    }
  });

  // Get worker participation events for a ticket
  app.get("/api/tickets/:ticketId/participation-events", async (req, res) => {
    try {
      const { ticketId } = req.params;
      const events = await storage.getWorkerParticipationEventsByTicket(ticketId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching participation events:", error);
      res.status(500).json({ error: "Failed to fetch participation events" });
    }
  });

  // ===============================================
  // RTW WORKFLOW ENGINE API
  // ===============================================

  // Initialize RTW workflow for a new case
  app.post("/api/tickets/:ticketId/rtw-workflow/initialize", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate input
      const initSchema = z.object({
        injuryDate: z.string().min(1, "Injury date is required").refine(
          (date) => !isNaN(Date.parse(date)), 
          "Invalid date format"
        )
      });
      
      const { injuryDate } = initSchema.parse(req.body);

      // Import workflow engine
      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      const workflowStep = await workflowEngine.initializeWorkflow(ticketId, new Date(injuryDate));

      console.log(`Initialized RTW workflow for ticket ${ticketId}`);
      res.json({ success: true, workflowStep });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error initializing RTW workflow:", error);
      res.status(500).json({ error: "Failed to initialize RTW workflow" });
    }
  });

  // Complete a workflow step
  app.patch("/api/rtw-workflow/:stepId/complete", async (req, res) => {
    try {
      const { stepId } = req.params;
      
      // Validate input
      const completeSchema = z.object({
        outcome: z.enum(["completed", "escalated", "terminated", "withdrawn"], {
          errorMap: () => ({ message: "Invalid outcome value" })
        }),
        completedBy: z.string().min(1, "Completed by is required"),
        notes: z.string().optional()
      });
      
      const { outcome, completedBy, notes } = completeSchema.parse(req.body);

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.completeWorkflowStep(stepId, outcome, completedBy, notes);

      console.log(`Completed workflow step ${stepId} with outcome: ${outcome}`);
      res.json({ success: true });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error completing workflow step:", error);
      res.status(500).json({ error: "Failed to complete workflow step" });
    }
  });

  // Record worker participation event
  app.post("/api/tickets/:ticketId/worker-participation", async (req, res) => {
    try {
      const { ticketId } = req.params;
      
      // Validate input
      const participationSchema = z.object({
        eventType: z.string().min(1, "Event type is required"),
        participationLevel: z.enum(["full", "partial", "none", "refused"], {
          errorMap: () => ({ message: "Invalid participation level" })
        }),
        notes: z.string().optional()
      });
      
      const { eventType, participationLevel, notes } = participationSchema.parse(req.body);

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.recordWorkerParticipation(ticketId, eventType, participationLevel, notes);

      console.log(`Recorded worker participation for ticket ${ticketId}`);
      res.json({ success: true });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Error recording worker participation:", error);
      res.status(500).json({ error: "Failed to record worker participation" });
    }
  });

  // Get workflow summary for a ticket
  app.get("/api/tickets/:ticketId/rtw-workflow/summary", async (req, res) => {
    try {
      const { ticketId } = req.params;

      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      const summary = await workflowEngine.getWorkflowSummary(ticketId);

      res.json(summary);

    } catch (error) {
      console.error("Error getting workflow summary:", error);
      res.status(500).json({ error: "Failed to get workflow summary" });
    }
  });

  // Process workflow progression (for scheduled tasks)
  app.post("/api/rtw-workflow/process-progression", async (req, res) => {
    try {
      const { createRtwWorkflowEngine } = await import('./rtwWorkflowEngine');
      const workflowEngine = createRtwWorkflowEngine(storage);

      await workflowEngine.processWorkflowProgression();

      console.log("Processed RTW workflow progression for all active cases");
      res.json({ success: true, message: "Workflow progression processed" });

    } catch (error) {
      console.error("Error processing workflow progression:", error);
      res.status(500).json({ error: "Failed to process workflow progression" });
    }
  });

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

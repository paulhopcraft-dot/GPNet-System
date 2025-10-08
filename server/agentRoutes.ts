import type { Express } from "express";
import { Agent, tool, run } from '@openai/agents';
import { OpenAIChatCompletionsModel } from '@openai/agents';
import OpenAI from 'openai';
import { storage } from "./storage";
import { db } from "./db";
import { tickets, workers } from "@shared/schema";
import { eq, like, or } from "drizzle-orm";
import { z } from "zod";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.GPNET_OPENAI 
});

const model = new OpenAIChatCompletionsModel('gpt-4o', { client: openai });

// Define tools with schema
const searchWorkersTool = tool({
  name: 'searchWorkers',
  description: 'Search for workers by name, email, or role',
  parameters: z.object({
    query: z.string().describe('Search term for worker name, email, or role'),
    limit: z.number().default(5).describe('Maximum number of results')
  }),
  execute: async ({ query, limit }) => {
    const searchTerm = `%${query}%`;
    const results = await db
      .select()
      .from(workers)
      .where(
        or(
          like(workers.firstName, searchTerm),
          like(workers.lastName, searchTerm),
          like(workers.email, searchTerm)
        )
      )
      .limit(limit);

    return {
      count: results.length,
      workers: results.map(w => ({
        id: w.id,
        name: `${w.firstName} ${w.lastName}`,
        email: w.email,
        role: w.roleApplied
      }))
    };
  }
});

const createCaseTool = tool({
  name: 'createCase',
  description: 'Create a new case/assessment for a worker',
  parameters: z.object({
    workerId: z.string().describe('ID of the worker'),
    caseType: z.enum(['pre_employment', 'injury', 'mental_health', 'return_to_work']).describe('Type of case'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium').describe('Case priority')
  }),
  execute: async ({ workerId, caseType, priority }) => {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, workerId)
    });

    if (!worker) {
      return { error: 'Worker not found' };
    }

    const newTicket = await storage.createTicket({
      workerId,
      caseType,
      status: 'NEW',
      priority,
      companyName: worker.company || 'Unknown',
      subject: `${caseType} - ${worker.firstName} ${worker.lastName}`,
      nextStep: 'Initial case review and triage'
    });

    return {
      success: true,
      caseId: newTicket.id,
      message: `Created ${caseType} case for ${worker.firstName} ${worker.lastName}`
    };
  }
});

const getStatsTool = tool({
  name: 'getSystemStats',
  description: 'Get system statistics and case counts',
  parameters: z.object({}),
  execute: async () => {
    const stats = await storage.getDashboardStats();
    return {
      totalCases: stats.total,
      newCases: stats.new,
      inProgress: stats.inProgress + stats.awaiting,
      completed: stats.complete
    };
  }
});

// Create the triage agent
const triageAgent = new Agent({
  name: 'GPNet Triage Agent',
  model,
  instructions: `You are the GPNet case management assistant. You help with:

1. Searching for workers
2. Creating health assessment cases
3. Providing system statistics

When a user wants to create a case:
- First search for the worker by name
- Then create the appropriate case type
- Confirm the action was successful

Be professional and helpful.`,
  tools: [searchWorkersTool, createCaseTool, getStatsTool],
});

export function registerAgentRoutes(app: Express) {
  // Agent chat endpoint
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log('🤖 Agent request:', message);

      // Run the agent
      const result = await run(triageAgent, message);

      // Extract response
      const output = result.output || [];
      let response = 'Unable to process request';
      
      for (const item of output) {
        if (item.type === 'message' && item.role === 'assistant') {
          const textContent = item.content.find((c: any) => c.type === 'output_text');
          if (textContent && 'text' in textContent) {
            response = textContent.text;
            break;
          }
        }
      }

      res.json({
        success: true,
        response,
        agent: triageAgent.name
      });

    } catch (error) {
      console.error('Agent error:', error);
      res.status(500).json({ 
        error: 'Agent processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  console.log('✅ Agent routes registered at /api/agent/*');
}

import type { Express } from "express";
import OpenAI from 'openai';
import { storage } from "./storage";
import { db } from "./db";
import { tickets, workers } from "@shared/schema";
import { eq, like, or } from "drizzle-orm";
import { z } from "zod";

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const possibleKeys = [
    process.env.GPNET_OPENAI,
    process.env.OPENAI_API_KEY
  ];

  for (const key of possibleKeys) {
    if (key && key.startsWith('sk-') && !key.includes('youtube') && !key.includes('https://')) {
      console.log('✅ AgentService: OpenAI client initialized successfully');
      return new OpenAI({ apiKey: key });
    }
  }

  throw new Error('OpenAI API key not found');
}

const openai = getOpenAIClient();

// Define function tools for OpenAI
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchWorkers',
      description: 'Search for workers by name, email, or role',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term for worker name, email, or role'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results',
            default: 5
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createCase',
      description: 'Create a new case/assessment for a worker',
      parameters: {
        type: 'object',
        properties: {
          workerId: {
            type: 'string',
            description: 'ID of the worker'
          },
          caseType: {
            type: 'string',
            enum: ['pre_employment', 'injury', 'mental_health', 'return_to_work'],
            description: 'Type of case'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'urgent'],
            description: 'Case priority',
            default: 'medium'
          }
        },
        required: ['workerId', 'caseType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSystemStats',
      description: 'Get system statistics and case counts',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

// Tool execution functions
async function searchWorkers(query: string, limit: number = 5) {
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

async function createCase(workerId: string, caseType: string, priority: string = 'medium') {
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

async function getSystemStats() {
  const stats = await storage.getDashboardStats();
  return {
    totalCases: stats.total,
    newCases: stats.new,
    inProgress: stats.inProgress + stats.awaiting,
    completed: stats.complete
  };
}

// Execute tool calls
async function executeTool(name: string, args: any) {
  switch (name) {
    case 'searchWorkers':
      return await searchWorkers(args.query, args.limit);
    case 'createCase':
      return await createCase(args.workerId, args.caseType, args.priority);
    case 'getSystemStats':
      return await getSystemStats();
    default:
      return { error: 'Unknown tool' };
  }
}

export function registerAgentRoutes(app: Express) {
  // Agent chat endpoint with function calling
  app.post('/api/agent/chat', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      console.log('🤖 Agent request:', message);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `You are the GPNet case management assistant. You help with:

1. Searching for workers
2. Creating health assessment cases
3. Providing system statistics

When a user wants to create a case:
- First search for the worker by name
- Then create the appropriate case type
- Confirm the action was successful

Be professional and helpful.`
        },
        {
          role: 'user',
          content: message
        }
      ];

      // Initial request with tools
      let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools,
        tool_choice: 'auto'
      });

      let assistantMessage = response.choices[0]?.message;
      let toolCalls: any[] = [];

      // Handle tool calls
      if (assistantMessage?.tool_calls) {
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          
          let functionArgs: any;
          try {
            functionArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.error(`Failed to parse tool arguments for ${functionName}:`, parseError);
            return res.status(400).json({
              error: 'Invalid tool arguments',
              details: 'Tool function arguments could not be parsed'
            });
          }

          console.log(`🔧 Calling tool: ${functionName}`, functionArgs);

          const functionResponse = await executeTool(functionName, functionArgs);
          
          toolCalls.push({
            tool: functionName,
            args: functionArgs,
            result: functionResponse
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResponse)
          });
        }

        // Get final response after tool execution
        const finalResponse = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages
        });

        assistantMessage = finalResponse.choices[0]?.message;
      }

      res.json({
        success: true,
        response: assistantMessage?.content || 'Unable to process request',
        toolCalls,
        agent: 'GPNet Triage Agent'
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

#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const sessionsTable = process.env.SESSIONS_TABLE;
const usersTable = process.env.USERS_TABLE;

const server = new Server(
  {
    name: 'interview-assistant-dynamodb',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_session',
        description: 'Retrieve session data from DynamoDB',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to retrieve',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'get_user_sessions',
        description: 'Get all sessions for a user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID to get sessions for',
            },
          },
          required: ['userId'],
        },
      },
      {
        name: 'get_session_analytics',
        description: 'Get analytics data for sessions',
        inputSchema: {
          type: 'object',
          properties: {
            timeRange: {
              type: 'string',
              description: 'Time range: last7days, last30days, all',
              enum: ['last7days', 'last30days', 'all'],
            },
          },
        },
      },
      {
        name: 'update_session_metadata',
        description: 'Update session with AI insights',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to update',
            },
            metadata: {
              type: 'object',
              description: 'Metadata to add/update',
            },
          },
          required: ['sessionId', 'metadata'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_session': {
        const { sessionId } = args;
        
        const result = await docClient.send(new GetCommand({
          TableName: sessionsTable,
          Key: { sessionId },
        }));
        
        if (!result.Item) {
          return {
            content: [{ type: 'text', text: 'Session not found' }],
          };
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result.Item, null, 2) }],
        };
      }

      case 'get_user_sessions': {
        const { userId } = args;
        
        const result = await docClient.send(new QueryCommand({
          TableName: sessionsTable,
          IndexName: 'UserIndex',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId,
          },
        }));
        
        return {
          content: [{ type: 'text', text: JSON.stringify(result.Items || [], null, 2) }],
        };
      }

      case 'get_session_analytics': {
        const { timeRange = 'all' } = args;
        
        let filterExpression = '';
        let expressionAttributeValues = {};
        
        if (timeRange !== 'all') {
          const days = timeRange === 'last7days' ? 7 : 30;
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          
          filterExpression = 'createdAt >= :cutoffDate';
          expressionAttributeValues[':cutoffDate'] = cutoffDate.toISOString();
        }
        
        const scanParams = {
          TableName: sessionsTable,
        };
        
        if (filterExpression) {
          scanParams.FilterExpression = filterExpression;
          scanParams.ExpressionAttributeValues = expressionAttributeValues;
        }
        
        const result = await docClient.send(new ScanCommand(scanParams));
        const sessions = result.Items || [];
        
        // Calculate analytics
        const analytics = {
          totalSessions: sessions.length,
          completedSessions: sessions.filter(s => s.status === 'completed').length,
          averageScore: 0,
          interviewTypes: {},
          difficultyLevels: {},
          scoreDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
        };
        
        let totalScore = 0;
        let scoredSessions = 0;
        
        sessions.forEach(session => {
          // Interview types
          analytics.interviewTypes[session.interviewType] = 
            (analytics.interviewTypes[session.interviewType] || 0) + 1;
          
          // Difficulty levels
          analytics.difficultyLevels[session.difficulty] = 
            (analytics.difficultyLevels[session.difficulty] || 0) + 1;
          
          // Scores
          if (session.overallScore !== undefined) {
            totalScore += session.overallScore;
            scoredSessions++;
            
            if (session.overallScore >= 8) analytics.scoreDistribution.excellent++;
            else if (session.overallScore >= 6) analytics.scoreDistribution.good++;
            else if (session.overallScore >= 4) analytics.scoreDistribution.fair++;
            else analytics.scoreDistribution.poor++;
          }
        });
        
        if (scoredSessions > 0) {
          analytics.averageScore = totalScore / scoredSessions;
        }
        
        return {
          content: [{ type: 'text', text: JSON.stringify(analytics, null, 2) }],
        };
      }

      case 'update_session_metadata': {
        const { sessionId, metadata } = args;
        
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        Object.keys(metadata).forEach((key, index) => {
          const attrName = `#attr${index}`;
          const attrValue = `:val${index}`;
          
          updateExpressions.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = metadata[key];
        });
        
        await docClient.send(new UpdateCommand({
          TableName: sessionsTable,
          Key: { sessionId },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
        }));
        
        return {
          content: [{ type: 'text', text: `Session ${sessionId} updated successfully` }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch(console.error);
}
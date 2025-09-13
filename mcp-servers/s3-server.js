#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.S3_BUCKET;

const server = new Server(
  {
    name: 'interview-assistant-s3',
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
        name: 'get_transcript',
        description: 'Retrieve a transcript from S3',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to retrieve transcripts for',
            },
            questionIndex: {
              type: 'number',
              description: 'Specific question index (optional)',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'list_transcripts',
        description: 'List all transcripts for a session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID to list transcripts for',
            },
          },
          required: ['sessionId'],
        },
      },
      {
        name: 'store_analysis',
        description: 'Store AI analysis results in S3',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: {
              type: 'string',
              description: 'Session ID',
            },
            analysis: {
              type: 'object',
              description: 'Analysis data to store',
            },
          },
          required: ['sessionId', 'analysis'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_transcript': {
        const { sessionId, questionIndex } = args;
        
        if (questionIndex !== undefined) {
          // Get specific transcript
          const key = `transcripts/${sessionId}/${questionIndex}-*.json`;
          const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: `transcripts/${sessionId}/${questionIndex}-`,
          }));
          
          if (!listResult.Contents || listResult.Contents.length === 0) {
            return {
              content: [{ type: 'text', text: 'Transcript not found' }],
            };
          }
          
          const getResult = await s3Client.send(new GetObjectCommand({
            Bucket: bucketName,
            Key: listResult.Contents[0].Key,
          }));
          
          const transcript = await getResult.Body.transformToString();
          return {
            content: [{ type: 'text', text: transcript }],
          };
        } else {
          // Get all transcripts for session
          const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: `transcripts/${sessionId}/`,
          }));
          
          const transcripts = [];
          for (const obj of listResult.Contents || []) {
            const getResult = await s3Client.send(new GetObjectCommand({
              Bucket: bucketName,
              Key: obj.Key,
            }));
            const content = await getResult.Body.transformToString();
            transcripts.push(JSON.parse(content));
          }
          
          return {
            content: [{ type: 'text', text: JSON.stringify(transcripts, null, 2) }],
          };
        }
      }

      case 'list_transcripts': {
        const { sessionId } = args;
        
        const listResult = await s3Client.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: `transcripts/${sessionId}/`,
        }));
        
        const files = (listResult.Contents || []).map(obj => ({
          key: obj.Key,
          lastModified: obj.LastModified,
          size: obj.Size,
        }));
        
        return {
          content: [{ type: 'text', text: JSON.stringify(files, null, 2) }],
        };
      }

      case 'store_analysis': {
        const { sessionId, analysis } = args;
        const key = `analysis/${sessionId}/ai-analysis-${Date.now()}.json`;
        
        await s3Client.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: JSON.stringify(analysis, null, 2),
          ContentType: 'application/json',
        }));
        
        return {
          content: [{ type: 'text', text: `Analysis stored at ${key}` }],
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
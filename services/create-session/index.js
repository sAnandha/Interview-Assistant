const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  try {
    const { userId, interviewType = 'behavioral', difficulty = 'medium' } = JSON.parse(event.body || '{}');
    
    const sessionId = uuidv4();
    const session = {
      sessionId,
      userId: userId || 'anonymous',
      interviewType,
      difficulty,
      status: 'active',
      createdAt: new Date().toISOString(),
      currentQuestionIndex: 0,
      questions: [],
      responses: []
    };

    await docClient.send(new PutCommand({
      TableName: process.env.SESSIONS_TABLE,
      Item: session
    }));

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({ sessionId, status: 'created' })
    };
  } catch (error) {
    console.error('Error creating session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create session' })
    };
  }
};
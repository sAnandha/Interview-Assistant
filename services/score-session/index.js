const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json'
};

// Simple scoring algorithm - in production, integrate with Amazon Q MCP
function scoreResponse(transcript, questionType) {
  const wordCount = transcript.split(' ').length;
  const hasStructure = transcript.includes('first') || transcript.includes('then') || transcript.includes('finally');
  const hasSpecifics = /\d+|specific|example|instance/.test(transcript.toLowerCase());
  
  let score = 0;
  
  // Length scoring
  if (wordCount > 50) score += 3;
  else if (wordCount > 20) score += 2;
  else score += 1;
  
  // Structure scoring
  if (hasStructure) score += 2;
  
  // Specificity scoring
  if (hasSpecifics) score += 2;
  
  // Question type specific scoring
  if (questionType === 'behavioral' && (transcript.includes('situation') || transcript.includes('result'))) {
    score += 2;
  }
  
  return Math.min(score, 10); // Cap at 10
}

function generateFeedback(score, transcript) {
  const feedback = [];
  
  if (score >= 8) {
    feedback.push("Excellent response with good structure and specific examples.");
  } else if (score >= 6) {
    feedback.push("Good response, but could benefit from more specific examples.");
  } else if (score >= 4) {
    feedback.push("Adequate response, consider adding more detail and structure.");
  } else {
    feedback.push("Response needs more development. Try to provide specific examples and use a clear structure.");
  }
  
  const wordCount = transcript.split(' ').length;
  if (wordCount < 30) {
    feedback.push("Consider providing more detailed responses (aim for 1-2 minutes).");
  }
  
  return feedback;
}

exports.handler = async (event) => {
  try {
    const { sessionId } = event.pathParameters;
    
    // Get session data
    const result = await docClient.send(new GetCommand({
      TableName: process.env.SESSIONS_TABLE,
      Key: { sessionId }
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' })
      };
    }

    const session = result.Item;
    const responses = session.responses || [];
    
    // Score each response
    const scoredResponses = responses.map(response => {
      const score = scoreResponse(response.transcript, session.interviewType);
      const feedback = generateFeedback(score, response.transcript);
      
      return {
        ...response,
        score,
        feedback
      };
    });

    // Calculate overall score
    const totalScore = scoredResponses.reduce((sum, r) => sum + r.score, 0);
    const averageScore = responses.length > 0 ? totalScore / responses.length : 0;
    
    // Update session with scores
    await docClient.send(new UpdateCommand({
      TableName: process.env.SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET #status = :status, scoredResponses = :scoredResponses, overallScore = :overallScore, completedAt = :completedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'completed',
        ':scoredResponses': scoredResponses,
        ':overallScore': averageScore,
        ':completedAt': new Date().toISOString()
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId,
        overallScore: averageScore,
        totalResponses: responses.length,
        scoredResponses,
        summary: {
          excellent: scoredResponses.filter(r => r.score >= 8).length,
          good: scoredResponses.filter(r => r.score >= 6 && r.score < 8).length,
          needsImprovement: scoredResponses.filter(r => r.score < 6).length
        }
      })
    };
  } catch (error) {
    console.error('Error scoring session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to score session' })
    };
  }
};
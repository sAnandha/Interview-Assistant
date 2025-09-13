const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({});

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  try {
    const { sessionId } = event.pathParameters;
    const { transcript, questionIndex, audioUrl } = JSON.parse(event.body || '{}');
    
    const timestamp = new Date().toISOString();
    const transcriptKey = `transcripts/${sessionId}/${questionIndex}-${timestamp}.json`;
    
    // Store transcript in S3
    const transcriptData = {
      sessionId,
      questionIndex,
      transcript,
      audioUrl,
      timestamp
    };

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.TRANSCRIPTS_BUCKET,
      Key: transcriptKey,
      Body: JSON.stringify(transcriptData),
      ContentType: 'application/json'
    }));

    // Update session in DynamoDB
    await docClient.send(new UpdateCommand({
      TableName: process.env.SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET responses = list_append(if_not_exists(responses, :empty_list), :response), currentQuestionIndex = :nextIndex',
      ExpressionAttributeValues: {
        ':empty_list': [],
        ':response': [{
          questionIndex,
          transcript,
          audioUrl,
          timestamp,
          s3Key: transcriptKey
        }],
        ':nextIndex': questionIndex + 1
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        transcriptKey,
        nextQuestionIndex: questionIndex + 1
      })
    };
  } catch (error) {
    console.error('Error recording transcript:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to record transcript' })
    };
  }
};
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Content-Type': 'application/json'
};

const questionBank = {
  behavioral: [
    "Tell me about a time when you had to work under pressure.",
    "Describe a situation where you had to resolve a conflict with a team member.",
    "Give me an example of when you had to learn something new quickly.",
    "Tell me about a time you failed and how you handled it.",
    "Describe your greatest professional achievement."
  ],
  technical: [
    "Explain the difference between synchronous and asynchronous programming.",
    "How would you optimize a slow database query?",
    "Describe the principles of RESTful API design.",
    "What are the benefits and drawbacks of microservices architecture?",
    "How do you handle error handling in distributed systems?"
  ]
};

exports.handler = async (event) => {
  try {
    const { sessionId } = event.pathParameters;
    
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
    const questions = questionBank[session.interviewType] || questionBank.behavioral;
    const currentIndex = session.currentQuestionIndex || 0;

    if (currentIndex >= questions.length) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          question: null, 
          isComplete: true,
          message: 'Interview completed' 
        })
      };
    }

    const question = questions[currentIndex];

    // Update session with current question
    await docClient.send(new UpdateCommand({
      TableName: process.env.SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET currentQuestionIndex = :index, #qs = :questions',
      ExpressionAttributeNames: {
        '#qs': 'questions'
      },
      ExpressionAttributeValues: {
        ':index': currentIndex,
        ':questions': questions
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        question,
        questionIndex: currentIndex,
        totalQuestions: questions.length,
        isComplete: false
      })
    };
  } catch (error) {
    console.error('Error getting question:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get question' })
    };
  }
};
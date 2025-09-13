# Deployment Instructions

## Prerequisites

1. **AWS CLI configured**
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

2. **Required tools installed**
   ```bash
   # Install SAM CLI
   pip install aws-sam-cli
   
   # Install Node.js (18+)
   # Download from https://nodejs.org/
   
   # Verify installations
   sam --version
   node --version
   npm --version
   ```

3. **Create S3 bucket for SAM deployments**
   ```bash
   aws s3 mb s3://your-sam-deployment-bucket-name
   ```

## Step-by-Step Deployment

### 1. Clone and Setup Project

```bash
git clone <your-repo-url>
cd qcli
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..

# Install MCP server dependencies
cd mcp-servers
npm install
cd ..

# Install Lambda function dependencies
for dir in services/*/; do
  if [ -f "$dir/package.json" ]; then
    cd "$dir" && npm install && cd ../..
  fi
done
```

### 3. Deploy Infrastructure

```bash
cd infrastructure

# Build the SAM application
sam build

# Deploy with guided setup (first time only)
sam deploy --guided

# For subsequent deployments
sam deploy
```

**During guided setup, provide:**
- Stack Name: `interview-assistant`
- AWS Region: `us-east-1` (or your preferred region)
- Confirm changes before deploy: `Y`
- Allow SAM CLI IAM role creation: `Y`
- Save parameters to samconfig.toml: `Y`

### 4. Get Stack Outputs

```bash
# Get API endpoint and other outputs
sam list stack-outputs --stack-name interview-assistant

# Or use AWS CLI
aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Outputs'
```

### 5. Deploy Frontend

```bash
cd frontend

# Build with API endpoint
REACT_APP_API_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com npm run build

# Get S3 bucket name from stack outputs
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Outputs[?OutputKey==`StaticWebsiteBucket`].OutputValue' \
  --output text)

# Deploy to S3
aws s3 sync build/ s3://$BUCKET_NAME --delete

# Invalidate CloudFront cache (if using CloudFront)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistribution`].OutputValue' \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

### 6. Configure MCP for Amazon Q CLI

```bash
# Get actual resource names from CloudFormation
TRANSCRIPTS_BUCKET=$(aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Outputs[?OutputKey==`TranscriptsBucket`].OutputValue' \
  --output text)

SESSIONS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Resources[?LogicalResourceId==`SessionsTable`].PhysicalResourceId' \
  --output text)

USERS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name interview-assistant \
  --query 'Stacks[0].Resources[?LogicalResourceId==`UsersTable`].PhysicalResourceId' \
  --output text)

# Update mcp.json with actual resource names
sed -i "s/your-transcripts-bucket-name/$TRANSCRIPTS_BUCKET/g" mcp.json
sed -i "s/your-sessions-table-name/$SESSIONS_TABLE/g" mcp.json
sed -i "s/your-users-table-name/$USERS_TABLE/g" mcp.json

# Copy to Amazon Q CLI location
mkdir -p ~/.aws/amazonq
cp mcp.json ~/.aws/amazonq/mcp.json
```

### 7. Test Deployment

```bash
# Run integration tests
cd tests
API_BASE_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com node integration-test.js

# Test MCP servers
cd ../mcp-servers
AWS_REGION=us-east-1 S3_BUCKET=$TRANSCRIPTS_BUCKET node s3-server.js &
AWS_REGION=us-east-1 SESSIONS_TABLE=$SESSIONS_TABLE USERS_TABLE=$USERS_TABLE node dynamodb-server.js &
```

## Environment-Specific Deployments

### Development Environment

```bash
sam deploy \
  --stack-name interview-assistant-dev \
  --parameter-overrides Environment=dev \
  --s3-bucket your-sam-deployment-bucket
```

### Production Environment

```bash
sam deploy \
  --stack-name interview-assistant-prod \
  --parameter-overrides Environment=prod \
  --s3-bucket your-sam-deployment-bucket
```

## Local Development

### Run Backend Locally

```bash
cd infrastructure
sam local start-api --port 3001

# In another terminal, test the API
curl http://localhost:3001/sessions -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","interviewType":"behavioral"}'
```

### Run Frontend Locally

```bash
cd frontend
REACT_APP_API_URL=http://localhost:3001 npm start
```

### Run MCP Servers Locally

```bash
cd mcp-servers

# Terminal 1: S3 server
AWS_REGION=us-east-1 S3_BUCKET=your-bucket node s3-server.js

# Terminal 2: DynamoDB server
AWS_REGION=us-east-1 SESSIONS_TABLE=your-table USERS_TABLE=your-users-table node dynamodb-server.js
```

## CI/CD Setup

### GitHub Actions

1. **Set up repository secrets:**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `SAM_DEPLOYMENT_BUCKET`

2. **Push to main branch to trigger deployment:**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

### Manual Deployment Script

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Build and deploy infrastructure
cd infrastructure
sam build
sam deploy --no-confirm-changeset

# Get outputs
API_ENDPOINT=$(sam list stack-outputs --stack-name interview-assistant --output json | jq -r '.[] | select(.OutputKey=="ApiEndpoint") | .OutputValue')
BUCKET_NAME=$(sam list stack-outputs --stack-name interview-assistant --output json | jq -r '.[] | select(.OutputKey=="StaticWebsiteBucket") | .OutputValue')

echo "📊 API Endpoint: $API_ENDPOINT"

# Build and deploy frontend
cd ../frontend
REACT_APP_API_URL=$API_ENDPOINT npm run build
aws s3 sync build/ s3://$BUCKET_NAME --delete

echo "✅ Deployment completed!"
echo "🌐 Visit your application at the CloudFront URL"
```

## Monitoring and Maintenance

### CloudWatch Dashboards

```bash
# Create custom dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "InterviewAssistant" \
  --dashboard-body file://cloudwatch-dashboard.json
```

### Log Monitoring

```bash
# View Lambda logs
aws logs tail /aws/lambda/interview-assistant-CreateSessionFunction --follow

# View API Gateway logs
aws logs tail /aws/apigateway/interview-assistant --follow
```

### Cost Monitoring

```bash
# Set up billing alerts
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

## Cleanup

### Delete Stack

```bash
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name interview-assistant

# Clean up S3 buckets (if needed)
aws s3 rm s3://your-transcripts-bucket --recursive
aws s3 rb s3://your-transcripts-bucket

aws s3 rm s3://your-static-website-bucket --recursive
aws s3 rb s3://your-static-website-bucket
```

## Troubleshooting

If you encounter issues during deployment, refer to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common problems and solutions.

## Next Steps

1. **Customize the application:**
   - Add more question types
   - Implement user authentication
   - Add advanced scoring algorithms

2. **Enhance security:**
   - Set up AWS WAF
   - Implement API rate limiting
   - Add input validation

3. **Scale for production:**
   - Set up monitoring and alerting
   - Implement caching strategies
   - Add load testing

4. **Integrate with Amazon Q:**
   - Use MCP servers for contextual data
   - Implement AI-powered feedback
   - Add real-time coaching features
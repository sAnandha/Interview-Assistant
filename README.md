# Intelligent Mock Interview Assistant

A production-ready serverless application for conducting AI-powered mock interviews with real-time feedback and transcript storage.

## Architecture

- **Frontend**: React app hosted on S3 + CloudFront
- **Backend**: AWS Lambda functions via API Gateway HTTP API
- **Data**: DynamoDB for sessions/users, S3 for recordings/transcripts
- **AI**: Amazon Q Developer CLI with MCP connectors for contextual data

## Quick Start

1. **Prerequisites**
   ```bash
   npm install -g aws-cdk
   pip install aws-sam-cli
   ```

2. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   sam build
   sam deploy --guided
   ```

3. **Setup MCP Configuration**
   ```bash
   # Copy MCP config to Amazon Q CLI location
   cp mcp.json ~/.aws/amazonq/mcp.json
   ```

4. **Deploy Frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   aws s3 sync build/ s3://your-bucket-name
   ```

## Project Structure

```
├── frontend/           # React application
├── infrastructure/     # SAM template and resources
├── services/          # Lambda function handlers
├── tests/             # Integration and unit tests
├── mcp.json          # MCP server configuration
└── .github/workflows/ # CI/CD pipeline
```

## Environment Setup

1. Configure AWS credentials
2. Set up Amazon Q Developer CLI with MCP
3. Deploy infrastructure stack
4. Build and deploy frontend

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues including CORS, permissions, and MCP connectivity.
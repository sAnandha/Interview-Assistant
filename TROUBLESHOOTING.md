# Troubleshooting Guide

## Common Issues and Solutions

### CORS Issues

#### Problem: "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Symptoms:**
- Browser console shows CORS errors
- API calls fail from the React app
- Network tab shows failed preflight requests

**Solutions:**

1. **Check API Gateway CORS Configuration**
   ```bash
   # Verify CORS settings in template.yaml
   aws apigatewayv2 get-cors --api-id YOUR_API_ID
   ```

2. **Verify Lambda Response Headers**
   ```javascript
   // Ensure all Lambda functions return CORS headers
   const corsHeaders = {
     'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
     'Access-Control-Allow-Headers': 'Content-Type,Authorization',
     'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
   };
   ```

3. **Check Environment Variables**
   ```bash
   # Verify CORS_ORIGIN is set correctly
   aws lambda get-function-configuration --function-name YOUR_FUNCTION_NAME
   ```

4. **Test CORS Manually**
   ```bash
   # Test preflight request
   curl -X OPTIONS \
     -H "Origin: https://your-domain.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     https://your-api-gateway-url/sessions
   ```

#### Problem: CORS works in development but fails in production

**Solutions:**
1. Update CORS origins in template.yaml to include production domain
2. Ensure CloudFront distribution URL is included in allowed origins
3. Check that environment variables are properly set in production

### Permission Issues

#### Problem: "AccessDenied" or "UnauthorizedOperation" errors

**Solutions:**

1. **Check IAM Roles**
   ```bash
   # Verify Lambda execution role has required permissions
   aws iam get-role-policy --role-name YOUR_LAMBDA_ROLE --policy-name YOUR_POLICY
   ```

2. **DynamoDB Permissions**
   ```yaml
   # Ensure Lambda has proper DynamoDB permissions
   Policies:
     - DynamoDBCrudPolicy:
         TableName: !Ref SessionsTable
   ```

3. **S3 Permissions**
   ```yaml
   # Ensure Lambda can read/write to S3
   Policies:
     - S3CrudPolicy:
         BucketName: !Ref TranscriptsBucket
   ```

### MCP Connectivity Issues

#### Problem: Amazon Q CLI cannot connect to MCP servers

**Solutions:**

1. **Verify MCP Configuration**
   ```bash
   # Check mcp.json location
   ls -la ~/.aws/amazonq/mcp.json
   
   # Validate JSON syntax
   cat ~/.aws/amazonq/mcp.json | jq .
   ```

2. **Install MCP Dependencies**
   ```bash
   cd mcp-servers
   npm install
   ```

3. **Test MCP Server Manually**
   ```bash
   # Test S3 server
   node mcp-servers/s3-server.js
   
   # Test DynamoDB server
   node mcp-servers/dynamodb-server.js
   ```

4. **Check AWS Credentials**
   ```bash
   # Ensure AWS credentials are configured
   aws sts get-caller-identity
   ```

5. **Update Resource Names**
   ```bash
   # Update mcp.json with actual resource names from CloudFormation
   aws cloudformation describe-stacks --stack-name YOUR_STACK_NAME
   ```

### Lambda Function Issues

#### Problem: Lambda function timeouts or memory errors

**Solutions:**

1. **Increase Timeout and Memory**
   ```yaml
   # In template.yaml
   Globals:
     Function:
       Timeout: 30
       MemorySize: 512
   ```

2. **Check CloudWatch Logs**
   ```bash
   # View function logs
   aws logs describe-log-groups --log-group-name-prefix /aws/lambda/
   aws logs tail /aws/lambda/YOUR_FUNCTION_NAME --follow
   ```

3. **Optimize Code**
   - Use connection pooling for DynamoDB
   - Implement proper error handling
   - Minimize cold start impact

#### Problem: "Module not found" errors

**Solutions:**
1. Ensure package.json exists in each Lambda directory
2. Run `npm install` in each service directory
3. Use SAM build with `--use-container` flag

### Frontend Issues

#### Problem: React app shows blank page or build errors

**Solutions:**

1. **Check Build Process**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Verify Environment Variables**
   ```bash
   # Set API URL for production build
   REACT_APP_API_URL=https://your-api-gateway-url npm run build
   ```

3. **Check S3 Bucket Policy**
   ```bash
   # Ensure bucket allows public read access
   aws s3api get-bucket-policy --bucket YOUR_BUCKET_NAME
   ```

4. **CloudFront Configuration**
   ```bash
   # Check distribution status
   aws cloudfront list-distributions
   ```

### Database Issues

#### Problem: DynamoDB read/write errors

**Solutions:**

1. **Check Table Status**
   ```bash
   aws dynamodb describe-table --table-name YOUR_TABLE_NAME
   ```

2. **Verify Capacity Settings**
   ```yaml
   # Use on-demand billing for variable workloads
   BillingMode: PAY_PER_REQUEST
   ```

3. **Check Item Structure**
   ```bash
   # Scan table to verify data structure
   aws dynamodb scan --table-name YOUR_TABLE_NAME --limit 5
   ```

### Deployment Issues

#### Problem: SAM deployment fails

**Solutions:**

1. **Check SAM Template Syntax**
   ```bash
   cd infrastructure
   sam validate
   ```

2. **Verify S3 Deployment Bucket**
   ```bash
   # Ensure deployment bucket exists
   aws s3 ls s3://YOUR_DEPLOYMENT_BUCKET
   ```

3. **Check Stack Events**
   ```bash
   aws cloudformation describe-stack-events --stack-name YOUR_STACK_NAME
   ```

4. **Clean Up Failed Stack**
   ```bash
   aws cloudformation delete-stack --stack-name YOUR_STACK_NAME
   ```

## Debugging Commands

### View API Gateway Logs
```bash
# Enable API Gateway logging
aws apigatewayv2 update-stage \
  --api-id YOUR_API_ID \
  --stage-name '$default' \
  --access-log-settings DestinationArn=arn:aws:logs:region:account:log-group:log-group-name
```

### Test Lambda Functions Locally
```bash
cd infrastructure
sam local start-api --port 3001
```

### Monitor CloudWatch Metrics
```bash
# View Lambda metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=YOUR_FUNCTION_NAME \
  --start-time 2023-01-01T00:00:00Z \
  --end-time 2023-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

### Test MCP Integration
```bash
# Test MCP server connectivity
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node mcp-servers/s3-server.js
```

## Performance Optimization

### Lambda Cold Starts
- Use provisioned concurrency for critical functions
- Minimize deployment package size
- Implement connection pooling

### DynamoDB Performance
- Use appropriate partition keys
- Implement caching with ElastiCache if needed
- Monitor consumed capacity

### Frontend Performance
- Enable CloudFront compression
- Implement code splitting
- Use React.memo for expensive components

## Security Best Practices

### API Security
- Implement proper authentication
- Use API keys or JWT tokens
- Enable AWS WAF for protection

### Data Protection
- Encrypt data at rest in S3 and DynamoDB
- Use HTTPS for all communications
- Implement proper input validation

### Access Control
- Follow principle of least privilege
- Use IAM roles instead of access keys
- Regularly audit permissions
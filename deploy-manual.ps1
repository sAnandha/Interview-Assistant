# Manual deployment script using AWS CLI
$STACK_NAME = "interview-assistant"
$REGION = "us-east-1"

# Create S3 bucket for Lambda code
$BUCKET_NAME = "interview-assistant-lambda-code-$(Get-Random)"
aws s3 mb s3://$BUCKET_NAME --region $REGION

# Package Lambda functions
cd ..\services\create-session
Compress-Archive -Path * -DestinationPath create-session.zip -Force
aws s3 cp create-session.zip s3://$BUCKET_NAME/

cd ..\get-question
Compress-Archive -Path * -DestinationPath get-question.zip -Force
aws s3 cp get-question.zip s3://$BUCKET_NAME/

cd ..\record-transcript
Compress-Archive -Path * -DestinationPath record-transcript.zip -Force
aws s3 cp record-transcript.zip s3://$BUCKET_NAME/

cd ..\score-session
Compress-Archive -Path * -DestinationPath score-session.zip -Force
aws s3 cp score-session.zip s3://$BUCKET_NAME/

cd ..\..\infrastructure

# Create CloudFormation template for direct deployment
$TEMPLATE = @"
{
  "AWSTemplateFormatVersion": "2010-09-09",
  "Resources": {
    "SessionsTable": {
      "Type": "AWS::DynamoDB::Table",
      "Properties": {
        "BillingMode": "PAY_PER_REQUEST",
        "AttributeDefinitions": [
          {"AttributeName": "sessionId", "AttributeType": "S"}
        ],
        "KeySchema": [
          {"AttributeName": "sessionId", "KeyType": "HASH"}
        ]
      }
    },
    "TranscriptsBucket": {
      "Type": "AWS::S3::Bucket",
      "Properties": {
        "CorsConfiguration": {
          "CorsRules": [{
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST"],
            "AllowedOrigins": ["*"]
          }]
        }
      }
    },
    "LambdaRole": {
      "Type": "AWS::IAM::Role",
      "Properties": {
        "AssumeRolePolicyDocument": {
          "Version": "2012-10-17",
          "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole"
          }]
        },
        "ManagedPolicyArns": [
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
        ],
        "Policies": [{
          "PolicyName": "DynamoDBAccess",
          "PolicyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": ["dynamodb:*"],
              "Resource": {"Fn::GetAtt": ["SessionsTable", "Arn"]}
            }, {
              "Effect": "Allow",
              "Action": ["s3:*"],
              "Resource": [
                {"Fn::GetAtt": ["TranscriptsBucket", "Arn"]},
                {"Fn::Sub": "\${TranscriptsBucket}/*"}
              ]
            }]
          }
        }]
      }
    },
    "CreateSessionFunction": {
      "Type": "AWS::Lambda::Function",
      "Properties": {
        "Runtime": "nodejs18.x",
        "Handler": "index.handler",
        "Role": {"Fn::GetAtt": ["LambdaRole", "Arn"]},
        "Code": {
          "S3Bucket": "$BUCKET_NAME",
          "S3Key": "create-session.zip"
        },
        "Environment": {
          "Variables": {
            "SESSIONS_TABLE": {"Ref": "SessionsTable"},
            "CORS_ORIGIN": "*"
          }
        }
      }
    },
    "InterviewApi": {
      "Type": "AWS::ApiGatewayV2::Api",
      "Properties": {
        "Name": "InterviewApi",
        "ProtocolType": "HTTP",
        "CorsConfiguration": {
          "AllowOrigins": ["*"],
          "AllowMethods": ["*"],
          "AllowHeaders": ["*"]
        }
      }
    },
    "CreateSessionIntegration": {
      "Type": "AWS::ApiGatewayV2::Integration",
      "Properties": {
        "ApiId": {"Ref": "InterviewApi"},
        "IntegrationType": "AWS_PROXY",
        "IntegrationUri": {"Fn::Sub": "arn:aws:apigateway:\${AWS::Region}:lambda:path/2015-03-31/functions/\${CreateSessionFunction.Arn}/invocations"},
        "PayloadFormatVersion": "2.0"
      }
    },
    "CreateSessionRoute": {
      "Type": "AWS::ApiGatewayV2::Route",
      "Properties": {
        "ApiId": {"Ref": "InterviewApi"},
        "RouteKey": "POST /sessions",
        "Target": {"Fn::Sub": "integrations/\${CreateSessionIntegration}"}
      }
    },
    "ApiStage": {
      "Type": "AWS::ApiGatewayV2::Stage",
      "Properties": {
        "ApiId": {"Ref": "InterviewApi"},
        "StageName": "\$default",
        "AutoDeploy": true
      }
    },
    "LambdaPermission": {
      "Type": "AWS::Lambda::Permission",
      "Properties": {
        "FunctionName": {"Ref": "CreateSessionFunction"},
        "Action": "lambda:InvokeFunction",
        "Principal": "apigateway.amazonaws.com",
        "SourceArn": {"Fn::Sub": "arn:aws:execute-api:\${AWS::Region}:\${AWS::AccountId}:\${InterviewApi}/*/*"}
      }
    }
  },
  "Outputs": {
    "ApiEndpoint": {
      "Value": {"Fn::Sub": "https://\${InterviewApi}.execute-api.\${AWS::Region}.amazonaws.com"}
    }
  }
}
"@

$TEMPLATE | Out-File -FilePath "direct-template.json" -Encoding UTF8

# Deploy stack
aws cloudformation create-stack `
  --stack-name $STACK_NAME `
  --template-body file://direct-template.json `
  --capabilities CAPABILITY_IAM `
  --region $REGION

Write-Host "Stack deployment initiated. Check AWS Console for progress."
Write-Host "Bucket created: $BUCKET_NAME"
#!/usr/bin/env python3
import aws_cdk as cdk
from aws_cdk import (
    Stack,
    aws_lambda as _lambda,
    aws_apigatewayv2 as apigw,
    aws_apigatewayv2_integrations as integrations,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_iam as iam,
    CfnOutput,
    RemovalPolicy
)

class InterviewAssistantStack(Stack):
    def __init__(self, scope, construct_id, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        # DynamoDB Tables
        sessions_table = dynamodb.Table(
            self, "SessionsTable",
            partition_key=dynamodb.Attribute(name="sessionId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY
        )

        # S3 Buckets
        transcripts_bucket = s3.Bucket(
            self, "TranscriptsBucket",
            cors=[s3.CorsRule(
                allowed_methods=[s3.HttpMethods.GET, s3.HttpMethods.POST, s3.HttpMethods.PUT],
                allowed_origins=["*"],
                allowed_headers=["*"]
            )],
            removal_policy=RemovalPolicy.DESTROY
        )

        static_bucket = s3.Bucket(
            self, "StaticWebsiteBucket",
            removal_policy=RemovalPolicy.DESTROY
        )

        # Lambda Functions
        create_session_fn = _lambda.Function(
            self, "CreateSessionFunction",
            runtime=_lambda.Runtime.NODEJS_18_X,
            handler="index.handler",
            code=_lambda.Code.from_asset("../services/create-session"),
            environment={
                "SESSIONS_TABLE": sessions_table.table_name,
                "CORS_ORIGIN": "*"
            }
        )

        # API Gateway
        api = apigw.HttpApi(
            self, "InterviewApi",
            cors_preflight=apigw.CorsPreflightOptions(
                allow_origins=["*"],
                allow_methods=[apigw.CorsHttpMethod.ANY],
                allow_headers=["Content-Type", "Authorization"]
            )
        )

        # Add routes
        api.add_routes(
            path="/sessions",
            methods=[apigw.HttpMethod.POST],
            integration=integrations.HttpLambdaIntegration("CreateSessionIntegration", create_session_fn)
        )

        # Grant permissions
        sessions_table.grant_read_write_data(create_session_fn)

        # Outputs
        CfnOutput(self, "ApiEndpoint", value=api.url)
        CfnOutput(self, "TranscriptsBucket", value=transcripts_bucket.bucket_name)

app = cdk.App()
InterviewAssistantStack(app, "InterviewAssistantStack")
app.synth()
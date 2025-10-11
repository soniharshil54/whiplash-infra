
## AWS Prerequisites

1. **AWS Account Setup**
   - AWS Account with appropriate permissions
   - AWS Access Key ID and Secret Access Key for GitLab CI/CD

2. **CDK Bootstrap** (Required for all environments)
   ```bash
   # Bootstrap CDK in your target region (e.g., us-west-2)
   cdk bootstrap aws://YOUR_ACCOUNT_ID/us-west-2
   
   # Bootstrap CDK in us-east-1 (Required for WAF)
   cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
   ```

## 🚀 Deployment Order

**CRITICAL**: Deploy components in this exact order:

1. **whiplash-infra** (Core Infrastructure)
2. **whiplash-db-infra** (Database Infrastructure)
3. **whiplash-infra** (Core Infrastructure) Run this pipeline again with deployment vars `ATLAS_SERVICE_NAME` that you get from atlas console after infra db deployment and `ENABLE_ATLAS_ENDPOINT` set to true.
3. **whiplash-backend** (Backend Application)
4. **whiplash-frontend** (Frontend Application)

## 🔧 Environment Variables Configuration
### Repository Level Variables
- `PROJECT` - Project name used for resource naming (e.g., "whiplash"). Used to generate unique resource names across all AWS services. **Must be same across all repos**. 

### Deployment Level Variables
- `AWS_ACCESS_KEY_ID` - AWS access key for authentication. Needed to deploy AWS resources via CDK. Different AWS accounts/keys per environment. 
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for authentication. Needed to deploy AWS resources via CDK. Different AWS accounts/keys per environment. 
- `AWS_REGION` - AWS region where resources will be deployed. CDK needs to know which region to deploy to. Different regions per environment. 
- `DEPLOY_ENV` - Environment identifier (dev/staging/prod). Used for resource naming and configuration selection. Different per environment. 
- `ENABLE_CUSTOM_DOMAINS` - Enable custom domain support in CloudFront. Defaults to false, only needed for custom domains. **Default**: false. 
- `CUSTOM_DOMAINS_CSV` - Comma-separated list of custom domains. Only needed when custom domains are enabled. **Example**: "example.com,www.example.com". Required if `ENABLE_CUSTOM_DOMAINS` is set to true.
- `ACM_CERT_ARN` - AWS Certificate Manager ARN for HTTPS. Only needed for HTTPS with custom domains. **Format**: arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID. Required if `ENABLE_CUSTOM_DOMAINS` is set to true. 
- `ENABLE_ATLAS_ENDPOINT` - Enable MongoDB Atlas private endpoint. Defaults to false, only needed for private connectivity. **Default**: false. you will need to get atlas service name first from db infra pipeline so set this variable to false for initial deployment. run this core-infra pipeline again after db infra pipeline has run and you get atlas service name from mongo atlas console.
- `ATLAS_SERVICE_NAME` - Name of Atlas service for private endpoint. Only needed when Atlas endpoint is enabled. you can get it from mongodb atlas console after db-infra deployment has run. so for first initial deployment run core infra pipeline without this variable. run this core-infra pipeline again after db infra pipeline has run and you get atlas service name from mongo atlas console. **Note**: Manually retrieve from MongoDB Atlas console after db-infra deployment.
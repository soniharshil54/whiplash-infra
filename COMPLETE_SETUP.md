# Whiplash Project Deployment Guide

This guide provides comprehensive instructions for deploying the Whiplash project using Bitbucket Pipelines. The project consists of four main components that must be deployed in a specific order.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Prerequisites](#prerequisites)
- [Repository Structure](#repository-structure)
- [Deployment Order](#deployment-order)
- [Environment Variables Configuration](#environment-variables-configuration)
- [Bitbucket Pipelines Setup](#bitbucket-pipelines-setup)
- [Local Development Setup](#local-development-setup)
- [Troubleshooting](#troubleshooting)

## 🏗️ Project Overview

The Whiplash project is a full-stack application with the following components:

1. **whiplash-infra** - Core AWS infrastructure (VPC, ECS, ALB, CloudFront, WAF)
2. **whiplash-db-infra** - MongoDB Atlas database infrastructure
3. **whiplash-backend** - Node.js backend application
4. **whiplash-frontend** - React frontend application

## ⚙️ Prerequisites

### AWS Prerequisites

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

3. **MongoDB Atlas Account**
   - MongoDB Atlas account with API keys
   - Organization ID

### Bitbucket Prerequisites

1. **Bitbucket Pipelines** enabled on all applicable projects/repositories
2. **Bitbucket Repository and Deployment Variables** configured (see [Environment Variables Configuration](#environment-variables-configuration))

## 📁 Repository Structure

```
whiplash/
├── whiplash-infra/          # Core AWS infrastructure (CDK)
├── whiplash-db-infra/        # MongoDB Atlas infrastructure (Pulumi)
├── whiplash-backend/         # Backend application
└── whiplash-frontend/        # Frontend application
```

## 🚀 Deployment Order

**CRITICAL**: Deploy components in this exact order:

1. **whiplash-infra** (Core Infrastructure)
2. **whiplash-db-infra** (Database Infrastructure)
3. **whiplash-infra** (Core Infrastructure) Run this pipeline again with deployment vars `ATLAS_SERVICE_NAME` that you get from atlas console after infra db deployment and `ENABLE_ATLAS_ENDPOINT` set to true.
3. **whiplash-backend** (Backend Application)
4. **whiplash-frontend** (Frontend Application)

### Why This Order Matters

- **Core Infrastructure** must be deployed first to create VPC, ECS cluster, and ECR repositories
- **Database Infrastructure** creates MongoDB Atlas cluster and private endpoints
- **Backend** requires the core infrastructure and database to be ready
- **Frontend** requires the backend ALB DNS to be available for API calls

## 🔧 Environment Variables Configuration

**Important**: `PROJECT` must be set at **Repository Level** in ALL repositories and must be the same across all repos for the same project.

## 📋 Repository-Specific Variable Requirements

### whiplash-infra Repository

#### Repository Level Variables
- `PROJECT` - Project name used for resource naming (e.g., "whiplash"). Used to generate unique resource names across all AWS services. **Must be same across all repos**. 

#### Deployment Level Variables
- `AWS_ACCESS_KEY_ID` - AWS access key for authentication. Needed to deploy AWS resources via CDK. Different AWS accounts/keys per environment. 
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for authentication. Needed to deploy AWS resources via CDK. Different AWS accounts/keys per environment. 
- `AWS_REGION` - AWS region where resources will be deployed. CDK needs to know which region to deploy to. Different regions per environment. 
- `DEPLOY_ENV` - Environment identifier (dev/staging/prod). Used for resource naming and configuration selection. Different per environment. 
- `ENABLE_CUSTOM_DOMAINS` - Enable custom domain support in CloudFront. Defaults to false, only needed for custom domains. **Default**: false. 
- `CUSTOM_DOMAINS_CSV` - Comma-separated list of custom domains. Only needed when custom domains are enabled. **Example**: "example.com,www.example.com". Required if `ENABLE_CUSTOM_DOMAINS` is set to true.
- `ACM_CERT_ARN` - AWS Certificate Manager ARN for HTTPS. Only needed for HTTPS with custom domains. **Format**: arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID. Required if `ENABLE_CUSTOM_DOMAINS` is set to true. 
- `ENABLE_ATLAS_ENDPOINT` - Enable MongoDB Atlas private endpoint. Defaults to false, only needed for private connectivity. **Default**: false. you will need to get atlas service name first from db infra pipeline so set this variable to false for initial deployment. run this core-infra pipeline again after db infra pipeline has run and you get atlas service name from mongo atlas console.
- `ATLAS_SERVICE_NAME` - Name of Atlas service for private endpoint. Only needed when Atlas endpoint is enabled. you can get it from mongodb atlas console after db-infra deployment has run. so for first initial deployment run core infra pipeline without this variable. run this core-infra pipeline again after db infra pipeline has run and you get atlas service name from mongo atlas console. **Note**: Manually retrieve from MongoDB Atlas console after db-infra deployment.

### whiplash-db-infra Repository

#### Repository Level Variables
- `PROJECT` - Project name used for resource naming. Must match other repositories. **Must be same across all repos**.

#### Deployment Level Variables
- `AWS_ACCESS_KEY_ID` - AWS access key for VPC peering and private endpoints. Needed for AWS-Atlas integration. Different AWS accounts per environment. 
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for VPC peering and private endpoints. Needed for AWS-Atlas integration. Different AWS accounts per environment. 
- `AWS_REGION` - AWS region for Atlas cluster and private endpoints. Atlas cluster region must match AWS region. Different regions per environment. 
- `DEPLOY_ENV` - Environment identifier for resource naming. Used for Atlas project and cluster naming. Different per environment. 
- `MONGODB_ATLAS_PUBLIC_KEY` - MongoDB Atlas API public key for authentication. Needed to create Atlas resources via Pulumi. Different Atlas accounts per environment. 
- `MONGODB_ATLAS_PRIVATE_KEY` - MongoDB Atlas API private key for authentication. Needed to create Atlas resources via Pulumi. Different Atlas accounts per environment. 
- `MONGODB_ATLAS_ORG_ID` - MongoDB Atlas organization ID. Needed to create Atlas project and resources. Different organizations per environment. 
- `MONGODB_USER_NAME` - Database username for application access. Used to create database user in Atlas. Different users per environment. 
- `MONGODB_USER_PASSWORD` - Database password for application access. Used to create database user in Atlas. Different passwords per environment. 
- `MONGODB_DATABASE_NAME` - Database name for the application. Used to create database in Atlas. Different database names per environment. 

### whiplash-backend Repository

#### Repository Level Variables
- `PROJECT` - Project name used for resource naming. Must match other repositories. **Must be same across all repos**. 
- `APP_TYPE` - Application type identifier. Used by pipeline to determine deployment behavior. **Value**: "backend". 

#### Deployment Level Variables
- `AWS_ACCESS_KEY_ID` - AWS access key for ECR and ECS deployment. Needed to push Docker images and deploy to ECS. Different AWS accounts per environment. 
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for ECR and ECS deployment. Needed to push Docker images and deploy to ECS. Different AWS accounts per environment. 
- `AWS_REGION` - AWS region for ECR and ECS deployment. Needed to deploy to correct region. Different regions per environment. 
- `DEPLOY_ENV` - Environment identifier for resource naming. Used for ECR repository and ECS service naming. Different per environment. 
- `MONGODB_URI` - Complete MongoDB connection string. Backend needs to connect to database. Different database URLs per environment. . **Note**: Manually retrieve from MongoDB Atlas console after db-infra deployment.
- `TLS_ENABLED` - Enable HTTPS for ALB. Defaults to false, only needed if you need alb to be HTTPS. This is for traffic between cloudfront and alb. this behaviour will not be exposed to end user **Default**: false. 
- `HOSTED_ZONE_NAME` - Route 53 hosted zone for custom domain. Only needed for custom domains. **Example**: "example.com". Required if `TLS_ENABLED` is set to true.
- `CERTIFICATE_ARN` - SSL certificate ARN for HTTPS. Only needed when TLS is enabled. **Format**: arn:aws:acm:region:ACCOUNT:certificate/CERT-ID. Required if `TLS_ENABLED` is set to true.

### whiplash-frontend Repository

#### Repository Level Variables
- `PROJECT` - Project name used for resource naming. Must match other repositories. **Must be same across all repos**. 
- `APP_TYPE` - Application type identifier. Used by pipeline to determine deployment behavior. **Value**: "frontend". 

#### Deployment Level Variables
- `AWS_ACCESS_KEY_ID` - AWS access key for ECR and ECS deployment. Needed to push Docker images and deploy to ECS. Different AWS accounts per environment. 
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for ECR and ECS deployment. Needed to push Docker images and deploy to ECS. Different AWS accounts per environment. 
- `AWS_REGION` - AWS region for ECR and ECS deployment. Needed to deploy to correct region. Different regions per environment. 
- `DEPLOY_ENV` - Environment identifier for resource naming. Used for ECR repository and ECS service naming. Different per environment. 
- `TLS_ENABLED` - Enable HTTPS for ALB. Defaults to false, only needed if you need alb to be HTTPS. This is for traffic between cloudfront and alb. this behaviour will not be exposed to end user **Default**: false. 
- `HOSTED_ZONE_NAME` - Route 53 hosted zone for custom domain. Only needed for custom domains. **Example**: "example.com". Required if `TLS_ENABLED` is set to true.
- `CERTIFICATE_ARN` - SSL certificate ARN for HTTPS. Only needed when TLS is enabled. **Format**: arn:aws:acm:region:ACCOUNT:certificate/CERT-ID. Required if `TLS_ENABLED` is set to true.
- `VITE_API_URL` - Backend API URL for frontend to call. **Example**: "https://api.example.com". **Note**: Might not need to set it as both frontend and backend share the same cloudfront and dns.
- `VITE_*` - Any other Vite environment variables. Only needed for specific frontend configuration. **Note**: All VITE_* variables are passed to frontend build. 

## 🔐 Variable Security Guidelines

**Mark as Secret**: Variables containing sensitive information like passwords, API keys, and connection strings.
**Do NOT Mark as Secret**: Variables containing public configuration, names, and identifiers.

## 🔄 Bitbucket Pipelines Setup

### 1. Repository Setup

Create repositories in Bitbucket:

```bash
# Create repositories in Bitbucket
# whiplash-infra
# whiplash-db-infra  
# whiplash-backend
# whiplash-frontend
```

### 2. Pipeline Configuration

Each repository uses Bitbucket Pipelines configuration:

#### whiplash-infra Pipeline
- **Trigger**: Manual deployment
- **Branches**: main → prod, staging → staging, dev → dev
- **Steps**: Init → Deploy/Destroy (parallel)

#### whiplash-db-infra Pipeline
- **Trigger**: Manual deployment
- **Branches**: main → prod, staging → staging, dev → dev
- **Steps**: Init → Deploy/Destroy (parallel)

#### whiplash-backend Pipeline
- **Trigger**: Automatic on push, manual build step
- **Branches**: main → prod, staging → staging, dev → dev
- **Steps**: Init → Build & Push → Deploy

#### whiplash-frontend Pipeline
- **Trigger**: Automatic on push, manual build step
- **Branches**: main → prod, staging → staging, dev → dev
- **Steps**: Init → Build & Push → Deploy

### 3. Deployment Process

#### Step 1: Deploy Core Infrastructure
1. Go to `whiplash-infra` repository in Bitbucket
2. Run pipeline for target environment. (note: pipeline will be triggered on push or MR Merge to the relevant branches (dev/staging/prod).)
3. Init step is run automatically setting up environment for deployment.
4. manually trigger deployment.
3. Wait for deployment to complete

#### Step 2: Deploy Database Infrastructure
1. Go to `whiplash-db-infra` repository in Bitbucket
2. Run pipeline for target environment. (note: pipeline will be triggered on push or MR Merge to the relevant branches (dev/staging/prod).)
3. Wait for MongoDB Atlas cluster creation

#### Step 3: Deploy Backend
1. Go to `whiplash-backend` repository in Bitbucket
2. Run pipeline for target environment. (note: pipeline will be triggered on push or MR Merge to the relevant branches (dev/staging/prod).)
3. Init step is run automatically setting up environment for deployment.
4. manually trigger deployment.
5. Wait for deployment to complete
6. Backend will automatically update core infrastructure with ALB DNS

#### Step 4: Deploy Frontend
1. Go to `whiplash-frontend` repository in Bitbucket
2. Run pipeline for target environment. (note: pipeline will be triggered on push or MR Merge to the relevant branches (dev/staging/prod).)
3. Init step is run automatically setting up environment for deployment.
4. manually trigger deployment.
5. Wait for deployment to complete
6. Backend will automatically update core infrastructure with ALB DNS

## 🔐 SSL Certificate and DNS Configuration

### Overview
This section covers setting up SSL certificates for custom domains and configuring DNS records for ALB endpoints. The setup assumes:
- **Root domain** (e.g., `example.com`) and **www subdomain** (`www.example.com`) are managed by external DNS provider (GoDaddy, Namecheap, etc.)
- **ALB subdomains** (`backend.alb.example.com`, `frontend.alb.example.com`) are managed by Route 53

### Step 1: Create Public Hosted Zone in Route 53

1. **Go to Route 53 Console**
   - Navigate to AWS Route 53 → Hosted zones
   - Click "Create hosted zone"

2. **Configure Hosted Zone**
   - **Domain name**: `alb.example.com` (replace `example.com` with your domain)
   - **Type**: Public hosted zone
   - **Description**: "ALB subdomains for Whiplash project"

3. **Note the Name Servers**
   - After creation, note the 4 NS records provided by Route 53
   - You'll need these for DNS configuration later

### Step 2: Create ACM Certificates

#### Certificate 1: CloudFront Certificate (us-east-1)

1. **Go to ACM Console**
   - Navigate to AWS Certificate Manager
   - **Important**: Select **us-east-1 (N. Virginia)** region (required for CloudFront)

2. **Request Certificate**
   - Click "Request a certificate"
   - Choose "Request a public certificate"
   - Click "Next"

3. **Add Domain Names**
   - **Domain name**: `example.com`
   - **Subject alternative names (SAN)**:
     - `www.example.com`
     - `*.example.com` (wildcard for subdomains)
   - Click "Next"

4. **Choose Validation Method**
   - Select "DNS validation" (recommended)
   - Click "Request"

5. **Validate Certificate**
   - Click on the certificate to view validation records
   - **For each domain**, you'll see CNAME records like:
     ```
     Name: _abc123.example.com
     Value: _xyz789.acm-validations.aws.
     ```
   - **Add these CNAME records** to your external DNS provider (GoDaddy/Namecheap)
   - Wait for validation (usually 5-30 minutes)

6. **Note Certificate ARN**
   - Copy the certificate ARN for use in deployment variables
   - Format: `arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID`

#### Certificate 2: ALB Certificate (Your Target Region)

1. **Go to ACM Console**
   - Navigate to AWS Certificate Manager
   - Select your **target region** (e.g., us-west-2)

2. **Request Certificate**
   - Click "Request a certificate"
   - Choose "Request a public certificate"
   - Click "Next"

3. **Add Domain Names**
   - **Domain name**: `backend.alb.example.com`
   - **Subject alternative names (SAN)**:
     - `frontend.alb.example.com`
   - Click "Next"

4. **Choose Validation Method**
   - Select "DNS validation"
   - Click "Request"

5. **Validate Certificate**
   - Click on the certificate to view validation records
   - **Add CNAME records** to Route 53 hosted zone (`alb.example.com`), just need to click create records for route53.
   - Wait for validation

6. **Note Certificate ARN**
   - Copy the certificate ARN for ALB deployment variables

### Step 3: Configure DNS Records

#### External DNS Provider (GoDaddy/Namecheap)

1. **Add CloudFront DNS Records**
   
   **For Root Domain (example.com):**
   - **Type**: A (Alias) or CNAME
   - **Name**: `@` or leave blank (represents root domain)
   - **Value**: CloudFront distribution domain name (e.g., `d1234567890.cloudfront.net`)
   - **TTL**: 300 (5 minutes) or use provider's default
   
   **For WWW Subdomain (www.example.com):**
   - **Type**: A (Alias) or CNAME
   - **Name**: `www`
   - **Value**: CloudFront distribution domain name (e.g., `d1234567890.cloudfront.net`)
   - **TTL**: 300 (5 minutes) or use provider's default
   
   **Note**: 
   - If your provider supports A (Alias) records, use those (preferred)
   - If only CNAME is available, use CNAME for both root and www
   - Some providers don't allow CNAME on root domain - use A record with CloudFront IPs in that case

4. **Get CloudFront Distribution Domain Name**
   - Go to AWS CloudFront Console
   - Find your distribution (created by whiplash-infra pipeline)
   - Copy the **Domain Name** (e.g., `d1234567890.cloudfront.net`)
   - This is what you'll use as the value for your DNS records

5. **Add NS Records for ALB Subdomains**
   - **Type**: NS
   - **Name**: `alb` (or `alb.example.com`)
   - **Value**: Use the 4 NS records from Route 53 hosted zone
   - **TTL**: 3600 (1 hour)

6. **Add ACM Validation Records**
   - **Type**: CNAME
   - **Name**: `_abc123` (from ACM validation)
   - **Value**: `_xyz789.acm-validations.aws.` (from ACM validation)
   - **TTL**: 300 (5 minutes)
   - Repeat for all validation records

#### Provider-Specific Instructions

**Namecheap:**
1. Log into Namecheap Advanced DNS
2. For root domain: Use "A Record" with Host "@" and Value as CloudFront domain
3. For www: Use "CNAME Record" with Host "www" and Value as CloudFront domain
4. Namecheap allows A records on root domain

**Cloudflare:**
1. Log into Cloudflare DNS
2. For root domain: Use "A" record with Name "@" and Value as CloudFront domain
3. For www: Use "CNAME" record with Name "www" and Value as CloudFront domain
4. Cloudflare supports both A and CNAME on root domain

**General Tips:**
- Godaddy doesn't support Alias with cloudfront dns, move your dns management to cloudflare or route53 instead.

### Step 4: Update Deployment Variables

#### whiplash-infra Repository Variables
- `ENABLE_CUSTOM_DOMAINS`: `true`
- `CUSTOM_DOMAINS_CSV`: `example.com,www.example.com`
- `ACM_CERT_ARN`: `arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID` (CloudFront certificate)

#### whiplash-backend Repository Variables
- `TLS_ENABLED`: `true`
- `HOSTED_ZONE_NAME`: `alb.example.com`
- `CERTIFICATE_ARN`: `arn:aws:acm:REGION:ACCOUNT:certificate/CERT-ID` (ALB certificate)

#### whiplash-frontend Repository Variables
- `TLS_ENABLED`: `true`
- `HOSTED_ZONE_NAME`: `alb.example.com`
- `CERTIFICATE_ARN`: `arn:aws:acm:REGION:ACCOUNT:certificate/CERT-ID` (ALB certificate)

### Step 5: DNS Propagation and Testing

1. **Wait for DNS Propagation**
   - NS record changes: 24-48 hours
   - CNAME records: 5-30 minutes
   - Use `dig` or online DNS checker to verify

2. **Test Certificate Validation**
   - Check ACM console for certificate status
   - Ensure all domains show "Issued" status

3. **Test Domain Access**
   - `https://example.com` → CloudFront (frontend)
   - `https://www.example.com` → CloudFront (frontend)

### Troubleshooting Certificate Issues

#### Certificate Validation Fails
- **Check DNS records**: Ensure CNAME records are correctly added
- **Wait longer**: DNS propagation can take up to 48 hours
- **Verify domain ownership**: Ensure you control the domain

#### Certificate Not Found in ACM
- **Check region**: CloudFront certificates must be in us-east-1
- **Check domain names**: Ensure exact match (case-sensitive)
- **Check SAN limits**: ACM allows up to 100 SANs per certificate

#### ALB Certificate Issues
- **Region mismatch**: ALB certificate must be in same region as ALB
- **Domain mismatch**: Certificate domains must match ALB domain
- **Validation status**: Ensure certificate shows "Issued" status

## 🔍 Troubleshooting

### Common Issues

#### 1. CDK Bootstrap Errors
```bash
# Ensure CDK is bootstrapped in both regions
cdk bootstrap aws://ACCOUNT-ID/us-west-2
cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

#### 2. ECR Repository Not Found
- Ensure core infrastructure is deployed first
- Check ECR repository names match: `{PROJECT}-{ENV}-{APP_TYPE}`

#### 3. MongoDB Atlas Connection Issues
- Verify MongoDB Atlas credentials
- Check private endpoint configuration
- Ensure VPC peering is established

#### 4. ALB DNS Not Found
- Wait for backend/frontend deployment to complete
- Check CloudFormation stack outputs
- Verify core infrastructure stack update

#### 5. CloudFront Cache Issues
- Pipeline automatically invalidates cache
- Manual invalidation: `aws cloudfront create-invalidation --distribution-id DISTRIBUTION-ID --paths "/*"` or via aws console.

### Pipeline Debugging

#### Check Pipeline Logs
1. Go to Bitbucket → Pipelines
2. Click on failed pipeline
3. Expand failed step logs
4. Look for error messages and stack traces

#### Common Pipeline Failures
- Missing environment variables
- AWS permissions issues
- Docker build failures
- CDK deployment errors

### Environment Variable Validation

Each pipeline validates required environment variables. Missing variables will cause immediate failure with clear error messages.

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Bitbucket Pipelines Documentation](https://support.atlassian.com/bitbucket-cloud/docs/get-started-with-bitbucket-pipelines/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)

## 🆘 Support

For issues or questions:
1. Check pipeline logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure deployment order is followed
4. Check AWS CloudFormation console for stack status

---

**Note**: This deployment process uses AWS Access Keys. Ensure your AWS credentials have sufficient permissions for all required AWS services.

## 🔧 Bitbucket Variable Configuration Details

### Repository Variables vs Deployment Variables

**Repository Variables** are shared across all deployments and environments. Use these for:
- AWS credentials (shared across all environments)
- MongoDB Atlas credentials (shared across all environments)
- Database credentials (shared across all environments)

**Deployment Variables** are environment-specific. Use these for:
- Environment-specific configurations (dev/staging/prod)
- Application-specific settings
- Domain and certificate configurations

### Setting Up Variables in Bitbucket

1. **Repository Variables**:
   - Go to Repository Settings → Pipelines → Repository variables
   - Add variables that should be available to all deployments
   - Mark sensitive variables as "Secured"

2. **Deployment Variables**:
   - Go to Repository Settings → Pipelines → Deployments
   - Create deployment environments (dev, staging, prod)
   - For each environment, go to Variables tab
   - Add environment-specific variables
   - Mark sensitive variables as "Secured"

### Variable Precedence

Deployment variables override repository variables with the same name. This allows you to:
- Set common values at repository level
- Override specific values per environment at deployment level

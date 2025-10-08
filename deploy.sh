#!/usr/bin/env bash
set -euo pipefail

# error if .cdk_env file is missing
if [ ! -f .cdk.env ]; then
  echo "Error: .cdk.env file not found!"
  exit 1
fi

# load env variables from .cdk_env file
export $(grep -v '^#' .cdk.env | xargs)

echo "Using environment variables:"
echo "  AWS_REGION: ${AWS_REGION}"
echo "  DEPLOY_ENV: ${DEPLOY_ENV}"
echo "  AWS_PROFILE: ${AWS_PROFILE}"
echo "  PROJECT: ${PROJECT}"

# ──────────────── VERSION & IMAGE ────────────────
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "🆔 AWS Account ID: ${AWS_ACCOUNT_ID}"
echo "📂 Infra DEPLOY_ENV: ${DEPLOY_ENV}"
export VERSION=$(cat VERSION)

echo "🚀 Deploying infra version: ${VERSION}"

# cdk bootstrap --context stage="${DEPLOY_ENV}" aws://${AWS_ACCOUNT_ID}/${AWS_REGION}

cdk context --clear

cdk deploy --all \
  --require-approval never \
  --context stage="${DEPLOY_ENV}" \
  --context version="${VERSION}" \
  --parameters ${PROJECT}-${DEPLOY_ENV}:EnableCustomDomains="${ENABLE_CUSTOM_DOMAINS:-false}" \
  --parameters ${PROJECT}-${DEPLOY_ENV}:CustomDomainsCsv="${CUSTOM_DOMAINS_CSV:-}" \
  --parameters ${PROJECT}-${DEPLOY_ENV}:AcmCertificateArnUsEast1="${ACM_CERT_ARN:-}" \
  --parameters ${PROJECT}-${DEPLOY_ENV}:EnableAtlasEndpoint="${ENABLE_ATLAS_ENDPOINT:-false}" \
  --parameters ${PROJECT}-${DEPLOY_ENV}:AtlasServiceName="${ATLAS_SERVICE_NAME:-}"

echo "✅ Infra ${VERSION} deployed successfully"

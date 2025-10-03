#!/usr/bin/env bash
set -euo pipefail

# load env variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

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

echo "🚀 Destroying infra version: ${VERSION}"

cdk context --clear
cdk destroy \
  --require-approval never \
  --context stage="${DEPLOY_ENV}" \
  --context version="${VERSION}"

echo "✅ Infra ${VERSION} destroyed successfully"

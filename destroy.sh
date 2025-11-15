#!/usr/bin/env bash
set -euo pipefail

# error if .cdk.env file is missing
if [ ! -f .cdk.env ]; then
  echo "Error: .cdk.env file not found!"
  exit 1
fi

# load env variables from .cdk.env file
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

echo "🚀 Destroying infra version: ${VERSION}"

cdk context --clear
cdk destroy \
  "${PROJECT}-${DEPLOY_ENV}" \
  "${PROJECT}-${DEPLOY_ENV}-waf" \
  --require-approval never \
  --context stage="${DEPLOY_ENV}" \
  --context version="${VERSION}"

echo "✅ Infra ${VERSION} destroyed successfully"

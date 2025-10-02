#!/usr/bin/env bash
set -euo pipefail

# ──────────────── CONFIG ────────────────
: "${AWS_REGION:=us-east-1}"
: "${STAGE:=dev}"
export PROJECT="whiplash"
export AWS_PROFILE="soni-1214"

# ──────────────── VERSION & IMAGE ────────────────
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
VERSION=$(cat VERSION)

echo "🚀 Deploying infra version: ${VERSION}"

cdk context --clear
cdk deploy \
  --require-approval never \
  --context stage="${STAGE}" \
  --context version="${VERSION}"

echo "✅ Infra ${VERSION} deployed successfully"

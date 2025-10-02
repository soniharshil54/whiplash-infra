#!/usr/bin/env bash
set -euo pipefail

# ──────────────── CONFIG ────────────────
: "${AWS_REGION:=us-east-1}"
: "${STAGE:=dev}"
PROJECT="whiplash"
AWS_PROFILE="soni-1214"

# ──────────────── VERSION & IMAGE ────────────────
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
VERSION=$(cat VERSION)

echo "💥 Destroying infra version: ${VERSION}"

cdk context --clear
cdk destroy \
  --require-approval never \
  --context stage="${STAGE}" \
  --context version="${VERSION}"

cd - >/dev/null

echo "✅ Infra ${VERSION} destroyed successfully"

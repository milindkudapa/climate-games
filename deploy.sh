#!/usr/bin/env bash
# Deploy v1 and v2 to S3 + invalidate CloudFront
# Usage: ./deploy.sh
# Requires: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY set in environment

set -euo pipefail

BUCKET="climate-games-v1"
DISTRIBUTION_ID="EV7XDM7C6DO7F"
REGION="us-east-1"

echo "▶ Building v1..."
npm run build --prefix v1

echo "▶ Building v2..."
npm run build --prefix v2

echo "▶ Deploying v1 to s3://$BUCKET/v1/ ..."
aws s3 sync v1/dist/ s3://$BUCKET/v1/ \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html"

aws s3 cp v1/dist/index.html s3://$BUCKET/v1/index.html \
  --content-type text/html \
  --cache-control "no-cache"

echo "▶ Deploying v2 to s3://$BUCKET/v2/ ..."
aws s3 sync v2/dist/ s3://$BUCKET/v2/ \
  --delete \
  --cache-control "max-age=31536000" \
  --exclude "*.html"

aws s3 cp v2/dist/index.html s3://$BUCKET/v2/index.html \
  --content-type text/html \
  --cache-control "no-cache"

echo "▶ Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/v1/*" "/v2/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output table

echo ""
echo "✓ Done. Live at:"
echo "  https://dubjcjjzo65gg.cloudfront.net/v1/"
echo "  https://dubjcjjzo65gg.cloudfront.net/v2/"

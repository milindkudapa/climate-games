#!/usr/bin/env bash
# Run this once to create the S3 bucket and CloudFront distribution.
# After it completes, add the printed values as GitHub secrets.
#
# Prerequisites:
#   - AWS CLI configured (aws configure) or AWS_ACCESS_KEY_ID/SECRET set in env
#   - jq installed (brew install jq)
#
# Usage:
#   chmod +x scripts/aws-setup.sh
#   ./scripts/aws-setup.sh

set -euo pipefail

REGION="us-east-1"
BUCKET_NAME="climate-games-v1"
OAC_NAME="climate-games-v1-oac"

echo ""
echo "============================================"
echo "  Climate Games v1 - AWS Setup"
echo "============================================"
echo ""

# ── S3 Bucket ──────────────────────────────────────────────────────────────

echo "▶ Creating S3 bucket: $BUCKET_NAME"

if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
  echo "  Bucket already exists, skipping creation."
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION"
  echo "  Bucket created."
fi

echo "▶ Blocking all public access on bucket..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "▶ Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled

# ── CloudFront Origin Access Control ──────────────────────────────────────

echo "▶ Creating CloudFront Origin Access Control..."

OAC_CONFIG=$(cat <<EOF
{
  "Name": "$OAC_NAME",
  "Description": "OAC for climate-games-v1",
  "SigningProtocol": "sigv4",
  "SigningBehavior": "always",
  "OriginAccessControlOriginType": "s3"
}
EOF
)

OAC_ID=$(aws cloudfront create-origin-access-control \
  --origin-access-control-config "$OAC_CONFIG" \
  --query 'OriginAccessControl.Id' \
  --output text 2>/dev/null || echo "")

if [ -z "$OAC_ID" ]; then
  echo "  OAC may already exist, looking up..."
  OAC_ID=$(aws cloudfront list-origin-access-controls \
    --query "OriginAccessControlList.Items[?Name=='$OAC_NAME'].Id" \
    --output text)
fi
echo "  OAC ID: $OAC_ID"

# ── CloudFront Distribution ────────────────────────────────────────────────

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_DOMAIN="${BUCKET_NAME}.s3.${REGION}.amazonaws.com"

echo "▶ Creating CloudFront distribution..."

DIST_CONFIG=$(cat <<EOF
{
  "CallerReference": "climate-games-v1-$(date +%s)",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "s3-climate-games-v1",
      "DomainName": "$S3_DOMAIN",
      "S3OriginConfig": {"OriginAccessIdentity": ""},
      "OriginAccessControlId": "$OAC_ID"
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "s3-climate-games-v1",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true,
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    }
  },
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {"ErrorCode": 403, "ResponseCode": "200", "ResponsePagePath": "/index.html", "ErrorCachingMinTTL": 0},
      {"ErrorCode": 404, "ResponseCode": "200", "ResponsePagePath": "/index.html", "ErrorCachingMinTTL": 0}
    ]
  },
  "Comment": "climate-games-v1",
  "Enabled": true,
  "HttpVersion": "http2and3",
  "PriceClass": "PriceClass_100"
}
EOF
)

DIST_OUTPUT=$(aws cloudfront create-distribution --distribution-config "$DIST_CONFIG")
DIST_ID=$(echo "$DIST_OUTPUT" | jq -r '.Distribution.Id')
DIST_DOMAIN=$(echo "$DIST_OUTPUT" | jq -r '.Distribution.DomainName')

echo "  Distribution ID: $DIST_ID"
echo "  Distribution domain: $DIST_DOMAIN"

# ── Bucket Policy (allow CloudFront OAC) ──────────────────────────────────

echo "▶ Attaching bucket policy for CloudFront OAC..."

BUCKET_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DIST_ID}"
      }
    }
  }]
}
EOF
)

aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy "$BUCKET_POLICY"

# ── Summary ────────────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Add these as GitHub repository secrets:"
echo ""
echo "  S3_BUCKET_NAME             = $BUCKET_NAME"
echo "  CLOUDFRONT_DISTRIBUTION_ID = $DIST_ID"
echo "  AWS_ACCESS_KEY_ID          = <your IAM key>"
echo "  AWS_SECRET_ACCESS_KEY      = <your IAM secret>"
echo ""
echo "Your site will be live at:"
echo "  https://$DIST_DOMAIN"
echo ""
echo "Note: CloudFront distribution takes ~10 minutes to deploy globally."

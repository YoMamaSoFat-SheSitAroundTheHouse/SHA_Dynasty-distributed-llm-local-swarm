#!/usr/bin/env bash
# test-sms.sh — Send a test SMS via the SMSGate gateway on velvet or sha-dynasty
# Run from shitbox-jr after SMSGate is installed and running on the Android device.
#
# Usage:
#   export SMS_USER="username_from_app"
#   export SMS_PASS="password_from_app"
#   export GATEWAY_IP="100.VELVET_TAILSCALE_IP"
#   export TARGET_NUMBER="+1YOURNUMBER"
#   ./test-sms.sh

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SMS_USER="${SMS_USER:-}"
SMS_PASS="${SMS_PASS:-}"
GATEWAY_IP="${GATEWAY_IP:-}"
TARGET_NUMBER="${TARGET_NUMBER:-}"
MESSAGE="${1:-SHA-Dynasty swarm online — test message from shitbox-jr}"

# ── Validation ────────────────────────────────────────────────────────────────
if [[ -z "$SMS_USER" || -z "$SMS_PASS" || -z "$GATEWAY_IP" || -z "$TARGET_NUMBER" ]]; then
  echo "ERROR: Set SMS_USER, SMS_PASS, GATEWAY_IP, and TARGET_NUMBER as environment variables."
  echo ""
  echo "Example:"
  echo "  export SMS_USER='abc123'"
  echo "  export SMS_PASS='xyz789'"
  echo "  export GATEWAY_IP='100.x.x.x'"
  echo "  export TARGET_NUMBER='+15551234567'"
  echo "  ./test-sms.sh 'Hello from the swarm'"
  exit 1
fi

BASE_URL="http://${GATEWAY_IP}:8080"

echo "=== SHA-Dynasty SMS Gateway Test ==="
echo "Gateway : $BASE_URL"
echo "Target  : $TARGET_NUMBER"
echo "Message : $MESSAGE"
echo ""

# ── Health check ──────────────────────────────────────────────────────────────
echo "1. Health check..."
HEALTH=$(curl -sf -u "$SMS_USER:$SMS_PASS" "$BASE_URL/health" 2>/dev/null || echo "FAILED")
if [[ "$HEALTH" == "FAILED" ]]; then
  echo "   ERROR: Cannot reach gateway at $BASE_URL"
  echo "   Is SMSGate running on the Android device? Is Tailscale connected?"
  exit 1
fi
echo "   OK: $HEALTH"

# ── Send SMS ──────────────────────────────────────────────────────────────────
echo ""
echo "2. Sending SMS..."
RESPONSE=$(curl -sf -X POST \
  -u "$SMS_USER:$SMS_PASS" \
  -H "Content-Type: application/json" \
  -d "{\"textMessage\": {\"text\": \"$MESSAGE\"}, \"phoneNumbers\": [\"$TARGET_NUMBER\"]}" \
  "$BASE_URL/message")

echo "   Response: $RESPONSE"
MESSAGE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")

if [[ -z "$MESSAGE_ID" ]]; then
  echo "   WARNING: Could not extract message ID from response."
  exit 0
fi

echo "   Message ID: $MESSAGE_ID"

# ── Poll delivery status ───────────────────────────────────────────────────────
echo ""
echo "3. Checking delivery status (polling for 30s)..."
for i in $(seq 1 6); do
  sleep 5
  STATUS=$(curl -sf -u "$SMS_USER:$SMS_PASS" "$BASE_URL/message/$MESSAGE_ID" 2>/dev/null || echo "{}")
  STATE=$(echo "$STATUS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('state','unknown'))" 2>/dev/null || echo "unknown")
  echo "   [${i}0s] State: $STATE"
  if [[ "$STATE" == "Delivered" || "$STATE" == "Failed" ]]; then
    break
  fi
done

echo ""
echo "=== Test complete ==="

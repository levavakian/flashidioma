#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="flashidioma"
CONTAINER_NAME="flashidioma-dev"

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY is not set."
    exit 1
fi

# Stop and remove any existing container with the same name
docker rm -f $CONTAINER_NAME 2>/dev/null || true

docker run -dit \
    --name $CONTAINER_NAME \
    --network host \
    -v "$SCRIPT_DIR:/app" \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    $IMAGE_NAME \
    "bash"

sleep 1

docker exec -it $CONTAINER_NAME bash

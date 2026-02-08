#!/bin/bash
set -e

IMAGE_NAME="flashidioma"
docker build -t $IMAGE_NAME .

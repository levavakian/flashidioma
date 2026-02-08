#!/bin/bash

# Match container user UID/GID to the host user who owns /app
HOST_UID=$(stat -c %u /app)
HOST_GID=$(stat -c %g /app)

sudo usermod -u $HOST_UID user
sudo groupmod -g $HOST_GID user
sudo chown -R $HOST_UID:$HOST_GID /home/user /app
sudo chmod -R u+w /app

# Write environment variables for the user shell
env_file="/home/user/.env_vars"
echo "export ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'" > "$env_file"
chown $HOST_UID:$HOST_GID "$env_file"
chmod 600 "$env_file"

echo "source $env_file" >> /home/user/.bashrc

# Execute the command passed to docker run
exec sudo -E -H -u user bash -c "$@"

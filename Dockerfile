# Dev container for flashidioma
FROM ubuntu:24.04
RUN userdel -r ubuntu

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js LTS via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - && \
    apt-get install -y nodejs

# Install latest npm and Claude Code CLI
RUN npm install -g npm@latest @anthropic-ai/claude-code

# Clean up
RUN apt-get clean && rm -rf /var/lib/apt/lists/*

# Create a user with sudo access
RUN useradd -m -s /bin/bash user && \
    echo "user ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

WORKDIR /app

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER user

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash"]

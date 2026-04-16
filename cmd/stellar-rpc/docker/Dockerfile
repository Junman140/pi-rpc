FROM golang:1.25-bookworm AS build
ARG RUST_TOOLCHAIN_VERSION=stable
ARG REPOSITORY_VERSION

WORKDIR /go/src/github.com/pi-node/pi-rpc

ADD . ./

RUN git config --global --add safe.directory "/go/src/github.com/pi-node/pi-rpc"

ENV CARGO_HOME=/rust/.cargo
ENV RUSTUP_HOME=/rust/.rust
ENV PATH="/usr/local/go/bin:$CARGO_HOME/bin:${PATH}"
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain $RUST_TOOLCHAIN_VERSION

# Pre-download Go dependencies with retries to handle network instability
RUN go mod download || (sleep 5 && go mod download) || (sleep 10 && go mod download)

RUN make REPOSITORY_VERSION=${REPOSITORY_VERSION} build-pi-rpc

# Move the binary to a common location
RUN mv pi-rpc /bin/pi-rpc

FROM ubuntu:22.04
ARG PI_NODE_VERSION
ENV PI_NODE_VERSION=${PI_NODE_VERSION:-*}
ENV PI_NODE_BINARY_PATH=/usr/bin/pi-node
ENV DEBIAN_FRONTEND=noninteractive

# ca-certificates are required to make tls connections
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    gnupg \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
# Note: Pi Node repository might be different, using Stellar as placeholder if Pi Node is derived from it
RUN curl -sSL https://apt.stellar.org/SDF.asc | gpg --dearmor >/etc/apt/trusted.gpg.d/SDF.gpg
RUN echo "deb https://apt.stellar.org jammy stable" >/etc/apt/sources.list.d/SDF.list
RUN echo "deb https://apt.stellar.org jammy unstable" >/etc/apt/sources.list.d/SDF-unstable.list

# install llvm-20 so that core can be installed
RUN wget -O /etc/apt/trusted.gpg.d/apt.llvm.org.asc https://apt.llvm.org/llvm-snapshot.gpg.key
RUN echo 'deb http://apt.llvm.org/jammy/ llvm-toolchain-jammy-20 main' > /etc/apt/sources.list.d/llvm.list
RUN echo 'deb-src http://apt.llvm.org/jammy/ llvm-toolchain-jammy-20 main' >> /etc/apt/sources.list.d/llvm.list

RUN apt-get update && apt-get install -y --no-install-recommends stellar-core=${PI_NODE_VERSION} \
    && ln -s /usr/bin/stellar-core /usr/bin/pi-node \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from the build stage
COPY --from=build /bin/pi-rpc /app/pi-rpc

# Set the entrypoint to the specific binary
ENTRYPOINT ["/app/pi-rpc"]

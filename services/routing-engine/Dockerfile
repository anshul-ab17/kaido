FROM rust:1.82-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY services/routing-engine/ ./
RUN cargo build --release

FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates
COPY --from=builder /app/target/release/engine /engine
EXPOSE 5000
ENV RUST_LOG=info
CMD ["/engine"]

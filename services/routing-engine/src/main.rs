mod config;
mod engine;
mod models;
mod routes;

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cfg = config::Config::from_env();

    let app = Router::new()
        .route("/health", get(routes::health::health))
        .route("/score-route", post(routes::score::score))
        .layer(CorsLayer::permissive());

    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    tracing::info!("Routing engine listening on {}", addr);
    axum::serve(listener, app).await.unwrap();
}

use axum::{http::StatusCode, Json};
use crate::{engine::score_route, models::{RouteRequest, RouteResult}};

pub async fn score(
    Json(payload): Json<RouteRequest>,
) -> Result<Json<RouteResult>, StatusCode> {
    let result = score_route(&payload);
    Ok(Json(result))
}

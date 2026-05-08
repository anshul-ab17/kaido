use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteRequest {
    pub input_token: String,
    pub output_token: String,
    pub input_amount: f64,
    pub slippage_bps: u32,
    pub wallet_address: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteStep {
    pub venue: String,
    pub input_token: String,
    pub output_token: String,
    pub input_amount: f64,
    pub output_amount: f64,
    pub price_impact: f64,
    pub fee: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteResult {
    pub steps: Vec<RouteStep>,
    pub input_amount: f64,
    pub output_amount: f64,
    pub price_impact: f64,
    pub total_fee: f64,
    pub confidence_score: f64,
    pub ai_explanation: String,
    pub estimated_savings: f64,
    pub execution_time_ms: u64,
}

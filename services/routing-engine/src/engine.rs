use crate::models::{RouteRequest, RouteResult, RouteStep};
use std::time::Instant;

pub fn score_route(req: &RouteRequest) -> RouteResult {
    let start = Instant::now();

    // Phase 2: replace with real AMM/CLOB scoring
    let slippage_factor = 1.0 - (req.input_amount * 0.0001_f64).min(0.01);
    let output_amount = req.input_amount * 150.8 * slippage_factor;
    let price_impact = (req.input_amount * 0.0001_f64).min(0.01);
    let fee = req.input_amount * 0.003;

    let venue = if req.input_amount > 1000.0 {
        "orca+openbook"
    } else {
        "orca"
    };

    RouteResult {
        steps: vec![RouteStep {
            venue: venue.to_string(),
            input_token: req.input_token.clone(),
            output_token: req.output_token.clone(),
            input_amount: req.input_amount,
            output_amount,
            price_impact,
            fee,
        }],
        input_amount: req.input_amount,
        output_amount,
        price_impact,
        total_fee: fee,
        confidence_score: 0.985,
        ai_explanation: format!(
            "Optimal route via {}. Price impact: {:.4}%. Fee: {:.4} USDC.",
            venue,
            price_impact * 100.0,
            fee
        ),
        estimated_savings: req.input_amount * 0.002,
        execution_time_ms: start.elapsed().as_millis() as u64,
    }
}

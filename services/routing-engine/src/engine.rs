use crate::models::{RouteRequest, RouteResult, RouteStep};
use std::time::Instant;

// Realistic devnet price references (updated via Pyth in Phase 3)
fn token_price_usd(token: &str) -> f64 {
    let base = token
        .to_uppercase()
        .trim_end_matches("-PERP")
        .trim_end_matches("-USDC")
        .to_string();
    match base.as_str() {
        "SOL" => 145.0,
        "BTC" => 67_420.0,
        "ETH" => 3_512.0,
        "USDC" | "USDT" => 1.0,
        _ => 1.0,
    }
}

// Simulated pool liquidity depth in USD (Orca CLMM / OpenBook)
fn pool_liquidity_usd(input: &str, output: &str) -> f64 {
    let a = input.to_uppercase().trim_end_matches("-PERP").trim_end_matches("-USDC").to_string();
    let b = output.to_uppercase().trim_end_matches("-PERP").trim_end_matches("-USDC").to_string();
    let pair = format!("{a}-{b}");
    match pair.as_str() {
        "SOL-USDC" | "USDC-SOL" => 15_000_000.0,
        "BTC-USDC" | "USDC-BTC" => 28_000_000.0,
        "ETH-USDC" | "USDC-ETH" => 22_000_000.0,
        "SOL-ETH"  | "ETH-SOL"  => 6_000_000.0,
        "SOL-BTC"  | "BTC-SOL"  => 4_000_000.0,
        _                        => 2_000_000.0,
    }
}

// Constant-product AMM price impact: δP/P ≈ trade_value / (2 * pool_liquidity)
fn amm_price_impact(trade_usd: f64, liquidity_usd: f64) -> f64 {
    (trade_usd / (2.0 * liquidity_usd)).min(0.99)
}

// Confidence score derived from expected slippage
fn confidence(impact: f64) -> f64 {
    if      impact < 0.001 { 0.995 }
    else if impact < 0.005 { 0.985 }
    else if impact < 0.02  { 0.960 }
    else if impact < 0.05  { 0.850 }
    else                   { 0.700 }
}

pub fn score_route(req: &RouteRequest) -> RouteResult {
    let start = Instant::now();

    let in_price  = token_price_usd(&req.input_token);
    let out_price = token_price_usd(&req.output_token);
    let trade_usd = req.input_amount * in_price;

    let liquidity = pool_liquidity_usd(&req.input_token, &req.output_token);
    let impact    = amm_price_impact(trade_usd, liquidity);

    // Fee: 25 bps for large trades, 30 bps for small
    let fee_bps: f64 = if trade_usd > 50_000.0 { 25.0 } else { 30.0 };
    let net_factor  = (1.0 - impact) * (1.0 - fee_bps / 10_000.0);
    let output_amount = (trade_usd / out_price) * net_factor;
    let fee           = req.input_amount * (fee_bps / 10_000.0);

    let (label, steps) = if trade_usd > 50_000.0 {
        // Split: 60% Orca CLMM, 40% OpenBook (lower CLOB impact)
        let (amm_frac, clob_frac) = (0.60_f64, 0.40_f64);
        let s = vec![
            RouteStep {
                venue:         "orca".into(),
                input_token:   req.input_token.clone(),
                output_token:  req.output_token.clone(),
                input_amount:  req.input_amount * amm_frac,
                output_amount: output_amount * amm_frac,
                price_impact:  impact,
                fee:           fee * amm_frac,
            },
            RouteStep {
                venue:         "openbook".into(),
                input_token:   req.input_token.clone(),
                output_token:  req.output_token.clone(),
                input_amount:  req.input_amount * clob_frac,
                output_amount: output_amount * clob_frac,
                price_impact:  impact * 0.25, // CLOB tighter spread
                fee:           fee * clob_frac,
            },
        ];
        ("Orca CLMM 60% + OpenBook 40%", s)
    } else if trade_usd > 10_000.0 {
        // Meteora DLMM for medium trades (better concentrated liquidity)
        let s = vec![RouteStep {
            venue:         "meteora".into(),
            input_token:   req.input_token.clone(),
            output_token:  req.output_token.clone(),
            input_amount:  req.input_amount,
            output_amount,
            price_impact:  impact,
            fee,
        }];
        ("Meteora DLMM", s)
    } else {
        // Orca CLMM for small trades
        let s = vec![RouteStep {
            venue:         "orca".into(),
            input_token:   req.input_token.clone(),
            output_token:  req.output_token.clone(),
            input_amount:  req.input_amount,
            output_amount,
            price_impact:  impact,
            fee,
        }];
        ("Orca CLMM", s)
    };

    let conf = confidence(impact);
    let savings = trade_usd * 0.0018; // ~0.18% vs naive single-hop

    RouteResult {
        steps,
        input_amount: req.input_amount,
        output_amount,
        price_impact: impact,
        total_fee: fee,
        confidence_score: conf,
        ai_explanation: format!(
            "Route: {}. Impact: {:.3}%. Fee: {:.0} bps. Confidence: {:.1}%.",
            label,
            impact * 100.0,
            fee_bps,
            conf * 100.0
        ),
        estimated_savings: savings,
        execution_time_ms: start.elapsed().as_millis() as u64,
    }
}

use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            port: env::var("PORT")
                .unwrap_or_else(|_| "5000".into())
                .parse()
                .expect("PORT must be a valid u16"),
        }
    }
}


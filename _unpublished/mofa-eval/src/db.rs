use std::fs;
use std::path::PathBuf;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalRow {
    pub id: String,
    pub run_id: String,
    pub expected: String,
    pub actual: String,
    pub rubric: String,
    pub score: i32,
    pub reasoning: String,
    pub created_at: String,
}

fn db_path() -> PathBuf {
    // 1. Environment variable override: MOFA_EVAL_DB_PATH
    if let Ok(custom) = std::env::var("MOFA_EVAL_DB_PATH") {
        let path = PathBuf::from(custom);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        return path;
    }
    // 2. Default to ~/.mofa/.mofa_eval_history.db
    let base = if let Ok(home) = std::env::var("HOME") {
        let mut dir = PathBuf::from(home);
        dir.push(".mofa");
        dir
    } else {
        PathBuf::from("/tmp/.mofa")
    };
    let _ = fs::create_dir_all(&base);
    base.join(".mofa_eval_history.db")
}

pub fn open_db() -> Result<Connection, String> {
    let path = db_path();
    let conn = Connection::open(&path)
        .map_err(|e| format!("Failed to open DB at {}: {}", path.display(), e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS evals (
            id         TEXT PRIMARY KEY,
            run_id     TEXT NOT NULL,
            expected   TEXT NOT NULL,
            actual     TEXT NOT NULL,
            rubric     TEXT NOT NULL,
            score      INTEGER NOT NULL,
            reasoning  TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create evals table: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_evals_run_id ON evals(run_id)",
        [],
    ).map_err(|e| format!("Failed to create run_id index: {}", e))?;

    Ok(conn)
}

pub fn insert_eval(conn: &Connection, eval: &EvalRow) -> Result<(), String> {
    conn.execute(
        "INSERT INTO evals (id, run_id, expected, actual, rubric, score, reasoning, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            eval.id,
            eval.run_id,
            eval.expected,
            eval.actual,
            eval.rubric,
            eval.score,
            eval.reasoning,
            eval.created_at
        ],
    ).map_err(|e| format!("Failed to insert evaluation: {}", e))?;
    Ok(())
}

pub fn get_run(conn: &Connection, run_id: &str) -> Result<Vec<EvalRow>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, run_id, expected, actual, rubric, score, reasoning, created_at
         FROM evals WHERE run_id = ?1 ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![run_id], |row| {
        Ok(EvalRow {
            id: row.get(0)?,
            run_id: row.get(1)?,
            expected: row.get(2)?,
            actual: row.get(3)?,
            rubric: row.get(4)?,
            score: row.get(5)?,
            reasoning: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut evals = Vec::new();
    for r in rows {
        evals.push(r.map_err(|e| e.to_string())?);
    }

    Ok(evals)
}

pub fn get_run_average(conn: &Connection, run_id: &str) -> Result<Option<f64>, String> {
    let mut stmt = conn.prepare(
        "SELECT AVG(score) FROM evals WHERE run_id = ?1"
    ).map_err(|e| e.to_string())?;

    let mut rows = stmt.query_map(params![run_id], |row| {
        row.get::<_, Option<f64>>(0)
    }).map_err(|e| e.to_string())?;

    if let Some(r) = rows.next() {
        Ok(r.map_err(|e| e.to_string())?)
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to open in-memory db");
        conn.execute_batch(
            "CREATE TABLE evals (
                id         TEXT PRIMARY KEY,
                run_id     TEXT NOT NULL,
                expected   TEXT NOT NULL,
                actual     TEXT NOT NULL,
                rubric     TEXT NOT NULL,
                score      INTEGER NOT NULL,
                reasoning  TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX idx_evals_run_id ON evals(run_id);",
        ).expect("failed to create schema");
        conn
    }

    fn sample_row(id: &str, run_id: &str, score: i32) -> EvalRow {
        EvalRow {
            id: id.to_string(),
            run_id: run_id.to_string(),
            expected: "expected output".to_string(),
            actual: "actual output".to_string(),
            rubric: "default".to_string(),
            score,
            reasoning: "looks correct".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn test_insert_and_get_run() {
        let conn = setup_in_memory_db();
        insert_eval(&conn, &sample_row("e1", "run-1", 80)).expect("insert failed");
        insert_eval(&conn, &sample_row("e2", "run-1", 90)).expect("insert failed");

        let evals = get_run(&conn, "run-1").expect("get_run failed");
        assert_eq!(evals.len(), 2);
        assert_eq!(evals[0].score, 80);
        assert_eq!(evals[1].score, 90);
    }

    #[test]
    fn test_get_run_average() {
        let conn = setup_in_memory_db();
        insert_eval(&conn, &sample_row("e1", "run-2", 60)).unwrap();
        insert_eval(&conn, &sample_row("e2", "run-2", 80)).unwrap();

        let avg = get_run_average(&conn, "run-2").expect("avg failed");
        assert!((avg.unwrap() - 70.0).abs() < 0.001);
    }

    #[test]
    fn test_get_run_average_empty_returns_none() {
        let conn = setup_in_memory_db();
        let avg = get_run_average(&conn, "no-such-run").expect("avg failed");
        assert!(avg.is_none());
    }

    #[test]
    fn test_get_run_empty() {
        let conn = setup_in_memory_db();
        let evals = get_run(&conn, "no-such-run").expect("get_run failed");
        assert!(evals.is_empty());
    }
}

use std::fs;
use std::path::PathBuf;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRow {
    pub id: String,
    pub role: String,
    pub system_prompt: String,
    pub max_concurrent_tasks: i32,
    pub status: String, // Active, Idle, Failed, Stopped
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRow {
    pub id: String,
    pub agent_id: String,
    pub payload: String,
    pub priority: i32,
    pub status: String, // Pending, Processing, Completed, Failed
    pub result: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

fn db_path() -> PathBuf {
    // 1) Environment variable override (full path to the DB file)
    if let Ok(custom) = std::env::var("MOFA_SWARM_DB_PATH") {
        let path = PathBuf::from(custom);
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        return path;
    }
    // 2) Default to ~/.mofa/.mofa_swarm.db, with /tmp fallback
    let base_dir = if let Some(home) = std::env::var("HOME").ok().map(PathBuf::from) {
        let mut dir = home;
        dir.push(".mofa");
        dir
    } else {
        PathBuf::from("/tmp/.mofa")
    };
    let _ = fs::create_dir_all(&base_dir);
    base_dir.join(".mofa_swarm.db")
}

pub fn open_db() -> Result<Connection, String> {
    let path = db_path();
    let conn = Connection::open(&path)
        .map_err(|e| format!("Failed to open DB at {}: {}", path.display(), e))?;

    // Enable foreign key enforcement (required for ON DELETE CASCADE to work)
    conn.execute("PRAGMA foreign_keys = ON;", [])
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    // Create agents table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agents (
            id                   TEXT PRIMARY KEY,
            role                 TEXT NOT NULL,
            system_prompt        TEXT NOT NULL,
            max_concurrent_tasks INTEGER NOT NULL DEFAULT 5,
            status               TEXT NOT NULL,
            created_at           TEXT NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create agents table: {}", e))?;

    // Create tasks table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            priority INTEGER NOT NULL,
            status TEXT NOT NULL,
            result TEXT,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
        )",
        [],
    ).map_err(|e| format!("Failed to create tasks table: {}", e))?;

    Ok(conn)
}

pub fn insert_agent(conn: &Connection, agent: &AgentRow) -> Result<(), String> {
    conn.execute(
        "INSERT INTO agents (id, role, system_prompt, max_concurrent_tasks, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            agent.id,
            agent.role,
            agent.system_prompt,
            agent.max_concurrent_tasks,
            agent.status,
            agent.created_at
        ],
    ).map_err(|e| format!("Failed to insert agent: {}", e))?;
    Ok(())
}

pub fn update_agent_status(conn: &Connection, agent_id: &str, status: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE agents SET status = ?1 WHERE id = ?2",
        params![status, agent_id],
    ).map_err(|e| format!("Failed to update agent status: {}", e))?;
    Ok(())
}

pub fn get_agents(conn: &Connection, role_filter: Option<&[String]>) -> Result<Vec<AgentRow>, String> {
    let query = "SELECT id, role, system_prompt, status, created_at FROM agents".to_string();
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok(AgentRow {
            id: row.get(0)?,
            role: row.get(1)?,
            system_prompt: row.get(2)?,
            max_concurrent_tasks: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut agents = Vec::new();
    for r in rows {
        let agent = r.map_err(|e| e.to_string())?;
        if let Some(roles) = role_filter {
            if !roles.contains(&agent.role) {
                continue;
            }
        }
        agents.push(agent);
    }

    Ok(agents)
}

pub fn get_agent_by_id(conn: &Connection, agent_id: &str) -> Result<Option<AgentRow>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, role, system_prompt, max_concurrent_tasks, status, created_at FROM agents WHERE id = ?1"
    ).map_err(|e| e.to_string())?;

    let mut rows = stmt.query_map(params![agent_id], |row| {
        Ok(AgentRow {
            id: row.get(0)?,
            role: row.get(1)?,
            system_prompt: row.get(2)?,
            max_concurrent_tasks: row.get(3)?,
            status: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    if let Some(r) = rows.next() {
        Ok(Some(r.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

pub fn insert_task(conn: &Connection, task: &TaskRow) -> Result<(), String> {
    conn.execute(
        "INSERT INTO tasks (id, agent_id, payload, priority, status, result, created_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            task.id,
            task.agent_id,
            task.payload,
            task.priority,
            task.status,
            task.result,
            task.created_at,
            task.completed_at
        ],
    ).map_err(|e| format!("Failed to insert task: {}", e))?;
    Ok(())
}

#[allow(dead_code)]
pub fn update_task_status(
    conn: &Connection,
    task_id: &str,
    status: &str,
    result: Option<&str>,
    completed_at: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE tasks SET status = ?1, result = ?2, completed_at = ?3 WHERE id = ?4",
        params![status, result, completed_at, task_id],
    ).map_err(|e| format!("Failed to update task: {}", e))?;
    Ok(())
}

/// Returns tasks for an agent ordered by creation date descending.
/// `limit` is capped to 100 by callers; DB enforces the cap via SQL LIMIT.
pub fn get_tasks_for_agent(conn: &Connection, agent_id: &str, limit: usize) -> Result<Vec<TaskRow>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, agent_id, payload, priority, status, result, created_at, completed_at
         FROM tasks WHERE agent_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![agent_id, limit as i64], |row| {
        Ok(TaskRow {
            id: row.get(0)?,
            agent_id: row.get(1)?,
            payload: row.get(2)?,
            priority: row.get(3)?,
            status: row.get(4)?,
            result: row.get(5)?,
            created_at: row.get(6)?,
            completed_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for r in rows {
        tasks.push(r.map_err(|e| e.to_string())?);
    }

    Ok(tasks)
}

pub fn get_pending_task_counts(conn: &Connection) -> Result<std::collections::HashMap<String, usize>, String> {
    let mut stmt = conn.prepare(
        "SELECT agent_id, COUNT(*) as cnt FROM tasks WHERE status = 'Pending' GROUP BY agent_id"
    ).map_err(|e| e.to_string())?;

    let mut counts = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        let agent_id: String = row.get(0)?;
        let count: i64 = row.get(1)?;
        Ok((agent_id, count as usize))
    }).map_err(|e| e.to_string())?;

    for r in rows {
        let (agent_id, count) = r.map_err(|e| e.to_string())?;
        counts.insert(agent_id, count);
    }

    Ok(counts)
}

pub fn delete_agent_tasks(conn: &Connection, agent_id: &str) -> Result<usize, String> {
    let deleted = conn.execute(
        "DELETE FROM tasks WHERE agent_id = ?1",
        params![agent_id],
    ).map_err(|e| format!("Failed to delete agent tasks: {}", e))?;
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to create in-memory db");
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;
            CREATE TABLE agents (
                id                   TEXT PRIMARY KEY,
                role                 TEXT NOT NULL,
                system_prompt        TEXT NOT NULL,
                max_concurrent_tasks INTEGER NOT NULL DEFAULT 5,
                status               TEXT NOT NULL,
                created_at           TEXT NOT NULL
            );
            CREATE TABLE tasks (
                id           TEXT PRIMARY KEY,
                agent_id     TEXT NOT NULL,
                payload      TEXT NOT NULL,
                priority     INTEGER NOT NULL,
                status       TEXT NOT NULL,
                result       TEXT,
                created_at   TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY(agent_id) REFERENCES agents(id) ON DELETE CASCADE
            );
            ",
        ).expect("failed to initialize schema");
        conn
    }

    #[test]
    fn test_agent_round_trip() {
        let conn = setup_in_memory_db();
        let agent = AgentRow {
            id: "agent-1".to_string(),
            role: "worker".to_string(),
            system_prompt: "You are a helpful agent.".to_string(),
            max_concurrent_tasks: 5,
            status: "Active".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
        };
        insert_agent(&conn, &agent).expect("insert_agent failed");
        let fetched = get_agent_by_id(&conn, "agent-1")
            .expect("get_agent_by_id failed")
            .expect("agent not found");
        assert_eq!(fetched.id, "agent-1");
        assert_eq!(fetched.role, "worker");
        assert_eq!(fetched.status, "Active");
    }

    #[test]
    fn test_task_round_trip_and_update() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO agents (id, role, system_prompt, max_concurrent_tasks, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["agent-1", "worker", "prompt", 5, "Active", "2024-01-01T00:00:00Z"],
        ).unwrap();
        let task = TaskRow {
            id: "task-1".to_string(),
            agent_id: "agent-1".to_string(),
            payload: "do something".to_string(),
            priority: 5,
            status: "Pending".to_string(),
            result: None,
            created_at: "2024-01-02T00:00:00Z".to_string(),
            completed_at: None,
        };
        insert_task(&conn, &task).expect("insert_task failed");
        let tasks = get_tasks_for_agent(&conn, "agent-1", 10).expect("get_tasks_for_agent failed");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].payload, "do something");

        update_task_status(&conn, "task-1", "Completed", Some("ok"), Some("2024-01-03T00:00:00Z"))
            .expect("update_task_status failed");
        let updated = get_tasks_for_agent(&conn, "agent-1", 10).expect("after update");
        assert_eq!(updated[0].status, "Completed");
        assert_eq!(updated[0].result.as_deref(), Some("ok"));
    }

    #[test]
    fn test_cascade_delete_agent_deletes_tasks() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO agents (id, role, system_prompt, max_concurrent_tasks, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["agent-1", "worker", "prompt", 5, "Active", "2024-01-01T00:00:00Z"],
        ).unwrap();
        let t = |id: &str| TaskRow {
            id: id.to_string(),
            agent_id: "agent-1".to_string(),
            payload: "payload".to_string(),
            priority: 1,
            status: "Pending".to_string(),
            result: None,
            created_at: "2024-01-02T00:00:00Z".to_string(),
            completed_at: None,
        };
        insert_task(&conn, &t("task-1")).unwrap();
        insert_task(&conn, &t("task-2")).unwrap();
        assert_eq!(get_tasks_for_agent(&conn, "agent-1", 10).unwrap().len(), 2);

        conn.execute("DELETE FROM agents WHERE id = ?1", params!["agent-1"]).unwrap();
        assert!(get_tasks_for_agent(&conn, "agent-1", 10).unwrap().is_empty());
    }

    #[test]
    fn test_pending_task_counts() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO agents (id, role, system_prompt, max_concurrent_tasks, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params!["a1", "worker", "p", 5, "Active", "2024-01-01T00:00:00Z"],
        ).unwrap();
        let t = |id: &str, status: &str| TaskRow {
            id: id.to_string(),
            agent_id: "a1".to_string(),
            payload: "p".to_string(),
            priority: 1,
            status: status.to_string(),
            result: None,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            completed_at: None,
        };
        insert_task(&conn, &t("t1", "Pending")).unwrap();
        insert_task(&conn, &t("t2", "Completed")).unwrap();
        insert_task(&conn, &t("t3", "Pending")).unwrap();
        let counts = get_pending_task_counts(&conn).unwrap();
        assert_eq!(*counts.get("a1").unwrap(), 2);
    }
}

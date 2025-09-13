import { Pool } from 'pg';

// PostgreSQL connection pool
const pool = new Pool({
  user: 'kinetic_user',
  host: 'localhost',
  database: 'kinetic_app',
  password: 'kinetic_password_2024',
  port: 5432,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Create a database interface that matches SQLite's better-sqlite3 API
class PostgresDatabase {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Prepare method that returns a statement-like object
  prepare(sql: string) {
    return {
      // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
      all: async (...params: any[]) => {
        const client = await this.pool.connect();
        try {
          const convertedSql = this.convertSqliteToPostgres(sql);
          const result = await client.query(convertedSql, params);
          return result.rows;
        } finally {
          client.release();
        }
      },
      
      get: async (...params: any[]) => {
        const client = await this.pool.connect();
        try {
          const convertedSql = this.convertSqliteToPostgres(sql);
          const result = await client.query(convertedSql, params);
          return result.rows[0] || null;
        } finally {
          client.release();
        }
      },
      
      run: async (...params: any[]) => {
        const client = await this.pool.connect();
        try {
          const convertedSql = this.convertSqliteToPostgres(sql);
          const result = await client.query(convertedSql, params);
          return { changes: result.rowCount || 0 };
        } finally {
          client.release();
        }
      }
    };
  }

  // Convert SQLite SQL to PostgreSQL
  private convertSqliteToPostgres(sql: string): string {
    // Replace ? placeholders with $1, $2, etc.
    let paramIndex = 1;
    return sql.replace(/\?/g, () => `$${paramIndex++}`);
  }

  // Direct query method
  async query(sql: string, params: any[] = []) {
    const client = await this.pool.connect();
    try {
      const convertedSql = this.convertSqliteToPostgres(sql);
      const result = await client.query(convertedSql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Exec method for DDL statements
  async exec(sql: string) {
    const client = await this.pool.connect();
    try {
      await client.query(sql);
    } finally {
      client.release();
    }
  }

  // Pragma method (no-op for PostgreSQL)
  pragma(setting: string) {
    // PostgreSQL doesn't have pragmas, so we'll just log them
    console.log(`PostgreSQL pragma (ignored): ${setting}`);
  }

  // Transaction method for PostgreSQL
  async transaction(callback: () => Promise<{ insertedCount: number; updatedCount: number }>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Create database instance
const db = new PostgresDatabase(pool);

export default db;
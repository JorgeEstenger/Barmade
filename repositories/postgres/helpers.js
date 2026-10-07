/**
 * Small helpers shared by the PostgreSQL repositories.
 * Each table keeps the full record in a `data` jsonb column, plus a few plain
 * columns used for filtering and sorting.
 */

/** Builds "WHERE a = $1 AND b >= $2 ..." from [column, operator, value] parts, skipping undefined values. */
function where(parts, params = []) {
  const clauses = [];
  for (const [column, op, value] of parts) {
    if (value === undefined || value === null || value === '') continue;
    params.push(value);
    clauses.push(`${column} ${op} $${params.length}`);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

const dataOf = (result) => result.rows.map((r) => r.data);

module.exports = { where, dataOf };

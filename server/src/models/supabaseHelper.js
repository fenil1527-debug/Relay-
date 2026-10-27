import getSupabase from '../config/supabase.js';

// Field mapping between JS camelCase and Postgres snake_case
const COLUMN_MAP = {
  id: 'id',
  _id: 'id',
  userId: 'user_id',
  sessionId: 'session_id',
  turnId: 'turn_id',
  githubId: 'github_id',
  avatarUrl: 'avatar_url',
  activeProvider: 'active_provider',
  fallbackChain: 'fallback_chain',
  tokenCap: 'token_cap',
  stepCount: 'step_count',
  startedAt: 'started_at',
  endedAt: 'ended_at',
  isSummary: 'is_summary',
  sourceSeq: 'source_seq',
  supersededBy: 'superseded_by',
  errorClass: 'error_class',
  latencyMs: 'latency_ms',
  tokensIn: 'tokens_in',
  tokensOut: 'tokens_out',
  fromProvider: 'from_provider',
  toProvider: 'to_provider',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

const REVERSE_MAP = {
  id: 'id',
  user_id: 'userId',
  session_id: 'sessionId',
  turn_id: 'turnId',
  github_id: 'githubId',
  avatar_url: 'avatarUrl',
  active_provider: 'activeProvider',
  fallback_chain: 'fallbackChain',
  token_cap: 'tokenCap',
  step_count: 'stepCount',
  started_at: 'startedAt',
  ended_at: 'endedAt',
  is_summary: 'isSummary',
  source_seq: 'sourceSeq',
  superseded_by: 'supersededBy',
  error_class: 'errorClass',
  latency_ms: 'latencyMs',
  tokens_in: 'tokensIn',
  tokens_out: 'tokensOut',
  from_provider: 'fromProvider',
  to_provider: 'toProvider',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
};

export function toDbColumn(field) {
  return COLUMN_MAP[field] || field;
}

export function toJsProperty(column) {
  return REVERSE_MAP[column] || column;
}

/**
 * Convert a JS document to DB record (snake_case columns).
 */
export function toDbRecord(doc) {
  if (!doc) return {};
  const record = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id') {
      if (value !== undefined) record.id = value;
      continue;
    }
    const dbCol = toDbColumn(key);
    record[dbCol] = value;
  }
  return record;
}

/**
 * Convert DB row to JS document (camelCase properties + _id alias).
 */
export function toJsDoc(row, ModelClass = null) {
  if (!row) return null;
  const doc = {};
  for (const [key, value] of Object.entries(row)) {
    const jsProp = toJsProperty(key);
    doc[jsProp] = value;
  }
  // Ensure both _id and id are accessible for frontend & backend compatibility
  if (row.id) {
    doc._id = row.id;
    doc.id = row.id;
  }

  if (ModelClass) {
    return new ModelClass(doc);
  }
  return doc;
}

/**
 * Query builder supporting Mongoose-like chaining (.sort, .limit, .select, .lean)
 */
export class SupabaseQuery {
  constructor(tableName, filters = {}, ModelClass = null, single = false) {
    this.tableName = tableName;
    this.filters = filters;
    this.ModelClass = ModelClass;
    this.single = single;
    this._sortField = null;
    this._ascending = true;
    this._limit = null;
    this._select = '*';
  }

  sort(sortObj) {
    if (sortObj && typeof sortObj === 'object') {
      const [key, dir] = Object.entries(sortObj)[0] || [];
      if (key) {
        this._sortField = toDbColumn(key);
        this._ascending = dir === 1 || dir === 'asc' || dir === 'ascending';
      }
    }
    return this;
  }

  limit(count) {
    this._limit = count;
    return this;
  }

  select(fields) {
    if (typeof fields === 'string') {
      const parts = fields.trim().split(/\s+/);
      const positiveParts = parts.filter(p => !p.startsWith('-'));
      if (positiveParts.length > 0) {
        const cols = new Set(['id']);
        for (const p of positiveParts) {
          cols.add(toDbColumn(p));
        }
        this._select = Array.from(cols).join(', ');
      } else {
        // Only negative/exclusion projections were specified, select all columns
        this._select = '*';
      }
    }
    return this;
  }

  lean() {
    this._isLean = true;
    return this;
  }

  async execute() {
    const supabase = getSupabase();
    let query = supabase.from(this.tableName).select(this._select);

    // Apply filters
    for (const [key, val] of Object.entries(this.filters)) {
      if (val === undefined) continue;
      const col = toDbColumn(key);

      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if ('$in' in val && Array.isArray(val.$in)) {
          query = query.in(col, val.$in);
        } else if ('$gt' in val) {
          query = query.gt(col, val.$gt);
        } else if ('$lt' in val) {
          query = query.lt(col, val.$lt);
        } else if ('$gte' in val) {
          query = query.gte(col, val.$gte);
        } else if ('$lte' in val) {
          query = query.lte(col, val.$lte);
        } else if ('$ne' in val) {
          query = query.neq(col, val.$ne);
        }
      } else {
        query = query.eq(col, val);
      }
    }

    if (this._sortField) {
      query = query.order(this._sortField, { ascending: this._ascending });
    }

    if (this._limit) {
      query = query.limit(this._limit);
    }

    if (this.single) {
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return toJsDoc(data, this._isLean ? null : this.ModelClass);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => toJsDoc(row, this._isLean ? null : this.ModelClass));
  }

  // Make SupabaseQuery thenable so `await Model.find(...)` works directly
  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }
}

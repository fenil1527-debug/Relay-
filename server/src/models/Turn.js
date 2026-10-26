import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc } from './supabaseHelper.js';

export class TurnQuery extends SupabaseQuery {
  async distinct(field) {
    const list = await this.execute();
    const prop = field === '_id' ? 'id' : field;
    return Array.from(new Set(list.map(item => item[prop] || item._id)));
  }
}

export class Turn {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new TurnQuery('turns', filters, Turn, false);
  }

  static findOne(filters) {
    return new TurnQuery('turns', filters, Turn, true);
  }

  static findById(id) {
    return new TurnQuery('turns', { id }, Turn, true);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord({
      status: 'running',
      stepCount: 0,
      startedAt: new Date().toISOString(),
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('turns')
      .insert(record)
      .select()
      .single();

    if (error) {
      // Translate Postgres unique constraint violation to MongoDB code 11000
      if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('idx_turns_single_running')) {
        const customErr = new Error('A turn is already running on this session');
        customErr.code = 11000;
        throw customErr;
      }
      throw error;
    }

    return new Turn(toJsDoc(data));
  }

  static async findByIdAndUpdate(id, updates) {
    const supabase = getSupabase();
    const record = toDbRecord(updates);
    delete record.id;

    const { data, error } = await supabase
      .from('turns')
      .update(record)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return toJsDoc(data);
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('turns').delete();

    for (const [key, val] of Object.entries(filters)) {
      if (key === 'sessionId' || key === 'session_id') {
        query = query.eq('session_id', val);
      } else if (key === '_id' || key === 'id') {
        query = query.eq('id', val);
      } else {
        query = query.eq(key, val);
      }
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default Turn;

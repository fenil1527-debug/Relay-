import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc, toDbColumn } from './supabaseHelper.js';

export class ProviderAttempt {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new SupabaseQuery('provider_attempts', filters, ProviderAttempt, false);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord({
      latencyMs: 0,
      tokensIn: 0,
      tokensOut: 0,
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('provider_attempts')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new ProviderAttempt(toJsDoc(data));
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('provider_attempts').delete();

    for (const [key, val] of Object.entries(filters)) {
      const col = toDbColumn(key);
      if (val && typeof val === 'object' && '$in' in val) {
        query = query.in(col, val.$in);
      } else {
        query = query.eq(col, val);
      }
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default ProviderAttempt;

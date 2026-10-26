import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc, toDbColumn } from './supabaseHelper.js';

export class Handoff {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new SupabaseQuery('handoffs', filters, Handoff, false);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord({
      packet: {},
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('handoffs')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new Handoff(toJsDoc(data));
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('handoffs').delete();

    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default Handoff;

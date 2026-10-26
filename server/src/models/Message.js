import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc, toDbColumn } from './supabaseHelper.js';

export class Message {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new SupabaseQuery('messages', filters, Message, false);
  }

  static findOne(filters) {
    return new SupabaseQuery('messages', filters, Message, true);
  }

  static async countDocuments(filters = {}) {
    const supabase = getSupabase();
    let query = supabase.from('messages').select('*', { count: 'exact', head: true });
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }

  static async create(doc) {
    const supabase = getSupabase();
    if (Array.isArray(doc)) {
      const records = doc.map(d => {
        const r = toDbRecord({
          blocks: [],
          usage: { inputTokens: 0, outputTokens: 0 },
          isSummary: false,
          ...d,
        });
        delete r.id;
        return r;
      });
      const { data, error } = await supabase.from('messages').insert(records).select();
      if (error) throw error;
      return (data || []).map(row => new Message(toJsDoc(row)));
    }

    const record = toDbRecord({
      blocks: [],
      usage: { inputTokens: 0, outputTokens: 0 },
      isSummary: false,
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('messages')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new Message(toJsDoc(data));
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('messages').delete();

    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default Message;

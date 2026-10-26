import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc } from './supabaseHelper.js';

export class Session {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  async save() {
    const supabase = getSupabase();
    const record = toDbRecord(this);
    delete record.id;
    record.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('sessions')
      .update(record)
      .eq('id', this.id || this._id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, toJsDoc(data));
    return this;
  }

  static find(filters) {
    return new SupabaseQuery('sessions', filters, Session, false);
  }

  static findOne(filters) {
    return new SupabaseQuery('sessions', filters, Session, true);
  }

  static findById(id) {
    return new SupabaseQuery('sessions', { id }, Session, true);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord({
      title: 'New Session',
      fallbackChain: ['anthropic:claude-3-5-sonnet-20241022', 'openai:gpt-4o'],
      activeProvider: doc.activeProvider || doc.fallbackChain?.[0] || 'anthropic:claude-3-5-sonnet-20241022',
      tokenCap: 100000,
      status: 'active',
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('sessions')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new Session(toJsDoc(data));
  }

  static async findByIdAndUpdate(id, updates) {
    const supabase = getSupabase();
    const record = toDbRecord(updates);
    delete record.id;
    record.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('sessions')
      .update(record)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return toJsDoc(data);
  }

  static async findByIdAndDelete(id) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return toJsDoc(data);
  }

  static async deleteOne(filters) {
    const supabase = getSupabase();
    let query = supabase.from('sessions').delete();
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key === '_id' ? 'id' : key, val);
    }
    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default Session;

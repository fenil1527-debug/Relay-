import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc, toDbColumn } from './supabaseHelper.js';

export class LedgerEntry {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new SupabaseQuery('ledger_entries', filters, LedgerEntry, false);
  }

  static findOne(filters) {
    return new SupabaseQuery('ledger_entries', filters, LedgerEntry, true);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord({
      status: 'active',
      sourceSeq: 0,
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('ledger_entries')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new LedgerEntry(toJsDoc(data));
  }

  static async findByIdAndUpdate(id, updates) {
    const supabase = getSupabase();
    const record = toDbRecord(updates);
    delete record.id;
    record.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ledger_entries')
      .update(record)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return toJsDoc(data);
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('ledger_entries').delete();

    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default LedgerEntry;

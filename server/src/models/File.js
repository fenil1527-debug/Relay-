import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc, toDbColumn } from './supabaseHelper.js';

export class File {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  static find(filters) {
    return new SupabaseQuery('files', filters, File, false);
  }

  static findOne(filters) {
    return new SupabaseQuery('files', filters, File, true);
  }

  static async create(doc) {
    const supabase = getSupabase();
    if (Array.isArray(doc)) {
      const records = doc.map(d => {
        const r = toDbRecord({ content: '', version: 1, ...d });
        delete r.id;
        return r;
      });
      const { data, error } = await supabase.from('files').insert(records).select();
      if (error) throw error;
      return (data || []).map(row => new File(toJsDoc(row)));
    }

    const record = toDbRecord({
      content: '',
      version: 1,
      ...doc,
    });
    delete record.id;

    const { data, error } = await supabase
      .from('files')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new File(toJsDoc(data));
  }

  static async countDocuments(filters = {}) {
    const supabase = getSupabase();
    let query = supabase.from('files').select('*', { count: 'exact', head: true });
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
  }

  static async findOneAndUpdate(filters, updates, options = {}) {
    const supabase = getSupabase();
    const existing = await File.findOne(filters);

    if (existing) {
      const record = toDbRecord(updates);
      delete record.id;
      record.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('files')
        .update(record)
        .eq('id', existing.id || existing._id)
        .select()
        .single();

      if (error) throw error;
      return toJsDoc(data, File);
    }

    if (options.upsert) {
      const record = toDbRecord({
        ...filters,
        ...updates,
      });
      delete record.id;

      const { data, error } = await supabase
        .from('files')
        .insert(record)
        .select()
        .single();

      if (error) throw error;
      return toJsDoc(data, File);
    }

    return null;
  }

  static async findOneAndDelete(filters) {
    const supabase = getSupabase();
    const existing = await File.findOne(filters);
    if (!existing) return null;

    const { error } = await supabase
      .from('files')
      .delete()
      .eq('id', existing.id || existing._id);

    if (error) throw error;
    return existing;
  }

  static async deleteMany(filters) {
    const supabase = getSupabase();
    let query = supabase.from('files').delete();

    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(toDbColumn(key), val);
    }

    const { error } = await query;
    if (error) throw error;
    return { acknowledged: true };
  }
}

export default File;

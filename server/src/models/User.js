import getSupabase from '../config/supabase.js';
import { SupabaseQuery, toDbRecord, toJsDoc } from './supabaseHelper.js';

export class User {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  async save() {
    const supabase = getSupabase();
    const record = toDbRecord(this);
    delete record.id;
    record.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(record)
      .eq('id', this.id || this._id)
      .select()
      .single();

    if (error) throw error;
    Object.assign(this, toJsDoc(data));
    return this;
  }

  static findOne(filters) {
    return new SupabaseQuery('users', filters, User, true);
  }

  static findById(id) {
    return new SupabaseQuery('users', { id }, User, true);
  }

  static async create(doc) {
    const supabase = getSupabase();
    const record = toDbRecord(doc);
    delete record.id;

    const { data, error } = await supabase
      .from('users')
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return new User(toJsDoc(data));
  }
}

export default User;

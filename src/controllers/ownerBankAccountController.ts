import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * Log owner activity into activity_logs table
 */
const logOwnerActivity = async (
  userId: string,
  action: string,
  resourceId: string,
  description: string,
  details: any,
  req: Request
) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || '';
    const userAgent = req.headers['user-agent'] || '';

    await supabaseAdmin.from('activity_logs').insert({
      user_id: userId,
      action: action.toUpperCase(),
      module: 'finance',
      entity_type: 'bank_account',
      entity_id: resourceId,
      description,
      metadata: details,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to write owner activity log:', err);
  }
};

/**
 * GET /api/owner/bank-accounts
 * Fetch all bank accounts for owner management (active & inactive)
 */
export const getOwnerBankAccounts = async (_req: Request, res: Response) => {
  try {
    const { data: accounts, error } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bank accounts:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data rekening bank: ' + error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: accounts || [],
    });
  } catch (error: any) {
    console.error('Get owner bank accounts error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
    });
  }
};

/**
 * POST /api/owner/bank-accounts
 * Create a new bank account
 */
export const createOwnerBankAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { bank_name, account_number, account_name, bank_code, logo_url, is_active } = req.body;

    if (!bank_name || !bank_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama bank wajib diisi',
      });
    }

    if (!account_number || !account_number.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nomor rekening wajib diisi',
      });
    }

    if (!account_name || !account_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama pemilik rekening (atas nama) wajib diisi',
      });
    }

    const newAccountData = {
      bank_name: bank_name.trim(),
      account_number: account_number.trim(),
      account_name: account_name.trim(),
      bank_code: bank_code?.trim() || null,
      logo_url: logo_url?.trim() || null,
      is_active: is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await supabaseAdmin
      .from('bank_accounts')
      .insert(newAccountData)
      .select()
      .single();

    if (error) {
      console.error('Error creating bank account:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menambahkan rekening bank: ' + error.message,
      });
    }

    await logOwnerActivity(
      userId,
      'CREATE_BANK_ACCOUNT',
      created.id,
      `Menambahkan rekening bank ${created.bank_name} - ${created.account_number} (${created.account_name})`,
      created,
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Rekening bank berhasil ditambahkan',
      data: created,
    });
  } catch (error: any) {
    console.error('Create bank account error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
    });
  }
};

/**
 * PUT /api/owner/bank-accounts/:id
 * Update an existing bank account
 */
export const updateOwnerBankAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { bank_name, account_number, account_name, bank_code, logo_url, is_active } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID rekening bank wajib disertakan',
      });
    }

    // Verify account exists
    const { data: existing, error: findError } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({
        success: false,
        message: 'Rekening bank tidak ditemukan',
      });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (bank_name !== undefined) updates.bank_name = bank_name.trim();
    if (account_number !== undefined) updates.account_number = account_number.trim();
    if (account_name !== undefined) updates.account_name = account_name.trim();
    if (bank_code !== undefined) updates.bank_code = bank_code ? bank_code.trim() : null;
    if (logo_url !== undefined) updates.logo_url = logo_url ? logo_url.trim() : null;
    if (is_active !== undefined) updates.is_active = Boolean(is_active);

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bank_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating bank account:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui rekening bank: ' + updateError.message,
      });
    }

    await logOwnerActivity(
      userId,
      'UPDATE_BANK_ACCOUNT',
      id,
      `Memperbarui data rekening bank ${updated.bank_name} - ${updated.account_number}`,
      { before: existing, after: updated },
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Rekening bank berhasil diperbarui',
      data: updated,
    });
  } catch (error: any) {
    console.error('Update bank account error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
    });
  }
};

/**
 * PATCH /api/owner/bank-accounts/:id/toggle
 * Toggle active status of a bank account
 */
export const toggleOwnerBankAccountStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { is_active } = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID rekening bank wajib disertakan',
      });
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({
        success: false,
        message: 'Rekening bank tidak ditemukan',
      });
    }

    const newStatus = is_active !== undefined ? Boolean(is_active) : !existing.is_active;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bank_accounts')
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error toggling bank account status:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengubah status rekening bank: ' + updateError.message,
      });
    }

    await logOwnerActivity(
      userId,
      'TOGGLE_BANK_ACCOUNT_STATUS',
      id,
      `Mengubah status rekening bank ${updated.bank_name} (${updated.account_number}) menjadi ${newStatus ? 'Aktif' : 'Nonaktif'}`,
      { previous_status: existing.is_active, new_status: newStatus },
      req
    );

    return res.status(200).json({
      success: true,
      message: `Rekening bank berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('Toggle bank account status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
    });
  }
};

/**
 * DELETE /api/owner/bank-accounts/:id
 * Delete a bank account
 */
export const deleteOwnerBankAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID rekening bank wajib disertakan',
      });
    }

    const { data: existing, error: findError } = await supabaseAdmin
      .from('bank_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({
        success: false,
        message: 'Rekening bank tidak ditemukan',
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('bank_accounts')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting bank account:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Gagal menghapus rekening bank: ' + deleteError.message,
      });
    }

    await logOwnerActivity(
      userId,
      'DELETE_BANK_ACCOUNT',
      id,
      `Menghapus rekening bank ${existing.bank_name} - ${existing.account_number} (${existing.account_name})`,
      existing,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Rekening bank berhasil dihapus',
    });
  } catch (error: any) {
    console.error('Delete bank account error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server',
    });
  }
};

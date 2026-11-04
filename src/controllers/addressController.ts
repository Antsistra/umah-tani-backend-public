import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';

/**
 * Get user's addresses
 * GET /api/addresses
 */
export const getUserAddresses = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    
    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Get addresses error:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
};

/**
 * Create new address
 * POST /api/addresses
 */
export const createAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { 
      label, 
      recipient_name, 
      phone, 
      address_line1, 
      address_line2, 
      city, 
      province, 
      postal_code, 
      subdistrict,
      village,
      biteship_area_id,
      biteship_location_id,
      country_code,
      is_default,
      latitude,
      longitude
    } = req.body;
    
    // Validate required fields
    if (!recipient_name || !phone || !address_line1 || !city || !province || !postal_code || !subdistrict) {
      return res.status(400).json({ 
        error: 'recipient_name, phone, address_line1, city, province, subdistrict, and postal_code are required' 
      });
    }
    
    // If setting as default, unset other defaults first
    if (is_default) {
      await supabaseAdmin
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .insert({
        user_id: userId,
        label,
        recipient_name,
        phone,
        address_line1,
        address_line2,
        city,
        province,
        postal_code,
        subdistrict,
        village,
        biteship_area_id,
        biteship_location_id,
        country_code: country_code || 'ID',
        is_default: is_default || false,
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
};

/**
 * Update address
 * PUT /api/addresses/:id
 */
export const updateAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const updates = req.body || {};

    const allowedFields = [
      'label',
      'recipient_name',
      'phone',
      'address_line1',
      'address_line2',
      'city',
      'province',
      'postal_code',
      'subdistrict',
      'village',
      'biteship_area_id',
      'biteship_location_id',
      'country_code',
      'is_default',
      'latitude',
      'longitude'
    ];

    const safeUpdates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }
    
    // If setting as default, unset other defaults first
    if (safeUpdates.is_default) {
      await supabaseAdmin
        .from('user_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('id', id);
    }
    
    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId) // security: only update own address
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
};

/**
 * Delete address
 * DELETE /api/addresses/:id
 */
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    
    const { error } = await supabaseAdmin
      .from('user_addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // security: only delete own address
    
    if (error) throw error;
    
    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error: any) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
};

/**
 * Set address as default
 * PUT /api/addresses/:id/set-default
 */
export const setDefaultAddress = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    
    // Unset all defaults
    await supabaseAdmin
      .from('user_addresses')
      .update({ is_default: false })
      .eq('user_id', userId);
    
    // Set this address as default
    const { data, error } = await supabaseAdmin
      .from('user_addresses')
      .update({ 
        is_default: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({ error: 'Address not found' });
    }
    
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
};

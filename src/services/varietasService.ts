// src/services/varietasService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

export interface Varietas {
  id?: string;
  tanaman_id: string;
  nama: string;
  deskripsi?: string;
}

/**
 * Get all varietas, optionally filtered by tanaman_id
 */
export const getAllVarietasService = async (tanaman_id?: string) => {
  try {
    let query = supabaseAdmin
      .from("varietas")
      .select(`
        *,
        tanaman:tanaman(id, nama)
      `)
      .order("nama");

    if (tanaman_id) {
      query = query.eq("tanaman_id", tanaman_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Gagal mengambil data varietas: ${error.message}`, 500);
  }
};

/**
 * Get varietas by ID
 */
export const getVarietasByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("varietas")
      .select(`
        *,
        tanaman:tanaman(id, nama)
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Varietas tidak ditemukan", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengambil data varietas: ${error.message}`, 500);
  }
};

/**
 * Create varietas
 */
export const createVarietasService = async (varietasData: Varietas) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("varietas")
      .insert([varietasData])
      .select(`
        *,
        tanaman:tanaman(id, nama)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Varietas dengan nama tersebut sudah ada untuk tanaman ini", 409);
      }
      if (error.code === "23503") {
        throw new AppError("Tanaman yang direferensikan tidak ditemukan", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal membuat varietas: ${error.message}`, 500);
  }
};

/**
 * Update varietas
 */
export const updateVarietasService = async (id: string, varietasData: Partial<Varietas>) => {
  try {
    await getVarietasByIdService(id);

    const { data, error } = await supabaseAdmin
      .from("varietas")
      .update(varietasData)
      .eq("id", id)
      .select(`
        *,
        tanaman:tanaman(id, nama)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Varietas dengan nama tersebut sudah ada untuk tanaman ini", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengupdate varietas: ${error.message}`, 500);
  }
};

/**
 * Delete varietas
 */
export const deleteVarietasService = async (id: string) => {
  try {
    const existingVarietas = await getVarietasByIdService(id);

    const { error } = await supabaseAdmin
      .from("varietas")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return {
      message: "Varietas berhasil dihapus",
      data: existingVarietas,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menghapus varietas: ${error.message}`, 500);
  }
};

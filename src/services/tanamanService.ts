// src/services/tanamanService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

export interface Tanaman {
  id?: string;
  nama: string;
  deskripsi?: string;
}

/**
 * Get all tanaman
 */
export const getAllTanamanService = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tanaman")
      .select("*")
      .order("nama");

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Gagal mengambil data tanaman: ${error.message}`, 500);
  }
};

/**
 * Get tanaman by ID
 */
export const getTanamanByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tanaman")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Tanaman tidak ditemukan", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengambil data tanaman: ${error.message}`, 500);
  }
};

/**
 * Create tanaman
 */
export const createTanamanService = async (tanamanData: Tanaman) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("tanaman")
      .insert([tanamanData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Tanaman dengan nama tersebut sudah ada", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal membuat tanaman: ${error.message}`, 500);
  }
};

/**
 * Update tanaman
 */
export const updateTanamanService = async (id: string, tanamanData: Partial<Tanaman>) => {
  try {
    // Check exists
    await getTanamanByIdService(id);

    const { data, error } = await supabaseAdmin
      .from("tanaman")
      .update(tanamanData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Tanaman dengan nama tersebut sudah ada", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengupdate tanaman: ${error.message}`, 500);
  }
};

/**
 * Delete tanaman
 */
export const deleteTanamanService = async (id: string) => {
  try {
    const existingTanaman = await getTanamanByIdService(id);

    const { error } = await supabaseAdmin
      .from("tanaman")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return {
      message: "Tanaman berhasil dihapus",
      data: existingTanaman,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menghapus tanaman: ${error.message}`, 500);
  }
};

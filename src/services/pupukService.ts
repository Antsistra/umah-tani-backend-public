// src/services/pupukService.ts
import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

export interface Pupuk {
  id?: string;
  nama: string;
  satuan?: string;
  deskripsi?: string;
}

/**
 * Get all pupuk
 */
export const getAllPupukService = async () => {
  try {
    const { data, error } = await supabaseAdmin
      .from("pupuk")
      .select("*")
      .order("nama");

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Gagal mengambil data pupuk: ${error.message}`, 500);
  }
};

/**
 * Get pupuk by ID
 */
export const getPupukByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("pupuk")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Pupuk tidak ditemukan", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengambil data pupuk: ${error.message}`, 500);
  }
};

/**
 * Create pupuk
 */
export const createPupukService = async (pupukData: Pupuk) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("pupuk")
      .insert([pupukData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Pupuk dengan nama tersebut sudah ada", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal membuat pupuk: ${error.message}`, 500);
  }
};

/**
 * Update pupuk
 */
export const updatePupukService = async (id: string, pupukData: Partial<Pupuk>) => {
  try {
    await getPupukByIdService(id);

    const { data, error } = await supabaseAdmin
      .from("pupuk")
      .update(pupukData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Pupuk dengan nama tersebut sudah ada", 409);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengupdate pupuk: ${error.message}`, 500);
  }
};

/**
 * Delete pupuk
 */
export const deletePupukService = async (id: string) => {
  try {
    const existingPupuk = await getPupukByIdService(id);

    const { error } = await supabaseAdmin
      .from("pupuk")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return {
      message: "Pupuk berhasil dihapus",
      data: existingPupuk,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menghapus pupuk: ${error.message}`, 500);
  }
};

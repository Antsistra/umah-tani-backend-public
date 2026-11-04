import { supabaseAdmin } from "../config/supabase";
import { AppError } from "../utils/appError";

export interface DetailRekomendasiInput {
  pupuk_id: string;
  dosis_per_ha: number;
  keterangan?: string;
  frekuensi_aplikasi?: string;
  cara_penggunaan?: string;
}

export interface AturanRekomendasiInput {
  tanaman_id: string;
  varietas_id?: string | null;
  hst_min: number;
  hst_max: number;
  label_opsi: "ekonomis" | "standar" | "lengkap";
  jarak_tanam_lebar?: number | null;
  jarak_tanam_panjang?: number | null;
  detail: DetailRekomendasiInput[];
}


export const getAllAturanService = async (filters: {
  tanaman_id?: string;
  varietas_id?: string;
  label_opsi?: string;
} = {}) => {
  try {
    let query = supabaseAdmin
      .from("aturan_rekomendasi")
      .select(`
        *,
        tanaman:tanaman(id, nama),
        varietas:varietas(id, nama),
        detail_rekomendasi(
          id,
          dosis_per_ha,
          keterangan,
          frekuensi_aplikasi,
          cara_penggunaan,
          pupuk:pupuk(id, nama, satuan)
        )
      `)
      .order("created_at", { ascending: false });

    if (filters.tanaman_id) {
      query = query.eq("tanaman_id", filters.tanaman_id);
    }
    if (filters.varietas_id) {
      query = query.eq("varietas_id", filters.varietas_id);
    }
    if (filters.label_opsi) {
      query = query.eq("label_opsi", filters.label_opsi);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    throw new AppError(`Gagal mengambil data aturan: ${error.message}`, 500);
  }
};

/**
 * Get aturan by ID with detail
 */
export const getAturanByIdService = async (id: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("aturan_rekomendasi")
      .select(`
        *,
        tanaman:tanaman(id, nama),
        varietas:varietas(id, nama),
        detail_rekomendasi(
          id,
          dosis_per_ha,
          keterangan,
          frekuensi_aplikasi,
          cara_penggunaan,
          pupuk:pupuk(id, nama, satuan)
        )
      `)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        throw new AppError("Aturan rekomendasi tidak ditemukan", 404);
      }
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengambil data aturan: ${error.message}`, 500);
  }
};

/**
 * Create aturan + detail rekomendasi (transactional)
 */
export const createAturanService = async (
  input: AturanRekomendasiInput,
  createdBy?: string
) => {
  try {
    // 1. Insert aturan_rekomendasi
    const { data: aturan, error: aturanError } = await supabaseAdmin
      .from("aturan_rekomendasi")
      .insert([{
        tanaman_id: input.tanaman_id,
        varietas_id: input.varietas_id || null,
        hst_min: input.hst_min,
        hst_max: input.hst_max,
        label_opsi: input.label_opsi,
        jarak_tanam_lebar: input.jarak_tanam_lebar || null,
        jarak_tanam_panjang: input.jarak_tanam_panjang || null,
        created_by: createdBy || null,
      }])
      .select()
      .single();

    if (aturanError) {
      if (aturanError.code === "23503") {
        throw new AppError("Tanaman atau varietas yang direferensikan tidak ditemukan", 404);
      }
      throw aturanError;
    }

    // 2. Insert detail_rekomendasi (bulk)
    if (input.detail && input.detail.length > 0) {
      const detailRows = input.detail.map((d) => ({
        aturan_id: aturan.id,
        pupuk_id: d.pupuk_id,
        dosis_per_ha: d.dosis_per_ha,
        keterangan: d.keterangan || null,
        frekuensi_aplikasi: d.frekuensi_aplikasi || null,
        cara_penggunaan: d.cara_penggunaan || null,
      }));

      const { error: detailError } = await supabaseAdmin
        .from("detail_rekomendasi")
        .insert(detailRows);

      if (detailError) {
        // Rollback: delete the aturan we just created
        await supabaseAdmin
          .from("aturan_rekomendasi")
          .delete()
          .eq("id", aturan.id);

        if (detailError.code === "23503") {
          throw new AppError("Pupuk yang direferensikan tidak ditemukan", 404);
        }
        if (detailError.code === "23505") {
          throw new AppError("Pupuk duplikat dalam satu aturan tidak diperbolehkan", 409);
        }
        throw detailError;
      }
    }

    // 3. Return full data with relations
    return await getAturanByIdService(aturan.id);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal membuat aturan rekomendasi: ${error.message}`, 500);
  }
};

/**
 * Update aturan + replace detail rekomendasi
 */
export const updateAturanService = async (
  id: string,
  input: AturanRekomendasiInput
) => {
  try {
    // Check exists
    await getAturanByIdService(id);

    // 1. Update aturan_rekomendasi
    const { error: aturanError } = await supabaseAdmin
      .from("aturan_rekomendasi")
      .update({
        tanaman_id: input.tanaman_id,
        varietas_id: input.varietas_id || null,
        hst_min: input.hst_min,
        hst_max: input.hst_max,
        label_opsi: input.label_opsi,
        jarak_tanam_lebar: input.jarak_tanam_lebar || null,
        jarak_tanam_panjang: input.jarak_tanam_panjang || null,
      })
      .eq("id", id);

    if (aturanError) {
      if (aturanError.code === "23503") {
        throw new AppError("Tanaman atau varietas yang direferensikan tidak ditemukan", 404);
      }
      throw aturanError;
    }

    // 2. Delete old detail_rekomendasi
    const { error: deleteError } = await supabaseAdmin
      .from("detail_rekomendasi")
      .delete()
      .eq("aturan_id", id);

    if (deleteError) throw deleteError;

    // 3. Insert new detail_rekomendasi
    if (input.detail && input.detail.length > 0) {
      const detailRows = input.detail.map((d) => ({
        aturan_id: id,
        pupuk_id: d.pupuk_id,
        dosis_per_ha: d.dosis_per_ha,
        keterangan: d.keterangan || null,
        frekuensi_aplikasi: d.frekuensi_aplikasi || null,
        cara_penggunaan: d.cara_penggunaan || null,
      }));

      const { error: insertError } = await supabaseAdmin
        .from("detail_rekomendasi")
        .insert(detailRows);

      if (insertError) {
        if (insertError.code === "23503") {
          throw new AppError("Pupuk yang direferensikan tidak ditemukan", 404);
        }
        if (insertError.code === "23505") {
          throw new AppError("Pupuk duplikat dalam satu aturan tidak diperbolehkan", 409);
        }
        throw insertError;
      }
    }

    // 4. Return updated data
    return await getAturanByIdService(id);
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal mengupdate aturan rekomendasi: ${error.message}`, 500);
  }
};

/**
 * Delete aturan (cascade deletes detail_rekomendasi)
 */
export const deleteAturanService = async (id: string) => {
  try {
    const existingAturan = await getAturanByIdService(id);

    const { error } = await supabaseAdmin
      .from("aturan_rekomendasi")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return {
      message: "Aturan rekomendasi berhasil dihapus",
      data: existingAturan,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menghapus aturan rekomendasi: ${error.message}`, 500);
  }
};



export interface SimulasiInput {
  tanaman_id: string;
  varietas_id?: string | null;
  umur_tanaman: number;
  luas_lahan: number;
}


export const simulasiRekomendasiService = async (input: SimulasiInput) => {
  try {
    const { data: tanaman, error: tanamanError } = await supabaseAdmin
      .from("tanaman")
      .select("id, nama")
      .eq("id", input.tanaman_id)
      .single();

    if (tanamanError || !tanaman) {
      throw new AppError("Tanaman tidak ditemukan", 404);
    }

    let varietas = null;
    if (input.varietas_id) {
      const { data: v, error: vError } = await supabaseAdmin
        .from("varietas")
        .select("id, nama")
        .eq("id", input.varietas_id)
        .single();

      if (vError || !v) {
        throw new AppError("Varietas tidak ditemukan", 404);
      }
      varietas = v;
    }

    // STEP 3: Forward Chaining — fetch all matching rules
    // Condition: tanaman_id matches AND (varietas_id matches OR varietas_id IS NULL) AND umur in HST range
    let query = supabaseAdmin
      .from("aturan_rekomendasi")
      .select(`
        *,
        tanaman:tanaman(id, nama),
        varietas:varietas(id, nama),
        detail_rekomendasi(
          id,
          dosis_per_ha,
          keterangan,
          frekuensi_aplikasi,
          cara_penggunaan,
          pupuk:pupuk(id, nama, satuan)
        )
      `)
      .eq("tanaman_id", input.tanaman_id)
      .lte("hst_min", input.umur_tanaman)
      .gte("hst_max", input.umur_tanaman);

    const { data: allMatchedRules, error: rulesError } = await query;

    if (rulesError) throw rulesError;

    if (!allMatchedRules || allMatchedRules.length === 0) {
      return {
        tanaman: tanaman.nama,
        varietas: varietas?.nama || null,
        umur_tanaman: input.umur_tanaman,
        luas_lahan: input.luas_lahan,
        rekomendasi: [],
        message: "Tidak ada aturan rekomendasi yang cocok untuk kondisi ini",
      };
    }

    // STEP 4: Filter by varietas — prefer specific varietas, fall back to generic (null)
    const specificRules = allMatchedRules.filter(
      (r: any) => r.varietas_id === input.varietas_id
    );
    const genericRules = allMatchedRules.filter(
      (r: any) => r.varietas_id === null
    );

    // Use specific rules if available, otherwise use generic rules
    // Group by label_opsi: if specific rule exists for an opsi, skip the generic one
    const specificOpsiSet = new Set(specificRules.map((r: any) => r.label_opsi));
    const filteredGenericRules = genericRules.filter(
      (r: any) => !specificOpsiSet.has(r.label_opsi)
    );
    const matchedRules = [...specificRules, ...filteredGenericRules];

    // STEP 5: Build response — calculate doses based on luas_lahan
    const rekomendasi = matchedRules.map((rule: any) => ({
      aturan_id: rule.id,
      opsi: rule.label_opsi,
      hst_range: `${rule.hst_min} - ${rule.hst_max} HST`,
      jarak_tanam_lebar: rule.jarak_tanam_lebar,
      jarak_tanam_panjang: rule.jarak_tanam_panjang,
      pupuk: (rule.detail_rekomendasi || []).map((d: any) => ({
        nama: d.pupuk?.nama,
        satuan: d.pupuk?.satuan,
        dosis_per_ha: d.dosis_per_ha,
        dosis_total: parseFloat((d.dosis_per_ha * input.luas_lahan).toFixed(2)),
        keterangan: d.keterangan,
        frekuensi_aplikasi: d.frekuensi_aplikasi,
        cara_penggunaan: d.cara_penggunaan,
      })),
    }));

    // Sort: standar first, then ekonomis, then lengkap
    const opsiOrder: Record<string, number> = { standar: 1, ekonomis: 2, lengkap: 3 };
    rekomendasi.sort((a: any, b: any) => (opsiOrder[a.opsi] || 99) - (opsiOrder[b.opsi] || 99));

    return {
      tanaman: tanaman.nama,
      varietas: varietas?.nama || "Semua varietas",
      umur_tanaman: input.umur_tanaman,
      luas_lahan: input.luas_lahan,
      rekomendasi,
    };
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Gagal menjalankan simulasi rekomendasi: ${error.message}`, 500);
  }
};

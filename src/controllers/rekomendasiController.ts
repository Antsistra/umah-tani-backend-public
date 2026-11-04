// src/controllers/rekomendasiController.ts
import { Request, Response } from "express";
import {
  getAllAturanService,
  getAturanByIdService,
  createAturanService,
  updateAturanService,
  deleteAturanService,
  simulasiRekomendasiService,
} from "../services/aturanRekomendasiService";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

// ==========================================
// ATURAN REKOMENDASI CONTROLLERS (Penyuluh - Auth required)
// ==========================================

/**
 * GET /api/rekomendasi/aturan
 */
export const getAllAturanController = async (req: Request, res: Response) => {
  try {
    const { tanaman_id, varietas_id, label_opsi } = req.query;

    const filters = {
      tanaman_id: tanaman_id as string,
      varietas_id: varietas_id as string,
      label_opsi: label_opsi as string,
    };

    const data = await getAllAturanService(filters);
    return res.status(200).json({
      success: true,
      data,
      message: "Data aturan rekomendasi berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/rekomendasi/aturan/:id
 */
export const getAturanByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await getAturanByIdService(id as any);
    return res.status(200).json({
      success: true,
      data,
      message: "Data aturan rekomendasi berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * POST /api/rekomendasi/aturan
 */
export const createAturanController = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      tanaman_id,
      varietas_id,
      hst_min,
      hst_max,
      label_opsi,
      jarak_tanam_lebar,
      jarak_tanam_panjang,
      detail,
    } = req.body;

    // Validation
    if (!tanaman_id || hst_min === undefined || hst_max === undefined || !label_opsi) {
      return res.status(400).json({
        success: false,
        message: "tanaman_id, hst_min, hst_max, dan label_opsi wajib diisi",
      });
    }

    if (!["ekonomis", "standar", "lengkap"].includes(label_opsi)) {
      return res.status(400).json({
        success: false,
        message: "label_opsi harus salah satu dari: ekonomis, standar, lengkap",
      });
    }

    if (hst_min < 0 || hst_max < 0) {
      return res.status(400).json({
        success: false,
        message: "hst_min dan hst_max tidak boleh negatif",
      });
    }

    if (hst_max < hst_min) {
      return res.status(400).json({
        success: false,
        message: "hst_max harus lebih besar atau sama dengan hst_min",
      });
    }

    if (!detail || !Array.isArray(detail) || detail.length === 0) {
      return res.status(400).json({
        success: false,
        message: "detail (array pupuk + dosis) wajib diisi minimal 1",
      });
    }

    // Validate each detail item
    for (const d of detail) {
      if (!d.pupuk_id || !d.dosis_per_ha) {
        return res.status(400).json({
          success: false,
          message: "Setiap detail harus memiliki pupuk_id dan dosis_per_ha",
        });
      }
      if (d.dosis_per_ha <= 0) {
        return res.status(400).json({
          success: false,
          message: "dosis_per_ha harus lebih dari 0",
        });
      }
    }

    const data = await createAturanService(
      {
        tanaman_id,
        varietas_id,
        hst_min,
        hst_max,
        label_opsi,
        jarak_tanam_lebar,
        jarak_tanam_panjang,
        detail,
      },
      req.userId
    );

    return res.status(201).json({
      success: true,
      data,
      message: "Aturan rekomendasi berhasil dibuat",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/rekomendasi/aturan/:id
 */
export const updateAturanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      tanaman_id,
      varietas_id,
      hst_min,
      hst_max,
      label_opsi,
      jarak_tanam_lebar,
      jarak_tanam_panjang,
      detail,
    } = req.body;

    // Validation
    if (!tanaman_id || hst_min === undefined || hst_max === undefined || !label_opsi) {
      return res.status(400).json({
        success: false,
        message: "tanaman_id, hst_min, hst_max, dan label_opsi wajib diisi",
      });
    }

    if (!["ekonomis", "standar", "lengkap"].includes(label_opsi)) {
      return res.status(400).json({
        success: false,
        message: "label_opsi harus salah satu dari: ekonomis, standar, lengkap",
      });
    }

    if (hst_max < hst_min) {
      return res.status(400).json({
        success: false,
        message: "hst_max harus lebih besar atau sama dengan hst_min",
      });
    }

    if (!detail || !Array.isArray(detail) || detail.length === 0) {
      return res.status(400).json({
        success: false,
        message: "detail (array pupuk + dosis) wajib diisi minimal 1",
      });
    }

    const data = await updateAturanService(id as any,  {
      tanaman_id,
      varietas_id,
      hst_min,
      hst_max,
      label_opsi,
      jarak_tanam_lebar,
      jarak_tanam_panjang,
      detail,
    });

    return res.status(200).json({
      success: true,
      data,
      message: "Aturan rekomendasi berhasil diupdate",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE /api/rekomendasi/aturan/:id
 */
export const deleteAturanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteAturanService(id as any);
    return res.status(200).json({
      success: true,
      data: result.data,
      message: result.message,
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==========================================
// SIMULASI CONTROLLER (Petani - No Auth)
// ==========================================

/**
 * POST /api/rekomendasi/simulasi
 */
export const simulasiRekomendasiController = async (req: Request, res: Response) => {
  try {
    const { tanaman_id, varietas_id, umur_tanaman, luas_lahan } = req.body;

    // Validation
    if (!tanaman_id || umur_tanaman === undefined || luas_lahan === undefined) {
      return res.status(400).json({
        success: false,
        message: "tanaman_id, umur_tanaman, dan luas_lahan wajib diisi",
      });
    }

    if (umur_tanaman < 0) {
      return res.status(400).json({
        success: false,
        message: "umur_tanaman tidak boleh negatif",
      });
    }

    if (luas_lahan <= 0) {
      return res.status(400).json({
        success: false,
        message: "luas_lahan harus lebih dari 0",
      });
    }

    const data = await simulasiRekomendasiService({
      tanaman_id,
      varietas_id: varietas_id || null,
      umur_tanaman: Number(umur_tanaman),
      luas_lahan: Number(luas_lahan),
    });

    return res.status(200).json({
      success: true,
      data,
      message: "Simulasi rekomendasi pupuk berhasil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

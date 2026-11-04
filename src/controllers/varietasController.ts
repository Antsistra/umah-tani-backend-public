// src/controllers/varietasController.ts
import { Request, Response } from "express";
import {
  getAllVarietasService,
  getVarietasByIdService,
  createVarietasService,
  updateVarietasService,
  deleteVarietasService,
} from "../services/varietasService";

/**
 * GET /api/rekomendasi/varietas?tanaman_id=
 */
export const getAllVarietasController = async (req: Request, res: Response) => {
  try {
    const tanaman_id = req.query.tanaman_id as string | undefined;
    const data = await getAllVarietasService(tanaman_id);
    return res.status(200).json({
      success: true,
      data,
      message: "Data varietas berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/rekomendasi/varietas/:id
 */
export const getVarietasByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await getVarietasByIdService(id as any);
    return res.status(200).json({
      success: true,
      data,
      message: "Data varietas berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * POST /api/rekomendasi/varietas
 */
export const createVarietasController = async (req: Request, res: Response) => {
  try {
    const { tanaman_id, nama, deskripsi } = req.body;

    if (!tanaman_id || !nama) {
      return res.status(400).json({
        success: false,
        message: "tanaman_id dan nama wajib diisi",
      });
    }

    const data = await createVarietasService({ tanaman_id, nama, deskripsi });
    return res.status(201).json({
      success: true,
      data,
      message: "Varietas berhasil ditambahkan",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/rekomendasi/varietas/:id
 */
export const updateVarietasController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tanaman_id, nama, deskripsi } = req.body;

    const updateData: Record<string, any> = {};
    if (tanaman_id !== undefined) updateData.tanaman_id = tanaman_id;
    if (nama !== undefined) updateData.nama = nama;
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal satu field harus diisi untuk update",
      });
    }

    const data = await updateVarietasService(id as any, updateData);
    return res.status(200).json({
      success: true,
      data,
      message: "Varietas berhasil diupdate",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE /api/rekomendasi/varietas/:id
 */
export const deleteVarietasController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteVarietasService(id as any);
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

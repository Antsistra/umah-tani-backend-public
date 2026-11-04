// src/controllers/pupukController.ts
import { Request, Response } from "express";
import {
  getAllPupukService,
  getPupukByIdService,
  createPupukService,
  updatePupukService,
  deletePupukService,
} from "../services/pupukService";

/**
 * GET /api/rekomendasi/pupuk
 */
export const getAllPupukController = async (req: Request, res: Response) => {
  try {
    const data = await getAllPupukService();
    return res.status(200).json({
      success: true,
      data,
      message: "Data pupuk berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/rekomendasi/pupuk/:id
 */
export const getPupukByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await getPupukByIdService(id as any);
    return res.status(200).json({
      success: true,
      data,
      message: "Data pupuk berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * POST /api/rekomendasi/pupuk
 */
export const createPupukController = async (req: Request, res: Response) => {
  try {
    const { nama, satuan, deskripsi } = req.body;

    if (!nama) {
      return res.status(400).json({
        success: false,
        message: "Nama pupuk wajib diisi",
      });
    }

    const data = await createPupukService({ nama, satuan, deskripsi });
    return res.status(201).json({
      success: true,
      data,
      message: "Pupuk berhasil ditambahkan",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/rekomendasi/pupuk/:id
 */
export const updatePupukController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama, satuan, deskripsi } = req.body;

    const updateData: Record<string, any> = {};
    if (nama !== undefined) updateData.nama = nama;
    if (satuan !== undefined) updateData.satuan = satuan;
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal satu field harus diisi untuk update",
      });
    }

    const data = await updatePupukService(id as any, updateData);
    return res.status(200).json({
      success: true,
      data,
      message: "Pupuk berhasil diupdate",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE /api/rekomendasi/pupuk/:id
 */
export const deletePupukController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deletePupukService(id as any);
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

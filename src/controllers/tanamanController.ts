// src/controllers/tanamanController.ts
import { Request, Response } from "express";
import {
  getAllTanamanService,
  getTanamanByIdService,
  createTanamanService,
  updateTanamanService,
  deleteTanamanService,
} from "../services/tanamanService";

/**
 * GET /api/rekomendasi/tanaman
 */
export const getAllTanamanController = async (req: Request, res: Response) => {
  try {
    const data = await getAllTanamanService();
    return res.status(200).json({
      success: true,
      data,
      message: "Data tanaman berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * GET /api/rekomendasi/tanaman/:id
 */
export const getTanamanByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await getTanamanByIdService(id as any);
    return res.status(200).json({
      success: true,
      data,
      message: "Data tanaman berhasil diambil",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * POST /api/rekomendasi/tanaman
 */
export const createTanamanController = async (req: Request, res: Response) => {
  try {
    const { nama, deskripsi } = req.body;

    if (!nama) {
      return res.status(400).json({
        success: false,
        message: "Nama tanaman wajib diisi",
      });
    }

    const data = await createTanamanService({ nama, deskripsi });
    return res.status(201).json({
      success: true,
      data,
      message: "Tanaman berhasil ditambahkan",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * PUT /api/rekomendasi/tanaman/:id
 */
export const updateTanamanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama, deskripsi } = req.body;

    const updateData: Record<string, any> = {};
    if (nama !== undefined) updateData.nama = nama;
    if (deskripsi !== undefined) updateData.deskripsi = deskripsi;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal satu field harus diisi untuk update",
      });
    }

    const data = await updateTanamanService(id as any, updateData);
    return res.status(200).json({
      success: true,
      data,
      message: "Tanaman berhasil diupdate",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * DELETE /api/rekomendasi/tanaman/:id
 */
export const deleteTanamanController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deleteTanamanService(id as any); ;
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

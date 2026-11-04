// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";

/**
 * Interface untuk request yang sudah terautentikasi
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Middleware sederhana untuk extract user_id dari Supabase JWT token.
 * Tidak melakukan pengecekan role — hanya memastikan user terautentikasi.
 *
 * Usage: Kirim header `Authorization: Bearer <supabase_access_token>`
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan. Silakan login terlebih dahulu.",
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT token via Supabase
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Token tidak valid atau sudah expired.",
      });
    }

    // Attach user_id ke request
    req.userId = user.id;

    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Gagal memverifikasi autentikasi.",
      error: error.message,
    });
  }
};

// Export dengan nama alternatif untuk kompatibilitas
export const authMiddleware = requireAuth;

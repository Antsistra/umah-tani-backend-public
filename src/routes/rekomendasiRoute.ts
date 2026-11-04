// src/routes/rekomendasiRoute.ts
import { Router } from "express";
import {
  getAllTanamanController,
  getTanamanByIdController,
  createTanamanController,
  updateTanamanController,
  deleteTanamanController,
} from "../controllers/tanamanController";
import {
  getAllVarietasController,
  getVarietasByIdController,
  createVarietasController,
  updateVarietasController,
  deleteVarietasController,
} from "../controllers/varietasController";
import {
  getAllPupukController,
  getPupukByIdController,
  createPupukController,
  updatePupukController,
  deletePupukController,
} from "../controllers/pupukController";
import {
  getAllAturanController,
  getAturanByIdController,
  createAturanController,
  updateAturanController,
  deleteAturanController,
  simulasiRekomendasiController,
} from "../controllers/rekomendasiController";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  rekomendasiActivityLogger,
  setRequestStartTime,
} from "../middlewares/activityLogger";

const router = Router();

// Add request timing middleware untuk semua routes
router.use(setRequestStartTime);

// ==========================================
// PUBLIC ROUTES (Petani - No Auth)
// ==========================================

// --- Tanaman (Read only - untuk dropdown) ---
router.get("/tanaman", getAllTanamanController);
router.get("/tanaman/:id", getTanamanByIdController);

// --- Varietas (Read only - untuk dropdown) ---
router.get("/varietas", getAllVarietasController);
router.get("/varietas/:id", getVarietasByIdController);

// --- Pupuk (Read only - untuk info) ---
router.get("/pupuk", getAllPupukController);
router.get("/pupuk/:id", getPupukByIdController);

// --- Simulasi Forward Chaining (Petani) ---
router.post("/simulasi", simulasiRekomendasiController);

// ==========================================
// PROTECTED ROUTES (Penyuluh - Auth required)
// ==========================================

// --- Tanaman CRUD (Create/Update/Delete) ---
router.post("/tanaman", requireAuth, rekomendasiActivityLogger.createTanaman, createTanamanController);
router.put("/tanaman/:id", requireAuth, rekomendasiActivityLogger.updateTanaman, updateTanamanController);
router.delete("/tanaman/:id", requireAuth, rekomendasiActivityLogger.deleteTanaman, deleteTanamanController);

// --- Varietas CRUD (Create/Update/Delete) ---
router.post("/varietas", requireAuth, rekomendasiActivityLogger.createVarietas, createVarietasController);
router.put("/varietas/:id", requireAuth, rekomendasiActivityLogger.updateVarietas, updateVarietasController);
router.delete("/varietas/:id", requireAuth, rekomendasiActivityLogger.deleteVarietas, deleteVarietasController);

// --- Pupuk CRUD (Create/Update/Delete) ---
router.post("/pupuk", requireAuth, rekomendasiActivityLogger.createPupuk, createPupukController);
router.put("/pupuk/:id", requireAuth, rekomendasiActivityLogger.updatePupuk, updatePupukController);
router.delete("/pupuk/:id", requireAuth, rekomendasiActivityLogger.deletePupuk, deletePupukController);

// --- Aturan Rekomendasi CRUD ---
router.get("/aturan", requireAuth, getAllAturanController);
router.get("/aturan/:id", requireAuth, getAturanByIdController);
router.post("/aturan", requireAuth, rekomendasiActivityLogger.createAturan, createAturanController);
router.put("/aturan/:id", requireAuth, rekomendasiActivityLogger.updateAturan, updateAturanController);
router.delete("/aturan/:id", requireAuth, rekomendasiActivityLogger.deleteAturan, deleteAturanController);

export default router;

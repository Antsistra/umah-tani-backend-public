import { Router } from "express";
import { 
  deletePegawaiController, 
  getAllPegawaiController, 
  editPegawaiController, 
  addNewPegawaiController,
  resetPegawaiPasswordController
} from "../controllers/pegawaiController";
import { 
  staffActivityLogger, 
  setRequestStartTime, 
  skipActivityLogging 
} from "../middlewares/activityLogger";

const router = Router();

// Add request timing middleware untuk semua routes
router.use(setRequestStartTime);

// Routes dengan activity logging
router.get("/pegawai", 
  skipActivityLogging, // Skip logging untuk GET operations
  getAllPegawaiController
);

router.post("/pegawai", 
  staffActivityLogger.createPegawai, // Auto-log CREATE operations
  addNewPegawaiController
);

router.put("/pegawai/:id", 
  staffActivityLogger.updatePegawai, // Auto-log UPDATE operations
  editPegawaiController
);

router.put("/pegawai/:id/reset-password",
  staffActivityLogger.resetPasswordPegawai,
  resetPegawaiPasswordController
);

router.delete("/pegawai/:id", 
  staffActivityLogger.deletePegawai, // Auto-log DELETE operations
  deletePegawaiController
);

export default router;
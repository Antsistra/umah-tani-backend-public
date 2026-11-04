import { Router } from "express";
import { healthCheck } from "../controllers/healthController";
import pegawaiRouter from "./pegawaiRoute";
import activityLogRouter from "./activityLogRoute";
import blogRouter from "./blogRoute";
import ecommerceRouter from "./ecommerceRoute";
import rekomendasiRouter from "./rekomendasiRoute";
import chatbotRouter from "./chatbotRoute";
import paymentRouter from "./paymentRoute";
import addressRouter from "./addressRoute";
import adminRouter from "./adminRoute";
import adminPaymentRouter from "./adminPaymentRoute";
import marketingAdminRouter from "./marketingAdminRoute";
import marketingRouter from "./marketingRoute";
import ownerBankAccountRouter from "./ownerBankAccountRoute";

const router = Router();

router.get("/health", healthCheck);
router.get("/", (req, res) => {
    res.send("Welcome to the Umah Tani")
    });

// Main routes
router.use("/", pegawaiRouter);
router.use("/", activityLogRouter);
router.use("/blog", blogRouter); 
router.use("/ecommerce", ecommerceRouter);
router.use("/rekomendasi", rekomendasiRouter);
router.use("/chatbot", chatbotRouter);

// Payment & Shipping routes
router.use("/payments", paymentRouter);
router.use("/addresses", addressRouter);
router.use("/admin", adminRouter);
router.use("/admin/payments", adminPaymentRouter);

// Marketing routes
router.use("/admin/marketing", marketingAdminRouter);
router.use("/marketing", marketingRouter);
router.use("/notifications", marketingRouter);

// Owner routes (strictly restricted to owner role)
router.use("/owner/bank-accounts", ownerBankAccountRouter);

export default router;
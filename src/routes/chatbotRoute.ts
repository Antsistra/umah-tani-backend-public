import { Router } from "express";
import { askChatbotController, summarizeChatController } from "../controllers/chatbotController";

const router = Router();

/**
 * POST /api/chatbot/ask
 */
router.post("/ask", askChatbotController);

/**
 * POST /api/chatbot/summarize
 */
router.post("/summarize", summarizeChatController);

export default router;

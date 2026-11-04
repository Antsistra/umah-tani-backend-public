import { Request, Response } from "express";
import { askAgribusinessChatbotService, summarizeChatHistoryService, ChatMessageSummaryInput } from "../services/chatbotService";

/**
 * POST /api/chatbot/ask
 */
export const askChatbotController = async (req: Request, res: Response) => {
  try {
    const { message, session_id, user_context } = req.body as {
      message?: string;
      session_id?: string;
      user_context?: {
        location?: string;
      };
    };

    if (!message || typeof message !== "string" || message.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Field message wajib diisi minimal 2 karakter",
      });
    }

    const data = await askAgribusinessChatbotService({
      message,
      session_id,
      user_context,
    });

    return res.status(200).json({
      success: true,
      data,
      message: "Chatbot response generated",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to process chatbot request",
    });
  }
};

/**
 * POST /api/chatbot/summarize
 */
export const summarizeChatController = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as {
      messages?: ChatMessageSummaryInput[];
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Field messages wajib diisi berupa array percakapan",
      });
    }

    const summary = await summarizeChatHistoryService(messages);

    return res.status(200).json({
      success: true,
      summary,
      message: "Chat history summarized successfully",
    });
  } catch (error: any) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to process summarization request",
    });
  }
};

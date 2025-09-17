import { Router } from "express";
import { getUploadUrl, getDownloadUrl } from "../controller/upload.controller";

const router = Router();

// POST /api/upload-url : Generate a signed URL for uploading
router.post("/", getUploadUrl);

// GET /api/upload-url/:fileKey : Generate a signed URL for downloading
router.get("/:fileKey", getDownloadUrl);

export default router;

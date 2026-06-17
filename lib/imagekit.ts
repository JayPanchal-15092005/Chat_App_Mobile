import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

const IMAGEKIT_PUBLIC_KEY = "public_HWdcHmVK9g78x8J7uB8QyxcyBpg=";
const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";
const AUTH_ENDPOINT = "https://chat-app-backend-zj3i.onrender.com/api/upload/auth";

export const uploadToImageKit = async (fileUri: string, type: "image" | "voice", token: string): Promise<string> => {
  try {
    // 1. Get auth signature from backend
    const authRes = await fetch(AUTH_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!authRes.ok) {
      throw new Error("Failed to get ImageKit auth signature");
    }
    
    const { signature, expire, token: imageKitToken } = await authRes.json();

    // 2. Prepare file data
    const filename = fileUri.split("/").pop() || `${Date.now()}.${type === "image" ? "jpg" : "m4a"}`;
    
    // In React Native, fetch can take a FormData object with { uri, name, type }
    const formData = new FormData();
    formData.append("file", {
      uri: Platform.OS === "ios" ? fileUri.replace("file://", "") : fileUri,
      name: filename,
      type: type === "image" ? "image/jpeg" : "audio/m4a",
    } as any);
    
    formData.append("publicKey", IMAGEKIT_PUBLIC_KEY);
    formData.append("signature", signature);
    formData.append("expire", expire.toString());
    formData.append("token", imageKitToken);
    formData.append("fileName", filename);
    formData.append("folder", type === "image" ? "/chat_images" : "/chat_voices");

    // 3. Upload to ImageKit
    const uploadRes = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/json",
        // Do not set Content-Type to multipart/form-data manually, fetch will do it with the correct boundary
      }
    });

    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      throw new Error(uploadData.message || "Upload failed");
    }

    return uploadData.url;
  } catch (error) {
    console.error("ImageKit upload error:", error);
    throw error;
  }
};


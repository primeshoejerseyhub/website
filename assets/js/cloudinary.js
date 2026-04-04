// ============================================
// PRIME SHOE JERSEY HUB — Cloudinary Uploader
// ============================================
// Replace CLOUD_NAME and UPLOAD_PRESET with your real values.
// To get these:
//   1. Go to cloudinary.com → Settings → Upload Presets
//   2. Create an unsigned preset (e.g. "psjh_unsigned")
//   3. Copy your Cloud Name from the Dashboard

const CLOUDINARY_CLOUD_NAME = "dhw2cwgd9";   // ← replace
const CLOUDINARY_UPLOAD_PRESET = "psjh_unsigned"; // ← replace (unsigned)

/**
 * Upload a single File object to Cloudinary.
 * Returns the secure_url string, or throws on failure.
 *
 * @param {File} file  - A File object from an <input type="file">
 * @param {string} [folder] - Optional Cloudinary folder name
 * @returns {Promise<string>} secure image URL
 */
export async function uploadToCloudinary(file, folder = "psjh_products") {
  if (!file) throw new Error("No file provided");

  console.log(`[Cloudinary] Uploading: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const response = await fetch(url, { method: "POST", body: formData });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error("[Cloudinary] Error response:", errData);
    throw new Error(errData.error?.message || `Upload failed (HTTP ${response.status})`);
  }

  const data = await response.json();
  console.log("[Cloudinary] Upload success:", data.secure_url);
  return data.secure_url;
}

/**
 * Upload multiple files to Cloudinary.
 * Returns array of secure_url strings.
 *
 * @param {FileList|File[]} files
 * @param {string} [folder]
 * @param {function} [onProgress] - callback(uploadedCount, totalCount)
 * @returns {Promise<string[]>}
 */
export async function uploadMultipleToCloudinary(files, folder = "psjh_products", onProgress) {
  const fileArray = Array.from(files);
  const urls = [];

  for (let i = 0; i < fileArray.length; i++) {
    const url = await uploadToCloudinary(fileArray[i], folder);
    urls.push(url);
    if (onProgress) onProgress(i + 1, fileArray.length);
  }

  return urls;
}

/**
 * Upload a payment screenshot to a separate Cloudinary folder.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function uploadScreenshot(file) {
  return uploadToCloudinary(file, "psjh_screenshots");
}

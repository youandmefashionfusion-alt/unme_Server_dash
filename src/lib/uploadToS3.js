export async function uploadFileToS3(file, options = {}) {
  const { folder = "uploads" } = options;

  if (!file) {
    throw new Error("No file selected");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  const response = await fetch("/api/upload/upload", {
    method: "POST",
    body: formData,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.result) {
    throw new Error(data?.message || "Failed to upload file");
  }

  return data.result;
}

export async function uploadFilesToS3(files, options = {}) {
  const input = Array.from(files || []).filter(Boolean);
  const uploaded = [];

  for (const file of input) {
    const result = await uploadFileToS3(file, options);
    uploaded.push(result);
  }

  return uploaded;
}

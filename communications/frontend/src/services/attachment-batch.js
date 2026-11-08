// Called only after an explicit Send action. Never retry an ambiguous delivery.
export async function sendAttachmentBatch(files, { isActive, upload, accepted }) {
 for (const file of files) {
  if (!isActive()) break
  await upload(file)
  if (!isActive()) break
  accepted(file)
 }
}

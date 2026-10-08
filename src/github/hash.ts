/**
 * code-server reports a file only as a hash of its absolute path: VS Code's
 * string hash, seeded with 149417, then `h = h * 31 + c` over the UTF-16 code
 * units, kept to a signed 32-bit integer. The Repo dashboard's jq computes the
 * same for the hashes it asks Loki about; if the two ever differ, the activity
 * counts silently read zero.
 */
export function pathHash(path: string): number {
  let h = 149417;
  for (let i = 0; i < path.length; i += 1) h = ((h << 5) - h + path.charCodeAt(i)) | 0;
  return h;
}

export function buildChatContextStatus(input: {
  vaultLoading: boolean;
  vaultReadyCount: number;
  vaultTotalCount: number;
  helperCount: number;
}) {
  const vaultLabel = input.vaultLoading
    ? "Vault loading"
    : input.vaultReadyCount > 0
      ? "Vault ready"
      : "Vault off";
  const vaultDetail = input.vaultLoading
    ? "Checking files"
    : input.vaultReadyCount > 0
      ? `${input.vaultReadyCount} ready / ${input.vaultTotalCount} files`
      : "No ready files";
  const helperLabel =
    input.helperCount === 0
      ? "No helpers"
      : input.helperCount === 1
        ? "1 helper"
        : `${input.helperCount} helpers`;

  return {
    vaultLabel,
    vaultDetail,
    helperLabel,
  };
}

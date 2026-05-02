import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { VaultFile } from "@/types";

export type LocalVaultFile = VaultFile & {
  previewText?: string | null;
};

type LocalVaultStore = {
  files: LocalVaultFile[];
  addFiles: (files: LocalVaultFile[]) => void;
  removeFile: (fileId: string) => void;
  clearAll: () => void;
};

export const useLocalVaultStore = create<LocalVaultStore>()(
  persist(
    set => ({
      files: [],
      addFiles: files =>
        set(state => ({
          files: [...files, ...state.files.filter(existing => !files.some(file => file.id === existing.id))],
        })),
      removeFile: fileId =>
        set(state => ({
          files: state.files.filter(file => file.id !== fileId),
        })),
      clearAll: () => set({ files: [] }),
    }),
    {
      name: "local-vault-store",
    },
  ),
);

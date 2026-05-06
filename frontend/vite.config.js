import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  return {
    plugins: [react()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: isProd
          ? {
              entryFileNames: "assets/[hash].js",
              chunkFileNames: "assets/[hash].js",
              assetFileNames: "assets/[hash][extname]",
            }
          : {},
      },
    },
  };
});

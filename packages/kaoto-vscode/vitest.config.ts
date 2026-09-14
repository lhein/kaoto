import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@kaoto/kaoto/models',
        replacement: resolve(__dirname, '../../packages/ui/src/models-api.ts'),
      },
      {
        find: '@kaoto/kaoto',
        replacement: resolve(__dirname, '../../packages/ui/src/event-bus/index.ts'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/webview/bridge/**/*.test.ts'],
    clearMocks: true,
  },
});

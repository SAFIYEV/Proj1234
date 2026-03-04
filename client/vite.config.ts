import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGithubPagesBuild = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  // For GitHub Pages project sites assets must be served from /<repo>/
  base: isGithubPagesBuild && repository ? `/${repository}/` : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // allowedHosts: ['oden-pashu.surge.sh']
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})

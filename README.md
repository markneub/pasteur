# Pasteur

A browser-based Milkdrop visualization exporter. Drop in an audio file, watch it visualize, and download the result as MP4 or WebM — all in-browser, no server required.

Built with Vue 3, Vite, [butterchurn](https://github.com/jberg/butterchurn), and WebCodecs.

## Requirements

- Node.js v18+ (use `nvm use` if you have nvm)

## Setup

```bash
npm install
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at `http://localhost:5173` |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npx vitest run` | Run unit tests |

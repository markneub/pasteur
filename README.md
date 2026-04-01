# Pasteur

A browser-based Milkdrop visualization exporter. Drop in an audio file, watch it visualize, and download the result as MP4 or WebM — all in-browser, no server required.

Built with Vue 3, Vite, [butterchurn](https://github.com/jberg/butterchurn), and WebCodecs.

## Requirements

- Node.js v18+ — v22 recommended

## Node version (nvm)

This project uses Node v22. If your shell's default `node` is too old, activate the right version first:

```bash
nvm use v22
```

To make v22 the default so you don't have to run this every time:

```bash
nvm alias default v22
```

If v22 isn't installed yet:

```bash
nvm install v22
```

All `npm` commands below assume the correct Node version is active.

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

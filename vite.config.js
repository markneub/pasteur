import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Patches butterchurn at build time to support configurable title options
// (duration, fontFamily, fontStyle) and fix FPS-dependent title timing.
function patchButterchurn() {
  return {
    name: 'patch-butterchurn',
    transform(code, id) {
      if (!id.includes('butterchurn/lib/butterchurn.js')) return null

      return code
        // Initial supertext state
        .replace(
          'this.supertext = {\n      startTime: -1\n    };',
          'this.supertext = {\n      startWallTime: -1\n    };'
        )
        // First progress block (pre-render pass)
        .replace(
          'if (this.supertext.startTime >= 0) {\n        var progress = (this.time - this.supertext.startTime) / this.supertext.duration;\n\n        if (progress >= 1) {\n          this.titleText.renderTitle(progress, true, globalVars);\n        }\n      }',
          'if (this.supertext.startWallTime >= 0) {\n        var progress = (performance.now() - this.supertext.startWallTime) / (this.supertext.duration * 1000);\n\n        if (progress >= 1) {\n          this.titleText.renderTitle(progress, true, globalVars);\n        }\n      }'
        )
        // Second progress block (final render pass)
        .replace(
          'if (this.supertext.startTime >= 0) {\n        var progress = (this.time - this.supertext.startTime) / this.supertext.duration;\n        this.titleText.renderTitle(progress, false, this.globalVars);\n\n        if (progress >= 1) {\n          this.supertext.startTime = -1;\n        }\n      }',
          'if (this.supertext.startWallTime >= 0) {\n        var progress = (performance.now() - this.supertext.startWallTime) / (this.supertext.duration * 1000);\n        this.titleText.renderTitle(progress, false, this.globalVars);\n\n        if (progress >= 1) {\n          this.supertext.startWallTime = -1;\n        }\n      }'
        )
        // Inner renderer launchSongTitleAnim
        .replace(
          'value: function launchSongTitleAnim(text) {\n      this.supertext = {\n        startTime: this.time,\n        duration: 1.7\n      };\n      this.titleText.generateTitleTexture(text);\n    }',
          'value: function launchSongTitleAnim(text, options) {\n      var opts = options || {};\n      this.supertext = {\n        startWallTime: performance.now(),\n        duration: opts.duration != null ? opts.duration : 1.7\n      };\n      this.titleText.generateTitleTexture(text, opts.fontFamily, opts.fontStyle);\n    }'
        )
        // generateTitleTexture — font support
        .replace(
          'value: function generateTitleTexture(text) {\n      this.context2D.clearRect(0, 0, this.texsizeX, this.texsizeY);\n      this.fontSize = Math.floor(16 * (this.texsizeX / 256));\n      this.fontSize = Math.max(this.fontSize, 6);\n      this.context2D.font = "italic ".concat(this.fontSize, "px Times New Roman");',
          'value: function generateTitleTexture(text, fontFamily, fontStyle) {\n      this.context2D.clearRect(0, 0, this.texsizeX, this.texsizeY);\n      this.fontSize = Math.floor(16 * (this.texsizeX / 256));\n      this.fontSize = Math.max(this.fontSize, 6);\n      var resolvedFamily = fontFamily || "Times New Roman";\n      var resolvedStyle = fontStyle || "italic";\n      this.context2D.font = "".concat(resolvedStyle, " ").concat(this.fontSize, "px ").concat(resolvedFamily);'
        )
        // Outer Visualizer launchSongTitleAnim wrapper
        .replace(
          'value: function launchSongTitleAnim(text) {\n      this.renderer.launchSongTitleAnim(text);\n    }',
          'value: function launchSongTitleAnim(text, options) {\n      this.renderer.launchSongTitleAnim(text, options);\n    }'
        )
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), vue(), patchButterchurn()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },
})

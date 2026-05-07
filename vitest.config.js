"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
const unplugin_swc_1 = require("unplugin-swc");
exports.default = (0, config_1.defineConfig)({
    test: {
        globals: true,
        root: './',
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
        },
    },
    plugins: [
        unplugin_swc_1.default.vite({
            module: { type: 'es6' },
        }),
    ],
});
//# sourceMappingURL=vitest.config.js.map
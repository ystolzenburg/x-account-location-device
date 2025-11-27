/**
 * Rollup Configuration for X-Posed Extension
 * Builds both Chrome (MV3) and Firefox compatible versions
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import copy from 'rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;
const browser = process.env.BROWSER || 'chrome';
const isFirefox = browser === 'firefox';
const outputDir = isFirefox ? 'dist/firefox' : 'dist/chrome';
const manifestFile = isFirefox ? 'src/manifest.firefox.json' : 'src/manifest.chrome.json';

// Common plugins
const plugins = [
    resolve({
        browser: true
    }),
    commonjs(),
    production && terser({
        format: {
            comments: false
        }
    })
];

// Copy static assets
const copyPlugin = copy({
    targets: [
        // Manifest (browser-specific)
        { src: manifestFile, dest: outputDir, rename: 'manifest.json' },
        // Icons
        { src: 'icons/*', dest: `${outputDir}/icons` },
        // Styles
        { src: 'src/styles/*.css', dest: `${outputDir}/styles` },
        // Popup
        { src: 'src/popup/popup.html', dest: `${outputDir}/popup` },
        { src: 'src/popup/popup.css', dest: `${outputDir}/popup` },
        // Options
        { src: 'src/options/options.html', dest: `${outputDir}/options` },
        { src: 'src/options/options.css', dest: `${outputDir}/options` }
    ]
});

export default [
    // Background Service Worker
    {
        input: 'src/background/service-worker.js',
        output: {
            file: `${outputDir}/background.js`,
            format: 'iife',
            name: 'XPosedBackground',
            sourcemap: !production
        },
        plugins: [...plugins]
    },

    // Content Script (ISOLATED world) - bundle with inlined dynamic imports
    {
        input: 'src/content/content-script.js',
        output: {
            file: `${outputDir}/content.js`,
            format: 'iife',
            name: 'XPosedContent',
            sourcemap: !production,
            inlineDynamicImports: true
        },
        plugins: [...plugins]
    },

    // Page Script (MAIN world) - simple IIFE
    {
        input: 'src/content/page-script.js',
        output: {
            file: `${outputDir}/page-script.js`,
            format: 'iife',
            sourcemap: !production
        },
        plugins: [...plugins]
    },

    // Popup Script
    {
        input: 'src/popup/popup.js',
        output: {
            file: `${outputDir}/popup/popup.js`,
            format: 'iife',
            name: 'XPosedPopup',
            sourcemap: !production,
            inlineDynamicImports: true
        },
        plugins: [...plugins, copyPlugin]
    },

    // Options Script
    {
        input: 'src/options/options.js',
        output: {
            file: `${outputDir}/options/options.js`,
            format: 'iife',
            name: 'XPosedOptions',
            sourcemap: !production,
            inlineDynamicImports: true
        },
        plugins: [...plugins]
    }
];
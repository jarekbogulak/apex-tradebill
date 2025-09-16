// Custom Metro config to avoid scanning Jest binaries/packages that can
// confuse Metro's TreeFS (file vs directory) when using pnpm.
// Extends Expo's default config and blocklists problematic paths.

const { getDefaultConfig } = require('expo/metro-config');
// Avoid using exclusionList helper due to export differences across versions

/** @type {import('metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prevent Metro from crawling Jest tooling that isn't needed at runtime
// and can trigger file/directory collisions with pnpm's layout.
config.resolver.blockList = new RegExp(
  [
    'node_modules/ts-jest/.*', // exclude ts-jest package tree
    'node_modules/\\.bin/.*', // exclude binaries symlinks
  ].join('|')
);

module.exports = config;

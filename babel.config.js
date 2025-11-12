const presets = [
  [
    '@babel/env',
    {
      useBuiltIns: 'usage',
      corejs: { version: '3.8.2', proposals: true },
    },
  ],
  '@babel/preset-typescript',
  // 'minify', can't use because of builtin math usage now
];

module.exports = {
  presets,
  sourceMaps: true,
  comments: false,
};

// base-rollup.config.js
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');
// const typescript = require('rollup-plugin-typescript2');
// const { terser } = require('rollup-plugin-terser');

module.exports = {
  input: 'src/activities/000-test/poc.ts', // Default input file
  output: {
    file: 'dist/bundle.js', // Default output file
    format: 'iife',
  },
  plugins: [
    resolve(),
    commonjs(),
    babel({
			exclude: 'node_modules/**',
			presets: [
				'@babel/env',
				'@babel/typescript',
			],
		}),
    // terser(),
  ],
};

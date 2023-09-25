// build.js
const rollup = require('rollup');
// const baseConfig = require('./base-rollup.config.js');
const activitiesJSON = require('./src/activities.json');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');
const nodePolyfills = require('rollup-plugin-polyfill-node');

// Function to build a single file
async function buildFile(config) {
	try {
		const bundle = await rollup.rollup(config);
		await bundle.write(config.output);
	} catch (error) {
		console.error('Build error:', error);
		// process.exit(1);
	}
}

// Loop through files and build each one
async function buildAllFiles() {
  for (const activity of activitiesJSON.activities) {
    console.log(`Building ${activity.activity}/${activity.scripts[0]}...`);
    await buildFile({
			input: `src/activities/${activity.activity}/${activity.scripts[0]}`,
			output: {
				file: `dist/fe_activity_${activity.activity}.js`,
				format: 'iife',
			},
			plugins: [
				nodePolyfills(),
				resolve({
					preferBuiltins: true,
				}),
				commonjs(),
				babel({
					babelHelpers: 'bundled',
					extensions: ['.js', '.ts'],
					exclude: 'node_modules/**',
					presets: [
						'@babel/typescript',
						'@babel/env',
					],
				}),
			],
		});
  }
}

// Run the build process
buildAllFiles().catch((error) => {
  console.error('Build error:', error);
  process.exit(1);
});

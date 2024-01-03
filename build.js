// build.js
const rollup = require('rollup');
const activitiesJSON = require('./src/activities.json');
const resolve = require('@rollup/plugin-node-resolve');
const replace = require('@rollup/plugin-replace');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');
const nodePolyfills = require('rollup-plugin-polyfill-node');
const { terser } = require('rollup-plugin-terser');

// Function to build a single file
const buildFile = async (config) => {
	try {
		const bundle = await rollup.rollup(config);
		await bundle.write(config.output);
	} catch (error) {
		console.error('Build error:', error);
		// process.exit(1);
	}
}

// Build the library files
const buildLibFiles = async () => {
	await buildFile({
		input: './init-activities.js',
		output: {
			file: 'dist/fe_dev.js',
			format: 'iife',
		},
		plugins: [
			replace({
				preventAssignment: false,
				objectGuards: true,
				values: {
					'process.env.REUSABLE_LIB': `"./src/activities/${activitiesJSON.reusable[0]}"`,
					'process.env.ENVIRONMENTS': JSON.stringify(activitiesJSON.environments),
					'process.env.SITES': JSON.stringify(activitiesJSON.sites),
					'process.env.ACTIVITIES': JSON.stringify(activitiesJSON.activities),
					'process.env.AWS_S3_BUCKET': `"${process.env.AWS_S3_BUCKET}"`,
				},
			}),
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
	await buildFile({
		input: './init-activities.js',
		output: {
			file: 'dist/fe_prod.js',
			format: 'iife',
		},
		plugins: [
			replace({
				preventAssignment: false,
				objectGuards: true,
				values: {
					'process.env.REUSABLE_LIB': `"./src/activities/${activitiesJSON.reusable[0]}"`,
					'process.env.ENVIRONMENTS': JSON.stringify(activitiesJSON.environments),
					'process.env.SITES': JSON.stringify(activitiesJSON.sites),
					'process.env.ACTIVITIES': JSON.stringify(activitiesJSON.activities),
					'process.env.AWS_S3_BUCKET': `"${process.env.AWS_S3_BUCKET}"`,
				},
			}),
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
			terser(),
		],
	});
}

buildLibFiles();


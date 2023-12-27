// build.js
import * as rollup from 'rollup';
import activitiesJSON from './src/activities.json' assert { type: 'json' };
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { terser } from 'rollup-plugin-terser';

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

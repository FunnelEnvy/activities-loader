// build.js

// capture command line arguments
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
const argv = yargs(hideBin(process.argv)).argv
// rollup dependencies
import * as rollup from 'rollup';
import activitiesJSON from './src/activities.json' assert { type: 'json' };
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { terser } from 'rollup-plugin-terser';
import { wrap, prepend } from 'rollup-plugin-insert';
import { cleandir } from 'rollup-plugin-cleandir';
// for building css
import fs from 'fs';
import CleanCSS from 'clean-css';

const plugins = ({ activity, styles, cssRestrictions }) => {
	// Read the CSS file
	const cssFilePath = styles ? `./src/activities/${activity}/${styles[0]}` : '';
	const cssContent = styles ? fs.readFileSync(cssFilePath, 'utf8') : null;

	// Minify the CSS content
	const minifiedCssContent = styles ? new CleanCSS().minify(cssContent).styles : '';
	return [
		prepend(`
			${styles ? 'const strMinifiedCss = process.env.MINIFIED_CSS' : ''};
			const feProjectId = process.env.FE_PROJECT_ID;
			const addCss = () => {
				${cssRestrictions ? 'if (' + cssRestrictions + ') {' : ''}
					window.${process.env.REUSABLE_FN}.injectCss(strMinifiedCss, feProjectId);
				${cssRestrictions ? '}' : ''}
			};
			${cssRestrictions ? 'window.' + process.env.REUSABLE_FN + '.waitForAudience(addCss);' : 'addCss();'}
		`),
		wrap(
			`try {`,
			`} catch (err) {
				console.error('Error loading activity ${activity}:', err);
			}`,
		),
		nodePolyfills(),
		resolve({
			preferBuiltins: true,
		}),
		commonjs(),
		replace({
			preventAssignment: false,
			objectGuards: true,
			values: {
				'process.env.MINIFIED_CSS': `${JSON.stringify(minifiedCssContent)}`,
				'process.env.FE_PROJECT_ID': `"fe_activity_${activity}"`,
				'process.env.REUSABLE_FN': process.env.REUSABLE_FN,
			},
		}),
		babel({
			babelHelpers: 'bundled',
			extensions: ['.js', '.ts'],
			exclude: 'node_modules/**',
			presets: [
				'@babel/typescript',
				'@babel/env',
			],
		}),
	];
};

// Loop through files and build each one
const buildActivities = async (activitiesFilter = []) => {
	let activitiesToBuild = [];
	if (activitiesFilter.length) {
		activitiesToBuild = activitiesJSON.activities.filter(activity => activitiesFilter.includes(activity.activity));
	} else {
		activitiesToBuild = activitiesJSON.activities;
	}
	for (const activity of activitiesToBuild) {
		console.log(`Building ${activity.activity}/${activity.scripts[0]}...`);
		await buildFile({
			input: `src/activities/${activity.activity}/${activity.scripts[0]}`,
			output: {
				file: `dist/fe_activity_${activity.activity}.js`,
				format: 'iife',
			},
			plugins: plugins(activity),
		});
		await buildFile({
			input: `src/activities/${activity.activity}/${activity.scripts[0]}`,
			output: {
				file: `dist/fe_activity_${activity.activity}.min.js`,
				format: 'iife',
			},
			plugins: [...plugins(activity), terser()],
		});
	}
}

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

// Run the build process
cleandir('dist');
if (argv.all) {
	buildLibFiles();
	buildActivities().catch((error) => {
		console.error('Build error:', error);
		process.exit(1);
	});
}
if (argv.lib) {
	buildLibFiles();
}
if (argv.activities) {
	console.log('activities:', argv.activities);
	buildActivities(argv.activities.split(',')).catch((error) => {
		console.error('Build error:', error);
		process.exit(1);
	});
}

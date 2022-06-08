// @ts-ignore
import multiInput from 'rollup-plugin-multi-input';
import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import rename from 'rollup-plugin-rename';
import resolve from '@rollup/plugin-node-resolve';
// @ts-ignore
import { uglify } from 'rollup-plugin-uglify';
// @ts-ignore
import cleaner from 'rollup-plugin-cleaner';
// import commonjs from '@rollup/plugin-commonjs';

export default {
  input: [
		'activities/testing-activity/index.ts',
		'activities/testing-activity2/index.js',
	],
  output: {
    format: 'cjs',
		dir: 'dist',
  },
	plugins: [
		cleaner({
			targets: [ 'dist' ],
		}),
		multiInput({ relative: 'activities/' }),
		rename({
			include: ['**/*.ts', '**/*.js'],
			map: (name) => {
				const splitName = name.split('/');
				return `fe_${splitName[0]}.js` || name;
			},
		}),
		typescript(),
		postcss({
			extract: false,
			extensions: ['.css'],
			minimize: process.env.ENV === 'production' ? true : false,
		}),
		resolve(),
		// commonjs(),
		process.env.ENV === 'production' && uglify(),
	],
};

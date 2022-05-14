const path = require('path');
const glob = require('glob');
const WrapperPlugin = require('wrapper-webpack-plugin');

console.log(glob.sync('./sample_activities/**/*'));

module.exports = {
	mode: 'development',
	entry: glob.sync('./sample_activities/**/*').reduce((accum, curr) => {
		fileSplit = curr.split('/');
		endingFile = fileSplit[fileSplit.length - 1];
		if (endingFile.endsWith('.ts') || endingFile.endsWith('.js')) {
			accum[fileSplit[fileSplit.length - 2]] = curr;
			return accum;
		}
		return accum;
	}, {}),
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: "[name].js",
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.m?js$/,
				use: 'babel-loader',
				exclude: /node_modules/
			},
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader"],
				exclude: /node_modules/
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.mjs', '.js', '.css'],
	},
	plugins: [
		new WrapperPlugin({
			header: function(filename) {
				return `
					(function () {
						"use strict";\n
						const reusable = require('./reusable');
						window.feFunctions = reusable;
						feProjectId = '${filename}';
						await window.feFunctions.sendEvent('${filename}');
				`;
			},
			footer: function(filename) {
				return `
						await window.feFunctions.sendEvent('${filename}');
					\n})();
				`;
			},
		}),
	],
};

const path = require('path');
const WrapperPlugin = require('wrapper-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
	mode: 'production',
	entry: [],
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
				test: /\.css$/i,
				use: [MiniCssExtractPlugin.loader, "style-loader", "css-loader"],
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.mjs', '.js', '.css'],
	},
	plugins: [
		new MiniCssExtractPlugin(),
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

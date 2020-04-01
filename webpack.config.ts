import path from "path";
import webpack from "webpack";

const config: webpack.Configuration = {
	mode: 'development',
	target: 'node',
	entry: './src/mod.ts',
	output: {
		path: path.resolve(__dirname, 'dist')
		// filename: "mod.js"
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/
			},
			{
				test: /\.node$/,
				use: 'node-loader'
			}
		]
	},
	node: {
		stream: 'mock'
	},
	resolve: {
		extensions: ['.ts', '.js', '.json'],
		modules: ['node_modules']
	},
	plugins: [
		new webpack.BannerPlugin({
			banner: '#!/usr/bin/env node',
			raw: true
		})
	]
}

export default config;

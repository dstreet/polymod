const path = require('path')
const webpack = require('webpack')

module.exports = {
	entry: ['babel-polyfill', './index.js'],
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist'),
		library: 'polymod',
		libraryTarget: 'umd'
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: [/node_modules/],
				use: [{
					loader: 'babel-loader',
					options: { presets: ['es2015', 'stage-3'] }
				}]
			}
		]
	}
}

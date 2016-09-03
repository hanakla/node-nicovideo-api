const path = require('path');
const webpack = require('webpack');

console.log(path.resolve(__dirname, 'src'));

module.exports = {
    context: path.join(__dirname, 'src'),
    target: 'node',
    // entry: {
    //     niconico: './niconico'
    // },
    resolve: {
        extensions: ['', '.js'],
    },
    externals: /^(?!\.\/|\.\.\/|src\/)/,
    output: {
        path: path.join(__dirname, 'lib'),
        filename: '[name].js',
        libraryTarget: 'commonjs2',
    },
    module: {
        preLoaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'eslint-loader',
            }
        ],
        loaders: [
            {test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/,
             query: {
                presets: [
                    'latest',
                    'stage-3',
                    'stage-2',
                ],
                plugins: [
                    'add-module-exports',
                    'transform-export-extensions',
                ]
             }},
        ],
    },
};

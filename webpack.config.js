const path = require('path');
const webpack = require('webpack');

console.log(path.resolve(__dirname, 'src'));

module.exports = {
    context: path.join(__dirname, 'src'),
    target: 'node',
    entry: {
        niconico: './niconico'
    },
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
        loaders: [
            {test: /\.js$/, loader: 'babel-loader', exclude: /node_modules/,
             query: {
                presets: [
                    'es2015',
                    'stage-3',
                    'stage-2',
                ],
                plugins: [
                    'add-module-exports',
                ]
             }},
        ],
    },
};

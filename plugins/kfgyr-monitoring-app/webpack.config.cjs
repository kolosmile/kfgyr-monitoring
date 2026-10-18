const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
module.exports = {
  entry: './src/module.ts',
  output: { filename: 'module.js', path: path.resolve(__dirname, 'dist'), library: { type: 'amd' }, publicPath: 'auto' },
  externals: [({ request }, cb) => /^(react($|\/)|react-dom($|\/)|@grafana\/|rxjs($|\/))/.test(request || '') ? cb(null, request) : cb()],
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: { loader: 'swc-loader', options: { jsc: { parser: { syntax: 'typescript', tsx: true }, target: 'es2020', transform: { react: { runtime: 'classic' } } } } } }] },
  resolve: { extensions: ['.ts', '.tsx', '.js'] },
  plugins: [new CopyPlugin({ patterns: [{ from: 'src/plugin.json', to: 'plugin.json' }, { from: 'src/img', to: 'img' }, { from: 'README.md', to: 'README.md' }] })],
  devtool: false
};

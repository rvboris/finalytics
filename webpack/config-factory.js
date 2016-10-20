const _ = require('lodash');
const path = require('path');
const webpack = require('webpack');
const AssetsPlugin = require('assets-webpack-plugin');
const nodeExternals = require('webpack-node-externals');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const log = require('debug')('webpack');
const cssnext = require('postcss-cssnext');
const flexbox = require('postcss-flexbox');
const Visualizer = require('webpack-visualizer-plugin');
const LodashModuleReplacementPlugin = require('lodash-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const stylelint = require('stylelint');
const rucksack = require('rucksack-css');
const mqpacker = require('css-mqpacker');
const postcssReporter = require('postcss-reporter');
const Writable = require('stream').Writable;
const configs = require('../config');

const ifElse = (condition) => (then, or) => (condition ? then : or);

const logStream = Writable({
  write(chunk, encoding, next) {
    log(chunk.toString('utf8', chunk.length, chunk.length - 1));
    next();
  },
});

logStream.isTTY = process.stdout.isTTY;

module.exports = ({ target, options }) => {
  log(`Creating webpack "${target}" config in "${options.mode}" mode`);

  const isDev = options.mode === 'development';
  const isProd = options.mode === 'production';
  const isClient = target === 'client';
  const isServer = target === 'server';

  const ifDev = ifElse(isDev);
  const ifProd = ifElse(isProd);
  const ifClient = ifElse(isClient);
  const ifServer = ifElse(isServer);
  const ifDevClient = ifElse(isDev && isClient);
  const ifDevServer = ifElse(isDev && isServer);
  const ifProdClient = ifElse(isProd && isClient);

  const config = configs[process.env.CI ? 'ci' : options.mode];
  const configForClient = _.omit(config, [
    'sessionKeys',
    'db',
    'google',
    'facebook',
    'twitter',
    'openexchangerates',
  ]);

  const reloadPath = `http://localhost:${config.devPort}/__webpack_hmr`;

  return {
    target: ifServer('node', 'web'),
    node: {
      __dirname: true,
      __filename: true,
    },
    externals: _.compact([ifServer(nodeExternals())]),
    devtool: ifElse(isServer || isDev)(
      'source-map',
      'hidden-source-map'
    ),
    entry: _.merge(
      ifClient({
        vendor: [
          'reselect',
          'seamless-immutable',
          'axios',
          'history',
          'moment',
          'money',
        ],
      }),
      {
        main: _.compact([
          ifDevClient('react-hot-loader/patch'),
          ifDevClient(`webpack-hot-middleware/client?reload=true&path=${reloadPath}`),
          ifClient('react-select/dist/react-select.css'),
          ifClient('react-toggle/style.css'),
          ifClient('./src/client/globals-css/semantic.css'),
          ifClient('./src/client/globals-css/bootstrap.css'),
          ifClient('./src/client/globals-css/select.css'),
          ifClient('./src/client/globals-css/toggle.css'),
          ifClient('./src/client/globals-css/app.css'),
          ifClient('webfontloader'),
          ifServer(
            path.resolve(__dirname, `../src/${target}/bootstrap.js`),
            path.resolve(__dirname, `../src/${target}/app.js`)
          ),
        ]),
      }
    ),
    output: {
      path: path.resolve(__dirname, `../build/${target}`),
      filename: ifProdClient(
        '[name]-[hash].js',
        '[name].js'
      ),
      publicPath: ifDev(
        `http://localhost:${config.devPort}/assets/`,
        '/assets/'
      ),
      chunkFilename: '[name]-[chunkhash].js',
      libraryTarget: ifServer('commonjs2', 'var'),
    },
    resolve: {
      extensions: ['.js', '.json'],
      alias: {
        react: ifElse(isDev)('react', 'react-lite'),
        'react/lib/ReactDOM': 'react-dom', // redbox-react fix
        'react-dom': ifElse(isDev)('react-dom', 'react-lite'),
      },
    },
    plugins: _.compact([
      new webpack.LoaderOptionsPlugin({
        options: {
          postcss: () => _.compact([
            stylelint(),
            rucksack(),
            flexbox(),
            cssnext(),
            mqpacker(),
            postcssReporter({ clearMessages: true }),
          ]),
          eslint: {
            configFile: '.eslintrc',
          },
        },
      }),
      new ProgressBarPlugin({ stream: logStream }),
      ifClient(new LodashModuleReplacementPlugin({
        collections: true,
        paths: true,
      })),
      new webpack.ContextReplacementPlugin(/moment[\\\/]locale$/, /^\.\/(en|ru)$/),
      new webpack.DefinePlugin({
        CONFIG: JSON.stringify(ifServer(config, configForClient)),
        IS_CLIENT: isClient,
        IS_SERVER: isServer,
        'process.env': {
          NODE_ENV: JSON.stringify(options.mode),
          SERVER_PORT: JSON.stringify(config.port),
          DEBUG: JSON.stringify(options.debug || ''),
          CI: JSON.stringify(process.env.CI || ''),
        },
      }),
      ifClient(new AssetsPlugin({
        filename: 'assets.json',
        path: path.resolve(__dirname, `../build/${target}`),
      })),
      ifClient(new webpack.optimize.CommonsChunkPlugin({
        name: 'vendor',
        children: true,
        minChunks: 2,
      })),
      ifClient(new Visualizer({ filename: '../client-stats.html' })),
      ifServer(new Visualizer({ filename: '../server-stats.html' })),
      ifDev(new webpack.NoErrorsPlugin()),
      ifDevClient(new webpack.HotModuleReplacementPlugin()),
      ifDevServer(new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })),
      ifProdClient(
        new webpack.LoaderOptionsPlugin({
          minimize: true,
          debug: false,
        })
      ),
      ifProdClient(
        new webpack.optimize.UglifyJsPlugin({
          compress: {
            screw_ie8: true,
            warnings: false,
          },
        })
      ),
      ifProd(new webpack.optimize.DedupePlugin()),
      ifClient(
        new ExtractTextPlugin({
          filename: '[name]-[chunkhash].css',
          disable: false,
          allChunks: true,
        })
      ),
    ]),
    module: {
      rules: _.compact([
        {
          enforce: 'pre',
          test: /\.js$/,
          exclude: [/node_modules/, path.resolve(__dirname, '../build')],
          loader: 'eslint',
        },
        {
          test: /\.pem$/,
          exclude: [/node_modules/, path.resolve(__dirname, '../build')],
          loader: 'raw-loader',
        },
        {
          test: /\.(jpg|png|svg)$/,
          exclude: [/node_modules/, path.resolve(__dirname, '../build')],
          loader: 'url?limit=100000',
        },
        {
          test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: 'url-loader?limit=10000&mimetype=application/font-woff',
        },
        {
          test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
          loader: 'file-loader',
        },
        {
          test: /\.json$/,
          exclude: /node_modules/,
          loader: 'json-loader',
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          exclude: [/node_modules/, path.resolve(__dirname, '../build')],
          query: _.merge(
            {
              cacheDirectory: false,
              babelrc: false,
              env: {
                development: {
                  plugins: ['react-hot-loader/babel'],
                },
              },
              plugins: [
                'lodash',
                'transform-promise-to-bluebird',
                [
                  'transform-runtime',
                  {
                    polyfill: true,
                    regenerator: true,
                  },
                ],
              ],
            },
            ifServer({ presets: ['react', 'es2016', 'es2017', 'stage-1'] }),
            ifClient({ presets: ['react', 'latest', 'stage-1'] })
          ),
        },
        _.merge(
          { test: /(globals-css|react-select|react-toggle|rc-tree).+\.css$/ },
          ifClient({
            loader: ExtractTextPlugin.extract({
              fallbackLoader: 'style-loader',
              loader: 'css-loader',
            }),
          })
        ),
        _.merge(
          { test: /shared.+\.css$/ },
          ifServer({ loader: ['css-loader/locals?modules', 'postcss-loader'] }),
          ifClient({
            loader: ExtractTextPlugin.extract({
              fallbackLoader: 'style-loader',
              loader: 'css-loader?modules!postcss-loader',
            }),
          })
        ),
      ]),
    },
  };
};

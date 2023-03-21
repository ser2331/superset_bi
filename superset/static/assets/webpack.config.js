const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const { UnusedFilesWebpackPlugin } = require('unused-files-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const parsedArgs = require('yargs').argv;
const getProxyConfig = require('./webpack.proxy-config');
const FilterWarningsPlugin = require('webpack-filter-warnings-plugin');

const os = require('os');

const cpuCount = Math.round(os.cpus().length - 1) || 1;

// input dir
const APP_DIR = path.resolve(__dirname, './');
// output dir
const BUILD_DIR = path.resolve(__dirname, './dist');

const {
    mode = 'development',
    devserverPort = 9000,
    measure = false,
    analyzeBundle = false,
    analyzerPort = 8888,
    nameChunks = false,
} = parsedArgs;

const isDevMode = mode !== 'production';

const output = {
    path: BUILD_DIR,
    publicPath: '/static/assets/dist/', // necessary for lazy-loaded chunks
};

if (isDevMode) {
    output.filename = '[name].[hash:8].entry.js';
    output.chunkFilename = '[name].[hash:8].chunk.js';
} else if (nameChunks) {
    output.filename = '[name].[chunkhash].entry.js';
    output.chunkFilename = '[name].[chunkhash].chunk.js';
} else {
    output.filename = '[name].[chunkhash].entry.js';
    output.chunkFilename = '[chunkhash].chunk.js';
}

const plugins = [
    // creates a manifest.json mapping of name to hashed output used in template files
    new ManifestPlugin({
        publicPath: output.publicPath,
        seed: { app: 'superset' },
        // This enables us to include all relevant files for an entry
        generate: (seed, files, entrypoints) => {
            // Each entrypoint's chunk files in the format of
            // {
            //   entry: {
            //     css: [],
            //     js: []
            //   }
            // }
            const entryFiles = {};
            Object.entries(entrypoints)
                .forEach(([entry, chunks]) => {
                    entryFiles[entry] = {
                        css: chunks
                            .filter(x => x.endsWith('.css'))
                            .map(x => path.join(output.publicPath, x)),
                        js: chunks
                            .filter(x => x.endsWith('.js'))
                            .map(x => path.join(output.publicPath, x)),
                    };
                });

            return {
                ...seed,
                entrypoints: entryFiles,
            };
        },
        // Also write to disk when using devServer
        // instead of only keeping manifest.json in memory
        // This is required to make devServer work with flask.
        writeToFileEmit: isDevMode,
    }),

    // create fresh dist/ upon build
    new CleanWebpackPlugin({
        dry: false,
        // required because the build directory is outside the frontend directory:
        dangerouslyAllowCleanPatternsOutsideProject: true,
    }),

    // expose mode variable to other modules
    new webpack.DefinePlugin({
        'process.env.WEBPACK_MODE': JSON.stringify(mode),
    }),

    new CopyPlugin({
        patterns: [
            'package.json',
            { from: 'images', to: 'images' },
            { from: 'stylesheets', to: 'stylesheets' },
        ],
    }),
    new UnusedFilesWebpackPlugin(),
];
if (!process.env.CI) {
    plugins.push(new webpack.ProgressPlugin());
}

plugins.push(
    new FilterWarningsPlugin({
        exclude: /mini-css-extract-plugin[^]*Conflicting order between:/,
    }),
);

// text loading (webpack 4+)
plugins.push(
    new MiniCssExtractPlugin({
        filename: '[name].[chunkhash].entry.css',
        chunkFilename: '[name].[chunkhash].chunk.css',
    }),
);

plugins.push(
    new webpack.ProvidePlugin({
            $: 'jquery',
            jQuery: 'jquery',
    }),
);

const PREAMBLE = ['babel-polyfill'];

function addPreamble(entry) {
    return PREAMBLE.concat([path.join(APP_DIR, entry)]);
}

const config = {
    node: {
        fs: 'empty',
    },
    entry: {
        sliceview: path.join(APP_DIR, '/javascripts/sliceview/index.js'),
        theme: path.join(APP_DIR, '/javascripts/theme.js'),
        common: path.join(APP_DIR, '/javascripts/common.js'),
        addSlice: addPreamble('/javascripts/addSlice/index.tsx'),
        explore: addPreamble('/javascripts/explore/index.jsx'),
        dashboard: addPreamble('/javascripts/dashboard/index.jsx'),
        sqllab: addPreamble('/javascripts/SqlLab/index.jsx'),
        welcome: addPreamble('/javascripts/welcome/index.jsx'),
        profile: addPreamble('/javascripts/profile/index.jsx'),
    },
    output,
    stats: 'minimal',
    performance: {
        assetFilter(assetFilename) {
            // don't throw size limit warning on geojson and font files
            return !/\.(map|geojson|woff2)$/.test(assetFilename);
        },
    },
    optimization: {
        minimize: !isDevMode,
        minimizer: [
            // This is only used in production mode
            new TerserPlugin({
                cache: false,
                parallel: cpuCount,
                terserOptions: {
                    ecma: 5,
                    compress: {
                        // turn off flags with small gains to speed up minification
                        arrows: false,
                        collapse_vars: false, // 0.3kb
                        comparisons: false,
                        computed_props: false,
                        hoist_funs: false,
                        hoist_props: false,
                        hoist_vars: false,
                        loops: false,
                        negate_iife: false,
                        properties: false,
                        reduce_funcs: false,
                        reduce_vars: false,
                        switches: false,
                        toplevel: false,
                        typeofs: false,

                        // a few flags with noticeable gains/speed ratio
                        // numbers based on out of the box vendor bundle
                        booleans: true, // 0.7kb
                        if_return: true, // 0.4kb
                        sequences: true, // 0.7kb
                        unused: true, // 2.3kb

                        // required features to drop conditional branches
                        conditionals: true,
                        dead_code: true,
                        evaluate: true,
                        inline: 2,
                    },
                    mangle: {
                        safari10: true,
                    },
                    output: {
                        comments: false,
                        ascii_only: true,
                    },
                },
                sourceMap: isDevMode,
            }),
            new OptimizeCSSAssetsPlugin({
                cssProcessorOptions: {
                    preset: ['default', { minifyFontValues: { removeQuotes: false } }],
                    parser: safePostCssParser,
                    map: isDevMode
                        ? {
                            inline: false,
                            annotation: true,
                        }
                        : false,
                },
            }),
        ],
        sideEffects: true,
        splitChunks: {
            chunks: 'all',
            name: nameChunks,
        },
        runtimeChunk: {
            name: entrypoint => `runtime-${entrypoint.name}`,
        },
        removeAvailableModules: true,
        removeEmptyChunks: true,
        mergeDuplicateChunks: true,
    },
    resolve: {
        modules: [APP_DIR, 'node_modules'],
        alias: {
            src: path.resolve(APP_DIR, './javascripts'),
            jquery: require.resolve('jquery'),
        },
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        symlinks: false,
    },
    context: APP_DIR,
    module: {
        // Uglifying mapbox-gl results in undefined errors, see
        // https://github.com/mapbox/mapbox-gl-js/issues/4359#issuecomment-288001933
        noParse: /(mapbox-gl)\.js$/,
        rules: [
            {
                test: /datatables\.net.*/,
                use: [
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                    'imports-loader?define=>false',
                ],
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                include: APP_DIR,
                use: [
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                    'ts-loader',
                ],
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                include: APP_DIR,
                use: [
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                    'babel-loader',
                ],
            },
            {
                test: /\.css$/,
                include: APP_DIR,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: isDevMode,
                        },
                    },
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                ],
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    process.env.NODE_ENV !== "production"
                        ? "style-loader"
                        : MiniCssExtractPlugin.loader,
                    "css-loader",
                    "sass-loader",
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                ],
            },
            {
                test: /\.less$/,
                include: APP_DIR,
                use: [
                    MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: isDevMode,
                        },
                    },
                    {
                        loader: 'less-loader',
                        options: {
                            sourceMap: isDevMode,
                            javascriptEnabled: true,
                        },
                    },
                    {
                        loader: 'cache-loader',
                        options: {
                            cacheDirectory: path.resolve(
                                __dirname,
                                'node_modules/.cache/cache-loader',
                            ),
                        },
                    },
                ],
            },
            /* for css linking images (and viz plugin thumbnails) */
            {
                test: /\.png$/,
                loader: 'url-loader',
                options: {
                    limit: 10000,
                    name: '[name].[hash:8].[ext]',
                },
            },
            {
                test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
                issuer: {
                    test: /\.(j|t)sx?$/,
                },
                use: ['@svgr/webpack'],
            },
            {
                test: /\.(jpg|gif)$/,
                loader: 'file-loader',
                options: {
                    name: '[name].[hash:8].[ext]',
                },
            },
            /* for font-awesome */
            {
                test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'url-loader?limit=10000&mimetype=application/font-woff',
            },
            {
                test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
                loader: 'file-loader',
                options: {
                    esModule: false,
                },
            },
        ],
    },
    externals: {
        cheerio: 'window',
        'react/lib/ExecutionEnvironment': true,
        'react/lib/ReactContext': true,
    },
    plugins,
    devtool: false,
};

let proxyConfig = getProxyConfig();

if (isDevMode) {
    config.devtool = 'eval-cheap-module-source-map';
    config.devServer = {
        before(app, server, compiler) {
            // load proxy config when manifest updates
            const hook = compiler.hooks.webpackManifestPluginAfterEmit;
            hook.tap('ManifestPlugin', (manifest) => {
                proxyConfig = getProxyConfig(manifest);
            });
        },
        stats: {
            colors: true,
            hash: false,
            timings: true,
            assets: false,
            chunks: false,
            chunkModules: false,
            modules: false,
            children: false,
            entrypoints: false,
        },
        historyApiFallback: true,
        hot: true,
        index: '',
        inline: true,
        overlay: true,
        injectHot: true,
        port: devserverPort,
        // Only serves bundled files from webpack-dev-server
        // and proxy everything else to Superset backend
        proxy: [
            // functions are called for every request
            () => proxyConfig,
        ],
        contentBase: path.join(process.cwd(), '../static/assets/dist'),
    };
}

// Bundle analyzer is disabled by default
// Pass flag --analyzeBundle=true to enable
// e.g. npm run build -- --analyzeBundle=true
if (analyzeBundle) {
    config.plugins.push(new BundleAnalyzerPlugin({ analyzerPort }));
}
// Speed measurement is disabled by default
// Pass flag --measure=true to enable
// e.g. npm run build -- --measure=true
const smp = new SpeedMeasurePlugin({
    disable: !measure,
});

module.exports = smp.wrap(config);

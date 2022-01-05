module.exports = function override(config, env) {
    // config.output.filename = 'static/js/[hash].bundle.js';
    config.module.rules.push({
        test: /\.worker\.js$/,
        loader: "worker-loader",
        options: {
            filename: '[name].worker.js'
            // filename: (pathData) => {
            //     // if (/\.worker\.(c|m)?js$/i.test(pathData.chunk.entryModule.resource)) {
            //     //     return "[name].worker.js";
            //     // }

            //     return "[name].js";
            // },
        },
    });
    return config;
};

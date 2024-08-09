var path = require('path');
var sgmfScripts = require('sgmf-scripts');
var ExtractTextPlugin = require('sgmf-scripts')['extract-text-webpack-plugin'];

module.exports = [{
    mode: 'production',
    name: 'js',
    entry: sgmfScripts.createJsPath(),
    output: {
        path: path.resolve('./cartridges/int_novalnet_sfra/cartridge/static/'),
        filename: '[name].js'
    }
}];

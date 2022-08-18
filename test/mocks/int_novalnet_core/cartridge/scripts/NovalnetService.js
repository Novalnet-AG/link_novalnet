const sandboxedModule = require('sandboxed-module');
module.exports = sandboxedModule.load('../../../../../cartridges/int_novalnet_core/cartridge/scripts/novalnetService', {
    requires: {
        'dw/svc/LocalServiceRegistry': require('../../../dw-mocks/dw/svc/LocalServiceRegistry'),
        'dw/util/StringUtils': require('../../../dw-mocks/dw/util/StringUtils'),
        '*/cartridge/scripts/novalnetConfig': require('../../../int_novalnet_core/cartridge/scripts/novalnetConfig')
    },
    singleOnly: true
});

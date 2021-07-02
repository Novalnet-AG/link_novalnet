/* eslint-disable no-unused-expressions */

const { expect, assert } = require('chai');
const novalnetService = require('../mocks/int_novalnet_core/cartridge/scripts/NovalnetService');
const LocalServiceRegistry = require('../mocks/dw-mocks/dw/svc/LocalServiceRegistry');

describe('Novalnet Service', () => {
    describe('service creation', () => {
        it('Should create a configuration for the Novalnet service', () => {
            assert.equal(novalnetService.exports.getNovalnetService().serviceId, 'novalnet.http.service');
        });
    });

    describe('createRequest', ()=> {
        it('Should prepare the request method and parameters with response', () => {
            const svc = {
                requestMethod: null,
                params: {},
                headers: {},
                configuration: {
                    credential: { URL: 'someUrl' }
                },
                getURL() {
                    return this.URL;
                },
                setURL(url) {
                    this.URL = url;
                },
                setRequestMethod(method) {
                    this.requestMethod = method;
                },
                addHeader(name, value) {
                    this.headers[name] = value;
                }
            };
            
            let requestObject = {
                endpoint: 'test',
                httpMethod: 'POST',
                queryString: {
                    x: 123,
                    s: {
                        s1: 1
                    },
                    p: ['q1', 'q2']
                }
            };
            
            let response = novalnetService.exports.getNovalnetService().callback.createRequest(svc, requestObject);
            assert.equal(svc.requestMethod, 'POST');
            assert.equal(svc.URL, this.URL);
            assert.equal(svc.headers['X-NN-Access-Key'], 'paymentAccessKey');
            assert.equal(svc.headers['charset'], 'UTF-8');
            assert.equal(svc.headers['Content-type'], 'application/json');
			assert.deepEqual(svc.params, {});
            assert.equal(response, requestObject);
        });
    });
});

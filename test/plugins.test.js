// Copyright 2012 Mark Cavage, Inc.  All rights reserved.

'use strict';

// external requires
var assert = require('chai').assert;
var restify = require('restify');
var restifyClients = require('restify-clients');

// local files
var plugins = require('../lib');
var helper = require('./lib/helper');

// local globals
var PORT = process.env.UNIT_TEST_PORT || 0;
var CLIENT;
var SERVER;


describe('all other plugins', function () {

    beforeEach(function (done) {
        SERVER = restify.createServer({
            dtrace: helper.dtrace,
            log: helper.getLog('server'),
            version: ['2.0.0', '0.5.4', '1.4.3']
        });

        SERVER.listen(PORT, '127.0.0.1', function () {
            PORT = SERVER.address().port;
            CLIENT = restifyClients.createJsonClient({
                url: 'http://127.0.0.1:' + PORT,
                dtrace: helper.dtrace,
                retry: false
            });

            done();
        });
    });


    afterEach(function (done) {
        CLIENT.close();
        SERVER.close(done);
    });


    describe('date parser', function () {

        it('should reject expired request', function (done) {
            SERVER.use(plugins.dateParser());

            SERVER.get('/', function respond(req, res, next) {
                res.send();
                next();
            });

            var opts = {
                path: '/',
                headers: {
                    date: 'Tue, 15 Nov 1994 08:12:31 GMT'
                }
            };

            CLIENT.get(opts, function (err, _, res) {
                assert.ok(err);
                assert.ok(/Date header .+ is too old/.test(err.message));
                assert.equal(res.statusCode, 400);
                done();
            });
        });
    });

    describe('request logger', function () {

        it('tests the requestLoggers extra header properties', function (done) {
            var key = 'x-request-uuid';
            var badKey = 'x-foo-bar';
            var getPath = '/requestLogger/extraHeaders';
            var headers = [key, badKey];

            SERVER.use(plugins.requestLogger({headers: headers}));
            SERVER.get(getPath, function (req, res, next) {
                assert.equal(req.log.fields[key], 'foo-for-eva');
                assert.equal(req.log.fields.hasOwnProperty(badKey), false);
                res.send();
                next();
            });

            var obj = {
                path: getPath,
                headers: { }
            };
            obj.headers[key] = 'foo-for-eva';
            CLIENT.get(obj, function (err, _, res) {
                assert.equal(res.statusCode, 200);
                assert.ifError(err);
                done();
            });
        });

    });

    describe('full response', function () {

        it('full response', function (done) {
            SERVER.use(plugins.fullResponse());
            SERVER.get('/bar/:id', function tester2(req, res, next) {
                assert.ok(req.params);
                assert.equal(req.params.id, 'bar');
                res.send();
                next();
            });

            CLIENT.get('/bar/bar', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                var headers = res.headers;
                assert.ok(headers, 'headers ok');
                assert.ok(headers.date);
                assert.ok(headers['request-id']);
                assert.ok(headers['response-time'] >= 0);
                assert.equal(headers.server, 'restify');
                assert.equal(headers.connection, 'Keep-Alive');
                assert.equal(headers['api-version'], '2.0.0');
                done();
            });
        });

    });

    describe('context', function () {
        it('set and get request context', function (done) {
            SERVER.pre(plugins.pre.context());

            var asserted = false;
            var expectedData = {
                pink: 'floyd'
            };
            SERVER.get('/context', [
                function (req, res, next) {
                    req.set('pink', 'floyd');
                    return next();
                },
                function (req, res, next) {
                    assert.equal('floyd', req.get('pink'));
                    assert.deepEqual(expectedData, req._getAllContext());
                    asserted = true;
                    res.send(200);
                    return next();
                }
            ]);

            CLIENT.get('/context', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.ok(asserted);
                done();
            });
        });

        it('should throw if set key is not string', function (done) {
            SERVER.pre(plugins.pre.context());

            var asserted = false;

            SERVER.get('/context', [
                function (req, res, next) {
                    try {
                        req.set({}, 'floyd');
                    } catch (e) {
                        asserted = true;
                        res.send(200);
                    }
                    return next();
                }
            ]);

            CLIENT.get('/context', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.ok(asserted);
                done();
            });
        });

        it('should throw if set key is empty string', function (done) {
            SERVER.pre(plugins.pre.context());

            var asserted = false;

            SERVER.get('/context', [
                function (req, res, next) {
                    try {
                        req.set('', 'floyd');
                    } catch (e) {
                        asserted = true;
                        res.send(200);
                    }
                    return next();
                }
            ]);

            CLIENT.get('/context', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.ok(asserted);
                done();
            });
        });

        it('should throw if get key is not string', function (done) {
            SERVER.pre(plugins.pre.context());

            var asserted = false;

            SERVER.get('/context', [
                function (req, res, next) {
                    try {
                        req.get({});
                    } catch (e) {
                        asserted = true;
                        res.send(200);
                    }
                    return next();
                }
            ]);

            CLIENT.get('/context', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.ok(asserted);
                done();
            });
        });

        it('should throw if get key is empty string', function (done) {
            SERVER.pre(plugins.pre.context());

            var asserted = false;

            SERVER.get('/context', [
                function (req, res, next) {
                    try {
                        req.get('');
                    } catch (e) {
                        asserted = true;
                        res.send(200);
                    }
                    return next();
                }
            ]);

            CLIENT.get('/context', function (err, _, res) {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.ok(asserted);
                done();
            });
        });
    });
});

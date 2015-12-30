'use strict';

var express = require('express');
var mongoose = require('mongoose');

/* phantomjs */
var session;
var outputDirectory = './tmp/';

function createPhantomSession(switches, callback) {
    if (session) {
        console.log('phantom session already exists');
        return callback(null, session);
    } else {
        require('phantom').create(switches[0], switches[1], function (_session) {
            console.log('phantom.create ' + switches[0] + ', ' + switches[1]);
            session = _session;
            return callback(null, session);
        }, {
            dnodeOpts: {
                weak: false
            }
        });
    }
}

function renderPdf(session, options, callback) {
    var page = null;

    try {
        session.createPage(function (_page) {

            page = _page;
            _page.set('viewportSize', options.viewportSize, function (result) {
                
                _page.open(options.url, function (status) {
                    
                    if (status === 'success') {
                        setTimeout(function () {
                            var filename = options.outputDirectory + options.fileName;
                            _page.render(filename, function () {

                                _page.close();
                                _page = null;
                                callback(null, filename);
                            });

                        }, options.timeout);

                    } else {
                        _page.close();
                        _page = null;
                        callback();
                    }
                });
            });
        });
    } catch (e) {
        try {
            if (page !== null) {
                page.close();
            }
        } catch (innerException) {
            e.innerException = innerException;
        }
        return callback();
    }
}

/* mongoose */
var database;
var mongodb = 'mongodb://' + (process.env.DB_PORT_27017_TCP_ADDR || 'localhost') + '/helloworld';

function openMongooseConnection(options, callback) {
    if (database) {
        console.log('mongoose connection already open');
        return callback(null, database);
    }
    else {
        mongoose.connect(mongodb, options);
        database = mongoose.connection;
        database.once('open', function () {
            console.log('mongoose.connect ' + JSON.stringify(options));
            return callback(null, database);
        });
    }
}

function saveMongooseModel(model, callback) {
    if (model) {
        model.save(function (error, _model) {
            if (error) {
                return callback(error);
            }

            return callback(null, _model);
        });
    } else {
        return (new Error('invalid mongoose model'));
    }
}

var mongooseSchema = mongoose.Schema({
    name: String
});

var MongooseModel = mongoose.model('Mongoose', mongooseSchema);


/* express */
var app = express();
var port = process.env.port || 1337;

process.on('exit', function (code, signal) {
    session.exit(0);
    database.close();
});

app.get('/', function (req, res) {
    res.send('hello world - express');
});

app.get('/phantomjs', function (req, res) {
    var phantomOptions = ['--ignore-ssl-errors=yes', '--ssl-protocol=any'];
    var reportOptions = {
        viewportSize: {
            width: 1575,
            height: 1650
        },
        url: req.protocol + '://' + req.get('host'),
        fileName: 'helloworld.pdf',
        outputDirectory: outputDirectory,
        timeout: 1000
    };
    
    createPhantomSession(phantomOptions, function (error, _session) {
        if (error) {
            res.send(500, error);
        }
        
        renderPdf(_session, reportOptions, function (renderError, _filename) {
            if (renderError) {
                res.send(500, renderError);
            }
            
            if (!_filename) {
                res.send(404);
            }

            res.download(_filename);
        });
    });
});

app.get('/mongodb', function (req, res) {
    var mongooseOptions = {
    };

    openMongooseConnection(mongooseOptions, function (error, _database) {
        if (error) {
            res.send(500, error);
        }
        
        var model = new MongooseModel({
            name: 'hello world'
        });
        saveMongooseModel(model, function (modelError, _model) {
            if (modelError) {
                res.send(500, modelError);
            }
            
            res.send('hello world - mongodb');
        });
    });
});

var server = app.listen(port, function () {
    var host = server.address().address;
    var port = server.address().port;
    
    console.log('Hello World listening at http://%s:%s', host, port);
});
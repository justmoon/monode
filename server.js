require.paths.unshift(__dirname + "/public/common");

var http = require('http'),
    sys  = require('sys'),
    yaml = require('yaml'),
    fs = require('fs'),
    io = require('socket.io'),
    nodeStatic = require('node-static')
    querystring = require('querystring')
    xml2js = require('xml2js');

var Mondb = require('mondb');

var config = yaml.eval(fs.readFileSync('config.yml').toString());

var database = Mondb.create();

var server = http.createServer(function (request, response) {
	var file = new nodeStatic.Server('./public', {
		cache: false
	});

	// Monit heartbeat collector
	if (request.url.substr(0, 10) == '/collector') {
		request.setEncoding("utf8");

		var content = '';
		request.addListener('data', function (chunk) {
			content += chunk;
		});

		request.addListener('end', function () {
			var parser = new xml2js.Parser();
			parser.addListener('end', function (result) {
				socket.broadcast(JSON.stringify(['heartbeat', result, new Date().getTime()]));
				database.parseHeartbeat(result);
			});
			parser.parseString(content);

			response.writeHead(200, {'Content-Type': 'text/plain'});
			response.end();
		});
	} else {
		request.addListener('end', function () {
			if (request.url == '/config.json' && request.method == "GET") {
				response.writeHead(200, {'Content-Type': 'application/x-javascript'});
				response.write(JSON.stringify(config));
				response.end();
			} else {
				file.serve(request,response);
			}
		});
	}
});

server.listen(config.port);

var socket = io.listen(server);
socket.on('connection', function(client) {
	client.send(JSON.stringify(['initial', database.serialize(), new Date().getTime()]));

	client.on('message', function(message){
	});
	client.on('disconnect', function(){
	});
});


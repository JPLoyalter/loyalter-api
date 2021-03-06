
const restify = require('restify');
const route = require('./api/route/route');
const fs = require('fs');

const HTTPS = process.env.PORT?false:true;
const serverHttpsOpt = {
    key: fs.readFileSync('./key.pem'),
    certificate: fs.readFileSync('./server.crt')
};
const server = restify.createServer(HTTPS?serverHttpsOpt:null);
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.requestLogger());

route.route(server);

const port = process.env.PORT || (HTTPS?443:8080);
server.listen(port, function() {
  console.log('%s listening at %s HTTPS:${HTTPS}', server.name, server.url);
});

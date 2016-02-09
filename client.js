var http = require('http');
var Static = require('node-static');

var fileServer = new Static.Server('.');
http.createServer(function (req, res) {
   
  fileServer.serve(req, res);

}).listen(8080);
 console.log("Client is runing !");
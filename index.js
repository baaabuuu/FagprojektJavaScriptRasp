/* 
Fagprojekt Netværksteknologi og IT
Author Emil Haugaard s164154 DTU
*/

var bleno = require('bleno');
var util = require('util');
var net = require('net');

var user;
var sendingMessage = {'request':'', 'username':'','password':'','setting':'','value':'','date':''};


var date;
var callbackIndicator;
var callback1;
var callback2;
var access = false;
var buf;
var callbackBuffer;

var settings = {
    service_id: '12ab',
    sendLoginInformation_id: 'D001',
    login_id: 'D002',
    getData_id: 'D003',
    getRest_id: 'D004',
    setDate_id: 'D005',
    getErrors_id: 'D006',
    setSetting_id: 'D007',
    update_id: 'D008'
};

var client = new net.Socket();

client.connect(2020, '127.0.0.1', function() {
	console.log('Connected');
});

client.on('data', function(data) {
    console.log('Received: ' + String(data));
    console.log(typeof data);
    if(callbackIndicator === 1){
	if(new String(data).trim() == new String("ACK").trim()){
	    callback1(bleno.Characteristic.RESULT_SUCCESS);
	} else if (new String(data).trim() == new String("LOGINOK").trim()){
	    access = true;
	    callback1(bleno.Characteristic.RESULT_SUCCESS);
	}
	else {
	    access = false;
	    callback1(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
	}
    } else if (callbackIndicator == 2) {
	if(data.length < 100){
	    buf = onReadRequestFunction('0'+String(data));
	    console.log("####"+String(data));
	    callback2(bleno.Characteristic.RESULT_SUCCESS,buf);
	}
	else{
	    buf = onReadRequestFunction('1'+String(data).substring(0,100));
	    console.log("####"+String(data).substring(0,100));
	    callbackBuffer = String(data).substring(100);
	    callback2(bleno.Characteristic.RESULT_SUCCESS,buf);
	}
    } else {
	// Test Scenario
	testData = '{"FPS":"55","MOD":"0","SYN":"yes","BER":"44","UTI":"nan","warning":"test"}';
	if(testData.length < 100){
	    buf = onReadRequestFunction(testData);
	    console.log("####"+testData);
	    callback2(bleno.Characteristic.RESULT_SUCCESS,buf);
	}
	else{
	    buf = onReadRequestFunction('1'+testData.substring(0,100));
	    callbackBuffer = testData.substring(100);
	    console.log("####"+testData.substring(0,100));
	    callback2(bleno.Characteristic.RESULT_SUCCESS,buf);
	}
    }
});

client.on('close', function() {
	console.log('Connection closed');
});

function writeToSystem(message){
    client.write(message + ' \n');
}


bleno.on('stateChange', function(state){
    if(state === 'poweredOn'){
	bleno.startAdvertising('FagProjektApp',['12ab']);
	console.log('Start listen');
    }else{
	bleno.stopAdvertising();
    }
});

bleno.on('advertisingStart', function(error){
    if(error){
	console.log('Error');
    }else{
	console.log('started..');
	bleno.setServices([
	    new bleno.PrimaryService({
		uuid : settings.service_id,
		characteristics : [
		    new bleno.Characteristic({
			value : null,
			uuid : settings.sendLoginInformation_id,
			properties : ['read','write','notify'],
			onWriteRequest : sendInformationFunction
		    }),
		    new bleno.Characteristic({
			value : null,
			uuid : settings.login_id,
			properties : ['read','write'],
			onReadRequest : function(offset,callback){
			    if (access == true){
				buf = onReadRequestFunction("OK");
				access = false;
				callback(bleno.Characteristic.RESULT_SUCCESS,buf);
			    }else{
				buf = onReadRequestFunction("NO");
				callback(bleno.Characteristic.RESULT_SUCCESS,buf);
			    }
			   
			}
		    }),
		     new bleno.Characteristic({
			value : null,
			uuid : settings.getData_id,
			properties : ['read','write'],
			onReadRequest : getDataFunction
		     }),
		    new bleno.Characteristic({
			value : null,
			uuid : settings.getRest_id,
			properties : ['read','write'],
			onReadRequest : function(offset, callback){
			    if(callbackBuffer.length > 100){
				var sendBack = onReadRequestFunction('1'+callbackBuffer.substring(0,100));
				console.log('!!!!!1'+callbackBuffer.substring(0,100));
				callbackBuffer = callbackBuffer.substring(100);
				callback(bleno.Characteristic.RESULT_SUCCESS,sendBack);
			    }
			    else {
				var sendBack = onReadRequestFunction('0'+callbackBuffer.substring(0));
				console.log('!!!!!2'+callbackBuffer.substring(0));
				callback(bleno.Characteristic.RESULT_SUCCESS,sendBack);
			    }
			}
		    }),
		    new bleno.Characteristic({
			value: null,
			uuid: settings.setDate_id,
			properties : ['read','write'],
			onWriteRequest : function(data, offset, withoutResponse, callback){
			    console.log(ArrayBufferToString(data));
			    var jsons = JSON.parse(ArrayBufferToString(data));
			    date = jsons.date;
			    console.log(date);
			    callback(bleno.Characteristic.RESULT_SUCCESS);
			}
		    }),
		    new bleno.Characteristic({
			value: null,
			uuid : settings.getErrors_id,
			properties : ['read','write'],
			onReadRequest : function(offset,callback){
			    sendingMessage.request = "getErrors";
			    sendingMessage.date = date;
			    console.log(sendingMessage);
			    writeToSystem(JSON.stringify(sendingMessage));
			    callbackIndicator = 2;
			    callback2 = callback;
			}
		    }),
		    new bleno.Characteristic({
			value: null,
			uuid : settings.setSetting_id,
			properties : ['read','write'],
			onWriteRequest : sendInformationFunction
		    }),
		    new bleno.Characteristic({
			value: null,
			uuid : settings.update_id,
			properties : ['read','write'],
			onReadRequest : function(offset,callback){
			    sendingMessage.request = "setSetting";
			    writeToSystem(JSON.stringify(sendingMessage));
			    // callbckIndicator = 2;
			    callbackIndicator = 10000;
			    callback2 = callback;
			}
		    })
		]
	    })
	])
    }
});


function sendInformationFunction(data, offset, withoutResponse, callback){
    console.log(ArrayBufferToString(data));
    writeToSystem(data);
    callbackIndicator = 1;
    callback1 = callback;
}

function getDataFunction(offset,callback){
    sendingMessage.request = "getData";
    console.log(sendingMessage);
    writeToSystem(JSON.stringify(sendingMessage));
    callbackIndicator = 2;
    callback2 = callback;
    
}

function onReadRequestFunction(input){
    var str = input;
    buf = Buffer.allocUnsafe(str.length);

    for (let i = 0; i < str.length; i++) {
	buf[i] = str.charCodeAt(i);
    }
    return buf;
}

function ArrayBufferToString(buffer) {
    return BinaryToString(String.fromCharCode.apply(null, Array.prototype.slice.apply(new Uint8Array(buffer))));
}

function StringToArrayBuffer(string) {
    return StringToUint8Array(string).buffer;
}

function BinaryToString(binary) {
    var error;

    try {
	return decodeURIComponent(escape(binary));
    } catch (_error) {
	error = _error;
        if (error instanceof URIError) {
            return binary;
        } else {
            throw error;
        }
    }
}

function StringToBinary(string) {
    var chars, code, i, isUCS2, len, _i;

    len = string.length;
    chars = [];
    isUCS2 = false;
    for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
	code = String.prototype.charCodeAt.call(string, i);
        if (code > 255) {
	    isUCS2 = true;
            chars = null;
            break;
        } else {
            chars.push(code);
        }
    }
    if (isUCS2 === true) {
	return unescape(encodeURIComponent(string));
    } else {
        return String.fromCharCode.apply(null, Array.prototype.slice.apply(chars));
    }
}

function StringToUint8Array(string) {
    var binary, binLen, buffer, chars, i, _i;
    binary = StringToBinary(string);
    binLen = binary.length;
    buffer = new ArrayBuffer(binLen);
    chars  = new Uint8Array(buffer);
    for (i = _i = 0; 0 <= binLen ? _i < binLen : _i > binLen; i = 0 <= binLen ? ++_i : --_i) {
	chars[i] = String.prototype.charCodeAt.call(binary, i);
    }
    return chars;
}

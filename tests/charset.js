
test("Encode UTF-8 to ArrayBuffer", function(){
    var str = "신",
        encoded = new Uint8Array([0xEC, 0x8B, 0xA0]);

    deepEqual(encoded, mimefuncs.charset.encode(str));
});

test("Decode utf-8 arraybuffer", function(){
    var str = "신",
        encoded = new Uint8Array([0xEC, 0x8B, 0xA0]);

    deepEqual(str, mimefuncs.charset.decode(encoded));
});

test("Decode non utf-8 arraybuffer", function(){
    var str = "신",
        encoding = "ks_c_5601-1987",
        encoded = new Uint8Array([0xBD, 0xC5]);

    deepEqual(str, mimefuncs.charset.decode(encoded,encoding));
});

test("Convert non utf-8 to arraybuffer", function(){
    var converted = new Uint8Array([0xEC, 0x8B, 0xA0]),
        encoding = "ks_c_5601-1987",
        encoded = new Uint8Array([0xBD, 0xC5]);

    deepEqual(converted, mimefuncs.charset.convert(encoded, encoding));
});

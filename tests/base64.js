
test("Convert UTF-8 string to base64", function(){
    var str = "abc123ÕÄÖÜŠŽ신",
        b64 = "YWJjMTIzw5XDhMOWw5zFoMW97Iug";

    equal(b64, mimefuncs.base64.encode(str));
});

test("Convert Uint8Array to Base64", function(){
    var buf = new Uint8Array([0x61, 0x62, 0x63, 0x31, 0x32, 0x33, 0xc3, 0x95, 0xc3, 0x84, 0xc3, 0x96, 0xc3, 0x9c, 0xc5, 0xa0, 0xc5, 0xbd, 0xec, 0x8b, 0xa0]),
        b64 = "YWJjMTIzw5XDhMOWw5zFoMW97Iug";
    equal(b64, mimefuncs.base64.encode(buf));
});

test("Convert base64 to UTF-8 string", function(test){
    var str = "abc123ÕÄÖÜŠŽ신",
        b64 = "YWJjMTIzw5XDhMOWw5zFoMW97Iug";

    equal(str, mimefuncs.base64.decode(b64, "string"));
});

test("Convert base64 to Uint8Array", function(test){
    var buf = new Uint8Array([0x61, 0x62, 0x63, 0x31, 0x32, 0x33, 0xc3, 0x95, 0xc3, 0x84, 0xc3, 0x96, 0xc3, 0x9c, 0xc5, 0xa0, 0xc5, 0xbd, 0xec, 0x8b, 0xa0]),
        b64 = "YWJjMTIzw5XDhMOWw5zFoMW97Iug";

    deepEqual(buf, mimefuncs.base64.decode(b64, "arraybuffer"));
});

test("Convert base64 to Uint8Array, default outputEncoding", function(test){
    var buf = new Uint8Array([0x61, 0x62, 0x63, 0x31, 0x32, 0x33, 0xc3, 0x95, 0xc3, 0x84, 0xc3, 0x96, 0xc3, 0x9c, 0xc5, 0xa0, 0xc5, 0xbd, 0xec, 0x8b, 0xa0]),
        b64 = "YWJjMTIzw5XDhMOWw5zFoMW97Iug";

    deepEqual(buf, mimefuncs.base64.decode(b64));
});

test("Convert base64 with spaces to UTF-8 string", function(test){
    var str = "abc123ÕÄÖÜŠŽ신",
        b64 = " Y W J j M T     \nI z w 5 X D hM O W w 5 z F o M W 9 7 I ug";

    equal(str, mimefuncs.base64.decode(b64, "string"));
});

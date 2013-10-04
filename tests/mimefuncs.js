
test("mimeEncode UTF-8", function(){
    var str = "tere ÕÄÖÕ",
        encodedStr = "tere =C3=95=C3=84=C3=96=C3=95";

    equal(mimefuncs.mimeEncode(str), encodedStr);
});

test("mimeEncode non UTF-8", function(){
    var buf = new Uint8Array([0xBD, 0xC5]),
        encoding = "ks_c_5601-1987",
        encodedStr = "=EC=8B=A0";

    equal(mimefuncs.mimeEncode(buf, encoding), encodedStr);
});

test("mimeDecode UTF-8", function(){
    var str = "tere ÕÄÖÕ",
        encodedStr = "tere =C3=95=C3=84=C3=96=C3=95";

    equal(mimefuncs.mimeDecode(encodedStr), str);
});

test("mimeDecode non UTF-8", function(){
    var str = "신",
        encoding = "ks_c_5601-1987",
        encodedStr = "=BD=C5";

    equal(mimefuncs.mimeDecode(encodedStr, encoding), str);
});

test("base64Encode UTF-8", function(){
    var str = "tere ÕÄÖÕ",
        encodedStr = "dGVyZSDDlcOEw5bDlQ==";

    equal(mimefuncs.base64Encode(str), encodedStr);
});

test("base64Encode non UTF-8", function(){
    var buf = new Uint8Array([0xBD, 0xC5]),
        encoding = "ks_c_5601-1987",
        encodedStr = "7Iug";

    equal(mimefuncs.base64Encode(buf, encoding), encodedStr);
});

test("base64Decode UTF-8", function(){
    var str = "tere ÕÄÖÕ",
        encodedStr = "dGVyZSDDlcOEw5bDlQ==";

    equal(mimefuncs.base64Decode(encodedStr), str);
});

test("base64Decode non UTF-8", function(){
    var str = "신",
        encoding = "ks_c_5601-1987",
        encodedStr = "vcU=";

    equal(mimefuncs.base64Decode(encodedStr, encoding), str);
});

test("quotedPrintableEncode UTF-8", function(){
    var str = "tere ÕÄ \t\nÕÄ \t\nÖÕ",
        encodedStr = "tere =C3=95=C3=84=20=09\r\n=C3=95=C3=84=20=09\r\n=C3=96=C3=95";

    equal(mimefuncs.quotedPrintableEncode(str), encodedStr);
});

test("quotedPrintableDecode UTF-8", function(){
    var str = "tere ÕÄ \t\r\nÕÄ \t\r\nÖÕ",
        encodedStr = "tere =C3=95=C3=84=20=09\r\n=C3=95=\r\n=C3=84=\r\n=20=09\r\n=C3=96=C3=95=";

    equal(mimefuncs.quotedPrintableDecode(encodedStr), str);
});

test("quotedPrintableEncode add soft line breaks", function(){
    var str = "õäöüõäöüõäöüõäöüõäöüõäöüõäöõ",
        encodedStr = "=C3=B5=C3=A4=C3=B6=C3=BC=C3=B5=C3=A4=C3=B6=C3=BC=C3=B5=C3=A4=C3=B6=C3=BC=\r\n"+
                     "=C3=B5=C3=A4=C3=B6=C3=BC=C3=B5=C3=A4=C3=B6=C3=BC=C3=B5=C3=A4=C3=B6=C3=BC=\r\n"+
                     "=C3=B5=C3=A4=C3=B6=C3=B5";

    equal(mimefuncs.quotedPrintableEncode(str), encodedStr);
});

test("Encode short string", function(){
    equal("Tere =C3=95=C3=84=C3=96=C3=9C!", mimefuncs.quotedPrintableEncode(new Uint8Array([0x54,0x65,0x72,0x65,0x20,0xD5,0xC4,0xD6,0xDC,0x21]), "Latin_1"));
    equal("Tere =C3=95=C3=84=C3=96=C3=9C=C5=A0=C5=BD!", mimefuncs.quotedPrintableEncode("Tere ÕÄÖÜŠŽ!"));
    equal("Tere =C5=A0=C5=BD!", mimefuncs.quotedPrintableEncode(new Uint8Array([0x54,0x65,0x72,0x65,0x20,0xD0,0xDE,0x21]), "Win-1257"));
});

test("Don't wrap between encoded chars", function(){
    var wrapped = "a__________________________",
        wrappedEncoded = "a=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=5F=\r\n=5F=5F";
    equal(wrappedEncoded, mimefuncs.quotedPrintableEncode(wrapped));
});

test("Encode long string", function(){
    var longLine = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        longLineEncoded = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLM=\r\n"+
                          "NOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ=\r\n"+
                          "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm=\r\n"+
                          "nopqrstuvwxyz0123456789";

    equal(longLineEncoded, mimefuncs.quotedPrintableEncode(longLine));
});

test("Quote at line edge", function(){
    var str = 'Title: <a href="http://www.elezea.com/2012/09/iphone-5-local-maximum/">The future of e-commerce is storytelling</a> <br>',
        strEncoded = "Title: <a href=3D=22http://www.elezea.com/2012/09/iphone-5-local-maximum/=\r\n=22>The future of e-commerce is storytelling</a> =\r\n<br>";
    equal(strEncoded, mimefuncs.quotedPrintableEncode(str));
});

test("Wordwrap long string with UTF-8 sequence on edge", function(){
    var longLine = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIÄÄÄPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        longLineEncoded = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI=\r\n"+
                          "=C3=84=C3=84=C3=84PQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ=\r\n"+
                          "KLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVW=\r\n"+
                          "XYZabcdefghijklmnopqrstuvwxyz0123456789";
    equal(longLineEncoded, mimefuncs.quotedPrintableEncode(longLine));
});

test("Decode string", function(){
    var longLine = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIÄÄÄPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"+
                   "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        longLineEncoded = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHI=\r\n"+
                          "=C3=84=C3=84=C3=84PQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ=\r\n"+
                          "KLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVW=\r\n"+
                          "XYZabcdefghijklmnopqrstuvwxyz0123456789";

    equal(longLine, mimefuncs.quotedPrintableDecode(longLineEncoded));
});

test("Decode string with soft linebreaks", function(){
    var input = "Tere =\r\nvana kere=",
        output = "Tere vana kere";

    equal(output, mimefuncs.quotedPrintableDecode(input));
});

test("Surrogate pair", function(){
    // 💩 pile of poo
    equal("=F0=9F=92=A9", mimefuncs.quotedPrintableEncode('\ud83d\udca9'));
    equal("\ud83d\udca9", mimefuncs.quotedPrintableDecode('=F0=9F=92=A9'));
});

test("Encode Mime Word QP", function(){
    equal("=?UTF-8?Q?J=C3=B5ge-va=C5=BD?=",
        mimefuncs.mimeWordEncode(new Uint8Array([0x4A,0xF5,0x67,0x65,0x2D,0x76,0x61,0xDE]), "Q", "iso-8859-13"));
});

test("Split on maxLength QP", function(){
    var inputStr = "Jõgeva Jõgeva Jõgeva mugeva Jõgeva Jõgeva Jõgeva Jõgeva Jõgeva",
        outputStr = "=?UTF-8?Q?J=C3=B5geva_?= =?UTF-8?Q?J=C3=B5geva_?= =?UTF-8?Q?J=C3=B5geva?= mugeva "+
                "=?UTF-8?Q?J=C3=B5geva_?= =?UTF-8?Q?J=C3=B5geva_?= =?UTF-8?Q?J=C3=B5geva_?= "+
                "=?UTF-8?Q?J=C3=B5geva_?= =?UTF-8?Q?J=C3=B5geva?=",
        encoded = mimefuncs.mimeWordsEncode(inputStr, "Q", 16);

    equal(outputStr, encoded);
    equal(inputStr, mimefuncs.mimeWordsDecode(encoded));
});

test("Split on maxLength Base64", function(){
    var inputStr = "Jõgeva Jõgeva Jõgeva mugeva Jõgeva Jõgeva Jõgeva Jõgeva Jõgeva",
        outputStr = "=?UTF-8?B?SsO1Zw==?= =?UTF-8?B?ZXZh?= =?UTF-8?B?IErDtQ==?= =?UTF-8?B?Z2V2?= "+
                "=?UTF-8?B?YSBK?= =?UTF-8?B?w7VnZQ==?= =?UTF-8?B?dmE=?= mugeva =?UTF-8?B?SsO1Zw==?= "+
                "=?UTF-8?B?ZXZh?= =?UTF-8?B?IErDtQ==?= =?UTF-8?B?Z2V2?= =?UTF-8?B?YSBK?= "+
                "=?UTF-8?B?w7VnZQ==?= =?UTF-8?B?dmEg?= =?UTF-8?B?SsO1Zw==?= =?UTF-8?B?ZXZh?= "+
                "=?UTF-8?B?IErDtQ==?= =?UTF-8?B?Z2V2?= =?UTF-8?B?YQ==?=",
        encoded = mimefuncs.mimeWordsEncode(inputStr,"B", 19);

    equal(outputStr, encoded);
    equal(inputStr, mimefuncs.mimeWordsDecode(encoded));
});

test("Fold long header line", function(){
    var inputStr = "Subject: Testin command line kirja õkva kakva mõni tõnis kõllas põllas tõllas rõllas jušla kušla tušla musla",
        outputStr = "Subject: Testin command line kirja =?UTF-8?Q?=C3=B5kva?= kakva\r\n"+
                    " =?UTF-8?Q?m=C3=B5ni_t=C3=B5nis_k=C3=B5llas_p=C3=B5?=\r\n"+
                    " =?UTF-8?Q?llas_t=C3=B5llas_r=C3=B5llas_ju=C5=A1la_?=\r\n"+
                    " =?UTF-8?Q?ku=C5=A1la_tu=C5=A1la?= musla",
        encodedHeaderLine = mimefuncs.mimeWordsEncode(inputStr, "Q", 52);

    equal(outputStr, mimefuncs.foldLines(encodedHeaderLine, 76));
});

test("Fold flowed text", function(){
    var inputStr = "Testin command line kirja õkva kakva mõni tõnis kõllas põllas tõllas rõllas jušla kušla tušla musla Testin command line kirja õkva kakva mõni tõnis kõllas põllas tõllas rõllas jušla kušla tušla musla",
        outputStr = "Testin command line kirja õkva kakva mõni tõnis kõllas põllas tõllas rõllas \r\n"+
                    "jušla kušla tušla musla Testin command line kirja õkva kakva mõni tõnis \r\n"+
                    "kõllas põllas tõllas rõllas jušla kušla tušla musla";

    equal(outputStr, mimefuncs.foldLines(inputStr, 76, true));
});

test("Ascii range", function(){
    var input1 = "метель\" вьюга",
        input2 = "метель'вьюга",
        output1 = "=?UTF-8?Q?=D0=BC=D0=B5=D1=82=D0=B5=D0=BB=D1=8C=22_?= =?UTF-8?Q?=D0=B2=D1=8C=D1=8E=D0=B3=D0=B0?=",
        output2 = "=?UTF-8?Q?=D0=BC=D0=B5=D1=82=D0=B5=D0=BB=D1=8C'?= =?UTF-8?Q?=D0=B2=D1=8C=D1=8E=D0=B3=D0=B0?=";

    equal(mimefuncs.mimeWordsEncode(input1, "Q", 52), output1);
    equal(mimefuncs.mimeWordsDecode(output1), input1);

    equal(mimefuncs.mimeWordsEncode(input2, "Q", 52), output2);
    equal(mimefuncs.mimeWordsDecode(output2), input2);

});

test("mimeWordsDecode example", function(){
    equal("Hello: See on õhin test", mimefuncs.mimeWordsDecode("Hello: =?UTF-8?q?See_on_=C3=B5hin_test?="));
    equal("=?UTF-8?Q?See_on_=C3=B5hin_test?=", mimefuncs.mimeWordEncode("See on õhin test"));
    equal("See on õhin test", mimefuncs.mimeWordDecode("=?UTF-8?q?See_on_=C3=B5hin_test?="));
});

test("Decode Mime Word QP", function(){
    equal("Jõge-vaŽ", mimefuncs.mimeWordDecode("=?ISO-8859-13?Q?J=F5ge-va=DE?="));
});

test("Decode Mime Words", function(){
    equal("Jõge-vaŽ zz Jõge-vaŽJõge-vaŽJõge-vaŽ", mimefuncs.mimeWordsDecode("=?ISO-8859-13?Q?J=F5ge-va=DE?= zz =?ISO-8859-13?Q?J=F5ge-va=DE?= =?ISO-8859-13?Q?J=F5ge-va=DE?= =?ISO-8859-13?Q?J=F5ge-va=DE?="));
    equal("Sssś Lałalalala", mimefuncs.mimeWordsDecode("=?UTF-8?B?U3NzxZsgTGHFgmFsYQ==?= =?UTF-8?B?bGFsYQ==?="));
});

test("Encode and fold header line", function(){
    var key = "Subject",
        value =  "Testin command line kirja õkva kakva mõni tõnis kõllas põllas tõllas rõllas jušla kušla tušla musla",
        outputStr = "Subject: Testin command line kirja =?UTF-8?Q?=C3=B5kva?= kakva\r\n"+
                    " =?UTF-8?Q?m=C3=B5ni_t=C3=B5nis_k=C3=B5llas_p=C3=B5?=\r\n"+
                    " =?UTF-8?Q?llas_t=C3=B5llas_r=C3=B5llas_ju=C5=A1la_?=\r\n"+
                    " =?UTF-8?Q?ku=C5=A1la_tu=C5=A1la?= musla",
        encodedHeaderLine = mimefuncs.headerLineEncode(key, value);

    equal(outputStr, encodedHeaderLine);
});

test("Parse headers", function(){
    var headersObj = {
            "subject": "Tere =?UTF-8?Q?J=C3=B5geva?=",
            "x-app": ["My =?UTF-8?Q?=C5=A1=C5=A1=C5=A1=C5=A1?= app line 1", "My =?UTF-8?Q?=C5=A1=C5=A1=C5=A1=C5=A1?= app line 2"],
            "long-line": "tere =?UTF-8?Q?=C3=B5klva?= karu =?UTF-8?Q?m=C3=B5kva_=C5=A1apaka=C5=A1?= tutikas suur maja, =?UTF-8?Q?k=C3=B5rge?= hoone, segane jutt"
        },
        headersStr = "Subject: Tere =?UTF-8?Q?J=C3=B5geva?=\r\n"+
                     "X-APP: My =?UTF-8?Q?=C5=A1=C5=A1=C5=A1=C5=A1?= app line 1\r\n"+
                     "X-APP: My =?UTF-8?Q?=C5=A1=C5=A1=C5=A1=C5=A1?= app line 2\r\n"+
                     "Long-Line: tere =?UTF-8?Q?=C3=B5klva?= karu\r\n"+
                     " =?UTF-8?Q?m=C3=B5kva_=C5=A1apaka=C5=A1?= tutikas suur maja,\r\n"+
                     " =?UTF-8?Q?k=C3=B5rge?= hoone, segane jutt";

    deepEqual(headersObj, mimefuncs.headerLinesDecode(headersStr));
});

test("fromArrayBuffer", function(){
    var len = 1 * 1024 * 1024,
        input = new Uint8Array(len),
        str = "";

    for(var i=0; i< len; i++){
        input[i] = i % 256;
        str += String.fromCharCode(i % 256);
    }

    equal(mimefuncs.fromArrayBuffer(input.buffer), str);
    equal(mimefuncs.fromArrayBuffer(input), str);
});

test("toArrayBuffer", function(){
    var str = "",
        i,
        len = 1024;

    for(i=0; i<len; i++){
        str += String.fromCharCode(i % 256);
    }

    equal(mimefuncs.fromArrayBuffer(mimefuncs.toArrayBuffer(str)), str);
});

test("parseHeaderValue, default value only", function(){
    var str = "text/plain",
        obj = {
            value: "text/plain",
            params: {}
        };

    deepEqual(mimefuncs.parseHeaderValue(str), obj);
});

test("parseHeaderValue, unquoted params", function(){
    var str = "text/plain; CHARSET= UTF-8; format=flowed;",
        obj = {
            value: "text/plain",
            params: {
                "charset": "UTF-8",
                "format": "flowed"
            }
        };

    deepEqual(mimefuncs.parseHeaderValue(str), obj);
});

test("parseHeaderValue, quoted params", function(){
    var str = "text/plain; filename= \";;;\\\"\"; format=flowed;",
        obj = {
            value: "text/plain",
            params: {
                "filename": ";;;\"",
                "format": "flowed"
            }
        };

    deepEqual(mimefuncs.parseHeaderValue(str), obj);
});



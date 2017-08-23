'use strict';

require.config({
    paths: {
        'chai': '../node_modules/chai/chai',
        'emailjs-stringencoding': '../node_modules/emailjs-stringencoding/src/emailjs-stringencoding'
    }
});


mocha.setup('bdd');
require(['../test/mimecodec-unit.js'], function() {
    window.mocha.run();
});

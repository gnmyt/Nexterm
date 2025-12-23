const translateKeys = (data, config) => {
    if (!config || !data) return data;

    const isBuffer = Buffer.isBuffer(data);
    let str = isBuffer ? data.toString('binary') : data;

    if (config.backspaceMode === 'ctrl-h') str = str.replace(/\x7f/g, '\x08');
    if (config.deleteMode === 'del') str = str.replace(/\x1b\[3~/g, '\x7f');

    if (config.functionKeyMode === 'vt') {
        str = str.replace(/\x1bOP/g, '\x1b[11~');  // F1
        str = str.replace(/\x1bOQ/g, '\x1b[12~');  // F2
        str = str.replace(/\x1bOR/g, '\x1b[13~');  // F3
        str = str.replace(/\x1bOS/g, '\x1b[14~');  // F4
    } else if (config.functionKeyMode === 'linux') {
        str = str.replace(/\x1bOP/g, '\x1b[[A');   // F1
        str = str.replace(/\x1bOQ/g, '\x1b[[B');   // F2
        str = str.replace(/\x1bOR/g, '\x1b[[C');   // F3
        str = str.replace(/\x1bOS/g, '\x1b[[D');   // F4
        str = str.replace(/\x1b\[15~/g, '\x1b[[E'); // F5

        str = str.replace(/\x1b\[11~/g, '\x1b[[A'); // F1
        str = str.replace(/\x1b\[12~/g, '\x1b[[B'); // F2
        str = str.replace(/\x1b\[13~/g, '\x1b[[C'); // F3
        str = str.replace(/\x1b\[14~/g, '\x1b[[D'); // F4
    }

    return isBuffer ? Buffer.from(str, 'binary') : str;
};

module.exports = { translateKeys };

'use strict'
const vscode = require('vscode');
const ping = require('ping');

const inactiveDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: {
        id: 'pingmyfile.inactive'
    },
    isWholeLine: true,
    rangeBehavior: 1
});

const activeDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: {
        id: 'pingmyfile.active'
    },
    isWholeLine: true,
    rangeBehavior: 1
});

const diagnosticCollection = vscode.languages.createDiagnosticCollection('ping');

class File {
    constructor(editor) {
        this.active = false;
        this.isWholeFileMode = true;
        this.hosts = [];
        this.editor = editor;
        this.visible = true;
    }

    show(editor) {
        this.visible = true;
        this.editor = editor;
        this.updateDecorations();
    }

    hide() {
        this.visible = false;
    }

    //TODO: Add functionality of hosts extraction from file contents
    prepareHostsFromContent() {
        if (!this.editor)
            return;
        this.hosts = [];
        const regEx = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
        let match;
        while (match = regEx.exec(this.editor.document.getText())) {
            const startPos = this.editor.document.positionAt(match.index);
            const endPos = this.editor.document.positionAt(match.index + match[0].length);
            this.hosts.push(new vscode.Range(startPos, endPos));
        }
    };

    prepareHostsFromFile() {
        if (!this.editor)
            return;
        this.hosts = [];
        for (let i = 0; i < this.editor.document.lineCount; i++) {
            let line = this.editor.document.lineAt(i);
            if (line.text.length > 0 && !line.text.startsWith('#')) {
                const host = line.range;
                host.txtHost = line.text;
                this.hosts.push(host);
            }
        }
    };

    prepareHosts() {
        if (this.isWholeFileMode)
            this.prepareHostsFromFile();
        else
            this.prepareHostsFromContent();
    };

    pingAll(active) {
        this.active = active;
        for (let i = 0; i < this.hosts.length; i++) {
            let host = this.hosts[i];
            ping.promise.probe(host.txtHost)
                .then((res) => {
                    if (!this.hosts.includes(host))
                        return;
                    host.checked = true;
                    host.isAlive = res.alive;
                    host.responseTime = res.time;
                    host.numericHost = res.numeric_host;
                    this.updateDecorations();
                    if (this.active && this.hosts.length > 0 && this.areAllProcessed()) {
                        for (let i = 0; i < this.hosts.length; i++) {
                            let host = this.hosts[i];
                            host.checked = false;
                        }
                        clearTimeout(this.timeoutTimer);
                        const pauseBetweenPings = vscode.workspace.getConfiguration('pingmyfile').get('pausebetweenpings');
                        this.timeoutTimer = setTimeout(() => {
                            this.pingAll(true);
                        }, pauseBetweenPings);
                    }
                });
        }
    };

    cancelPing() {
        clearTimeout(this.timeoutTimer)
        this.active = false;
    };

    pausePing() {
        clearTimeout(this.timeoutTimer)
    }

    clearHosts() {
        this.hosts = [];
        this.updateDecorations();
    };

    areAllProcessed() {
        const processedHosts = this.hosts.filter((item) => {
            return item.checked == true;
        });
        return processedHosts.length == this.hosts.length;
    };

    createDecorationOption(item) {
        return {
            range: new vscode.Range(item.start, item.start),
            renderOptions: {
                after: {
                    contentText: `  (${item.responseTime} ms, ${item.numericHost})`,
                    fontStyle: 'italic',
                    color: {
                        id: 'pingmyfile.activeComment'
                    },
                }
            }
        }
    };

    updateDecorations() {
        const inactiveDecorations = this.hosts.filter((item) => {
            return 'isAlive' in item && !item.isAlive
        }).map(item => {
            return new vscode.Range(item.start, item.start)
        })
        const problems = this.hosts.filter((item) => {
            return 'isAlive' in item && !item.isAlive
        }).map(item => {
            return new vscode.Diagnostic(item, item.txtHost + " is not responding")
        })
        const activeDecorations = this.hosts.filter((item) => {
            return 'isAlive' in item && item.isAlive
        }).map(item => this.createDecorationOption(item))

        if (this.visible) {
            this.editor.setDecorations(inactiveDecorationType, inactiveDecorations);
            this.editor.setDecorations(activeDecorationType, activeDecorations);
        }
        diagnosticCollection.set(this.editor.document.uri, problems);
    }
}

module.exports = File;

import * as vscode from 'vscode';
import * as path from 'path';
import { GitHandler } from '../git/gitHandler';

export class WebviewPanel {
    private static currentPanel: vscode.WebviewPanel | undefined;
    private static currentState: any = {};

    public static show(context: vscode.ExtensionContext, gitHandler: GitHandler) {
        // যদি panel already open থাকে, তাহলে সেটি focus করুন
        if (WebviewPanel.currentPanel) {
            WebviewPanel.currentPanel.reveal(vscode.ViewColumn.Beside);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'autoGitWebview',
            ' Auto Push - AI Powered Git Automation',
            vscode.ViewColumn.Beside,
            { 
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        WebviewPanel.currentPanel = panel;

        const stylePath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'main.css'));
        const scriptPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'script.js'));
        const styleUri = panel.webview.asWebviewUri(stylePath);
        const scriptUri = panel.webview.asWebviewUri(scriptPath);

        panel.webview.html = WebviewPanel.getHtml(styleUri, scriptUri);

        // ✅ State restore করতে initial data send করুন
        panel.webview.postMessage({
            type: 'restoreState',
            state: WebviewPanel.currentState
        });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async message => {
            console.log('Received message from webview:', message);
            
            switch (message.type) {
                case 'toggle':
                    gitHandler.toggle(message.enabled);
                    // ✅ State save করুন
                    WebviewPanel.currentState.enabled = message.enabled;
                    break;
                case 'setInterval':
                    gitHandler.startTimer(message.minutes);
                    WebviewPanel.currentState.interval = message.minutes;
                    break;
                case 'pause':
                    gitHandler.pause(message.minutes);
                    WebviewPanel.currentState.paused = true;
                    break;
                case 'resume':
                    gitHandler.resume();
                    WebviewPanel.currentState.paused = false;
                    break;
                case 'manualCommit':
                    vscode.window.showInformationMessage('AI Commit started...');
                    await gitHandler.manualCommitWithAI();
                    break;
                case 'quickCommit':
                    vscode.window.showInformationMessage('Quick Commit started...');
                    await gitHandler.quickCommit();
                    break;
                case 'setUseAI':
                    gitHandler.setUseAI(message.useAI);
                    WebviewPanel.currentState.useAI = message.useAI;
                    vscode.window.showInformationMessage(`AI Commit Messages: ${message.useAI ? 'ON' : 'OFF'}`);
                    break;
                case 'saveState':
                    // ✅ Webview থেকে state save করার request
                    WebviewPanel.currentState = message.state;
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        }, undefined, context.subscriptions);

        // ✅ Panel close হলে cleanup করুন
        panel.onDidDispose(() => {
            WebviewPanel.currentPanel = undefined;
        }, null, context.subscriptions);
    }

    public static showInWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.ExtensionContext,
        gitHandler: GitHandler
    ) {
        webviewView.webview.options = { 
            enableScripts: true,
            // retainContextWhenHidden: true
        };

        const stylePath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'main.css'));
        const scriptPath = vscode.Uri.file(path.join(context.extensionPath, 'media', 'script.js'));
        const styleUri = webviewView.webview.asWebviewUri(stylePath);
        const scriptUri = webviewView.webview.asWebviewUri(scriptPath);

        webviewView.webview.html = WebviewPanel.getHtml(styleUri, scriptUri);

        // ✅ Sidebar এর জন্যেও initial state send করুন
        const initialState = {
            enabled: false,
            useAI: false,
            interval: 10,
            paused: false
        };

        webviewView.webview.postMessage({
            type: 'restoreState',
            state: initialState
        });

        webviewView.webview.onDidReceiveMessage(async message => {
            console.log('Received message from sidebar webview:', message);
            
            switch (message.type) {
                case 'toggle':
                    gitHandler.toggle(message.enabled);
                    break;
                case 'setInterval':
                    gitHandler.startTimer(message.minutes);
                    break;
                case 'pause':
                    gitHandler.pause(message.minutes);
                    break;
                case 'resume':
                    gitHandler.resume();
                    break;
                case 'manualCommit':
                    vscode.window.showInformationMessage('AI Commit started...');
                    await gitHandler.manualCommitWithAI();
                    break;
                case 'quickCommit':
                    vscode.window.showInformationMessage('Quick Commit started...');
                    await gitHandler.quickCommit();
                    break;
                case 'setUseAI':
                    gitHandler.setUseAI(message.useAI);
                    vscode.window.showInformationMessage(`AI Commit Messages: ${message.useAI ? 'ON' : 'OFF'}`);
                    break;
                case 'saveState':
                    // ✅ Sidebar এর state save
                    break;
            }
        }, undefined, context.subscriptions);
    }

    // ✅ GitHandler থেকে actual state নেওয়ার function
    public static updateStateFromGitHandler(gitHandler: GitHandler) {
        const status = gitHandler.getStatus();
        WebviewPanel.currentState = {
            enabled: status.enabled,
            interval: status.interval,
            paused: status.paused,
            useAI: true // GitHandler থেকে এই value নিতে হবে
        };

        // যদি panel open থাকে, তাহলে state update করুন
        if (WebviewPanel.currentPanel) {
            WebviewPanel.currentPanel.webview.postMessage({
                type: 'restoreState',
                state: WebviewPanel.currentState
            });
        }
    }

    private static getHtml(styleUri: vscode.Uri, scriptUri: vscode.Uri) {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Auto Push - AI Powered Git Automation</title>
        </head>
        <body>
            <div class="container">
                <!-- Header with Logo -->
                <div class="header">
                    <div class="logo">
                        <div class="logo-icon">🚀</div>
                        <div class="logo-text">
                            <h1> Auto Push</h1>
                            <p class="tagline">AI-Powered Git Automation</p>
                        </div>
                    </div>
                    <div class="status-badge" id="globalStatus">
                        <span class="status-dot"></span>
                        <span class="status-text">Ready</span>
                    </div>
                </div>

                <!-- Main Controls Card -->
                <div class="card">
                    <div class="card-header">
                        <h2>⚙️ Automation Settings</h2>
                        <p>Configure your automatic Git workflow</p>
                    </div>
                    
                    <div class="control-group">
                        <div class="control-item">
                            <div class="control-info">
                                <span class="control-label">Auto Commit</span>
                                <span class="control-description">Automatically commit changes at regular intervals</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="toggle">
                                <span class="slider">
                                    <span class="slider-text on">ON</span>
                                    <span class="slider-text off">OFF</span>
                                </span>
                            </label>
                        </div>

                        <div class="control-item">
                            <div class="control-info">
                                <span class="control-label">Commit Frequency</span>
                                <span class="control-description">How often to auto-commit changes</span>
                            </div>
                            <div class="input-group">
                                <input type="number" id="interval" min="1" max="120" value="10" class="modern-input">
                                <span class="input-suffix">minutes</span>
                            </div>
                        </div>

                        <div class="control-item">
                            <div class="control-info">
                                <span class="control-label">AI Commit Messages</span>
                                <span class="control-description">Generate smart commit messages using AI</span>
                            </div>
                            <label class="switch">
                                <input type="checkbox" id="useAI">
                                <span class="slider">
                                    <span class="slider-text on">AI</span>
                                    <span class="slider-text off">MANUAL</span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions Card -->
                <div class="card">
                    <div class="card-header">
                        <h2>🎯 Quick Actions</h2>
                        <p>Instant Git operations with one click</p>
                    </div>
                    
                    <div class="actions-grid">
                        <button id="manualCommit" class="action-btn ai-commit">
                            <span class="btn-icon">🤖</span>
                            <span class="btn-content">
                                <span class="btn-title">AI Commit & Push</span>
                                <span class="btn-desc">Smart commit with AI message</span>
                            </span>
                            <span class="btn-badge">RECOMMENDED</span>
                        </button>

                        <button id="quickCommit" class="action-btn quick-commit">
                            <span class="btn-icon">⚡</span>
                            <span class="btn-content">
                                <span class="btn-title">Quick Commit</span>
                                <span class="btn-desc">Fast commit with default message</span>
                            </span>
                        </button>

                        <button id="pause1h" class="action-btn pause-btn">
                            <span class="btn-icon">⏸️</span>
                            <span class="btn-content">
                                <span class="btn-title">Pause Auto</span>
                                <span class="btn-desc">Stop auto-commit for 1 hour</span>
                            </span>
                        </button>

                        <button id="resumeBtn" class="action-btn resume-btn">
                            <span class="btn-icon">▶️</span>
                            <span class="btn-content">
                                <span class="btn-title">Resume Auto</span>
                                <span class="btn-desc">Restart auto-commit feature</span>
                            </span>
                        </button>
                    </div>
                </div>

                <!-- Status Card -->
                <div class="card">
                    <div class="card-header">
                        <h2>📊 Current Status</h2>
                        <p>Real-time extension status</p>
                    </div>
                    
                    <div class="status-grid">
                        <div class="status-item">
                            <div class="status-icon auto-commit-icon">🔄</div>
                            <div class="status-info">
                                <span class="status-name">Auto Commit</span>
                                <span class="status-value" id="statusEnabled">Disabled</span>
                            </div>
                        </div>
                        
                        <div class="status-item">
                            <div class="status-icon ai-icon">🧠</div>
                            <div class="status-info">
                                <span class="status-name">AI Messages</span>
                                <span class="status-value" id="statusAI">Disabled</span>
                            </div>
                        </div>
                        
                        <div class="status-item">
                            <div class="status-icon pause-icon">⏸️</div>
                            <div class="status-info">
                                <span class="status-name">Pause Status</span>
                                <span class="status-value" id="statusPaused">Active</span>
                            </div>
                        </div>
                        
                        <div class="status-item">
                            <div class="status-icon timer-icon">⏰</div>
                            <div class="status-info">
                                <span class="status-name">Next Commit</span>
                                <span class="status-value" id="nextCommit">10:00 min</span>
                            </div>
                        </div>
                    </div>
                </div>


            <script src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }
}
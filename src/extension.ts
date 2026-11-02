import * as vscode from 'vscode';
import { PetManager } from './vscode/petManager';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new PetManager(context);
  context.subscriptions.push(
    manager,
    vscode.commands.registerCommand('pettingZoo.spawn', () => manager.spawnInteractive()),
    vscode.commands.registerCommand('pettingZoo.remove', () => manager.removeInteractive()),
    vscode.commands.registerCommand('pettingZoo.removeAll', () => manager.removeAll()),
    vscode.commands.registerCommand('pettingZoo.callHere', () => manager.callHere()),
    vscode.commands.registerCommand('pettingZoo.togglePause', () => manager.togglePause()),
  );
  manager.start();
}

export function deactivate(): void {}

const { Plugin, Modal, Setting, Notice, TFile, TFolder, PluginSettingTab } = require('obsidian');
const fs = require('fs');
const path = require('path');

// 기본 설정값
const DEFAULT_SETTINGS = {
    targetVaultPaths: [],
    includeAttachments: true,
    preserveMetadata: true,
    handleConflicts: 'rename', // 'rename', 'overwrite', 'skip'
    deleteAfterTransfer: false // 전송 후 원본 파일 삭제 여부
};

class VaultTransferPlugin extends Plugin {
    async onload() {
        console.log('Vault Transfer Plugin 로딩 중...');
        
        // 설정 로드
        await this.loadSettings();
        
        // 리본 아이콘 추가
        this.addRibbonIcon('send', 'Transfer file to another vault', () => {
            this.openTransferModal();
        });

        // 명령어 추가
        this.addCommand({
            id: 'transfer-current-file',
            name: 'Transfer current file to another vault',
            callback: () => this.transferCurrentFile()
        });

        this.addCommand({
            id: 'move-current-file',
            name: 'Move current file to another vault (delete original)',
            callback: () => this.moveCurrentFile()
        });

        this.addCommand({
            id: 'transfer-selected-files',
            name: 'Transfer selected files to another vault',
            callback: () => this.openTransferModal()
        });

        // 컨텍스트 메뉴에 추가
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                if (file instanceof TFile) {
                    menu.addItem((item) => {
                        item
                            .setTitle('Transfer to another vault')
                            .setIcon('send')
                            .onClick(() => this.transferFile(file, null, false));
                    });
                    
                    menu.addItem((item) => {
                        item
                            .setTitle('Move to another vault')
                            .setIcon('scissors')
                            .onClick(() => this.transferFile(file, null, true));
                    });
                }
            })
        );

        // 설정 탭 추가
        this.addSettingTab(new VaultTransferSettingTab(this.app, this));
    }

    async onunload() {
        console.log('Vault Transfer Plugin 언로딩됨');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // 현재 활성 파일 전송
    async transferCurrentFile() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('활성 파일이 없습니다.');
            return;
        }
        this.transferFile(activeFile, null, false);
    }

    // 현재 활성 파일 이동 (원본 삭제)
    async moveCurrentFile() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('활성 파일이 없습니다.');
            return;
        }
        this.transferFile(activeFile, null, true);
    }

    // 파일 전송 모달 열기
    openTransferModal() {
        new VaultTransferModal(this.app, this).open();
    }

    // 실제 파일 전송 로직
    async transferFile(file, targetVaultPath = null, forceDelete = null) {
        if (!targetVaultPath) {
            if (this.settings.targetVaultPaths.length === 0) {
                new Notice('대상 vault가 설정되지 않았습니다. 설정에서 추가해주세요.');
                return;
            }
            // 대상 vault가 여러개면 선택 모달 표시
            if (this.settings.targetVaultPaths.length > 1) {
                new VaultSelectModal(this.app, this, file, forceDelete).open();
                return;
            }
            targetVaultPath = this.settings.targetVaultPaths[0];
        }

        try {
            await this.performFileTransfer(file, targetVaultPath, forceDelete);
        } catch (error) {
            console.error('파일 전송 오류:', error);
            new Notice(`파일 전송 실패: ${error.message}`);
        }
    }

    // 실제 파일 전송 수행
    async performFileTransfer(file, targetVaultPath, forceDelete = null) {
        const sourceContent = await this.app.vault.read(file);
        const sourcePath = file.path;
        const fileName = file.name;
        
        // 삭제 여부 결정 (매개변수 우선, 없으면 설정값 사용)
        const shouldDelete = forceDelete !== null ? forceDelete : this.settings.deleteAfterTransfer;
        
        // 대상 경로 구성
        const targetFilePath = path.join(targetVaultPath, sourcePath);
        const targetDir = path.dirname(targetFilePath);

        // 대상 디렉토리 생성
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 파일 충돌 처리
        let finalTargetPath = targetFilePath;
        if (fs.existsSync(targetFilePath)) {
            finalTargetPath = this.handleFileConflict(targetFilePath, fileName);
            if (!finalTargetPath) {
                new Notice('파일 전송이 취소되었습니다.');
                return;
            }
        }

        // 파일 쓰기
        fs.writeFileSync(finalTargetPath, sourceContent, 'utf8');

        // 메타데이터 보존
        if (this.settings.preserveMetadata) {
            const sourceStats = fs.statSync(path.join(this.app.vault.adapter.basePath, sourcePath));
            fs.utimesSync(finalTargetPath, sourceStats.atime, sourceStats.mtime);
        }

        // 첨부파일 처리
        if (this.settings.includeAttachments) {
            await this.transferAttachments(file, targetVaultPath, sourceContent, shouldDelete);
        }

        // 원본 파일 삭제 (이동 모드인 경우)
        if (shouldDelete) {
            try {
                await this.app.vault.delete(file);
                new Notice(`파일이 성공적으로 이동되었습니다: ${path.basename(finalTargetPath)}`);
            } catch (deleteError) {
                console.error('원본 파일 삭제 오류:', deleteError);
                new Notice(`파일은 전송되었지만 원본 삭제에 실패했습니다: ${deleteError.message}`);
            }
        } else {
            new Notice(`파일이 성공적으로 전송되었습니다: ${path.basename(finalTargetPath)}`);
        }
    }

    // 파일 충돌 처리
    handleFileConflict(targetPath, fileName) {
        switch (this.settings.handleConflicts) {
            case 'overwrite':
                return targetPath;
            case 'skip':
                return null;
            case 'rename':
            default:
                const dir = path.dirname(targetPath);
                const name = path.parse(fileName).name;
                const ext = path.parse(fileName).ext;
                let counter = 1;
                let newPath;
                
                do {
                    const newFileName = `${name} (${counter})${ext}`;
                    newPath = path.join(dir, newFileName);
                    counter++;
                } while (fs.existsSync(newPath));
                
                return newPath;
        }
    }

    // 첨부파일 전송
    async transferAttachments(file, targetVaultPath, content, shouldDelete = false) {
        // 마크다운에서 첨부파일 링크 추출
        const attachmentRegex = /!\[\[([^\]]+)\]\]|!\[.*?\]\(([^)]+)\)/g;
        const matches = [...content.matchAll(attachmentRegex)];
        
        for (const match of matches) {
            const attachmentPath = match[1] || match[2];
            if (attachmentPath && !attachmentPath.startsWith('http')) {
                await this.transferSingleAttachment(attachmentPath, targetVaultPath, shouldDelete);
            }
        }
    }

    // 개별 첨부파일 전송
    async transferSingleAttachment(attachmentPath, targetVaultPath, shouldDelete = false) {
        try {
            const sourceFile = this.app.vault.getAbstractFileByPath(attachmentPath);
            if (sourceFile instanceof TFile) {
                const content = await this.app.vault.readBinary(sourceFile);
                const targetAttachmentPath = path.join(targetVaultPath, attachmentPath);
                const targetDir = path.dirname(targetAttachmentPath);
                
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                
                fs.writeFileSync(targetAttachmentPath, Buffer.from(content));
                
                // 첨부파일도 삭제 (이동 모드인 경우)
                if (shouldDelete) {
                    try {
                        await this.app.vault.delete(sourceFile);
                    } catch (deleteError) {
                        console.warn(`첨부파일 삭제 실패: ${attachmentPath}`, deleteError);
                    }
                }
            }
        } catch (error) {
            console.warn(`첨부파일 전송 실패: ${attachmentPath}`, error);
        }
    }
}

// Vault 선택 모달
class VaultSelectModal extends Modal {
    constructor(app, plugin, file, forceDelete = null) {
        super(app);
        this.plugin = plugin;
        this.file = file;
        this.forceDelete = forceDelete;
    }

    onOpen() {
        const { contentEl } = this;
        const actionText = this.forceDelete ? '이동' : '전송';
        
        contentEl.createEl('h3', { text: 'Vault 선택' });
        contentEl.createEl('p', { text: `"${this.file.name}"을 ${actionText}할 vault를 선택하세요:` });

        this.plugin.settings.targetVaultPaths.forEach((vaultPath, index) => {
            const button = contentEl.createEl('button', {
                text: path.basename(vaultPath),
                cls: 'mod-cta'
            });
            button.style.display = 'block';
            button.style.width = '100%';
            button.style.marginBottom = '10px';
            
            button.onclick = () => {
                this.close();
                this.plugin.transferFile(this.file, vaultPath, this.forceDelete);
            };
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 파일 전송 모달
class VaultTransferModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Vault 간 파일 전송' });

        // 현재 vault 정보
        const currentVaultPath = this.app.vault.adapter.basePath;
        contentEl.createEl('p', { text: `현재 Vault: ${path.basename(currentVaultPath)}` });

        // 파일 선택 영역
        const fileSelectDiv = contentEl.createDiv('file-select');
        fileSelectDiv.createEl('h3', { text: '전송할 파일 선택' });
        
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const fileInfo = fileSelectDiv.createDiv('current-file');
            fileInfo.createEl('strong', { text: '현재 활성 파일: ' });
            fileInfo.createSpan({ text: activeFile.path });
            
            const buttonContainer = fileSelectDiv.createDiv('button-container');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            buttonContainer.style.marginTop = '10px';
            
            const transferButton = buttonContainer.createEl('button', {
                text: '복사 (원본 유지)',
                cls: 'mod-cta'
            });
            transferButton.onclick = () => {
                this.close();
                this.plugin.transferFile(activeFile, null, false);
            };
            
            const moveButton = buttonContainer.createEl('button', {
                text: '이동 (원본 삭제)',
                cls: 'mod-warning'
            });
            moveButton.onclick = () => {
                this.close();
                this.plugin.transferFile(activeFile, null, true);
            };
        }

        // 대상 vault 목록
        if (this.plugin.settings.targetVaultPaths.length > 0) {
            const vaultListDiv = contentEl.createDiv('vault-list');
            vaultListDiv.createEl('h3', { text: '등록된 대상 Vault' });
            
            this.plugin.settings.targetVaultPaths.forEach(vaultPath => {
                const vaultItem = vaultListDiv.createDiv('vault-item');
                vaultItem.createSpan({ text: path.basename(vaultPath) });
                vaultItem.createEl('small', { 
                    text: ` (${vaultPath})`,
                    cls: 'vault-path'
                });
            });
        } else {
            contentEl.createEl('p', { 
                text: '대상 vault가 설정되지 않았습니다. 설정에서 추가해주세요.',
                cls: 'mod-warning'
            });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 설정 탭
class VaultTransferSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Vault Transfer Settings' });

        // 대상 vault 경로 설정
        new Setting(containerEl)
            .setName('대상 Vault 경로')
            .setDesc('파일을 전송할 다른 vault들의 경로를 추가하세요')
            .addButton(btn => btn
                .setButtonText('경로 추가')
                .setCta()
                .onClick(() => this.addVaultPath()));

        // 기존 경로들 표시
        this.displayVaultPaths();

        // 첨부파일 포함 설정
        new Setting(containerEl)
            .setName('첨부파일 포함')
            .setDesc('파일 전송 시 첨부파일도 함께 전송합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeAttachments)
                .onChange(async (value) => {
                    this.plugin.settings.includeAttachments = value;
                    await this.plugin.saveSettings();
                }));

        // 메타데이터 보존 설정
        new Setting(containerEl)
            .setName('메타데이터 보존')
            .setDesc('파일의 생성일, 수정일 등을 보존합니다')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.preserveMetadata)
                .onChange(async (value) => {
                    this.plugin.settings.preserveMetadata = value;
                    await this.plugin.saveSettings();
                }));

        // 충돌 처리 방식
        new Setting(containerEl)
            .setName('파일 충돌 처리')
            .setDesc('같은 이름의 파일이 존재할 때 처리 방식')
            .addDropdown(dropdown => dropdown
                .addOption('rename', '이름 변경')
                .addOption('overwrite', '덮어쓰기')
                .addOption('skip', '건너뛰기')
                .setValue(this.plugin.settings.handleConflicts)
                .onChange(async (value) => {
                    this.plugin.settings.handleConflicts = value;
                    await this.plugin.saveSettings();
                }));
    }

    displayVaultPaths() {
        const pathsContainer = this.containerEl.createDiv('vault-paths-container');
        
        this.plugin.settings.targetVaultPaths.forEach((vaultPath, index) => {
            const pathSetting = new Setting(pathsContainer)
                .setName(`Vault ${index + 1}`)
                .setDesc(vaultPath)
                .addButton(btn => btn
                    .setButtonText('제거')
                    .setWarning()
                    .onClick(async () => {
                        this.plugin.settings.targetVaultPaths.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display(); // 설정 화면 새로고침
                    }));
        });
    }

    async addVaultPath() {
        // Electron의 dialog를 사용하여 폴더 선택
        const { dialog } = require('electron').remote || require('@electron/remote');
        
        const result = await dialog.showOpenDialog({
            title: 'Vault 폴더 선택',
            properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths.length > 0) {
            const selectedPath = result.filePaths[0];
            
            // 중복 체크
            if (!this.plugin.settings.targetVaultPaths.includes(selectedPath)) {
                this.plugin.settings.targetVaultPaths.push(selectedPath);
                await this.plugin.saveSettings();
                this.display(); // 설정 화면 새로고침
                new Notice('Vault 경로가 추가되었습니다.');
            } else {
                new Notice('이미 추가된 경로입니다.');
            }
        }
    }
}

module.exports = VaultTransferPlugin;
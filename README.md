# Vault Transfer Plugin for Obsidian

Transfer or move files between different Obsidian vaults with ease. This plugin supports attachments, metadata preservation, and flexible conflict handling.

## Features

- 📁 **Transfer files between vaults** - Copy or move files to other Obsidian vaults
- 🖼️ **Attachment support** - Automatically includes linked images and attachments
- ⚙️ **Flexible options** - Choose to copy (keep original) or move (delete original)
- 🔧 **Conflict handling** - Rename, overwrite, or skip when files already exist
- 📅 **Metadata preservation** - Maintains creation and modification dates
- 🎯 **Multiple methods** - Ribbon icon, command palette, or right-click context menu
- 🗂️ **Folder structure** - Preserves original folder structure in target vault

## Installation

### Manual Installation

1. Download the latest release from [GitHub releases](https://github.com/yourusername/obsidian-vault-transfer/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/vault-transfer/`
3. Reload Obsidian and enable the plugin in Settings → Community Plugins

### From Community Plugins (Coming Soon)

Search for "Vault Transfer" in the Community Plugins tab.

## Usage

### Initial Setup

1. Go to Settings → Vault Transfer
2. Add target vault paths by clicking "Add Path"
3. Configure your preferences:
   - Include attachments
   - Preserve metadata
   - Default action (copy or move)
   - Conflict handling method

### Transfer Methods

#### Method 1: Command Palette
- Press `Ctrl+P` (or `Cmd+P` on Mac)
- Search for "Transfer" or "Move"
- Choose your preferred action

#### Method 2: Ribbon Icon
- Click the transfer icon in the ribbon
- Choose between copy or move in the modal

#### Method 3: Right-click Menu
- Right-click on any file in the file explorer
- Select "Transfer to another vault" or "Move to another vault"

### Transfer vs Move

- **Transfer (Copy)**: Creates a copy in the target vault, keeps the original
- **Move**: Copies to target vault and deletes the original file

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Target Vault Paths | List of other vault folders to transfer files to | Empty |
| Include Attachments | Transfer linked images and files | Enabled |
| Preserve Metadata | Keep original creation/modification dates | Enabled |
| Delete After Transfer | Default action: move (true) or copy (false) | Copy |
| Conflict Handling | What to do when file already exists | Rename |

## Conflict Handling Options

- **Rename**: Adds a number suffix (e.g., "note (1).md")
- **Overwrite**: Replaces the existing file
- **Skip**: Cancels the transfer for that file

## Requirements

- Obsidian v0.15.0 or higher
- Desktop only (Windows, Mac, Linux)
- Write permissions to target vault folders

## Limitations

- **Desktop only**: Does not work on mobile devices
- **File system access**: Requires direct access to vault folders
- **Obsidian Sync**: Use Obsidian Sync for mobile vault synchronization instead

## Troubleshooting

### Plugin Won't Load
- Check that all three files (main.js, manifest.json, styles.css) are in the plugin folder
- Verify the plugin is enabled in Settings → Community Plugins
- Check the developer console (Ctrl+Shift+I) for error messages

### Can't Add Target Vault
- Ensure you have write permissions to the target folder
- Try selecting the root vault folder (containing .obsidian folder)
- Check that the path doesn't contain special characters

### Files Not Transferring
- Verify target vault path is correct
- Check available disk space
- Ensure target vault is not currently open in another Obsidian instance

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Clone this repository
2. Copy files to your vault's plugins folder for testing
3. Make changes and test in Obsidian
4. Submit a pull request with your improvements

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this plugin helpful, consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs or requesting features
- ☕ [Buying me a coffee](https://ko-fi.com/yourusername)

## Changelog

### 1.0.0
- Initial release
- Basic file transfer functionality
- Attachment support
- Metadata preservation
- Conflict handling
- Copy/Move options

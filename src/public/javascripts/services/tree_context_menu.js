import treeService from './tree.js';
import messagingService from './messaging.js';
import protectedSessionService from './protected_session.js';
import treeChangesService from './branches.js';
import treeUtils from './tree_utils.js';
import branchPrefixDialog from '../dialogs/branch_prefix.js';
import exportDialog from '../dialogs/export.js';
import importDialog from '../dialogs/import.js';
import treeCache from "./tree_cache.js";
import syncService from "./sync.js";
import hoistedNoteService from './hoisted_note.js';
import noteDetailService from './note_detail.js';
import clipboard from './clipboard.js';

class TreeContextMenu {
    constructor(node) {
        this.node = node;
    }

    getNoteTypeItems(baseCmd) {
        return [
            { title: "Text", cmd: baseCmd + "_text", uiIcon: "file" },
            { title: "Code", cmd: baseCmd + "_code", uiIcon: "terminal" },
            { title: "Saved search", cmd: baseCmd + "_search", uiIcon: "search-folder" },
            { title: "Relation Map", cmd: baseCmd + "_relation-map", uiIcon: "map" },
            { title: "Render HTML note", cmd: baseCmd + "_render", uiIcon: "play" }
        ];
    }

    async getContextMenuItems() {
        const branch = await treeCache.getBranch(this.node.data.branchId);
        const note = await treeCache.getNote(this.node.data.noteId);
        const parentNote = await treeCache.getNote(branch.parentNoteId);
        const isNotRoot = note.noteId !== 'root';
        const isHoisted = note.noteId === await hoistedNoteService.getHoistedNoteId();

        const insertNoteAfterEnabled = isNotRoot && !isHoisted && parentNote.type !== 'search';
        const insertChildNoteEnabled = note.type !== 'search';

        return [
            { title: "Open in new tab", cmd: "openInTab", uiIcon: "empty" },
            { title: "Insert note after <kbd>Ctrl+O</kbd>", cmd: "insertNoteAfter", uiIcon: "plus",
                items: insertNoteAfterEnabled ? this.getNoteTypeItems("insertNoteAfter") : null,
                enabled: insertNoteAfterEnabled },
            { title: "Insert child note <kbd>Ctrl+P</kbd>", cmd: "insertChildNote", uiIcon: "plus",
                items: insertChildNoteEnabled ? this.getNoteTypeItems("insertChildNote") : null,
                enabled: insertChildNoteEnabled },
            { title: "Delete <kbd>Delete</kbd>", cmd: "delete", uiIcon: "trash",
                enabled: isNotRoot && !isHoisted && parentNote.type !== 'search' },
            { title: "----" },
            isHoisted ? null : { title: "Hoist note <kbd>Ctrl-H</kbd>", cmd: "hoist", uiIcon: "empty" },
            !isHoisted || !isNotRoot ? null : { title: "Unhoist note <kbd>Ctrl-H</kbd>", cmd: "unhoist", uiIcon: "arrow-up" },
            { title: "Edit branch prefix <kbd>F2</kbd>", cmd: "editBranchPrefix", uiIcon: "empty",
                enabled: isNotRoot && parentNote.type !== 'search'},
            { title: "----" },
            { title: "Protect subtree", cmd: "protectSubtree", uiIcon: "shield-check" },
            { title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "shield-close" },
            { title: "----" },
            { title: "Copy / clone <kbd>Ctrl+C</kbd>", cmd: "copy", uiIcon: "files",
                enabled: isNotRoot },
            { title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "scissors",
                enabled: isNotRoot },
            { title: "Paste into <kbd>Ctrl+V</kbd>", cmd: "pasteInto", uiIcon: "clipboard",
                enabled: !clipboard.isEmpty() && note.type !== 'search' },
            { title: "Paste after", cmd: "pasteAfter", uiIcon: "clipboard",
                enabled: !clipboard.isEmpty() && isNotRoot && parentNote.type !== 'search' },
            { title: "----" },
            { title: "Export", cmd: "export", uiIcon: "empty",
                enabled: note.type !== 'search' },
            { title: "Import into note", cmd: "importIntoNote", uiIcon: "empty",
                enabled: note.type !== 'search' },
            { title: "----" },
            { title: "Collapse subtree <kbd>Alt+-</kbd>", cmd: "collapseSubtree", uiIcon: "align-justify" },
            { title: "Force note sync", cmd: "forceNoteSync", uiIcon: "refresh" },
            { title: "Sort alphabetically <kbd>Alt+S</kbd>", cmd: "sortAlphabetically", uiIcon: "empty" }
        ].filter(row => row !== null);
    }

    async selectContextMenuItem(event, cmd) {
        if (cmd === 'openInTab') {
            const notePath = await treeUtils.getNotePath(this.node);

            noteDetailService.openInTab(notePath);
        }
        else if (cmd.startsWith("insertNoteAfter")) {
            const parentNoteId = this.node.data.parentNoteId;
            const isProtected = await treeUtils.getParentProtectedStatus(this.node);
            const type = cmd.split("_")[1];

            treeService.createNote(this.node, parentNoteId, 'after', {
                type: type,
                isProtected: isProtected
            });
        }
        else if (cmd.startsWith("insertChildNote")) {
            const type = cmd.split("_")[1];

            treeService.createNote(this.node, this.node.data.noteId, 'into', {
                type: type,
                isProtected: this.node.data.isProtected
            });
        }
        else if (cmd === "editBranchPrefix") {
            branchPrefixDialog.showDialog(this.node);
        }
        else if (cmd === "protectSubtree") {
            protectedSessionService.protectSubtree(this.node.data.noteId, true);
        }
        else if (cmd === "unprotectSubtree") {
            protectedSessionService.protectSubtree(this.node.data.noteId, false);
        }
        else if (cmd === "copy") {
            clipboard.copy(treeService.getSelectedNodes());
        }
        else if (cmd === "cut") {
            clipboard.cut(treeService.getSelectedNodes());
        }
        else if (cmd === "pasteAfter") {
            clipboard.pasteAfter(this.node);
        }
        else if (cmd === "pasteInto") {
            clipboard.pasteInto(this.node);
        }
        else if (cmd === "delete") {
            treeChangesService.deleteNodes(treeService.getSelectedNodes(true));
        }
        else if (cmd === "export") {
            exportDialog.showDialog("subtree");
        }
        else if (cmd === "importIntoNote") {
            importDialog.showDialog();
        }
        else if (cmd === "collapseSubtree") {
            treeService.collapseTree(this.node);
        }
        else if (cmd === "forceNoteSync") {
            syncService.forceNoteSync(this.node.data.noteId);
        }
        else if (cmd === "sortAlphabetically") {
            treeService.sortAlphabetically(this.node.data.noteId);
        }
        else if (cmd === "hoist") {
            hoistedNoteService.setHoistedNoteId(this.node.data.noteId);
        }
        else if (cmd === "unhoist") {
            hoistedNoteService.unhoist();
        }
        else {
            messagingService.logError("Unknown command: " + cmd);
        }
    }
}

export default TreeContextMenu;
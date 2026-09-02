const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'scrum', 'retrospective') + path.sep;
const read = f => fs.readFileSync(DIR + f, 'utf8');
const load = (f, name) => eval(read(f) + ';' + name);

let LOG = [], TRIGGERS = [], SEQ = 0;
const resetLog = () => { LOG = []; };
const mkTrig = (h, u) => ({ getHandlerFunction: () => h, getUniqueId: () => u });

function installGasStubs() {
  global.Logger = { log: m => LOG.push(String(m)) };
  global.ScriptApp = {
    getProjectTriggers: () => TRIGGERS.slice(),
    deleteTrigger: t => { TRIGGERS = TRIGGERS.filter(x => x.getUniqueId() !== t.getUniqueId()); },
    newTrigger: h => ({ timeBased: () => ({ at: () => ({ create: () => {
      const t = mkTrig(h, `${h}-${++SEQ}`); TRIGGERS.push(t); return t;
    }})})}),
    getScriptId: () => 'SCRIPT123',
  };
  global.Infra = { DriveMime: { FORM: 'mime/form', PRESENTATION: 'mime/slide', PPTX: 'mime/pptx' } };
}

// ── 假的 Drive client（對應 InfraLib 的 DriveClient 介面）──
function fakeDrive(tree) {
  const mkFolder = (name, id) => ({ getName: () => name, getId: () => id, getUrl: () => `url://${id}` });
  const mkFile   = (name, id, mime) => ({ getName: () => name, getId: () => id,
                                          getUrl: () => `url://${id}`, getMimeType: () => mime });
  return {
    _tree: tree,
    findFolderByName(parentId, name) {
      const kids = (tree.folders[parentId] || []);
      return kids.includes(name) ? mkFolder(name, `${parentId}/${name}`) : null;
    },
    listFolders(parentId) {
      return (tree.folders[parentId] || []).map(n => mkFolder(n, `${parentId}/${n}`));
    },
    createFolder(parentId, name) {
      tree.folders[parentId] = (tree.folders[parentId] || []).concat(name);
      return mkFolder(name, `${parentId}/${name}`);
    },
    findFileByName(folderId, name) {
      const f = (tree.files[folderId] || []).find(x => x.name === name);
      return f ? mkFile(f.name, `${folderId}/${f.name}`, f.mime) : null;
    },
    listFiles(folderId) {
      return (tree.files[folderId] || []).map(f => mkFile(f.name, `${folderId}/${f.name}`, f.mime));
    },
    findFilesByMimeType(folderId, mime) {
      return this.listFiles(folderId).filter(f => f.getMimeType() === mime);
    },
    copyFile(fileId, newName, targetFolderId) {
      const mime = fileId.includes('slide') || fileId.includes('投影') ? 'mime/slide' : 'mime/form';
      tree.files[targetFolderId] = (tree.files[targetFolderId] || []).concat({ name: newName, mime });
      return mkFile(newName, `${targetFolderId}/${newName}`, mime);
    },
    getFolder(id) { return mkFolder(String(id).split('/').pop(), id); },
  };
}

function fakeFormClient(publishedIds) {
  const set = publishedIds || new Set();
  return {
    isPublished: id => set.has(id),
    publish: id => set.add(id),
    getPublishedUrl: id => `viewform://${id}`,
    setTitle: () => {},
    _published: set,
  };
}

module.exports = { DIR, read, load, installGasStubs, fakeDrive, fakeFormClient,
                   mkTrig, resetLog,
                   getLog: () => LOG,
                   getTriggers: () => TRIGGERS,
                   setTriggers: t => { TRIGGERS = t; } };
